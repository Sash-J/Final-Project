"""Unit tests for Phase 5 financial reports, print views, and performance telemetry."""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.finance_reports import (  # noqa: E402
    generate_financial_report,
    render_finance_print_html,
    VALID_REPORT_TYPES,
)
from services.telemetry_service import (  # noqa: E402
    record_web_vital,
    get_web_vitals_summary,
    get_combined_performance_telemetry,
    clear_web_vitals_buffer,
)


class TestPhase5ReportsAndTelemetry(unittest.TestCase):
    def setUp(self):
        clear_web_vitals_buffer()

    def test_valid_report_types(self):
        self.assertIn("pnl", VALID_REPORT_TYPES)
        self.assertIn("trial_balance", VALID_REPORT_TYPES)
        self.assertIn("general_ledger", VALID_REPORT_TYPES)
        self.assertIn("capital_drawings", VALID_REPORT_TYPES)

    def test_unsupported_report_type_raises(self):
        with self.assertRaises(ValueError):
            generate_financial_report(report_type="invalid_report_name")

    def test_capital_drawings_forbidden_for_unauthorized_user(self):
        with self.assertRaises(PermissionError):
            generate_financial_report(
                report_type="capital_drawings",
                can_view_personal=False,
            )

    @patch("services.finance_reports.get_connection")
    def test_generate_pnl_report_structure(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        mock_cursor.fetchall.return_value = [
            {
                "account_id": 2,
                "code": "4010",
                "name": "Commercial Video Revenue",
                "account_class": "income",
                "sub_type": "production",
                "debit": 0.0,
                "credit": 1200000.0,
            },
            {
                "account_id": 3,
                "code": "5010",
                "name": "Direct Crew Wages",
                "account_class": "cogs",
                "sub_type": "payroll",
                "debit": 300000.0,
                "credit": 0.0,
            },
            {
                "account_id": 4,
                "code": "6010",
                "name": "Studio Office Rent",
                "account_class": "expense",
                "sub_type": "overhead",
                "debit": 100000.0,
                "credit": 0.0,
            },
        ]

        report = generate_financial_report(report_type="pnl", can_view_personal=True)
        self.assertEqual(report["meta"]["report_type"], "pnl")
        totals = report["totals"]
        self.assertEqual(totals["total_revenue"], 1200000.0)
        self.assertEqual(totals["total_cogs"], 300000.0)
        self.assertEqual(totals["gross_profit"], 900000.0)
        self.assertEqual(totals["total_operating_expenses"], 100000.0)
        self.assertEqual(totals["net_profit"], 800000.0)

    @patch("services.finance_reports.get_connection")
    def test_generate_trial_balance_structure(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn

        mock_cursor.fetchall.return_value = [
            {
                "account_id": 1,
                "code": "1010",
                "name": "Bank",
                "account_class": "asset",
                "normal_balance": "debit",
                "debit": 500000.0,
                "credit": 0.0,
            },
            {
                "account_id": 2,
                "code": "4010",
                "name": "Revenue",
                "account_class": "income",
                "normal_balance": "credit",
                "debit": 0.0,
                "credit": 500000.0,
            },
        ]

        report = generate_financial_report(report_type="trial_balance")
        self.assertEqual(report["meta"]["report_type"], "trial_balance")
        self.assertTrue(report["totals"]["is_balanced"])
        self.assertEqual(report["totals"]["total_debit"], 500000.0)
        self.assertEqual(report["totals"]["total_credit"], 500000.0)

    def test_render_finance_print_html(self):
        mock_data = {
            "meta": {"report_type": "pnl", "scope": "all", "generated_on": "2026-11-13"},
            "sections": {
                "income": [{"code": "4010", "name": "Income", "amount": 100000}],
                "cogs": [],
                "operating_expenses": [{"code": "6010", "name": "Rent", "amount": 25000}],
            },
            "totals": {
                "total_revenue": 100000,
                "total_cogs": 0,
                "gross_profit": 100000,
                "total_operating_expenses": 25000,
                "net_profit": 75000,
            },
        }
        html_out = render_finance_print_html(mock_data)
        self.assertIn("<!doctype html>", html_out.lower())
        self.assertIn("Vision Division Studio", html_out)
        self.assertIn("Profit &amp; Loss Statement", html_out)
        self.assertIn("Rs 75,000.00", html_out)

    def test_telemetry_recording_and_averages(self):
        record_web_vital({"name": "LCP", "value": 1200.0})
        record_web_vital({"name": "LCP", "value": 1400.0})
        record_web_vital({"name": "CLS", "value": 0.01})

        summary = get_web_vitals_summary()
        self.assertEqual(summary["sample_count"], 3)
        self.assertEqual(summary["metrics"]["LCP"]["avg"], 1300.0)
        self.assertEqual(summary["metrics"]["CLS"]["avg"], 0.01)

    @patch("services.database.get_connection")
    def test_combined_performance_telemetry(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value = mock_conn
        mock_cursor.fetchall.return_value = []

        res = get_combined_performance_telemetry()
        self.assertIn("web_vitals", res)
        self.assertIn("persisted_web_vitals", res)
        self.assertIn("db_audit", res)


if __name__ == "__main__":
    unittest.main()
