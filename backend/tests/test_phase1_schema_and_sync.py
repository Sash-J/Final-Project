"""Unit tests for Phase 1 finance schema seeds, RBAC permissions, and payment ledger sync."""

from datetime import date
from decimal import Decimal
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services import db_operations  # noqa: E402
from services import finance_migrations  # noqa: E402


class _FakePaymentSyncCursor:
    """Minimal stateful cursor stub validating SQL balance & idempotent payment sync."""

    def __init__(self, existing_tx=None):
        self.existing_tx = existing_tx
        self.executed = []
        self.ledger_inserts = []
        self.period_deltas = []
        self._last_result = None
        self._last_all = []
        self.lastrowid = 100
        self.rowcount = 1

    def execute(self, sql, params=None):
        norm = " ".join(sql.split())
        self.executed.append((norm, params))
        if norm.startswith("SHOW TABLES LIKE 'finance_transactions'"):
            self._last_result = ("finance_transactions",)
        elif norm.startswith("SELECT p.id, p.project_id"):
            self._last_result = (
                42,
                16,
                Decimal("250000.00"),
                date(2026, 4, 15),
                "Advance",
                "REF-42",
                "Bank Transfer",
                "Production milestone 1",
                9,
                "Aurora Campaign",
            )
        elif norm.startswith("SELECT id FROM finance_entities"):
            self._last_result = (1,)
        elif norm.startswith("SELECT id, code FROM finance_accounts"):
            self._last_all = [(10, "1010"), (11, "1020"), (40, "4010")]
        elif norm.startswith("SELECT id FROM finance_bank_accounts"):
            self._last_result = (2,)
        elif norm.startswith("SELECT id FROM finance_fiscal_periods"):
            self._last_result = (5,)
        elif norm.startswith("SELECT id, total_amount, tx_date, description FROM finance_transactions"):
            self._last_result = self.existing_tx
        elif norm.startswith("SELECT entity_id, fiscal_period_id, account_id, scope"):
            self._last_all = [
                (1, 5, 11, "project", 16, None, Decimal("200000.00"), Decimal("0.00")),
                (1, 5, 40, "project", 16, None, Decimal("0.00"), Decimal("200000.00")),
            ]
        elif norm.startswith("INSERT INTO finance_transactions"):
            self.lastrowid = 700
        elif norm.startswith("INSERT INTO finance_transaction_lines"):
            self.lastrowid = 800
        elif norm.startswith("INSERT INTO finance_ledger_entries"):
            self.ledger_inserts.append(params)
        elif norm.startswith("INSERT INTO finance_period_account_balances"):
            self.period_deltas.append(params)

    def fetchone(self):
        return self._last_result

    def fetchall(self):
        return self._last_all

    def close(self):
        pass


class TestPhase1SchemaAndSync(unittest.TestCase):
    def test_seed_accounts_keep_strict_separation_of_drawings_capital_income_expense(self):
        by_code = {row[0]: row for row in finance_migrations.SEED_ACCOUNTS}
        self.assertEqual(by_code["3010"][3], "equity")
        self.assertEqual(by_code["3020"][3], "drawings")
        self.assertEqual(by_code["4010"][3], "income")
        self.assertEqual(by_code["4020"][3], "income")
        self.assertEqual(by_code["5010"][3], "cogs")
        self.assertEqual(by_code["6010"][3], "expense")
        # Ensure all 15 normalized tables exist in migration DDL
        self.assertEqual(len(finance_migrations.TABLE_DDL_STATEMENTS), 15)

    def test_sync_payment_insert_posts_balanced_double_entry_and_period_rollup(self):
        cur = _FakePaymentSyncCursor(existing_tx=None)
        tx_id = finance_migrations.sync_payment_to_ledger(cur, 42, actor_user_id=9)

        self.assertEqual(tx_id, 700)
        self.assertEqual(len(cur.ledger_inserts), 2)
        total_debit = sum(entry[7] for entry in cur.ledger_inserts)
        total_credit = sum(entry[8] for entry in cur.ledger_inserts)
        self.assertEqual(total_debit, Decimal("250000.00"))
        self.assertEqual(total_credit, Decimal("250000.00"))
        self.assertEqual(total_debit, total_credit)

        # Bank account 11 debited, Project income 40 credited; project_key=16
        self.assertEqual(cur.ledger_inserts[0][5], 11)
        self.assertEqual(cur.ledger_inserts[1][5], 40)
        self.assertEqual(len(cur.period_deltas), 2)
        self.assertEqual(cur.period_deltas[0][4], 16)
        self.assertEqual(cur.period_deltas[0][6], Decimal("250000.00"))
        self.assertEqual(cur.period_deltas[1][7], Decimal("250000.00"))

    def test_sync_payment_update_reverses_prior_period_deltas_before_reposting(self):
        existing_row = (700, Decimal("200000.00"), date(2026, 4, 15), "Initial deposit")
        cur = _FakePaymentSyncCursor(existing_tx=existing_row)

        tx_id = finance_migrations.sync_payment_to_ledger(cur, 42, actor_user_id=9)
        self.assertEqual(tx_id, 700)
        # Expect 2 reversal deltas (-200k) followed by 2 new deltas (+250k)
        self.assertEqual(len(cur.period_deltas), 4)
        self.assertEqual(cur.period_deltas[0][6], Decimal("-200000.00"))
        self.assertEqual(cur.period_deltas[1][7], Decimal("-200000.00"))
        self.assertEqual(cur.period_deltas[2][6], Decimal("250000.00"))
        self.assertEqual(cur.period_deltas[3][7], Decimal("250000.00"))

    def test_insert_payment_runs_atomic_commit_with_sync(self):
        mock_cursor = MagicMock()
        mock_cursor.lastrowid = 99
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(db_operations, "get_connection", return_value=mock_conn), patch.object(
            finance_migrations, "sync_payment_to_ledger"
        ) as mock_sync:
            new_id = db_operations.insert_payment(16, 50000, "2026-04-20", notes="Test")

        self.assertEqual(new_id, 99)
        mock_sync.assert_called_once_with(mock_cursor, 99, actor_user_id=None)
        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()

