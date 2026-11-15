"""Unit tests for Phase 0 accounting math fixes and Web Vitals RUM telemetry."""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services import db_operations  # noqa: E402
from services.telemetry_service import (  # noqa: E402
    clear_web_vitals_buffer,
    get_web_vitals_summary,
    record_web_vital,
)


class TestPhase0FinancialMath(unittest.TestCase):
    def test_admin_summary_separates_quoted_total_direct_cost_and_margin(self):
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "quoted_client_total": 1200000.0,
            "budgeted_direct_cost": 750000.0,
            "total_received": 500000.0,
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(db_operations, "get_connection", return_value=mock_conn):
            summary = db_operations.get_admin_financial_summary()

        self.assertEqual(summary["quoted_client_total"], 1200000.0)
        self.assertEqual(summary["budgeted_direct_cost"], 750000.0)
        self.assertEqual(summary["projected_gross_margin"], 450000.0)
        self.assertEqual(summary["total_received"], 500000.0)
        self.assertEqual(summary["pending_balance"], 700000.0)
        # Backward-compatible aliases must stay aligned with true quoted total & margin
        self.assertEqual(summary["gross_revenue"], 1200000.0)
        self.assertEqual(summary["gross_profit"], 450000.0)
        mock_cursor.close.assert_called_once()
        mock_conn.close.assert_called_once()

    def test_projects_financials_includes_canonical_and_legacy_fields(self):
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [
            {
                "id": 7,
                "project_name": "Solaris",
                "code_name": "SOL-07",
                "status": "ACTIVE",
                "budgeted_direct_cost": 300000.0,
                "quoted_client_total": 450000.0,
                "total_paid": 200000.0,
            }
        ]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(db_operations, "get_connection", return_value=mock_conn):
            rows = db_operations.get_all_projects_financials()

        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["budgeted_direct_cost"], 300000.0)
        self.assertEqual(row["quoted_client_total"], 450000.0)
        self.assertEqual(row["projected_gross_margin"], 150000.0)
        self.assertEqual(row["balance"], 250000.0)
        self.assertEqual(row["latest_gross_total"], 300000.0)
        self.assertEqual(row["latest_budget_total"], 450000.0)


class TestPhase0Telemetry(unittest.TestCase):
    def setUp(self):
        clear_web_vitals_buffer()

    def test_record_web_vital_validates_and_aggregates(self):
        ok_rec, err = record_web_vital(
            {"name": "LCP", "value": 1820.456, "route": "finance", "navigationType": "navigate"}
        )
        self.assertIsNone(err)
        self.assertEqual(ok_rec["name"], "LCP")
        self.assertEqual(ok_rec["rating"], "good")
        self.assertEqual(ok_rec["route"], "/finance")

        bad_rec, bad_err = record_web_vital({"name": "INVALID", "value": 100})
        self.assertIsNone(bad_rec)
        self.assertIsNotNone(bad_err)

        summary = get_web_vitals_summary()
        self.assertEqual(summary["sample_count"], 1)
        self.assertEqual(summary["metrics"]["LCP"]["p75"], 1820.46)

    def test_telemetry_route_post_and_authorized_get(self):
        import app as flask_app_module

        flask_app_module.app.config["TESTING"] = True
        client = flask_app_module.app.test_client()
        post_res = client.post(
            "/api/telemetry/web-vitals",
            json={"name": "CLS", "value": 0.025, "route": "/finance", "id": "cls-1"},
        )
        self.assertEqual(post_res.status_code, 202)
        self.assertEqual(post_res.get_json()["metric"]["rating"], "good")

        bad_res = client.post("/api/telemetry/web-vitals", json={"name": "CLS", "value": -5})
        self.assertEqual(bad_res.status_code, 400)

        unauth_get = client.get("/api/telemetry/web-vitals")
        self.assertEqual(unauth_get.status_code, 401)


if __name__ == "__main__":
    unittest.main()

