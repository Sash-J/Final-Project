"""Phase 2 Finance Engine: Double-entry posting, voids/reversals, settlements, and single-pass queries."""

from datetime import date, datetime, timedelta
from decimal import Decimal
import hashlib
import json
import uuid

from .database import get_connection
from .finance_migrations import (
    DEFAULT_BASE_CURRENCY,
    DEFAULT_ENTITY_CODE,
    apply_period_balance_delta,
    ensure_fiscal_period,
)
from .finance_validation import (
    DOC_TYPE_REGISTRY,
    parse_iso_date,
    parse_optional_int,
    validate_account_payload,
    validate_counterparty_payload,
    validate_settlement_payload,
    validate_voucher_payload,
)


def _d(val):
    return Decimal(str(val or 0)).quantize(Decimal("0.01"))


def _f(val):
    return round(float(val or 0), 2)


def _date_iso(val):
    if val is None:
        return None
    if isinstance(val, (date, datetime)):
        return val.strftime("%Y-%m-%d")
    return str(val)[:10]


def _serialize_rows(rows):
    out = []
    for row in rows:
        item = {}
        for k, v in row.items():
            if isinstance(v, Decimal):
                item[k] = float(v)
            elif isinstance(v, datetime):
                item[k] = v.isoformat()
            elif isinstance(v, date):
                item[k] = v.strftime("%Y-%m-%d")
            else:
                item[k] = v
        out.append(item)
    return out


def _get_entity_and_accounts(cursor):
    cursor.execute(
        "SELECT id, code, name, base_currency FROM finance_entities WHERE code = %s",
        (DEFAULT_ENTITY_CODE,),
    )
    entity = cursor.fetchone()
    if not entity:
        raise ValueError("Default finance entity has not been initialized.")

    entity_id = entity["id"]
    cursor.execute(
        """
        SELECT id, parent_id, code, name, account_class, sub_type, normal_balance,
               allow_direct_posting, is_system, is_active
        FROM finance_accounts
        WHERE entity_id = %s
        ORDER BY code ASC
        """,
        (entity_id,),
    )
    accounts = cursor.fetchall()
    by_id = {a["id"]: a for a in accounts}
    by_code = {a["code"]: a for a in accounts}

    cursor.execute(
        """
        SELECT id, gl_account_id, account_kind, bank_name, account_label,
               account_number_masked, currency_code, opening_balance, is_default
        FROM finance_bank_accounts
        WHERE entity_id = %s AND is_active = 1
        ORDER BY is_default DESC, id ASC
        """,
        (entity_id,),
    )
    banks = cursor.fetchall()
    return entity, accounts, by_id, by_code, banks


def _resolve_default_settlement_account(validated, by_code, banks):
    """Pick specified cash/bank settlement GL account or fallback based on payment_method."""
    if validated.get("settlement_account_id"):
        return validated["settlement_account_id"], validated.get("bank_account_id")

    bank_id = validated.get("bank_account_id")
    if bank_id:
        for b in banks:
            if b["id"] == bank_id:
                return b["gl_account_id"], b["id"]

    is_cash = str(validated.get("payment_method") or "").strip().lower() == "cash"
    target_kind = "petty_cash" if is_cash else "checking"
    for b in banks:
        if b["account_kind"] == target_kind:
            return b["gl_account_id"], b["id"]
    if banks:
        return banks[0]["gl_account_id"], banks[0]["id"]

    fallback_code = "1010" if is_cash else "1020"
    acct = by_code.get(fallback_code) or by_code.get("1020") or by_code.get("1010")
    return (acct["id"] if acct else None), None


def _generate_voucher_no(cursor, entity_id, doc_type, tx_date):
    prefix = DOC_TYPE_REGISTRY[doc_type]["prefix"]
    ym = tx_date.strftime("%Y%m")
    like_pattern = f"{prefix}-{ym}-%"
    cursor.execute(
        "SELECT COUNT(*) AS cnt FROM finance_transactions WHERE entity_id = %s AND voucher_no LIKE %s",
        (entity_id, like_pattern),
    )
    seq = int(cursor.fetchone()["cnt"] or 0) + 1
    candidate = f"{prefix}-{ym}-{seq:04d}"
    cursor.execute("SELECT id FROM finance_transactions WHERE voucher_no = %s", (candidate,))
    if cursor.fetchone():
        candidate = f"{prefix}-{ym}-{uuid.uuid4().hex[:6].upper()}"
    return candidate


def _assert_open_period(cursor, entity_id, tx_date):
    period_id = ensure_fiscal_period(cursor, entity_id, tx_date)
    cursor.execute("SELECT id, period_code, status FROM finance_fiscal_periods WHERE id = %s", (period_id,))
    period = cursor.fetchone()
    if not period:
        raise ValueError("Unable to resolve fiscal period for transaction date.")
    if period["status"] != "open":
        raise ValueError(
            f"Fiscal period {period['period_code']} is '{period['status']}' and cannot accept new postings."
        )
    return period_id


def _compile_lines_and_ledger_legs(validated, accounts_by_id, accounts_by_code, default_settle_acct_id):
    """Compile normalized transaction_lines AND balanced double-entry ledger legs."""
    doc_type = validated["doc_type"]
    scope = validated["scope"]
    lines = validated["lines"]
    ledger_legs = []

    def _check_postable(acct_id, label="Account"):
        acct = accounts_by_id.get(acct_id)
        if not acct or not acct["is_active"]:
            raise ValueError(f"{label} (ID {acct_id}) does not exist or is inactive.")
        if not acct["allow_direct_posting"]:
            raise ValueError(f"{label} '{acct['code']} {acct['name']}' is a summary header and cannot accept direct postings.")
        return acct

    # Mode A: Explicit compound debit/credit lines (journal, payroll, depreciation, notes)
    if lines and all(ln["debit"] > 0 or ln["credit"] > 0 for ln in lines):
        sum_dr = sum(ln["debit"] for ln in lines)
        sum_cr = sum(ln["credit"] for ln in lines)
        if sum_dr <= 0 or sum_dr != sum_cr:
            raise ValueError(f"Unbalanced voucher legs: debits ({sum_dr}) must equal credits ({sum_cr}).")
        for idx, ln in enumerate(lines):
            _check_postable(ln["account_id"], f"Line #{ln['line_no']} account")
            ledger_legs.append(
                {
                    "line_index": idx,
                    "account_id": ln["account_id"],
                    "scope": scope,
                    "project_id": ln["project_id"],
                    "department_id": ln["department_id"],
                    "person_user_id": ln["person_user_id"],
                    "counterparty_id": validated.get("counterparty_id"),
                    "debit": ln["debit"],
                    "credit": ln["credit"],
                    "memo": ln["description"],
                }
            )
        return lines, ledger_legs, sum_dr

    # Mode B & C: Build normalized business lines if single-form submitted, then auto-generate balanced GL legs
    if not lines:
        amt = validated["amount"]
        default_acct_code = {
            "expense": "5010" if scope == "project" else "6010",
            "income": "4010" if scope == "project" else "4020",
            "drawing": "3020",
            "capital": "3010",
            "invoice_ar": "4010" if scope == "project" else "4020",
            "bill_ap": "5010" if scope == "project" else "6010",
            "transfer": None,
        }.get(doc_type)

        if doc_type == "transfer":
            line_acct_id = validated["destination_account_id"]
        else:
            line_acct_id = validated.get("category_account_id") or (
                accounts_by_code[default_acct_code]["id"] if default_acct_code in accounts_by_code else None
            )
        if not line_acct_id:
            raise ValueError("Unable to resolve primary ledger account for this transaction.")

        lines = [
            {
                "line_no": 1,
                "account_id": line_acct_id,
                "tax_code_id": None,
                "project_id": validated["primary_project_id"] if scope == "project" else None,
                "department_id": validated.get("department_id"),
                "budget_item_id": validated.get("budget_item_id"),
                "person_user_id": validated.get("primary_user_id"),
                "cost_center_code": None,
                "description": validated["description"],
                "quantity": Decimal("1.000"),
                "unit_price": amt,
                "tax_amount": Decimal("0.00"),
                "line_total": amt,
                "debit": Decimal("0.00"),
                "credit": Decimal("0.00"),
                "side": None,
            }
        ]

    # Pick counterbalancing settlement / control GL account
    if doc_type == "invoice_ar":
        counter_acct_id = accounts_by_code["1100"]["id"]
    elif doc_type == "bill_ap":
        counter_acct_id = accounts_by_code["2010"]["id"]
    elif doc_type in ("expense", "income", "drawing", "capital", "transfer"):
        if doc_type == "expense" and validated.get("settlement_mode") == "credit":
            counter_acct_id = accounts_by_code["2010"]["id"]
        elif doc_type == "income" and validated.get("settlement_mode") == "credit":
            counter_acct_id = accounts_by_code["1100"]["id"]
        else:
            counter_acct_id = default_settle_acct_id
    else:
        counter_acct_id = default_settle_acct_id

    _check_postable(counter_acct_id, "Settlement / Control account")
    total_amount = Decimal("0.00")

    for idx, ln in enumerate(lines):
        acct = _check_postable(ln["account_id"], f"Line #{ln['line_no']} account")
        amt = ln["line_total"]
        total_amount += amt

        if doc_type == "drawing" and acct["account_class"] != "drawings":
            raise ValueError("Drawing vouchers must debit a Drawings account (e.g., 3020 Owner Drawings).")
        if doc_type == "capital" and acct["sub_type"] != "capital":
            raise ValueError("Capital vouchers must credit a Paid-In Capital equity account (e.g., 3010).")

        if doc_type in ("expense", "bill_ap", "drawing", "transfer"):
            # Debit destination/expense/drawing line, credit cash/bank/AP control
            ledger_legs.append(
                {
                    "line_index": idx,
                    "account_id": ln["account_id"],
                    "scope": scope,
                    "project_id": ln["project_id"],
                    "department_id": ln["department_id"],
                    "person_user_id": ln["person_user_id"],
                    "counterparty_id": validated.get("counterparty_id"),
                    "debit": amt,
                    "credit": Decimal("0.00"),
                    "memo": ln["description"],
                }
            )
            ledger_legs.append(
                {
                    "line_index": idx,
                    "account_id": counter_acct_id,
                    "scope": scope,
                    "project_id": ln["project_id"],
                    "department_id": ln["department_id"],
                    "person_user_id": ln["person_user_id"],
                    "counterparty_id": validated.get("counterparty_id"),
                    "debit": Decimal("0.00"),
                    "credit": amt,
                    "memo": ln["description"],
                }
            )
        elif doc_type in ("income", "invoice_ar", "capital"):
            # Debit cash/bank/AR control, credit revenue/capital line
            ledger_legs.append(
                {
                    "line_index": idx,
                    "account_id": counter_acct_id,
                    "scope": scope,
                    "project_id": ln["project_id"],
                    "department_id": ln["department_id"],
                    "person_user_id": ln["person_user_id"],
                    "counterparty_id": validated.get("counterparty_id"),
                    "debit": amt,
                    "credit": Decimal("0.00"),
                    "memo": ln["description"],
                }
            )
            ledger_legs.append(
                {
                    "line_index": idx,
                    "account_id": ln["account_id"],
                    "scope": scope,
                    "project_id": ln["project_id"],
                    "department_id": ln["department_id"],
                    "person_user_id": ln["person_user_id"],
                    "counterparty_id": validated.get("counterparty_id"),
                    "debit": Decimal("0.00"),
                    "credit": amt,
                    "memo": ln["description"],
                }
            )
        else:
            raise ValueError(f"Unsupported automated leg compilation for doc_type '{doc_type}'.")

    return lines, ledger_legs, total_amount.quantize(Decimal("0.01"))


def _insert_ledger_and_rollups(cursor, entity_id, fiscal_period_id, tx_id, tx_date, currency_code, ledger_legs, line_ids):
    total_dr = sum(leg["debit"] for leg in ledger_legs)
    total_cr = sum(leg["credit"] for leg in ledger_legs)
    if total_dr <= 0 or total_dr != total_cr:
        raise ValueError(f"Double-entry invariant violation: debits ({total_dr}) != credits ({total_cr}).")

    for leg in ledger_legs:
        line_id = line_ids[leg["line_index"]] if leg.get("line_index") is not None and leg["line_index"] < len(line_ids) else None
        cursor.execute(
            """
            INSERT INTO finance_ledger_entries (
                entity_id, fiscal_period_id, transaction_id, transaction_line_id,
                entry_date, account_id, scope, project_id, department_id,
                person_user_id, counterparty_id, debit, credit,
                currency_code, fx_debit, fx_credit, memo
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                entity_id,
                fiscal_period_id,
                tx_id,
                line_id,
                tx_date,
                leg["account_id"],
                leg["scope"],
                leg["project_id"],
                leg["department_id"],
                leg["person_user_id"],
                leg["counterparty_id"],
                leg["debit"],
                leg["credit"],
                currency_code,
                leg["debit"],
                leg["credit"],
                (leg["memo"] or "")[:255],
            ),
        )
        apply_period_balance_delta(
            cursor,
            entity_id,
            fiscal_period_id,
            leg["account_id"],
            leg["scope"],
            leg["project_id"],
            leg["person_user_id"],
            leg["debit"],
            leg["credit"],
        )


def post_voucher(raw_payload, actor_user_id=None, can_approve=True):
    """Create and optionally post a validated double-entry finance voucher."""
    validated = validate_voucher_payload(raw_payload)
    _ = can_approve  # Posting workflow gate may be tightened in future approval policy settings

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        entity, _, accounts_by_id, accounts_by_code, banks = _get_entity_and_accounts(cursor)
        entity_id = entity["id"]
        fiscal_period_id = _assert_open_period(cursor, entity_id, validated["tx_date"])

        settle_acct_id, bank_acct_id = _resolve_default_settlement_account(validated, accounts_by_code, banks)
        compiled_lines, ledger_legs, total_amount = _compile_lines_and_ledger_legs(
            validated, accounts_by_id, accounts_by_code, settle_acct_id
        )

        # Verify optional foreign keys exist before insertion for clean 400 error responses
        if validated["primary_project_id"]:
            cursor.execute("SELECT id FROM projects WHERE id = %s", (validated["primary_project_id"],))
            if not cursor.fetchone():
                raise ValueError(f"Project ID {validated['primary_project_id']} was not found.")
        if validated["primary_user_id"]:
            cursor.execute("SELECT id FROM users WHERE id = %s", (validated["primary_user_id"],))
            if not cursor.fetchone():
                raise ValueError(f"User ID {validated['primary_user_id']} was not found.")
        if validated["counterparty_id"]:
            cursor.execute("SELECT id FROM finance_counterparties WHERE id = %s AND entity_id = %s", (validated["counterparty_id"], entity_id))
            if not cursor.fetchone():
                raise ValueError(f"Counterparty ID {validated['counterparty_id']} was not found.")

        voucher_no = _generate_voucher_no(cursor, entity_id, validated["doc_type"], validated["tx_date"])
        is_posted = validated["status"] == "posted"
        is_open_item = validated["doc_type"] in ("invoice_ar", "bill_ap")
        settled_amount = Decimal("0.00") if is_open_item else total_amount

        cursor.execute(
            """
            INSERT INTO finance_transactions (
                entity_id, fiscal_period_id, voucher_no, doc_type, scope,
                primary_project_id, primary_user_id, counterparty_id,
                settlement_account_id, bank_account_id,
                tx_date, due_date, currency_code, exchange_rate,
                subtotal_amount, tax_amount, total_amount, settled_amount,
                payment_method, bank_ref, status, description, notes,
                created_by, approved_by, approved_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, 0.00, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s
            )
            """,
            (
                entity_id,
                fiscal_period_id,
                voucher_no,
                validated["doc_type"],
                validated["scope"],
                validated["primary_project_id"],
                validated["primary_user_id"],
                validated["counterparty_id"],
                settle_acct_id,
                bank_acct_id,
                validated["tx_date"],
                validated["due_date"],
                validated["currency_code"],
                validated["exchange_rate"],
                total_amount,
                total_amount,
                settled_amount if is_posted else Decimal("0.00"),
                validated["payment_method"],
                validated["bank_ref"],
                validated["status"],
                validated["description"],
                validated["notes"],
                actor_user_id,
                actor_user_id if is_posted else None,
                datetime.utcnow() if is_posted else None,
            ),
        )
        tx_id = cursor.lastrowid

        line_ids = []
        for ln in compiled_lines:
            cursor.execute(
                """
                INSERT INTO finance_transaction_lines (
                    transaction_id, line_no, account_id, tax_code_id,
                    project_id, department_id, budget_item_id, person_user_id,
                    cost_center_code, description, quantity, unit_price, tax_amount, line_total
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    tx_id,
                    ln["line_no"],
                    ln["account_id"],
                    ln["tax_code_id"],
                    ln["project_id"],
                    ln["department_id"],
                    ln["budget_item_id"],
                    ln["person_user_id"],
                    ln["cost_center_code"],
                    ln["description"],
                    ln["quantity"],
                    ln["unit_price"],
                    ln["tax_amount"],
                    ln["line_total"],
                ),
            )
            line_ids.append(cursor.lastrowid)

        if is_posted:
            _insert_ledger_and_rollups(
                cursor,
                entity_id,
                fiscal_period_id,
                tx_id,
                validated["tx_date"],
                validated["currency_code"],
                ledger_legs,
                line_ids,
            )

        for att in validated["attachments"]:
            checksum = hashlib.sha256(att["payload"].encode("utf-8")).hexdigest()
            cursor.execute(
                """
                INSERT INTO finance_attachments (
                    entity_type, entity_id, file_name, mime_type, byte_size,
                    storage_driver, payload, checksum_sha256, uploaded_by
                ) VALUES ('transaction', %s, %s, %s, %s, 'db_blob', %s, %s, %s)
                """,
                (tx_id, att["file_name"], att["mime_type"], att["byte_size"], att["payload"], checksum, actor_user_id),
            )

        cursor.execute(
            """
            INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, after_json)
            VALUES ('finance_transaction', %s, %s, %s, %s)
            """,
            (
                tx_id,
                "POST_VOUCHER" if is_posted else "SAVE_DRAFT",
                actor_user_id,
                json.dumps(
                    {
                        "voucher_no": voucher_no,
                        "doc_type": validated["doc_type"],
                        "scope": validated["scope"],
                        "total_amount": str(total_amount),
                        "status": validated["status"],
                        "leg_count": len(ledger_legs),
                    }
                ),
            ),
        )
        conn.commit()
        return {
            "id": tx_id,
            "voucher_no": voucher_no,
            "status": validated["status"],
            "total_amount": float(total_amount),
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def approve_post_voucher(tx_id, actor_user_id=None):
    """Approve and post an existing 'draft' voucher into the double-entry GL."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM finance_transactions WHERE id = %s FOR UPDATE", (tx_id,))
        tx = cursor.fetchone()
        if not tx:
            raise ValueError("Transaction not found.")
        if tx["status"] != "draft":
            raise ValueError(f"Only 'draft' transactions can be posted (current status: '{tx['status']}').")

        fiscal_period_id = _assert_open_period(cursor, tx["entity_id"], tx["tx_date"])
        _, _, accounts_by_id, accounts_by_code, banks = _get_entity_and_accounts(cursor)

        cursor.execute(
            "SELECT * FROM finance_transaction_lines WHERE transaction_id = %s ORDER BY line_no ASC",
            (tx_id,),
        )
        raw_lines = cursor.fetchall()
        if not raw_lines:
            raise ValueError("Transaction has no lines to post.")

        # Reconstruct validated shape to reuse exact balanced compiler
        line_payloads = []
        for ln in raw_lines:
            line_payloads.append(
                {
                    "line_no": ln["line_no"],
                    "account_id": ln["account_id"],
                    "tax_code_id": ln["tax_code_id"],
                    "project_id": ln["project_id"],
                    "department_id": ln["department_id"],
                    "budget_item_id": ln["budget_item_id"],
                    "person_user_id": ln["person_user_id"],
                    "cost_center_code": ln["cost_center_code"],
                    "description": ln["description"],
                    "quantity": Decimal(str(ln["quantity"])),
                    "unit_price": Decimal(str(ln["unit_price"])),
                    "tax_amount": Decimal(str(ln["tax_amount"])),
                    "line_total": Decimal(str(ln["line_total"])),
                    "debit": Decimal("0.00"),
                    "credit": Decimal("0.00"),
                    "side": None,
                }
            )

        pseudo_validated = {
            "doc_type": tx["doc_type"],
            "scope": tx["scope"],
            "primary_project_id": tx["primary_project_id"],
            "primary_user_id": tx["primary_user_id"],
            "counterparty_id": tx["counterparty_id"],
            "settlement_account_id": tx["settlement_account_id"],
            "bank_account_id": tx["bank_account_id"],
            "payment_method": tx["payment_method"],
            "description": tx["description"],
            "lines": line_payloads,
            "settlement_mode": "immediate",
        }
        settle_acct_id, _ = _resolve_default_settlement_account(pseudo_validated, accounts_by_code, banks)
        _, ledger_legs, total_amount = _compile_lines_and_ledger_legs(
            pseudo_validated, accounts_by_id, accounts_by_code, settle_acct_id
        )

        line_ids = [ln["id"] for ln in raw_lines]
        _insert_ledger_and_rollups(
            cursor,
            tx["entity_id"],
            fiscal_period_id,
            tx_id,
            tx["tx_date"],
            tx["currency_code"],
            ledger_legs,
            line_ids,
        )

        settled_amt = Decimal("0.00") if tx["doc_type"] in ("invoice_ar", "bill_ap") else total_amount
        cursor.execute(
            """
            UPDATE finance_transactions
            SET status = 'posted', fiscal_period_id = %s, settled_amount = %s,
                approved_by = %s, approved_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (fiscal_period_id, settled_amt, actor_user_id, tx_id),
        )
        cursor.execute(
            """
            INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, before_json, after_json)
            VALUES ('finance_transaction', %s, 'APPROVE_POST', %s, %s, %s)
            """,
            (
                tx_id,
                actor_user_id,
                json.dumps({"status": "draft"}),
                json.dumps({"status": "posted", "voucher_no": tx["voucher_no"]}),
            ),
        )
        conn.commit()
        return {"id": tx_id, "voucher_no": tx["voucher_no"], "status": "posted"}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def void_voucher(tx_id, actor_user_id=None, void_reason=""):
    """Safely void a draft or create an immutable balanced reversal entry for a posted voucher."""
    clean_reason = str(void_reason or "").strip()[:255]
    if len(clean_reason) < 3:
        raise ValueError("A void_reason of at least 3 characters is required for audit compliance.")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM finance_transactions WHERE id = %s FOR UPDATE", (tx_id,))
        tx = cursor.fetchone()
        if not tx:
            raise ValueError("Transaction not found.")
        if tx["status"] == "voided":
            raise ValueError("Transaction is already voided.")
        if tx.get("source_table") == "payments":
            raise ValueError("Payment-mirrored records are synchronized from Project Payments and should be updated there.")
        if tx.get("reversal_of_tx_id"):
            raise ValueError("Reversal vouchers cannot themselves be voided.")
        if tx["doc_type"] in ("invoice_ar", "bill_ap") and _d(tx.get("settled_amount")) > Decimal("0.00"):
            raise ValueError("Cannot void an invoice or bill that already has settlements; void the settlement voucher first.")

        if tx["status"] == "draft":
            cursor.execute(
                """
                UPDATE finance_transactions
                SET status = 'voided', voided_by = %s, voided_at = CURRENT_TIMESTAMP, void_reason = %s
                WHERE id = %s
                """,
                (actor_user_id, clean_reason, tx_id),
            )
            cursor.execute(
                """
                INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, before_json, after_json)
                VALUES ('finance_transaction', %s, 'VOID_DRAFT', %s, %s, %s)
                """,
                (tx_id, actor_user_id, json.dumps({"status": "draft"}), json.dumps({"status": "voided", "reason": clean_reason})),
            )
            conn.commit()
            return {"id": tx_id, "status": "voided", "reversal_tx_id": None}

        reversal_date = date.today()
        fiscal_period_id = _assert_open_period(cursor, tx["entity_id"], reversal_date)

        cursor.execute("SELECT * FROM finance_ledger_entries WHERE transaction_id = %s ORDER BY id ASC", (tx_id,))
        orig_entries = cursor.fetchall()
        if not orig_entries:
            raise ValueError("No ledger entries found to reverse.")

        rev_voucher = f"REV-{tx['voucher_no']}"[:36]
        cursor.execute("SELECT id FROM finance_transactions WHERE voucher_no = %s", (rev_voucher,))
        if cursor.fetchone():
            rev_voucher = f"REV-{tx_id}-{uuid.uuid4().hex[:6].upper()}"[:36]

        cursor.execute(
            """
            INSERT INTO finance_transactions (
                entity_id, fiscal_period_id, voucher_no, doc_type, scope,
                primary_project_id, primary_user_id, counterparty_id,
                settlement_account_id, bank_account_id,
                tx_date, currency_code, exchange_rate,
                subtotal_amount, tax_amount, total_amount, settled_amount,
                payment_method, status, description, notes,
                reversal_of_tx_id, created_by, approved_by, approved_at
            ) VALUES (
                %s, %s, %s, 'journal', %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, 'posted', %s, %s,
                %s, %s, %s, CURRENT_TIMESTAMP
            )
            """,
            (
                tx["entity_id"],
                fiscal_period_id,
                rev_voucher,
                tx["scope"],
                tx["primary_project_id"],
                tx["primary_user_id"],
                tx["counterparty_id"],
                tx["settlement_account_id"],
                tx["bank_account_id"],
                reversal_date,
                tx["currency_code"],
                tx["exchange_rate"],
                tx["subtotal_amount"],
                tx["tax_amount"],
                tx["total_amount"],
                tx["total_amount"],
                tx["payment_method"],
                f"Reversal of {tx['voucher_no']}: {clean_reason}"[:255],
                f"Automated void reversal for voucher #{tx['voucher_no']}.",
                tx_id,
                actor_user_id,
                actor_user_id,
            ),
        )
        rev_tx_id = cursor.lastrowid

        rev_legs = []
        for entry in orig_entries:
            deb = _d(entry["credit"])
            cred = _d(entry["debit"])
            rev_legs.append(
                {
                    "line_index": None,
                    "account_id": entry["account_id"],
                    "scope": entry["scope"],
                    "project_id": entry["project_id"],
                    "department_id": entry["department_id"],
                    "person_user_id": entry["person_user_id"],
                    "counterparty_id": entry["counterparty_id"],
                    "debit": deb,
                    "credit": cred,
                    "memo": f"Void Reversal ({tx['voucher_no']}): {clean_reason}"[:255],
                }
            )

        _insert_ledger_and_rollups(
            cursor,
            tx["entity_id"],
            fiscal_period_id,
            rev_tx_id,
            reversal_date,
            tx["currency_code"],
            rev_legs,
            [],
        )

        cursor.execute(
            """
            UPDATE finance_transactions
            SET status = 'voided', voided_by = %s, voided_at = CURRENT_TIMESTAMP, void_reason = %s
            WHERE id = %s
            """,
            (actor_user_id, clean_reason, tx_id),
        )
        # If voiding a settlement voucher, restore parent open balance/status and clear allocation link
        if tx["doc_type"] == "settlement" and tx.get("parent_tx_id"):
            cursor.execute("SELECT * FROM finance_transactions WHERE id = %s FOR UPDATE", (tx["parent_tx_id"],))
            parent_tx = cursor.fetchone()
            if parent_tx:
                reverted_settled = max(Decimal("0.00"), _d(parent_tx["settled_amount"]) - _d(tx["total_amount"]))
                parent_status = "posted" if reverted_settled <= Decimal("0.00") else (
                    "settled" if reverted_settled >= _d(parent_tx["total_amount"]) else "partial"
                )
                cursor.execute(
                    "UPDATE finance_transactions SET settled_amount = %s, status = %s WHERE id = %s",
                    (reverted_settled, parent_status, parent_tx["id"]),
                )
            cursor.execute("DELETE FROM finance_settlements WHERE settlement_tx_id = %s", (tx_id,))
        cursor.execute(
            """
            INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, before_json, after_json)
            VALUES ('finance_transaction', %s, 'VOID_REVERSAL', %s, %s, %s)
            """,
            (
                tx_id,
                actor_user_id,
                json.dumps({"status": tx["status"], "voucher_no": tx["voucher_no"]}),
                json.dumps({"status": "voided", "reversal_tx_id": rev_tx_id, "reversal_voucher": rev_voucher, "reason": clean_reason}),
            ),
        )
        conn.commit()
        return {"id": tx_id, "status": "voided", "reversal_tx_id": rev_tx_id, "reversal_voucher": rev_voucher}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def settle_counterparty_transaction(raw_payload, actor_user_id=None):
    """Apply a partial or full cash/bank settlement against an open AR invoice or AP bill."""
    validated = validate_settlement_payload(raw_payload)
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM finance_transactions WHERE id = %s FOR UPDATE", (validated["target_tx_id"],))
        target = cursor.fetchone()
        if not target:
            raise ValueError("Target debtor/creditor document not found.")
        if target["doc_type"] not in ("invoice_ar", "bill_ap"):
            raise ValueError("Only AR invoices ('invoice_ar') and AP bills ('bill_ap') can be settled.")
        if target["status"] in ("draft", "voided", "settled"):
            raise ValueError(f"Cannot settle transaction with status '{target['status']}'.")

        total_amt = _d(target["total_amount"])
        already_settled = _d(target["settled_amount"])
        remaining = total_amt - already_settled
        pay_amt = validated["amount"]
        if pay_amt > remaining:
            raise ValueError(f"Settlement amount ({pay_amt}) exceeds remaining balance ({remaining}).")

        entity, _, accounts_by_id, accounts_by_code, banks = _get_entity_and_accounts(cursor)
        entity_id = target["entity_id"]
        fiscal_period_id = _assert_open_period(cursor, entity_id, validated["settlement_date"])
        settle_acct_id, bank_acct_id = _resolve_default_settlement_account(validated, accounts_by_code, banks)
        if not settle_acct_id or not accounts_by_id.get(settle_acct_id):
            raise ValueError("Valid cash or bank settlement account is required.")

        ar_id = accounts_by_code["1100"]["id"]
        ap_id = accounts_by_code["2010"]["id"]
        is_ar = target["doc_type"] == "invoice_ar"
        control_acct_id = ar_id if is_ar else ap_id

        voucher_no = _generate_voucher_no(cursor, entity_id, "settlement", validated["settlement_date"])
        desc = f"{'AR Receipt' if is_ar else 'AP Settlement'} for {target['voucher_no']}"
        cursor.execute(
            """
            INSERT INTO finance_transactions (
                entity_id, fiscal_period_id, voucher_no, doc_type, scope,
                primary_project_id, primary_user_id, counterparty_id,
                settlement_account_id, bank_account_id,
                tx_date, currency_code, exchange_rate,
                subtotal_amount, tax_amount, total_amount, settled_amount,
                payment_method, bank_ref, status, description, notes,
                parent_tx_id, created_by, approved_by, approved_at
            ) VALUES (
                %s, %s, %s, 'settlement', %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, 0.00, %s, %s,
                %s, %s, 'posted', %s, %s,
                %s, %s, %s, CURRENT_TIMESTAMP
            )
            """,
            (
                entity_id,
                fiscal_period_id,
                voucher_no,
                target["scope"],
                target["primary_project_id"],
                target["primary_user_id"],
                target["counterparty_id"],
                settle_acct_id,
                bank_acct_id,
                validated["settlement_date"],
                target["currency_code"],
                target["exchange_rate"],
                pay_amt,
                pay_amt,
                pay_amt,
                validated["payment_method"],
                validated["bank_ref"],
                desc,
                validated["notes"],
                target["id"],
                actor_user_id,
                actor_user_id,
            ),
        )
        stl_tx_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO finance_transaction_lines (
                transaction_id, line_no, account_id, project_id, person_user_id,
                description, quantity, unit_price, tax_amount, line_total
            ) VALUES (%s, 1, %s, %s, %s, %s, 1.000, %s, 0.00, %s)
            """,
            (stl_tx_id, control_acct_id, target["primary_project_id"], target["primary_user_id"], desc, pay_amt, pay_amt),
        )
        line_id = cursor.lastrowid

        if is_ar:
            # Debit Cash/Bank, Credit AR 1100
            legs = [
                {
                    "line_index": 0, "account_id": settle_acct_id, "scope": target["scope"],
                    "project_id": target["primary_project_id"], "department_id": None,
                    "person_user_id": target["primary_user_id"], "counterparty_id": target["counterparty_id"],
                    "debit": pay_amt, "credit": Decimal("0.00"), "memo": desc,
                },
                {
                    "line_index": 0, "account_id": control_acct_id, "scope": target["scope"],
                    "project_id": target["primary_project_id"], "department_id": None,
                    "person_user_id": target["primary_user_id"], "counterparty_id": target["counterparty_id"],
                    "debit": Decimal("0.00"), "credit": pay_amt, "memo": desc,
                },
            ]
        else:
            # Debit AP 2010, Credit Cash/Bank
            legs = [
                {
                    "line_index": 0, "account_id": control_acct_id, "scope": target["scope"],
                    "project_id": target["primary_project_id"], "department_id": None,
                    "person_user_id": target["primary_user_id"], "counterparty_id": target["counterparty_id"],
                    "debit": pay_amt, "credit": Decimal("0.00"), "memo": desc,
                },
                {
                    "line_index": 0, "account_id": settle_acct_id, "scope": target["scope"],
                    "project_id": target["primary_project_id"], "department_id": None,
                    "person_user_id": target["primary_user_id"], "counterparty_id": target["counterparty_id"],
                    "debit": Decimal("0.00"), "credit": pay_amt, "memo": desc,
                },
            ]

        _insert_ledger_and_rollups(
            cursor, entity_id, fiscal_period_id, stl_tx_id, validated["settlement_date"], target["currency_code"], legs, [line_id]
        )

        cursor.execute(
            """
            INSERT INTO finance_settlements (entity_id, target_tx_id, settlement_tx_id, amount, settlement_date, notes, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (entity_id, target["id"], stl_tx_id, pay_amt, validated["settlement_date"], validated["notes"], actor_user_id),
        )

        new_settled = already_settled + pay_amt
        new_status = "settled" if new_settled >= total_amt else "partial"
        cursor.execute(
            "UPDATE finance_transactions SET settled_amount = %s, status = %s WHERE id = %s",
            (new_settled, new_status, target["id"]),
        )
        cursor.execute(
            """
            INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, before_json, after_json)
            VALUES ('finance_transaction', %s, 'SETTLEMENT_ALLOCATED', %s, %s, %s)
            """,
            (
                target["id"],
                actor_user_id,
                json.dumps({"settled_amount": str(already_settled), "status": target["status"]}),
                json.dumps({"settled_amount": str(new_settled), "status": new_status, "settlement_tx_id": stl_tx_id}),
            ),
        )
        conn.commit()
        return {
            "target_tx_id": target["id"],
            "settlement_tx_id": stl_tx_id,
            "voucher_no": voucher_no,
            "settled_amount": float(new_settled),
            "remaining_balance": float(total_amt - new_settled),
            "target_status": new_status,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def create_account(raw_payload, actor_user_id=None):
    """Add an extensible Chart of Accounts item without modifying database schema."""
    cleaned = validate_account_payload(raw_payload, is_update=False)
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        entity, _, accounts_by_id, accounts_by_code, _ = _get_entity_and_accounts(cursor)
        entity_id = entity["id"]
        if cleaned["code"] in accounts_by_code:
            raise ValueError(f"Account code '{cleaned['code']}' already exists.")

        parent_id = cleaned.get("parent_id")
        hierarchy_path = cleaned["code"]
        if parent_id:
            parent = accounts_by_id.get(parent_id)
            if not parent:
                raise ValueError("Parent account not found.")
            hierarchy_path = f"{parent['hierarchy_path']}/{cleaned['code']}"

        cursor.execute(
            """
            INSERT INTO finance_accounts (
                entity_id, parent_id, code, name, account_class, sub_type,
                normal_balance, hierarchy_path, description, is_system, allow_direct_posting, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
            """,
            (
                entity_id,
                parent_id,
                cleaned["code"],
                cleaned["name"],
                cleaned["account_class"],
                cleaned.get("sub_type", "general"),
                cleaned["normal_balance"],
                hierarchy_path,
                cleaned.get("description"),
                cleaned.get("allow_direct_posting", 1),
                cleaned.get("is_active", 1),
            ),
        )
        new_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, after_json)
            VALUES ('finance_account', %s, 'CREATE_ACCOUNT', %s, %s)
            """,
            (new_id, actor_user_id, json.dumps(cleaned)),
        )
        conn.commit()
        return {"id": new_id, **cleaned}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def update_account(account_id, raw_payload, actor_user_id=None):
    """Update Chart of Accounts metadata while safeguarding system account codes/classes."""
    cleaned = validate_account_payload(raw_payload, is_update=True)
    if not cleaned:
        raise ValueError("No valid fields supplied to update.")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM finance_accounts WHERE id = %s FOR UPDATE", (account_id,))
        acct = cursor.fetchone()
        if not acct:
            raise ValueError("Account not found.")
        if acct["is_system"] and ("code" in cleaned or "account_class" in cleaned or cleaned.get("is_active") == 0):
            raise ValueError("System control accounts cannot change code, class, or be deactivated.")

        fields = []
        params = []
        for col in ("code", "name", "account_class", "sub_type", "normal_balance", "parent_id", "description", "allow_direct_posting", "is_active"):
            if col in cleaned:
                fields.append(f"{col} = %s")
                params.append(cleaned[col])
        params.append(account_id)
        cursor.execute(f"UPDATE finance_accounts SET {', '.join(fields)} WHERE id = %s", tuple(params))
        cursor.execute(
            """
            INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, before_json, after_json)
            VALUES ('finance_account', %s, 'UPDATE_ACCOUNT', %s, %s, %s)
            """,
            (account_id, actor_user_id, json.dumps({"name": acct["name"], "is_active": acct["is_active"]}), json.dumps(cleaned)),
        )
        conn.commit()
        return {"id": account_id, **cleaned}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def create_counterparty(raw_payload, actor_user_id=None):
    """Create a Debtor/Creditor counterparty record cleanly."""
    cleaned = validate_counterparty_payload(raw_payload)
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM finance_entities WHERE code = %s", (DEFAULT_ENTITY_CODE,))
        ent = cursor.fetchone()
        entity_id = ent["id"]
        if cleaned["user_id"]:
            cursor.execute("SELECT id FROM users WHERE id = %s", (cleaned["user_id"],))
            if not cursor.fetchone():
                raise ValueError("Linked user account not found.")

        cursor.execute(
            """
            INSERT INTO finance_counterparties (
                entity_id, user_id, party_type, name, email, phone, tax_id,
                payment_terms_days, credit_limit, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
            """,
            (
                entity_id,
                cleaned["user_id"],
                cleaned["party_type"],
                cleaned["name"],
                cleaned["email"],
                cleaned["phone"],
                cleaned["tax_id"],
                cleaned["payment_terms_days"],
                cleaned["credit_limit"],
            ),
        )
        new_id = cursor.lastrowid
        conn.commit()
        return {"id": new_id, **{k: float(v) if isinstance(v, Decimal) else v for k, v in cleaned.items()}}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def _load_taxonomy_with_cursor(cursor):
    entity, accounts, _, _, banks = _get_entity_and_accounts(cursor)
    entity_id = entity["id"]

    # Combine remaining 5 taxonomy queries into 1 single database roundtrip (keeps X-DB-Queries < 10)
    batch_sql = """
        SELECT id, code, name, rate_pct, tax_direction, is_recoverable, is_active
        FROM finance_tax_codes
        WHERE entity_id = %s AND is_active = 1
        ORDER BY code ASC;

        SELECT id, user_id, party_type, name, email, phone, payment_terms_days, credit_limit
        FROM finance_counterparties
        WHERE entity_id = %s AND is_active = 1
        ORDER BY name ASC;

        SELECT id, project_name, code_name, status, client_name
        FROM projects
        ORDER BY id DESC;

        SELECT id, username, COALESCE(full_name, username) AS full_name, role, email
        FROM users
        WHERE is_approved = 1
        ORDER BY full_name ASC;

        SELECT id, period_code, period_name, fiscal_year, start_date, end_date, status
        FROM finance_fiscal_periods
        WHERE entity_id = %s
        ORDER BY period_code DESC
        LIMIT 36;
    """
    result_sets = cursor.execute(batch_sql, (entity_id, entity_id, entity_id), multi=True)
    tax_codes = _serialize_rows(next(result_sets).fetchall())
    counterparties = _serialize_rows(next(result_sets).fetchall())
    projects = _serialize_rows(next(result_sets).fetchall())
    users = _serialize_rows(next(result_sets).fetchall())
    periods = _serialize_rows(next(result_sets).fetchall())

    return {
        "entity": {
            "id": entity["id"],
            "code": entity["code"],
            "name": entity["name"],
            "base_currency": entity["base_currency"],
        },
        "accounts": _serialize_rows(accounts),
        "bank_accounts": _serialize_rows(banks),
        "tax_codes": tax_codes,
        "counterparties": counterparties,
        "projects": projects,
        "users": users,
        "fiscal_periods": periods,
        "doc_types": [
            {"code": k, "label": v["label"], "prefix": v["prefix"]}
            for k, v in DOC_TYPE_REGISTRY.items()
        ],
    }


def get_finance_taxonomy():
    """Return master taxonomy lists cleanly in 1 DB connection."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        return _load_taxonomy_with_cursor(cursor)
    finally:
        cursor.close()
        conn.close()


def _timeframe_start_date(timeframe):
    tf = str(timeframe or "6M").strip().upper()
    today = date.today()
    days_map = {"1M": 30, "3M": 92, "6M": 183, "1Y": 366}
    if tf in days_map:
        return today - timedelta(days=days_map[tf]), tf
    return None, "ALL"


def get_finance_workspace_init(scope="all", timeframe="6M", can_view_personal=True):
    """Batched single-pass workspace bootstrap payload (Trick #9: Fewer Requests, <= 9 queries on 1 conn)."""
    req_scope = str(scope or "all").strip().lower()
    if req_scope not in ("all", "project", "company", "personal"):
        req_scope = "all"
    if not can_view_personal:
        req_scope = "project"

    start_dt, normalized_tf = _timeframe_start_date(timeframe)
    scope_clause = "" if req_scope == "all" else " AND fle.scope = %s"
    date_clause = " AND fle.entry_date >= %s" if start_dt else ""
    params = []
    if req_scope != "all":
        params.append(req_scope)
    if start_dt:
        params.append(start_dt)

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Query 1: Executive KPIs + Bucket Rollups (income, cogs/expense, drawings, capital, assets/AR/AP)
        cursor.execute(
            f"""
            SELECT
                COALESCE(SUM(CASE WHEN fa.account_class = 'income' THEN fle.credit - fle.debit ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN fa.account_class IN ('cogs', 'expense') THEN fle.debit - fle.credit ELSE 0 END), 0) AS total_expenses,
                COALESCE(SUM(CASE WHEN fa.account_class = 'drawings' THEN fle.debit - fle.credit ELSE 0 END), 0) AS total_drawings,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'capital' THEN fle.credit - fle.debit ELSE 0 END), 0) AS total_capital,
                COALESCE(SUM(CASE WHEN fa.sub_type IN ('cash', 'bank') THEN fle.debit - fle.credit ELSE 0 END), 0) AS ledger_cash_balance,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'ar' THEN fle.debit - fle.credit ELSE 0 END), 0) AS ar_balance,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'ap' THEN fle.credit - fle.debit ELSE 0 END), 0) AS ap_balance
            FROM finance_ledger_entries fle
            JOIN finance_accounts fa ON fa.id = fle.account_id
            WHERE 1=1 {scope_clause} {date_clause}
            """,
            tuple(params),
        )
        kpi = cursor.fetchone() or {}

        # Query 2: Trajectory Monthly Series + Bucket Voucher Counts
        cursor.execute(
            f"""
            SELECT
                DATE_FORMAT(fle.entry_date, '%Y-%m') AS month_key,
                COALESCE(SUM(CASE WHEN fa.account_class = 'income' THEN fle.credit - fle.debit ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN fa.account_class IN ('cogs', 'expense') THEN fle.debit - fle.credit ELSE 0 END), 0) AS expenses,
                COALESCE(SUM(CASE WHEN fa.account_class = 'drawings' THEN fle.debit - fle.credit ELSE 0 END), 0) AS drawings,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'capital' THEN fle.credit - fle.debit ELSE 0 END), 0) AS capital
            FROM finance_ledger_entries fle
            JOIN finance_accounts fa ON fa.id = fle.account_id
            WHERE 1=1 {scope_clause} {date_clause}
            GROUP BY DATE_FORMAT(fle.entry_date, '%Y-%m')
            ORDER BY month_key ASC
            """,
            tuple(params),
        )
        chart_rows = cursor.fetchall()
        trajectory = []
        for row in chart_rows:
            inc = float(row["income"] or 0)
            exp = float(row["expenses"] or 0)
            trajectory.append(
                {
                    "month": row["month_key"],
                    "income": round(inc, 2),
                    "expenses": round(exp, 2),
                    "drawings": round(float(row["drawings"] or 0), 2),
                    "capital": round(float(row["capital"] or 0), 2),
                    "net_profit": round(inc - exp, 2),
                }
            )

        # Query 3: Watchlist Projects + Budget Baseline (Single-Pass Derived Joins)
        cursor.execute(
            """
            SELECT
                p.id, p.project_name, p.code_name, p.status,
                COALESCE(lbv.quoted_total, 0) AS quoted_client_total,
                COALESCE(lbv.direct_cost, 0) AS budgeted_direct_cost,
                COALESCE(pay.total_paid, 0) AS total_paid,
                COALESCE(led.actual_income, 0) AS actual_income,
                COALESCE(led.actual_expense, 0) AS actual_expense
            FROM projects p
            LEFT JOIN (
                SELECT bv.project_id, SUM(pbv.total) AS quoted_total, SUM(pbv.gross_revenue) AS direct_cost
                FROM budget_versions bv
                JOIN (SELECT project_id, MAX(version_number) AS max_ver FROM budget_versions GROUP BY project_id) m
                  ON bv.project_id = m.project_id AND bv.version_number = m.max_ver
                JOIN project_budget_values pbv ON pbv.version_id = bv.id
                GROUP BY bv.project_id
            ) lbv ON lbv.project_id = p.id
            LEFT JOIN (
                SELECT project_id, SUM(amount) AS total_paid FROM payments GROUP BY project_id
            ) pay ON pay.project_id = p.id
            LEFT JOIN (
                SELECT
                    fle.project_id,
                    SUM(CASE WHEN fa.account_class = 'income' THEN fle.credit - fle.debit ELSE 0 END) AS actual_income,
                    SUM(CASE WHEN fa.account_class IN ('cogs', 'expense') THEN fle.debit - fle.credit ELSE 0 END) AS actual_expense
                FROM finance_ledger_entries fle
                JOIN finance_accounts fa ON fa.id = fle.account_id
                WHERE fle.project_id IS NOT NULL
                GROUP BY fle.project_id
            ) led ON led.project_id = p.id
            ORDER BY p.id DESC
            LIMIT 8
            """
        )
        watch_projects = []
        for p in cursor.fetchall():
            quoted = float(p["quoted_client_total"] or 0)
            paid = float(p["total_paid"] or 0)
            act_inc = float(p["actual_income"] or 0)
            act_exp = float(p["actual_expense"] or 0)
            watch_projects.append(
                {
                    "id": p["id"],
                    "project_name": p["project_name"],
                    "code_name": p["code_name"],
                    "status": p["status"],
                    "quoted_client_total": quoted,
                    "budgeted_direct_cost": float(p["budgeted_direct_cost"] or 0),
                    "total_paid": paid,
                    "outstanding_budget": round(quoted - paid, 2),
                    "actual_income": act_inc,
                    "actual_expense": act_exp,
                    "net_margin": round(act_inc - act_exp, 2),
                }
            )

        # Query 4: Accountable Bucket Voucher Counts + Pending AR/AP Open Watchlist
        cursor.execute(
            f"""
            SELECT
                doc_type,
                COUNT(*) AS tx_count,
                COALESCE(SUM(total_amount), 0) AS total_amount
            FROM finance_transactions
            WHERE status IN ('posted', 'partial', 'settled')
              {"" if req_scope == "all" else "AND scope = %s"}
              {"" if can_view_personal else "AND doc_type NOT IN ('drawing', 'capital')"}
            GROUP BY doc_type
            """,
            (() if req_scope == "all" else (req_scope,)),
        )
        bucket_rows = {r["doc_type"]: r for r in cursor.fetchall()}

        # Query 5: Open AR / AP Watchlist Items (strictly scoped if user lacks personal/company visibility)
        open_items_where = "AND ft.scope = 'project'" if not can_view_personal else ""
        cursor.execute(
            f"""
            SELECT
                ft.id, ft.voucher_no, ft.doc_type, ft.scope, ft.tx_date, ft.due_date,
                ft.total_amount, ft.settled_amount, (ft.total_amount - ft.settled_amount) AS balance,
                ft.status, ft.description,
                COALESCE(fc.name, p.client_name, u.full_name, 'Unassigned') AS party_name
            FROM finance_transactions ft
            LEFT JOIN finance_counterparties fc ON fc.id = ft.counterparty_id
            LEFT JOIN projects p ON p.id = ft.primary_project_id
            LEFT JOIN users u ON u.id = ft.primary_user_id
            WHERE ft.doc_type IN ('invoice_ar', 'bill_ap')
              AND ft.status IN ('posted', 'partial')
              {open_items_where}
            ORDER BY ft.due_date IS NULL, ft.due_date ASC, ft.id DESC
            LIMIT 10
            """
        )
        open_items = _serialize_rows(cursor.fetchall())

        # Keep total queries <= 9 by loading core taxonomy selectively (reusing single connection)
        taxonomy = _load_taxonomy_with_cursor(cursor)

        total_inc = float(kpi.get("total_income") or 0)
        total_exp = float(kpi.get("total_expenses") or 0)
        total_drw = float(kpi.get("total_drawings") or 0) if can_view_personal else 0.0
        total_cap = float(kpi.get("total_capital") or 0) if can_view_personal else 0.0
        opening_cash = sum(float(b["opening_balance"] or 0) for b in taxonomy["bank_accounts"])
        cash_bal = opening_cash + float(kpi.get("ledger_cash_balance") or 0)

        return {
            "scope": req_scope,
            "timeframe": normalized_tf,
            "can_view_personal": can_view_personal,
            "summary": {
                "total_income": round(total_inc, 2),
                "total_expenses": round(total_exp, 2),
                "net_profit": round(total_inc - total_exp, 2),
                "total_drawings": round(total_drw, 2),
                "total_capital": round(total_cap, 2),
                "cash_balance": round(cash_bal, 2),
                "ar_balance": round(float(kpi.get("ar_balance") or 0), 2),
                "ap_balance": round(float(kpi.get("ap_balance") or 0), 2),
                "quoted_client_total": round(sum(p["quoted_client_total"] for p in watch_projects), 2),
                "total_collections": round(sum(p["total_paid"] for p in watch_projects), 2),
            },
            "buckets": {
                k: {
                    "count": int(bucket_rows.get(k, {}).get("tx_count") or 0),
                    "total": round(float(bucket_rows.get(k, {}).get("total_amount") or 0), 2),
                }
                for k in ("income", "expense", "drawing", "capital")
                if can_view_personal or k not in ("drawing", "capital")
            },
            "watchlist": {
                "projects": watch_projects,
                "debtors": [x for x in open_items if x["doc_type"] == "invoice_ar"][:6],
                "creditors": [x for x in open_items if x["doc_type"] == "bill_ap"][:6],
            },
            "trajectory": trajectory,
            "taxonomy": taxonomy,
        }
    finally:
        cursor.close()
        conn.close()


def get_transactions_ledger(filters, can_view_personal=True):
    """Query paginated accountable transaction headers with project/scope/search filters."""
    where = ["1=1"]
    params = []

    if not can_view_personal:
        where.append("ft.scope = 'project' AND ft.doc_type NOT IN ('drawing', 'capital')")

    doc_type = str(filters.get("doc_type") or "").strip().lower()
    if doc_type and doc_type != "all":
        where.append("ft.doc_type = %s")
        params.append(doc_type)

    scope = str(filters.get("scope") or "").strip().lower()
    if scope and scope != "all":
        where.append("ft.scope = %s")
        params.append(scope)

    status = str(filters.get("status") or "").strip().lower()
    if status and status != "all":
        where.append("ft.status = %s")
        params.append(status)

    proj_id = parse_optional_int(filters.get("project_id"), "project_id")
    if proj_id:
        where.append("ft.primary_project_id = %s")
        params.append(proj_id)

    person_id = parse_optional_int(filters.get("person_user_id"), "person_user_id")
    if person_id:
        where.append("ft.primary_user_id = %s")
        params.append(person_id)

    date_from = parse_iso_date(filters.get("date_from"), "date_from", required=False)
    if date_from:
        where.append("ft.tx_date >= %s")
        params.append(date_from)

    date_to = parse_iso_date(filters.get("date_to"), "date_to", required=False)
    if date_to:
        where.append("ft.tx_date <= %s")
        params.append(date_to)

    search = str(filters.get("search") or "").strip()[:100]
    if search:
        like_q = f"%{search}%"
        where.append(
            "(ft.voucher_no LIKE %s OR ft.description LIKE %s OR COALESCE(ft.bank_ref, '') LIKE %s OR COALESCE(p.project_name, '') LIKE %s OR COALESCE(fc.name, '') LIKE %s OR COALESCE(u.full_name, '') LIKE %s)"
        )
        params.extend([like_q, like_q, like_q, like_q, like_q, like_q])

    page = max(1, int(filters.get("page") or 1))
    per_page = min(100, max(10, int(filters.get("per_page") or 50)))
    offset = (page - 1) * per_page

    where_sql = " AND ".join(where)
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM finance_transactions ft
            LEFT JOIN projects p ON p.id = ft.primary_project_id
            LEFT JOIN finance_counterparties fc ON fc.id = ft.counterparty_id
            LEFT JOIN users u ON u.id = ft.primary_user_id
            WHERE {where_sql}
            """,
            tuple(params),
        )
        total = int(cursor.fetchone()["total"] or 0)

        cursor.execute(
            f"""
            SELECT
                ft.id, ft.voucher_no, ft.doc_type, ft.scope, ft.tx_date, ft.due_date,
                ft.currency_code, ft.total_amount, ft.settled_amount,
                (ft.total_amount - ft.settled_amount) AS balance,
                ft.payment_method, ft.bank_ref, ft.status, ft.description, ft.source_table, ft.source_id,
                ft.primary_project_id, p.project_name, p.code_name AS project_code,
                ft.primary_user_id, COALESCE(u.full_name, u.username) AS person_name,
                ft.counterparty_id, fc.name AS counterparty_name,
                fa.code AS settlement_account_code, fa.name AS settlement_account_name,
                (SELECT COUNT(*) FROM finance_attachments fatt WHERE fatt.entity_type = 'transaction' AND fatt.entity_id = ft.id) AS attachment_count
            FROM finance_transactions ft
            LEFT JOIN projects p ON p.id = ft.primary_project_id
            LEFT JOIN users u ON u.id = ft.primary_user_id
            LEFT JOIN finance_counterparties fc ON fc.id = ft.counterparty_id
            LEFT JOIN finance_accounts fa ON fa.id = ft.settlement_account_id
            WHERE {where_sql}
            ORDER BY ft.tx_date DESC, ft.id DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [per_page, offset]),
        )
        rows = _serialize_rows(cursor.fetchall())
        return {
            "items": rows,
            "pagination": {"page": page, "per_page": per_page, "total": total},
        }
    finally:
        cursor.close()
        conn.close()


def get_transaction_detail(tx_id, can_view_personal=True):
    """Fetch complete voucher header, N lines, GL entries, attachments, and audit trail."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT ft.*, p.project_name, fc.name AS counterparty_name,
                   COALESCE(u.full_name, u.username) AS person_name,
                   cb.username AS created_by_username,
                   ab.username AS approved_by_username
            FROM finance_transactions ft
            LEFT JOIN projects p ON p.id = ft.primary_project_id
            LEFT JOIN finance_counterparties fc ON fc.id = ft.counterparty_id
            LEFT JOIN users u ON u.id = ft.primary_user_id
            LEFT JOIN users cb ON cb.id = ft.created_by
            LEFT JOIN users ab ON ab.id = ft.approved_by
            WHERE ft.id = %s
            """,
            (tx_id,),
        )
        tx = cursor.fetchone()
        if not tx:
            return None
        if not can_view_personal and (tx["scope"] != "project" or tx["doc_type"] in ("drawing", "capital")):
            raise PermissionError("Forbidden: missing permission to view company/personal transactions.")

        cursor.execute(
            """
            SELECT ftl.*, fa.code AS account_code, fa.name AS account_name, fa.account_class,
                   p.project_name, d.department_name, bi.item_name AS budget_item_name,
                   COALESCE(u.full_name, u.username) AS person_name
            FROM finance_transaction_lines ftl
            JOIN finance_accounts fa ON fa.id = ftl.account_id
            LEFT JOIN projects p ON p.id = ftl.project_id
            LEFT JOIN departments d ON d.id = ftl.department_id
            LEFT JOIN budget_items bi ON bi.id = ftl.budget_item_id
            LEFT JOIN users u ON u.id = ftl.person_user_id
            WHERE ftl.transaction_id = %s
            ORDER BY ftl.line_no ASC
            """,
            (tx_id,),
        )
        lines = _serialize_rows(cursor.fetchall())

        cursor.execute(
            """
            SELECT fle.*, fa.code AS account_code, fa.name AS account_name, fa.account_class
            FROM finance_ledger_entries fle
            JOIN finance_accounts fa ON fa.id = fle.account_id
            WHERE fle.transaction_id = %s
            ORDER BY fle.id ASC
            """,
            (tx_id,),
        )
        gl_entries = _serialize_rows(cursor.fetchall())

        cursor.execute(
            """
            SELECT id, file_name, mime_type, byte_size, payload, created_at
            FROM finance_attachments
            WHERE entity_type = 'transaction' AND entity_id = %s
            ORDER BY id ASC
            """,
            (tx_id,),
        )
        attachments = _serialize_rows(cursor.fetchall())

        cursor.execute(
            """
            SELECT fal.id, fal.action, fal.before_json, fal.after_json, fal.created_at,
                   COALESCE(u.full_name, u.username, 'System') AS actor_name
            FROM finance_audit_logs fal
            LEFT JOIN users u ON u.id = fal.actor_user_id
            WHERE fal.entity_type = 'finance_transaction' AND fal.entity_id = %s
            ORDER BY fal.id DESC
            """,
            (tx_id,),
        )
        audit_logs = _serialize_rows(cursor.fetchall())

        return {
            "transaction": _serialize_rows([tx])[0],
            "lines": lines,
            "ledger_entries": gl_entries,
            "attachments": attachments,
            "audit_logs": audit_logs,
        }
    finally:
        cursor.close()
        conn.close()


def get_general_ledger_entries(filters, can_view_personal=True):
    """Fetch filtered paginated double-entry General Ledger postings with period totals."""
    where = ["1=1"]
    params = []
    if not can_view_personal:
        where.append("fle.scope = 'project' AND fa.account_class NOT IN ('drawings', 'equity')")

    account_id = parse_optional_int(filters.get("account_id"), "account_id")
    if account_id:
        where.append("fle.account_id = %s")
        params.append(account_id)

    proj_id = parse_optional_int(filters.get("project_id"), "project_id")
    if proj_id:
        where.append("fle.project_id = %s")
        params.append(proj_id)

    scope = str(filters.get("scope") or "").strip().lower()
    if scope and scope != "all":
        where.append("fle.scope = %s")
        params.append(scope)

    date_from = parse_iso_date(filters.get("date_from"), "date_from", required=False)
    if date_from:
        where.append("fle.entry_date >= %s")
        params.append(date_from)

    date_to = parse_iso_date(filters.get("date_to"), "date_to", required=False)
    if date_to:
        where.append("fle.entry_date <= %s")
        params.append(date_to)

    page = max(1, int(filters.get("page") or 1))
    per_page = min(100, max(10, int(filters.get("per_page") or 50)))
    offset = (page - 1) * per_page
    where_sql = " AND ".join(where)

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS total,
                   COALESCE(SUM(fle.debit), 0) AS total_debit,
                   COALESCE(SUM(fle.credit), 0) AS total_credit
            FROM finance_ledger_entries fle
            JOIN finance_accounts fa ON fa.id = fle.account_id
            WHERE {where_sql}
            """,
            tuple(params),
        )
        totals = cursor.fetchone() or {}

        cursor.execute(
            f"""
            SELECT
                fle.id, fle.entry_date, fle.transaction_id, ft.voucher_no, ft.doc_type,
                fle.scope, fle.debit, fle.credit, fle.memo,
                fa.id AS account_id, fa.code AS account_code, fa.name AS account_name, fa.account_class,
                p.project_name, COALESCE(u.full_name, u.username) AS person_name,
                fc.name AS counterparty_name
            FROM finance_ledger_entries fle
            JOIN finance_transactions ft ON ft.id = fle.transaction_id
            JOIN finance_accounts fa ON fa.id = fle.account_id
            LEFT JOIN projects p ON p.id = fle.project_id
            LEFT JOIN users u ON u.id = fle.person_user_id
            LEFT JOIN finance_counterparties fc ON fc.id = fle.counterparty_id
            WHERE {where_sql}
            ORDER BY fle.entry_date DESC, fle.id DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [per_page, offset]),
        )
        rows = _serialize_rows(cursor.fetchall())
        return {
            "items": rows,
            "totals": {
                "total_debit": _f(totals.get("total_debit")),
                "total_credit": _f(totals.get("total_credit")),
            },
            "pagination": {"page": page, "per_page": per_page, "total": int(totals.get("total") or 0)},
        }
    finally:
        cursor.close()
        conn.close()


def get_project_finances(project_id=None):
    """Single-pass per-project scorecard + optional deep-dive department/personal/ledger breakdown."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        proj_filter = "WHERE p.id = %s" if project_id else ""
        params = (project_id,) if project_id else ()
        cursor.execute(
            f"""
            SELECT
                p.id, p.project_name, p.code_name, p.client_name, p.status, p.start_date, p.end_date,
                COALESCE(lbv.quoted_total, 0) AS quoted_client_total,
                COALESCE(lbv.direct_cost, 0) AS budgeted_direct_cost,
                COALESCE(pay.total_paid, 0) AS payments_received,
                COALESCE(led.actual_income, 0) AS actual_income,
                COALESCE(led.actual_expense, 0) AS actual_expense,
                COALESCE(led.ar_open, 0) AS open_ar,
                COALESCE(led.ap_open, 0) AS open_ap,
                COALESCE(st.stakeholder_count, 0) AS stakeholder_count
            FROM projects p
            LEFT JOIN (
                SELECT bv.project_id, SUM(pbv.total) AS quoted_total, SUM(pbv.gross_revenue) AS direct_cost
                FROM budget_versions bv
                JOIN (SELECT project_id, MAX(version_number) AS max_ver FROM budget_versions GROUP BY project_id) m
                  ON bv.project_id = m.project_id AND bv.version_number = m.max_ver
                JOIN project_budget_values pbv ON pbv.version_id = bv.id
                GROUP BY bv.project_id
            ) lbv ON lbv.project_id = p.id
            LEFT JOIN (
                SELECT project_id, SUM(amount) AS total_paid FROM payments GROUP BY project_id
            ) pay ON pay.project_id = p.id
            LEFT JOIN (
                SELECT
                    fle.project_id,
                    SUM(CASE WHEN fa.account_class = 'income' THEN fle.credit - fle.debit ELSE 0 END) AS actual_income,
                    SUM(CASE WHEN fa.account_class IN ('cogs', 'expense') THEN fle.debit - fle.credit ELSE 0 END) AS actual_expense,
                    SUM(CASE WHEN fa.sub_type = 'ar' THEN fle.debit - fle.credit ELSE 0 END) AS ar_open,
                    SUM(CASE WHEN fa.sub_type = 'ap' THEN fle.credit - fle.debit ELSE 0 END) AS ap_open
                FROM finance_ledger_entries fle
                JOIN finance_accounts fa ON fa.id = fle.account_id
                WHERE fle.project_id IS NOT NULL
                GROUP BY fle.project_id
            ) led ON led.project_id = p.id
            LEFT JOIN (
                SELECT project_id, COUNT(DISTINCT user_id) AS stakeholder_count FROM crew_projects GROUP BY project_id
            ) st ON st.project_id = p.id
            {proj_filter}
            ORDER BY p.id DESC
            """,
            params,
        )
        scorecard = []
        for r in cursor.fetchall():
            quoted = float(r["quoted_client_total"] or 0)
            direct_b = float(r["budgeted_direct_cost"] or 0)
            paid = float(r["payments_received"] or 0)
            act_inc = float(r["actual_income"] or 0)
            act_exp = float(r["actual_expense"] or 0)
            scorecard.append(
                {
                    "id": r["id"],
                    "project_name": r["project_name"],
                    "code_name": r["code_name"],
                    "client_name": r["client_name"],
                    "status": r["status"],
                    "start_date": _date_iso(r["start_date"]),
                    "end_date": _date_iso(r["end_date"]),
                    "quoted_client_total": quoted,
                    "budgeted_direct_cost": direct_b,
                    "projected_margin": round(quoted - direct_b, 2),
                    "payments_received": paid,
                    "receivable_balance": round(quoted - paid, 2),
                    "actual_income": act_inc,
                    "actual_expense": act_exp,
                    "actual_net_margin": round(act_inc - act_exp, 2),
                    "budget_variance": round(direct_b - act_exp, 2),
                    "open_ar": float(r["open_ar"] or 0),
                    "open_ap": float(r["open_ap"] or 0),
                    "stakeholder_count": int(r["stakeholder_count"] or 0),
                }
            )

        if not project_id:
            return {"projects": scorecard}

        if not scorecard:
            return None

        # Deep-dive queries for selected project_id (still <= 4 total queries on 1 conn)
        cursor.execute(
            """
            SELECT
                d.id AS department_id,
                d.department_name,
                COALESCE(SUM(pbv.gross_revenue), 0) AS budgeted_cost,
                COALESCE(SUM(pbv.total), 0) AS budgeted_total,
                COALESCE(act.actual_expense, 0) AS actual_expense
            FROM departments d
            LEFT JOIN categories c ON c.department_id = d.id
            LEFT JOIN budget_items bi ON bi.category_id = c.id
            LEFT JOIN (
                SELECT pbv.*
                FROM project_budget_values pbv
                JOIN budget_versions bv ON bv.id = pbv.version_id
                JOIN (SELECT project_id, MAX(version_number) AS max_ver FROM budget_versions WHERE project_id = %s GROUP BY project_id) m
                  ON bv.project_id = m.project_id AND bv.version_number = m.max_ver
            ) pbv ON pbv.budget_item_id = bi.id
            LEFT JOIN (
                SELECT
                    ftl.department_id,
                    SUM(ftl.line_total) AS actual_expense
                FROM finance_transaction_lines ftl
                JOIN finance_transactions ft ON ft.id = ftl.transaction_id
                JOIN finance_accounts fa ON fa.id = ftl.account_id
                WHERE ftl.project_id = %s
                  AND ft.status IN ('posted', 'partial', 'settled')
                  AND fa.account_class IN ('cogs', 'expense')
                GROUP BY ftl.department_id
            ) act ON act.department_id = d.id
            GROUP BY d.id, d.department_name, act.actual_expense
            HAVING budgeted_cost > 0 OR budgeted_total > 0 OR actual_expense > 0
            ORDER BY d.sort_order ASC, d.id ASC
            """,
            (project_id, project_id),
        )
        dept_variance = _serialize_rows(cursor.fetchall())

        cursor.execute(
            """
            SELECT
                u.id AS user_id,
                COALESCE(u.full_name, u.username) AS full_name,
                u.role,
                COALESCE(SUM(CASE WHEN fa.account_class IN ('cogs', 'expense') THEN fle.debit - fle.credit ELSE 0 END), 0) AS incurred_fees,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'ap' THEN fle.credit - fle.debit ELSE 0 END), 0) AS payable_balance,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'advance' THEN fle.debit - fle.credit ELSE 0 END), 0) AS advance_balance,
                COALESCE(SUM(CASE WHEN fa.account_class = 'drawings' THEN fle.debit - fle.credit ELSE 0 END), 0) AS drawings
            FROM finance_ledger_entries fle
            JOIN users u ON u.id = fle.person_user_id
            JOIN finance_accounts fa ON fa.id = fle.account_id
            WHERE fle.project_id = %s
            GROUP BY u.id, u.full_name, u.username, u.role
            ORDER BY full_name ASC
            """,
            (project_id,),
        )
        personal_statuses = _serialize_rows(cursor.fetchall())

        return {
            "project": scorecard[0],
            "department_variance": dept_variance,
            "personal_statuses": personal_statuses,
        }
    finally:
        cursor.close()
        conn.close()


def get_company_finances(date_from=None, date_to=None):
    """Company-scoped financial status, bank/cash balances, overhead, capital & drawings isolation."""
    d_from = parse_iso_date(date_from, "date_from", required=False)
    d_to = parse_iso_date(date_to, "date_to", required=False)
    date_where = ""
    params = []
    if d_from:
        date_where += " AND fle.entry_date >= %s"
        params.append(d_from)
    if d_to:
        date_where += " AND fle.entry_date <= %s"
        params.append(d_to)

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Query 1: Bank & Cash Vault Live Balances (all scopes reflect real physical bank balance)
        cursor.execute(
            """
            SELECT
                ba.id, ba.account_kind, ba.bank_name, ba.account_label, ba.currency_code, ba.opening_balance,
                fa.code AS gl_code,
                (ba.opening_balance + COALESCE(SUM(fle.debit - fle.credit), 0)) AS current_balance
            FROM finance_bank_accounts ba
            JOIN finance_accounts fa ON fa.id = ba.gl_account_id
            LEFT JOIN finance_ledger_entries fle ON fle.account_id = ba.gl_account_id
            WHERE ba.is_active = 1
            GROUP BY ba.id, ba.account_kind, ba.bank_name, ba.account_label, ba.currency_code, ba.opening_balance, fa.code
            ORDER BY ba.is_default DESC, ba.id ASC
            """
        )
        bank_accounts = _serialize_rows(cursor.fetchall())

        # Query 2: Company Overhead, Non-Project Income, Capital & Drawings Breakdown
        cursor.execute(
            f"""
            SELECT
                fa.id AS account_id, fa.code, fa.name, fa.account_class, fa.sub_type,
                COALESCE(SUM(fle.debit), 0) AS debit,
                COALESCE(SUM(fle.credit), 0) AS credit
            FROM finance_ledger_entries fle
            JOIN finance_accounts fa ON fa.id = fle.account_id
            WHERE (
                (fle.scope = 'company' AND fa.account_class IN ('income', 'expense', 'cogs'))
                OR fa.account_class = 'drawings'
                OR fa.sub_type = 'capital'
            ) {date_where}
            GROUP BY fa.id, fa.code, fa.name, fa.account_class, fa.sub_type
            ORDER BY fa.code ASC
            """,
            tuple(params),
        )
        breakdown = []
        company_income = 0.0
        company_overhead = 0.0
        owner_capital = 0.0
        owner_drawings = 0.0
        for r in cursor.fetchall():
            deb = float(r["debit"] or 0)
            cred = float(r["credit"] or 0)
            cls = r["account_class"]
            net = round(cred - deb if cls in ("income", "equity") else deb - cred, 2)
            if cls == "income":
                company_income += net
            elif cls in ("expense", "cogs"):
                company_overhead += net
            elif r["sub_type"] == "capital":
                owner_capital += net
            elif cls == "drawings":
                owner_drawings += net
            breakdown.append(
                {
                    "account_id": r["account_id"],
                    "code": r["code"],
                    "name": r["name"],
                    "account_class": cls,
                    "sub_type": r["sub_type"],
                    "net_amount": net,
                }
            )

        # Query 3: Firm liquidity control totals (Cash + AR - AP)
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN fa.sub_type = 'ar' THEN fle.debit - fle.credit ELSE 0 END), 0) AS total_ar,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'ap' THEN fle.credit - fle.debit ELSE 0 END), 0) AS total_ap
            FROM finance_ledger_entries fle
            JOIN finance_accounts fa ON fa.id = fle.account_id
            """
        )
        liq = cursor.fetchone() or {}
        total_cash = sum(float(b["current_balance"] or 0) for b in bank_accounts)
        total_ar = float(liq.get("total_ar") or 0)
        total_ap = float(liq.get("total_ap") or 0)

        return {
            "bank_accounts": bank_accounts,
            "summary": {
                "total_cash": round(total_cash, 2),
                "company_income": round(company_income, 2),
                "company_overhead": round(company_overhead, 2),
                "company_net_operating": round(company_income - company_overhead, 2),
                "owner_capital": round(owner_capital, 2),
                "owner_drawings": round(owner_drawings, 2),
                "net_owner_equity_flow": round(owner_capital - owner_drawings, 2),
                "total_ar": round(total_ar, 2),
                "total_ap": round(total_ap, 2),
                "net_liquidity": round(total_cash + total_ar - total_ap, 2),
            },
            "breakdown": breakdown,
        }
    finally:
        cursor.close()
        conn.close()


def get_personal_finances(person_user_id=None, project_id=None):
    """Per-person and optional per-project financial status (Capital, Drawings, Advances, Crew Payables)."""
    where = ["fle.person_user_id IS NOT NULL"]
    params = []
    if person_user_id:
        where.append("fle.person_user_id = %s")
        params.append(int(person_user_id))
    if project_id:
        where.append("fle.project_id = %s")
        params.append(int(project_id))

    where_sql = " AND ".join(where)
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Query 1: Overall per-person rollup across Directors / Crew / Partners
        cursor.execute(
            f"""
            SELECT
                u.id AS user_id,
                u.username,
                COALESCE(u.full_name, u.username) AS full_name,
                u.role,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'capital' THEN fle.credit - fle.debit ELSE 0 END), 0) AS capital_contributed,
                COALESCE(SUM(CASE WHEN fa.account_class = 'drawings' THEN fle.debit - fle.credit ELSE 0 END), 0) AS drawings_taken,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'advance' THEN fle.debit - fle.credit ELSE 0 END), 0) AS advances_owed,
                COALESCE(SUM(CASE WHEN fa.account_class IN ('cogs', 'expense') THEN fle.debit - fle.credit ELSE 0 END), 0) AS fees_earned_or_expensed,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'ap' THEN fle.credit - fle.debit ELSE 0 END), 0) AS payables_unpaid
            FROM finance_ledger_entries fle
            JOIN users u ON u.id = fle.person_user_id
            JOIN finance_accounts fa ON fa.id = fle.account_id
            WHERE {where_sql}
            GROUP BY u.id, u.username, u.full_name, u.role
            ORDER BY full_name ASC
            """,
            tuple(params),
        )
        people = []
        for r in cursor.fetchall():
            cap = float(r["capital_contributed"] or 0)
            drw = float(r["drawings_taken"] or 0)
            adv = float(r["advances_owed"] or 0)
            pay = float(r["payables_unpaid"] or 0)
            people.append(
                {
                    "user_id": r["user_id"],
                    "username": r["username"],
                    "full_name": r["full_name"],
                    "role": r["role"],
                    "capital_contributed": cap,
                    "drawings_taken": drw,
                    "net_equity_balance": round(cap - drw, 2),
                    "advances_owed": adv,
                    "fees_incurred": float(r["fees_earned_or_expensed"] or 0),
                    "payables_unpaid": pay,
                    "net_settlement_position": round(pay - adv, 2),
                }
            )

        # Query 2: Per-person x per-project breakdown so each project shows exact personal financial statuses
        cursor.execute(
            f"""
            SELECT
                fle.person_user_id AS user_id,
                COALESCE(u.full_name, u.username) AS full_name,
                p.id AS project_id,
                COALESCE(p.project_name, 'Company / General') AS project_name,
                p.code_name AS project_code,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'capital' THEN fle.credit - fle.debit ELSE 0 END), 0) AS capital_contributed,
                COALESCE(SUM(CASE WHEN fa.account_class = 'drawings' THEN fle.debit - fle.credit ELSE 0 END), 0) AS drawings_taken,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'advance' THEN fle.debit - fle.credit ELSE 0 END), 0) AS advances_owed,
                COALESCE(SUM(CASE WHEN fa.account_class IN ('cogs', 'expense') THEN fle.debit - fle.credit ELSE 0 END), 0) AS fees_incurred,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'ap' THEN fle.credit - fle.debit ELSE 0 END), 0) AS payables_unpaid
            FROM finance_ledger_entries fle
            JOIN users u ON u.id = fle.person_user_id
            JOIN finance_accounts fa ON fa.id = fle.account_id
            LEFT JOIN projects p ON p.id = fle.project_id
            WHERE {where_sql}
            GROUP BY fle.person_user_id, full_name, p.id, p.project_name, p.code_name
            ORDER BY full_name ASC, project_name ASC
            """,
            tuple(params),
        )
        by_project = _serialize_rows(cursor.fetchall())

        return {
            "people": people,
            "by_project": by_project,
        }
    finally:
        cursor.close()
        conn.close()


def get_debtors_creditors(party_filter="all"):
    """Return open AR (Debtors) and AP (Creditors) with SQL aging buckets."""
    doc_filter = {
        "debtors": "('invoice_ar')",
        "creditors": "('bill_ap')",
    }.get(str(party_filter or "all").lower(), "('invoice_ar', 'bill_ap')")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            f"""
            SELECT
                ft.id, ft.voucher_no, ft.doc_type, ft.scope, ft.tx_date, ft.due_date,
                ft.total_amount, ft.settled_amount,
                (ft.total_amount - ft.settled_amount) AS balance,
                ft.status, ft.description,
                DATEDIFF(CURDATE(), COALESCE(ft.due_date, ft.tx_date)) AS days_past_due,
                p.id AS project_id, p.project_name,
                fc.id AS counterparty_id,
                COALESCE(fc.name, p.client_name, u.full_name, 'General Counterparty') AS party_name,
                COALESCE(fc.party_type, CASE WHEN ft.doc_type = 'invoice_ar' THEN 'client' ELSE 'vendor' END) AS party_type
            FROM finance_transactions ft
            LEFT JOIN finance_counterparties fc ON fc.id = ft.counterparty_id
            LEFT JOIN projects p ON p.id = ft.primary_project_id
            LEFT JOIN users u ON u.id = ft.primary_user_id
            WHERE ft.doc_type IN {doc_filter}
              AND ft.status IN ('posted', 'partial')
              AND (ft.total_amount - ft.settled_amount) > 0
            ORDER BY days_past_due DESC, ft.tx_date ASC
            """
        )
        items = _serialize_rows(cursor.fetchall())

        # Also summarize uncollected project contract balances as unbilled/contractual project debtors
        cursor.execute(
            """
            SELECT
                p.id AS project_id, p.project_name, p.code_name, p.client_name,
                COALESCE(lbv.quoted_total, 0) AS quoted_total,
                COALESCE(pay.total_paid, 0) AS total_paid,
                (COALESCE(lbv.quoted_total, 0) - COALESCE(pay.total_paid, 0)) AS contract_balance
            FROM projects p
            LEFT JOIN (
                SELECT bv.project_id, SUM(pbv.total) AS quoted_total
                FROM budget_versions bv
                JOIN (SELECT project_id, MAX(version_number) AS max_ver FROM budget_versions GROUP BY project_id) m
                  ON bv.project_id = m.project_id AND bv.version_number = m.max_ver
                JOIN project_budget_values pbv ON pbv.version_id = bv.id
                GROUP BY bv.project_id
            ) lbv ON lbv.project_id = p.id
            LEFT JOIN (
                SELECT project_id, SUM(amount) AS total_paid FROM payments GROUP BY project_id
            ) pay ON pay.project_id = p.id
            HAVING contract_balance > 0
            ORDER BY contract_balance DESC
            """
        )
        project_receivables = _serialize_rows(cursor.fetchall())

        def _summarize(doc_kind):
            subset = [x for x in items if x["doc_type"] == doc_kind]
            buckets = {"current": 0.0, "days_1_30": 0.0, "days_31_60": 0.0, "days_60_plus": 0.0, "total": 0.0}
            for x in subset:
                bal = float(x["balance"] or 0)
                dpd = int(x["days_past_due"] or 0)
                buckets["total"] += bal
                if dpd <= 0:
                    buckets["current"] += bal
                elif dpd <= 30:
                    buckets["days_1_30"] += bal
                elif dpd <= 60:
                    buckets["days_31_60"] += bal
                else:
                    buckets["days_60_plus"] += bal
            return {k: round(v, 2) for k, v in buckets.items()}

        return {
            "debtors": [x for x in items if x["doc_type"] == "invoice_ar"],
            "creditors": [x for x in items if x["doc_type"] == "bill_ap"],
            "project_contract_receivables": project_receivables,
            "aging": {
                "debtors": _summarize("invoice_ar"),
                "creditors": _summarize("bill_ap"),
            },
        }
    finally:
        cursor.close()
        conn.close()


def update_fiscal_period_status(period_id, status, actor_user_id=None):
    """Open, soft-close, or lock a fiscal period with audit logging."""
    clean_status = str(status or "").strip().lower()
    if clean_status not in ("open", "soft_closed", "locked"):
        raise ValueError("status must be 'open', 'soft_closed', or 'locked'.")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, period_code, status FROM finance_fiscal_periods WHERE id = %s FOR UPDATE", (period_id,))
        period = cursor.fetchone()
        if not period:
            raise ValueError("Fiscal period not found.")
        if period["status"] == "locked" and clean_status != "locked":
            raise ValueError("Locked fiscal periods cannot be reopened via standard workflow.")

        closed_at = datetime.utcnow() if clean_status in ("soft_closed", "locked") else None
        closed_by = actor_user_id if closed_at else None
        cursor.execute(
            "UPDATE finance_fiscal_periods SET status = %s, closed_by = %s, closed_at = %s WHERE id = %s",
            (clean_status, closed_by, closed_at, period_id),
        )
        cursor.execute(
            """
            INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, before_json, after_json)
            VALUES ('finance_fiscal_period', %s, 'PERIOD_STATUS_CHANGE', %s, %s, %s)
            """,
            (
                period_id,
                actor_user_id,
                json.dumps({"status": period["status"], "period_code": period["period_code"]}),
                json.dumps({"status": clean_status, "period_code": period["period_code"]}),
            ),
        )
        conn.commit()
        return {"id": period_id, "period_code": period["period_code"], "status": clean_status}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
