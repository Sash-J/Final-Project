"""Unit tests for Phase 2 validation rules, double-entry compiler, RBAC scoping, and HTTP cache/gzip."""

from datetime import date
from decimal import Decimal
import gzip
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services import finance_operations  # noqa: E402
from services import finance_reports  # noqa: E402
from services import finance_validation  # noqa: E402


ACCOUNTS_MAP = {
    1010: {"id": 1010, "code": "1010", "name": "Cash on Hand", "account_class": "asset", "sub_type": "cash", "allow_direct_posting": 1, "is_active": 1},
    1020: {"id": 1020, "code": "1020", "name": "Studio Bank", "account_class": "asset", "sub_type": "bank", "allow_direct_posting": 1, "is_active": 1},
    1100: {"id": 1100, "code": "1100", "name": "Accounts Receivable", "account_class": "asset", "sub_type": "ar", "allow_direct_posting": 1, "is_active": 1},
    2010: {"id": 2010, "code": "2010", "name": "Accounts Payable", "account_class": "liability", "sub_type": "ap", "allow_direct_posting": 1, "is_active": 1},
    3010: {"id": 3010, "code": "3010", "name": "Owner Capital", "account_class": "equity", "sub_type": "capital", "allow_direct_posting": 1, "is_active": 1},
    3020: {"id": 3020, "code": "3020", "name": "Owner Drawings", "account_class": "drawings", "sub_type": "drawings", "allow_direct_posting": 1, "is_active": 1},
    4010: {"id": 4010, "code": "4010", "name": "Project Income", "account_class": "income", "sub_type": "project_income", "allow_direct_posting": 1, "is_active": 1},
    5010: {"id": 5010, "code": "5010", "name": "Direct Project Expense", "account_class": "cogs", "sub_type": "direct_cost", "allow_direct_posting": 1, "is_active": 1},
    6010: {"id": 6010, "code": "6010", "name": "General Overhead", "account_class": "expense", "sub_type": "overhead", "allow_direct_posting": 1, "is_active": 1},
    1000: {"id": 1000, "code": "1000", "name": "Assets Header", "account_class": "asset", "sub_type": "general", "allow_direct_posting": 0, "is_active": 1},
}
BY_CODE = {v["code"]: v for v in ACCOUNTS_MAP.values()}


class TestPhase2Validation(unittest.TestCase):
    def test_rejects_invalid_amounts_dates_and_scope_violations(self):
        base = {
            "doc_type": "expense",
            "scope": "project",
            "primary_project_id": 16,
            "tx_date": "2026-11-10",
            "amount": 5000,
            "description": "Camera lens rental",
        }
        # Zero or over-limit amount rejected
        with self.assertRaises(ValueError):
            finance_validation.validate_voucher_payload({**base, "amount": 0})
        with self.assertRaises(ValueError):
            finance_validation.validate_voucher_payload({**base, "amount": "1000000001"})

        # Bad calendar date rejected
        with self.assertRaises(ValueError):
            finance_validation.validate_voucher_payload({**base, "tx_date": "2026-02-30"})

        # Scope integrity rules
        with self.assertRaises(ValueError):
            finance_validation.validate_voucher_payload({**base, "primary_project_id": None})
        with self.assertRaises(ValueError):
            finance_validation.validate_voucher_payload({**base, "scope": "company", "primary_project_id": 16})
        with self.assertRaises(ValueError):
            finance_validation.validate_voucher_payload(
                {"doc_type": "drawing", "scope": "personal", "tx_date": "2026-11-10", "amount": 1000, "description": "Draw"}
            )

        # Unbalanced compound journal rejected
        with self.assertRaises(ValueError):
            finance_validation.validate_voucher_payload(
                {
                    "doc_type": "journal",
                    "scope": "company",
                    "tx_date": "2026-11-10",
                    "description": "Unbalanced test",
                    "lines": [
                        {"account_id": 6010, "debit": 1000, "credit": 0},
                        {"account_id": 1020, "debit": 0, "credit": 900},
                    ],
                }
            )

    def test_attachment_validation_rejects_non_image_or_oversized(self):
        bad_att = [{"file_name": "evil.html", "mime_type": "text/html", "payload": "data:text/html;base64,PGI+eDwvYj4="}]
        with self.assertRaises(ValueError):
            finance_validation.validate_attachments(bad_att)

        ok_att = [{"file_name": "receipt.webp", "mime_type": "image/webp", "payload": "data:image/webp;base64,UklGRh4AAABXRUJQ"}]
        res = finance_validation.validate_attachments(ok_att)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["mime_type"], "image/webp")


class TestPhase2LedgerCompilerAndReports(unittest.TestCase):
    def test_compile_balanced_legs_across_expense_drawing_capital_and_bill(self):
        for payload, exp_dr_acct, exp_cr_acct in [
            (
                {"doc_type": "expense", "scope": "project", "primary_project_id": 16, "tx_date": "2026-11-10", "amount": 12500, "description": "Lighting kit"},
                5010,
                1020,
            ),
            (
                {"doc_type": "drawing", "scope": "personal", "primary_user_id": 5, "tx_date": "2026-11-10", "amount": 30000, "description": "Director drawing"},
                3020,
                1020,
            ),
            (
                {"doc_type": "capital", "scope": "personal", "primary_user_id": 5, "tx_date": "2026-11-10", "amount": 250000, "description": "Partner equity"},
                1020,
                3010,
            ),
            (
                {"doc_type": "bill_ap", "scope": "company", "tx_date": "2026-11-10", "amount": 45000, "description": "Studio rent invoice"},
                6010,
                2010,
            ),
        ]:
            val = finance_validation.validate_voucher_payload(payload)
            lines, legs, total = finance_operations._compile_lines_and_ledger_legs(val, ACCOUNTS_MAP, BY_CODE, 1020)
            self.assertEqual(len(lines), 1)
            self.assertEqual(total, Decimal(str(payload["amount"])).quantize(Decimal("0.01")))
            self.assertEqual(sum(l["debit"] for l in legs), total)
            self.assertEqual(sum(l["credit"] for l in legs), total)
            dr_accts = [l["account_id"] for l in legs if l["debit"] > 0]
            cr_accts = [l["account_id"] for l in legs if l["credit"] > 0]
            self.assertIn(exp_dr_acct, dr_accts)
            self.assertIn(exp_cr_acct, cr_accts)

    def test_summary_accounts_block_direct_posting(self):
        val = finance_validation.validate_voucher_payload(
            {"doc_type": "expense", "scope": "company", "tx_date": "2026-11-10", "category_account_id": 1000, "amount": 1000, "description": "Bad summary"}
        )
        with self.assertRaises(ValueError):
            finance_operations._compile_lines_and_ledger_legs(val, ACCOUNTS_MAP, BY_CODE, 1020)

    def test_pnl_report_excludes_drawings_and_capital_from_net_profit(self):
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            {"account_id": 4010, "code": "4010", "name": "Project Income", "account_class": "income", "sub_type": "project_income", "debit": Decimal("0.00"), "credit": Decimal("500000.00")},
            {"account_id": 5010, "code": "5010", "name": "Direct Cost", "account_class": "cogs", "sub_type": "direct_cost", "debit": Decimal("180000.00"), "credit": Decimal("0.00")},
            {"account_id": 6010, "code": "6010", "name": "Studio Overhead", "account_class": "expense", "sub_type": "overhead", "debit": Decimal("70000.00"), "credit": Decimal("0.00")},
            {"account_id": 3020, "code": "3020", "name": "Owner Drawings", "account_class": "drawings", "sub_type": "drawings", "debit": Decimal("100000.00"), "credit": Decimal("0.00")},
            {"account_id": 3010, "code": "3010", "name": "Owner Capital", "account_class": "equity", "sub_type": "capital", "debit": Decimal("0.00"), "credit": Decimal("300000.00")},
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(finance_reports, "get_connection", return_value=mock_conn):
            report = finance_reports.generate_financial_report("pnl", scope="all", can_view_personal=True)

        self.assertEqual(report["totals"]["total_revenue"], 500000.0)
        self.assertEqual(report["totals"]["total_cogs"], 180000.0)
        self.assertEqual(report["totals"]["gross_profit"], 320000.0)
        self.assertEqual(report["totals"]["total_operating_expenses"], 70000.0)
        # Net Profit MUST be 500k - 180k - 70k = 250k (Drawings & Capital excluded!)
        self.assertEqual(report["totals"]["net_profit"], 250000.0)
        self.assertEqual(report["equity_memo"]["total_capital"], 300000.0)
        self.assertEqual(report["equity_memo"]["total_drawings"], 100000.0)


class TestPhase2RoutesAndHttpPerformance(unittest.TestCase):
    def setUp(self):
        import app as flask_app_module

        self.app = flask_app_module.app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _login_session(self, roles, permissions, user_id=1):
        with self.client.session_transaction() as sess:
            sess["user_id"] = user_id
            sess["username"] = "tester"
            sess["user_role"] = roles[0]
            sess["user_roles"] = roles
            sess["user_permissions"] = permissions

    def test_manager_cannot_access_company_personal_or_post_drawings(self):
        self._login_session(["Manager"], ["finance.view", "finance.edit", "finance.export"])

        r_comp = self.client.get("/api/finance/company")
        self.assertEqual(r_comp.status_code, 403)

        r_pers = self.client.get("/api/finance/personal")
        self.assertEqual(r_pers.status_code, 403)

        r_draw = self.client.post(
            "/api/finance/transactions",
            json={
                "doc_type": "drawing",
                "scope": "personal",
                "primary_user_id": 1,
                "tx_date": "2026-11-10",
                "amount": 5000,
                "description": "Unauthorized drawing",
            },
        )
        self.assertEqual(r_draw.status_code, 403)
        self.assertEqual(r_draw.headers.get("Cache-Control"), "no-store")

    def test_etag_304_and_gzip_compression_on_taxonomy(self):
        self._login_session(["Admin"], ["finance.view", "finance.personal.view"])
        large_payload = {
            "entity": {"id": 1, "code": "VD-STUDIO", "name": "Vision Division Studio", "base_currency": "LKR"},
            "accounts": [{"id": i, "code": str(1000 + i), "name": f"Sample Account Name {i} Extra Padding"} for i in range(60)],
            "bank_accounts": [],
            "tax_codes": [],
            "counterparties": [],
            "projects": [],
            "users": [],
            "fiscal_periods": [],
            "doc_types": [],
        }

        with patch("services.finance_operations.get_finance_taxonomy", return_value=large_payload):
            r1 = self.client.get("/api/finance/taxonomy", headers={"Accept-Encoding": "gzip"})
            self.assertEqual(r1.status_code, 200)
            self.assertIn("max-age=120", r1.headers.get("Cache-Control", ""))
            self.assertEqual(r1.headers.get("Content-Encoding"), "gzip")
            self.assertTrue(r1.headers.get("ETag"))
            # Ensure gzip body decompresses cleanly
            decompressed = gzip.decompress(r1.data).decode("utf-8")
            self.assertIn("VD-STUDIO", decompressed)

            # Matching If-None-Match must trigger 304 Not Modified with empty body
            r2 = self.client.get(
                "/api/finance/taxonomy",
                headers={"If-None-Match": r1.headers["ETag"]},
            )
            self.assertEqual(r2.status_code, 304)
            self.assertEqual(r2.data, b"")

    def test_print_view_escapes_html_and_sets_text_html(self):
        self._login_session(["Accountant"], ["finance.view", "finance.export", "finance.personal.view"])
        stub_report = {
            "meta": {"report_type": "pnl", "scope": "all", "generated_on": "2026-11-12"},
            "sections": {
                "income": [{"code": "4010", "name": "<script>alert(1)</script>Film Revenue", "amount": 100000}],
                "cogs": [],
                "operating_expenses": [],
            },
            "equity_memo": {"total_capital": 0, "total_drawings": 0},
            "totals": {"total_revenue": 100000, "total_cogs": 0, "gross_profit": 100000, "total_operating_expenses": 0, "net_profit": 100000},
        }
        with patch("routes.finance_management.generate_financial_report", return_value=stub_report):
            res = self.client.get("/api/finance/reports/print-view?report_type=pnl")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/html", res.content_type)
        html_text = res.data.decode("utf-8")
        self.assertNotIn("<script>alert(1)</script>", html_text)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html_text)

    def test_write_route_rbac_guards_enforce_approve_and_accounts_manage(self):
        self._login_session(["Manager"], ["finance.view", "finance.edit", "finance.export"])

        r_post = self.client.post("/api/finance/transactions/99/post")
        self.assertEqual(r_post.status_code, 403)
        self.assertEqual(r_post.headers.get("Cache-Control"), "no-store")

        r_void = self.client.post("/api/finance/transactions/99/void", json={"void_reason": "Duplicate"})
        self.assertEqual(r_void.status_code, 403)

        r_acct = self.client.post("/api/finance/accounts", json={"code": "6999", "name": "Temp"})
        self.assertEqual(r_acct.status_code, 403)

        r_period = self.client.put("/api/finance/fiscal-periods/1", json={"status": "closed"})
        self.assertEqual(r_period.status_code, 403)


class TestPhase2LifecycleOperations(unittest.TestCase):
    def test_closed_period_blocks_posting_and_rolls_back(self):
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [
            {"id": 1, "code": "VD-STUDIO", "name": "Vision Division Studio", "base_currency": "LKR"},
            {"id": 12, "period_code": "2025-01", "status": "closed"},
        ]
        mock_cursor.fetchall.side_effect = [list(ACCOUNTS_MAP.values()), []]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(finance_operations, "get_connection", return_value=mock_conn), patch.object(
            finance_operations, "ensure_fiscal_period", return_value=12
        ):
            with self.assertRaises(ValueError) as ctx:
                finance_operations.post_voucher(
                    {
                        "doc_type": "expense",
                        "scope": "company",
                        "tx_date": "2025-01-15",
                        "amount": 5000,
                        "description": "Closed month entry",
                    },
                    actor_user_id=1,
                )
        self.assertIn("closed", str(ctx.exception))
        mock_conn.rollback.assert_called_once()

    def test_approve_post_voucher_posts_draft_to_gl(self):
        draft_tx = {
            "id": 77,
            "entity_id": 1,
            "voucher_no": "EXP-202611-0001",
            "doc_type": "expense",
            "scope": "project",
            "primary_project_id": 16,
            "primary_user_id": None,
            "counterparty_id": None,
            "settlement_account_id": 1020,
            "bank_account_id": None,
            "tx_date": date(2026, 11, 10),
            "currency_code": "LKR",
            "payment_method": "bank_transfer",
            "status": "draft",
            "description": "Sound mix fee",
        }
        draft_lines = [
            {
                "id": 201,
                "line_no": 1,
                "account_id": 5010,
                "tax_code_id": None,
                "project_id": 16,
                "department_id": None,
                "budget_item_id": None,
                "person_user_id": None,
                "cost_center_code": None,
                "description": "Sound mix fee",
                "quantity": Decimal("1.000"),
                "unit_price": Decimal("25000.00"),
                "tax_amount": Decimal("0.00"),
                "line_total": Decimal("25000.00"),
            }
        ]
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [
            draft_tx,
            {"id": 11, "period_code": "2026-11", "status": "open"},
            {"id": 1, "code": "VD-STUDIO", "name": "Vision Division Studio", "base_currency": "LKR"},
        ]
        mock_cursor.fetchall.side_effect = [list(ACCOUNTS_MAP.values()), [], draft_lines]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(finance_operations, "get_connection", return_value=mock_conn), patch.object(
            finance_operations, "ensure_fiscal_period", return_value=11
        ), patch.object(finance_operations, "apply_period_balance_delta") as mock_rollup:
            res = finance_operations.approve_post_voucher(77, actor_user_id=2)

        self.assertEqual(res["status"], "posted")
        self.assertEqual(mock_rollup.call_count, 2)
        mock_conn.commit.assert_called_once()

    def test_void_voucher_posts_symmetrical_reversal_and_guards_settled_invoices(self):
        settled_invoice = {
            "id": 88,
            "entity_id": 1,
            "voucher_no": "INV-202611-0001",
            "doc_type": "invoice_ar",
            "scope": "project",
            "status": "partial",
            "settled_amount": Decimal("10000.00"),
            "total_amount": Decimal("50000.00"),
        }
        c1 = MagicMock()
        c1.fetchone.return_value = settled_invoice
        conn1 = MagicMock()
        conn1.cursor.return_value = c1
        with patch.object(finance_operations, "get_connection", return_value=conn1):
            with self.assertRaises(ValueError) as ctx:
                finance_operations.void_voucher(88, actor_user_id=1, void_reason="Entered twice")
        self.assertIn("already has settlements", str(ctx.exception))
        conn1.rollback.assert_called_once()

        # Voiding a posted settlement restores parent balance and swaps GL debits/credits
        stl_tx = {
            "id": 95,
            "entity_id": 1,
            "voucher_no": "STL-202611-0002",
            "doc_type": "settlement",
            "scope": "company",
            "primary_project_id": None,
            "primary_user_id": None,
            "counterparty_id": 4,
            "settlement_account_id": 1020,
            "bank_account_id": 1,
            "currency_code": "LKR",
            "exchange_rate": Decimal("1.000000"),
            "subtotal_amount": Decimal("15000.00"),
            "tax_amount": Decimal("0.00"),
            "total_amount": Decimal("15000.00"),
            "settled_amount": Decimal("15000.00"),
            "payment_method": "bank_transfer",
            "status": "posted",
            "parent_tx_id": 88,
        }
        orig_entries = [
            {"id": 1, "account_id": 1020, "scope": "company", "project_id": None, "department_id": None, "person_user_id": None, "counterparty_id": 4, "debit": Decimal("15000.00"), "credit": Decimal("0.00")},
            {"id": 2, "account_id": 1100, "scope": "company", "project_id": None, "department_id": None, "person_user_id": None, "counterparty_id": 4, "debit": Decimal("0.00"), "credit": Decimal("15000.00")},
        ]
        parent_invoice = {"id": 88, "settled_amount": Decimal("15000.00"), "total_amount": Decimal("50000.00")}
        c2 = MagicMock()
        c2.fetchone.side_effect = [
            stl_tx,
            {"id": 11, "period_code": "2026-11", "status": "open"},
            None,  # no duplicate REV-voucher collision
            parent_invoice,
        ]
        c2.fetchall.return_value = orig_entries
        c2.lastrowid = 199
        conn2 = MagicMock()
        conn2.cursor.return_value = c2

        with patch.object(finance_operations, "get_connection", return_value=conn2), patch.object(
            finance_operations, "ensure_fiscal_period", return_value=11
        ), patch.object(finance_operations, "apply_period_balance_delta") as mock_rollup:
            res = finance_operations.void_voucher(95, actor_user_id=1, void_reason="Bounced cheque")

        self.assertEqual(res["status"], "voided")
        self.assertEqual(res["reversal_tx_id"], 199)
        self.assertEqual(mock_rollup.call_count, 2)
        conn2.commit.assert_called_once()

    def test_settle_counterparty_ap_bill_updates_partial_balance_and_prevents_overpay(self):
        target_bill = {
            "id": 310,
            "entity_id": 1,
            "voucher_no": "BILL-202611-0001",
            "doc_type": "bill_ap",
            "scope": "company",
            "primary_project_id": None,
            "primary_user_id": None,
            "counterparty_id": 9,
            "currency_code": "LKR",
            "exchange_rate": Decimal("1.000000"),
            "total_amount": Decimal("40000.00"),
            "settled_amount": Decimal("10000.00"),
            "status": "partial",
        }
        c_over = MagicMock()
        c_over.fetchone.return_value = target_bill
        conn_over = MagicMock()
        conn_over.cursor.return_value = c_over
        with patch.object(finance_operations, "get_connection", return_value=conn_over):
            with self.assertRaises(ValueError):
                finance_operations.settle_counterparty_transaction(
                    {"target_tx_id": 310, "amount": 35000, "settlement_date": "2026-11-12"},
                    actor_user_id=1,
                )
        conn_over.rollback.assert_called_once()

        c_ok = MagicMock()
        c_ok.fetchone.side_effect = [
            target_bill,
            {"id": 1, "code": "VD-STUDIO", "name": "Vision Division Studio", "base_currency": "LKR"},
            {"id": 11, "period_code": "2026-11", "status": "open"},
            {"cnt": 0},
            None,
        ]
        c_ok.fetchall.side_effect = [list(ACCOUNTS_MAP.values()), []]
        c_ok.lastrowid = 311
        conn_ok = MagicMock()
        conn_ok.cursor.return_value = c_ok

        with patch.object(finance_operations, "get_connection", return_value=conn_ok), patch.object(
            finance_operations, "ensure_fiscal_period", return_value=11
        ), patch.object(finance_operations, "apply_period_balance_delta") as mock_rollup:
            res = finance_operations.settle_counterparty_transaction(
                {"target_tx_id": 310, "amount": 15000, "settlement_date": "2026-11-12", "payment_method": "bank_transfer"},
                actor_user_id=1,
            )

        self.assertEqual(res["settled_amount"], 25000.0)
        self.assertEqual(res["remaining_balance"], 15000.0)
        self.assertEqual(res["target_status"], "partial")
        self.assertEqual(mock_rollup.call_count, 2)
        conn_ok.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
