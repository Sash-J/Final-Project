"""Phase 2 extensible finance validation rules and document type classification registry.

Replaces rigid MySQL ENUMs with an extensible Python mapping so new accounting modules
(payroll, depreciation, credit notes, loans) plug in without DDL table locks.
"""

from datetime import datetime
from decimal import Decimal, InvalidOperation
import re

MAX_MONETARY_AMOUNT = Decimal("1000000000.00")
MAX_ATTACHMENT_PAYLOAD_LEN = 2_000_000  # ~1.5 MB binary after base64 expansion
MAX_ATTACHMENTS_PER_VOUCHER = 3

VALID_SCOPES = frozenset({"project", "company", "personal"})
VALID_ACCOUNT_CLASSES = frozenset(
    {"asset", "liability", "equity", "income", "cogs", "expense", "drawings"}
)
VALID_ACCOUNT_NORMAL_BALANCES = frozenset({"debit", "credit"})
VALID_COUNTERPARTY_TYPES = frozenset(
    {"client", "vendor", "crew", "director", "investor", "lender"}
)
VALID_TAX_DIRECTIONS = frozenset({"none", "input", "output", "withholding"})

ALLOWED_ATTACHMENT_MIMES = frozenset(
    {"image/png", "image/jpeg", "image/jpg", "image/webp"}
)

ACCOUNT_CODE_REGEX = re.compile(r"^[A-Z0-9][A-Z0-9_-]{1,23}$")
SAFE_IMAGE_DATA_URL_REGEX = re.compile(
    r"^data:image/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$",
    re.IGNORECASE,
)

# Extensible Document Type Registry: defines voucher prefix, allowed initial statuses, and balance rules
DOC_TYPE_REGISTRY = {
    "expense": {
        "prefix": "EXP",
        "label": "Expense Voucher",
        "default_debit_classes": {"expense", "cogs", "asset"},
        "supports_simple_posting": True,
        "requires_balanced_lines": False,
    },
    "income": {
        "prefix": "INC",
        "label": "Income Receipt",
        "default_credit_classes": {"income"},
        "supports_simple_posting": True,
        "requires_balanced_lines": False,
    },
    "drawing": {
        "prefix": "DRW",
        "label": "Owner / Director Drawing",
        "default_debit_classes": {"drawings"},
        "supports_simple_posting": True,
        "requires_balanced_lines": False,
    },
    "capital": {
        "prefix": "CAP",
        "label": "Capital Injection",
        "default_credit_classes": {"equity"},
        "supports_simple_posting": True,
        "requires_balanced_lines": False,
    },
    "invoice_ar": {
        "prefix": "INV",
        "label": "Debtor Invoice (AR)",
        "supports_simple_posting": True,
        "requires_balanced_lines": False,
    },
    "bill_ap": {
        "prefix": "BIL",
        "label": "Creditor Bill (AP)",
        "supports_simple_posting": True,
        "requires_balanced_lines": False,
    },
    "settlement": {
        "prefix": "STL",
        "label": "AR/AP Settlement",
        "supports_simple_posting": False,
        "requires_balanced_lines": False,
    },
    "transfer": {
        "prefix": "TRF",
        "label": "Internal Fund Transfer",
        "supports_simple_posting": True,
        "requires_balanced_lines": False,
    },
    "payroll": {
        "prefix": "PAY",
        "label": "Payroll Run",
        "supports_simple_posting": False,
        "requires_balanced_lines": True,
    },
    "depreciation": {
        "prefix": "DEP",
        "label": "Depreciation Entry",
        "supports_simple_posting": False,
        "requires_balanced_lines": True,
    },
    "credit_note": {
        "prefix": "CRN",
        "label": "Credit Note",
        "supports_simple_posting": False,
        "requires_balanced_lines": True,
    },
    "debit_note": {
        "prefix": "DBN",
        "label": "Debit Note",
        "supports_simple_posting": False,
        "requires_balanced_lines": True,
    },
    "journal": {
        "prefix": "JRN",
        "label": "General Journal Voucher",
        "supports_simple_posting": False,
        "requires_balanced_lines": True,
    },
}


def parse_positive_decimal(value, field_name="amount", allow_zero=False):
    """Parse and range-check monetary values up to MAX_MONETARY_AMOUNT."""
    if value is None or value == "":
        if allow_zero:
            return Decimal("0.00")
        raise ValueError(f"{field_name} is required.")
    try:
        dec = Decimal(str(value).strip()).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise ValueError(f"{field_name} must be a valid decimal number.")

    if not dec.is_finite():
        raise ValueError(f"{field_name} must be finite.")
    if allow_zero:
        if dec < Decimal("0.00"):
            raise ValueError(f"{field_name} cannot be negative.")
    elif dec <= Decimal("0.00"):
        raise ValueError(f"{field_name} must be greater than zero.")
    if dec > MAX_MONETARY_AMOUNT:
        raise ValueError(f"{field_name} exceeds maximum allowable limit (1,000,000,000.00).")
    return dec


def parse_iso_date(value, field_name="date", required=True):
    """Validate strict YYYY-MM-DD calendar dates."""
    if value is None or str(value).strip() == "":
        if required:
            raise ValueError(f"{field_name} is required (YYYY-MM-DD).")
        return None
    text = str(value).strip()[:10]
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"{field_name} must be a valid calendar date in YYYY-MM-DD format.")


def parse_optional_int(value, field_name="id"):
    """Coerce nullable integer references cleanly."""
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
        if parsed <= 0:
            raise ValueError(f"{field_name} must be a positive integer.")
        return parsed
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid integer ID.")


def validate_attachments(attachments):
    """Validate client-compressed voucher receipt attachments."""
    if attachments is None:
        return []
    if not isinstance(attachments, list):
        raise ValueError("attachments must be an array.")
    if len(attachments) > MAX_ATTACHMENTS_PER_VOUCHER:
        raise ValueError(f"At most {MAX_ATTACHMENTS_PER_VOUCHER} attachments are allowed per voucher.")

    cleaned = []
    for idx, att in enumerate(attachments, start=1):
        if not isinstance(att, dict):
            raise ValueError(f"Attachment #{idx} must be an object.")
        file_name = str(att.get("file_name") or f"attachment_{idx}.webp").strip()[:180]
        mime_type = str(att.get("mime_type") or "").strip().lower()
        payload = str(att.get("payload") or "").strip()
        if mime_type not in ALLOWED_ATTACHMENT_MIMES:
            raise ValueError(
                f"Attachment #{idx} uses unsupported type '{mime_type}'. Allowed: PNG, JPEG, WebP."
            )
        if not SAFE_IMAGE_DATA_URL_REGEX.match(payload):
            raise ValueError(f"Attachment #{idx} must contain a valid Base64 image data URI.")
        if len(payload) > MAX_ATTACHMENT_PAYLOAD_LEN:
            raise ValueError(f"Attachment #{idx} exceeds 1.5 MB encoded size limit.")
        cleaned.append(
            {
                "file_name": file_name,
                "mime_type": mime_type,
                "payload": payload,
                "byte_size": len(payload),
            }
        )
    return cleaned


def validate_voucher_payload(data):
    """Validate and normalize a single-mode or multi-line voucher payload."""
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    doc_type = str(data.get("doc_type") or "").strip().lower()
    if doc_type not in DOC_TYPE_REGISTRY:
        raise ValueError(f"Unsupported document type '{doc_type}'.")

    scope = str(data.get("scope") or "").strip().lower()
    if scope not in VALID_SCOPES:
        raise ValueError("scope must be one of 'project', 'company', or 'personal'.")

    tx_date = parse_iso_date(data.get("tx_date"), "tx_date", required=True)
    due_date = parse_iso_date(data.get("due_date"), "due_date", required=False)
    if due_date and due_date < tx_date:
        raise ValueError("due_date cannot be earlier than tx_date.")

    primary_project_id = parse_optional_int(data.get("primary_project_id"), "primary_project_id")
    primary_user_id = parse_optional_int(data.get("primary_user_id"), "primary_user_id")
    counterparty_id = parse_optional_int(data.get("counterparty_id"), "counterparty_id")
    settlement_account_id = parse_optional_int(data.get("settlement_account_id"), "settlement_account_id")
    bank_account_id = parse_optional_int(data.get("bank_account_id"), "bank_account_id")
    destination_account_id = parse_optional_int(data.get("destination_account_id"), "destination_account_id")
    category_account_id = parse_optional_int(data.get("category_account_id"), "category_account_id")
    department_id = parse_optional_int(data.get("department_id"), "department_id")
    budget_item_id = parse_optional_int(data.get("budget_item_id"), "budget_item_id")

    description = str(data.get("description") or "").strip()
    if not description:
        raise ValueError("description is required.")
    if len(description) > 255:
        raise ValueError("description cannot exceed 255 characters.")

    notes = str(data.get("notes") or "").strip()[:2000]
    payment_method = str(data.get("payment_method") or "Bank Transfer").strip()[:50]
    bank_ref = str(data.get("bank_ref") or "").strip()[:100] or None

    status = str(data.get("status") or "posted").strip().lower()
    if status not in ("draft", "posted"):
        raise ValueError("Initial voucher status must be 'draft' or 'posted'.")

    currency_code = str(data.get("currency_code") or "LKR").strip().upper()[:3]
    if not re.match(r"^[A-Z]{3}$", currency_code):
        raise ValueError("currency_code must be a 3-letter ISO currency code.")

    exchange_rate_raw = data.get("exchange_rate", "1.0")
    try:
        exchange_rate = Decimal(str(exchange_rate_raw)).quantize(Decimal("0.000001"))
        if not exchange_rate.is_finite() or exchange_rate <= Decimal("0"):
            raise ValueError()
    except (InvalidOperation, ValueError):
        raise ValueError("exchange_rate must be a positive number.")

    raw_lines = data.get("lines")
    lines = []
    if raw_lines is not None:
        if not isinstance(raw_lines, list) or len(raw_lines) == 0:
            raise ValueError("lines must be a non-empty array when provided.")
        if len(raw_lines) > 50:
            raise ValueError("A single voucher cannot exceed 50 line items.")

        for idx, line in enumerate(raw_lines, start=1):
            if not isinstance(line, dict):
                raise ValueError(f"Line #{idx} must be an object.")
            acct_id = parse_optional_int(line.get("account_id"), f"lines[{idx}].account_id")
            if not acct_id:
                raise ValueError(f"Line #{idx} requires account_id.")

            line_desc = str(line.get("description") or description).strip()[:255]
            line_proj_id = parse_optional_int(line.get("project_id"), f"lines[{idx}].project_id")
            line_dept_id = parse_optional_int(line.get("department_id"), f"lines[{idx}].department_id")
            line_bitem_id = parse_optional_int(line.get("budget_item_id"), f"lines[{idx}].budget_item_id")
            line_user_id = parse_optional_int(line.get("person_user_id"), f"lines[{idx}].person_user_id")
            tax_code_id = parse_optional_int(line.get("tax_code_id"), f"lines[{idx}].tax_code_id")

            # Enforce company scope isolation on lines when header scope is 'company'
            if scope == "company" and line_proj_id is not None:
                raise ValueError("Company-scoped vouchers cannot link lines to a specific project.")

            if "debit" in line or "credit" in line:
                deb = parse_positive_decimal(line.get("debit", 0), f"lines[{idx}].debit", allow_zero=True)
                cred = parse_positive_decimal(line.get("credit", 0), f"lines[{idx}].credit", allow_zero=True)
                if (deb > 0 and cred > 0) or (deb == 0 and cred == 0):
                    raise ValueError(f"Line #{idx} must have either positive debit OR positive credit.")
                line_total = deb if deb > 0 else cred
                side = "debit" if deb > 0 else "credit"
            else:
                qty = Decimal(str(line.get("quantity", 1))).quantize(Decimal("0.001"))
                if qty <= 0:
                    raise ValueError(f"Line #{idx} quantity must be positive.")
                unit_price = parse_positive_decimal(line.get("unit_price", line.get("amount")), f"lines[{idx}].amount")
                line_total = (qty * unit_price).quantize(Decimal("0.01"))
                if line_total > MAX_MONETARY_AMOUNT:
                    raise ValueError(f"Line #{idx} total exceeds maximum allowable limit.")
                side = str(line.get("side") or "").strip().lower() or None

            lines.append(
                {
                    "line_no": idx,
                    "account_id": acct_id,
                    "tax_code_id": tax_code_id,
                    "project_id": line_proj_id or (primary_project_id if scope == "project" else None),
                    "department_id": line_dept_id or department_id,
                    "budget_item_id": line_bitem_id or budget_item_id,
                    "person_user_id": line_user_id or primary_user_id,
                    "cost_center_code": str(line.get("cost_center_code") or "").strip()[:32] or None,
                    "description": line_desc,
                    "quantity": Decimal(str(line.get("quantity", 1))).quantize(Decimal("0.001")),
                    "unit_price": parse_positive_decimal(
                        line.get("unit_price", line_total), f"lines[{idx}].unit_price", allow_zero=True
                    ),
                    "tax_amount": parse_positive_decimal(line.get("tax_amount", 0), f"lines[{idx}].tax_amount", allow_zero=True),
                    "line_total": line_total,
                    "debit": line_total if side == "debit" else Decimal("0.00"),
                    "credit": line_total if side == "credit" else Decimal("0.00"),
                    "side": side,
                }
            )

    amount = None
    if not lines:
        amount = parse_positive_decimal(data.get("amount"), "amount")

    # Strict Scope Integrity Rules
    if scope == "project":
        has_project = bool(primary_project_id) or any(ln.get("project_id") for ln in lines)
        if not has_project:
            raise ValueError("Project-scoped records require primary_project_id or line project_id.")
    elif scope == "company":
        if primary_project_id is not None:
            raise ValueError("Company-scoped records must not set primary_project_id.")
    elif scope == "personal":
        has_person = bool(primary_user_id or counterparty_id) or any(ln.get("person_user_id") for ln in lines)
        if not has_person:
            raise ValueError("Personal-scoped records require primary_user_id or counterparty_id.")

    if doc_type == "transfer" and not lines:
        if not settlement_account_id or not destination_account_id:
            raise ValueError("Internal transfers require both source settlement_account_id and destination_account_id.")
        if settlement_account_id == destination_account_id:
            raise ValueError("Source and destination accounts for a transfer must be different.")

    if DOC_TYPE_REGISTRY[doc_type]["requires_balanced_lines"]:
        if len(lines) < 2:
            raise ValueError(f"Document type '{doc_type}' requires at least 2 balanced journal lines.")
        sum_dr = sum(ln["debit"] for ln in lines)
        sum_cr = sum(ln["credit"] for ln in lines)
        if sum_dr <= 0 or sum_dr != sum_cr:
            raise ValueError(f"Unbalanced journal lines: debits ({sum_dr}) must equal credits ({sum_cr}).")

    attachments = validate_attachments(data.get("attachments"))

    return {
        "doc_type": doc_type,
        "scope": scope,
        "tx_date": tx_date,
        "due_date": due_date,
        "primary_project_id": primary_project_id,
        "primary_user_id": primary_user_id,
        "counterparty_id": counterparty_id,
        "settlement_account_id": settlement_account_id,
        "bank_account_id": bank_account_id,
        "destination_account_id": destination_account_id,
        "category_account_id": category_account_id,
        "department_id": department_id,
        "budget_item_id": budget_item_id,
        "amount": amount,
        "payment_method": payment_method,
        "bank_ref": bank_ref,
        "status": status,
        "description": description,
        "notes": notes or None,
        "currency_code": currency_code,
        "exchange_rate": exchange_rate,
        "lines": lines,
        "attachments": attachments,
        "settlement_mode": str(data.get("settlement_mode") or "immediate").strip().lower(),
    }


def validate_account_payload(data, is_update=False):
    """Validate Chart of Accounts creation/update payload."""
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    cleaned = {}
    if not is_update or "code" in data:
        code = str(data.get("code") or "").strip().upper()
        if not ACCOUNT_CODE_REGEX.match(code):
            raise ValueError("Account code must be 2-24 uppercase alphanumeric/hyphen/underscore chars.")
        cleaned["code"] = code

    if not is_update or "name" in data:
        name = str(data.get("name") or "").strip()
        if len(name) < 2 or len(name) > 120:
            raise ValueError("Account name must be between 2 and 120 characters.")
        cleaned["name"] = name

    if not is_update or "account_class" in data:
        acct_class = str(data.get("account_class") or "").strip().lower()
        if acct_class not in VALID_ACCOUNT_CLASSES:
            raise ValueError(f"Invalid account_class '{acct_class}'.")
        cleaned["account_class"] = acct_class

    if "sub_type" in data or not is_update:
        cleaned["sub_type"] = str(data.get("sub_type") or "general").strip().lower()[:40]

    if "normal_balance" in data or not is_update:
        default_nb = (
            "credit"
            if cleaned.get("account_class") in ("liability", "equity", "income")
            else "debit"
        )
        nb = str(data.get("normal_balance") or default_nb).strip().lower()
        if nb not in VALID_ACCOUNT_NORMAL_BALANCES:
            raise ValueError("normal_balance must be 'debit' or 'credit'.")
        cleaned["normal_balance"] = nb

    if "parent_id" in data:
        cleaned["parent_id"] = parse_optional_int(data.get("parent_id"), "parent_id")
    if "description" in data:
        cleaned["description"] = str(data.get("description") or "").strip()[:255] or None
    if "allow_direct_posting" in data:
        cleaned["allow_direct_posting"] = 1 if data.get("allow_direct_posting") else 0
    if "is_active" in data:
        cleaned["is_active"] = 1 if data.get("is_active") else 0

    return cleaned


def validate_counterparty_payload(data):
    """Validate Debtors/Creditors counterparty creation payload."""
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    party_type = str(data.get("party_type") or "").strip().lower()
    if party_type not in VALID_COUNTERPARTY_TYPES:
        raise ValueError(f"party_type must be one of {sorted(VALID_COUNTERPARTY_TYPES)}.")

    name = str(data.get("name") or "").strip()
    if len(name) < 2 or len(name) > 150:
        raise ValueError("Counterparty name must be between 2 and 150 characters.")

    email = str(data.get("email") or "").strip()[:255] or None
    if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ValueError("Counterparty email format is invalid.")

    phone = str(data.get("phone") or "").strip()[:30] or None
    tax_id = str(data.get("tax_id") or "").strip()[:60] or None
    user_id = parse_optional_int(data.get("user_id"), "user_id")

    terms = data.get("payment_terms_days", 30)
    try:
        payment_terms_days = int(terms)
        if payment_terms_days < 0 or payment_terms_days > 365:
            raise ValueError()
    except (TypeError, ValueError):
        raise ValueError("payment_terms_days must be between 0 and 365.")

    credit_limit = None
    if data.get("credit_limit") not in (None, ""):
        credit_limit = parse_positive_decimal(data.get("credit_limit"), "credit_limit", allow_zero=True)

    return {
        "party_type": party_type,
        "name": name,
        "email": email,
        "phone": phone,
        "tax_id": tax_id,
        "user_id": user_id,
        "payment_terms_days": payment_terms_days,
        "credit_limit": credit_limit,
    }


def validate_settlement_payload(data):
    """Validate partial or full AR/AP settlement payload."""
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    target_tx_id = parse_optional_int(data.get("target_tx_id"), "target_tx_id")
    if not target_tx_id:
        raise ValueError("target_tx_id is required.")

    amount = parse_positive_decimal(data.get("amount"), "amount")
    settlement_date = parse_iso_date(data.get("settlement_date"), "settlement_date", required=True)
    settlement_account_id = parse_optional_int(data.get("settlement_account_id"), "settlement_account_id")
    bank_account_id = parse_optional_int(data.get("bank_account_id"), "bank_account_id")
    payment_method = str(data.get("payment_method") or "Bank Transfer").strip()[:50]
    bank_ref = str(data.get("bank_ref") or "").strip()[:100] or None
    notes = str(data.get("notes") or "").strip()[:255] or None

    return {
        "target_tx_id": target_tx_id,
        "amount": amount,
        "settlement_date": settlement_date,
        "settlement_account_id": settlement_account_id,
        "bank_account_id": bank_account_id,
        "payment_method": payment_method,
        "bank_ref": bank_ref,
        "notes": notes,
    }

