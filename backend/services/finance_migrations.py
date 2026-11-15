"""Phase 1 expandable double-entry Finance DB schema migrations, seeding, and payment sync."""

from datetime import date, datetime
from decimal import Decimal
import calendar
import json

from .database import get_connection

DEFAULT_ENTITY_CODE = "VD-STUDIO"
DEFAULT_ENTITY_NAME = "Vision Division Studio"
DEFAULT_BASE_CURRENCY = "LKR"

# Hierarchical seed Chart of Accounts: (code, parent_code, name, account_class, sub_type, normal_balance, allow_direct_posting)
SEED_ACCOUNTS = [
    # Group headers (non-postable rollup nodes)
    ("1000", None, "Assets", "asset", "general", "debit", 0),
    ("2000", None, "Liabilities", "liability", "general", "credit", 0),
    ("3000", None, "Equity, Capital & Drawings", "equity", "general", "credit", 0),
    ("4000", None, "Revenue & Income", "income", "general", "credit", 0),
    ("5000", None, "Direct Project Costs (COGS)", "cogs", "general", "debit", 0),
    ("6000", None, "Company Operating Expenses", "expense", "general", "debit", 0),
    # 1xxx Assets
    ("1010", "1000", "Cash on Hand & Petty Cash", "asset", "cash", "debit", 1),
    ("1020", "1000", "Studio Operating Bank Account", "asset", "bank", "debit", 1),
    ("1100", "1000", "Accounts Receivable (Debtors)", "asset", "ar", "debit", 1),
    ("1200", "1000", "Crew & Staff Advances Receivable", "asset", "advance", "debit", 1),
    ("1500", "1000", "Studio Equipment & Fixed Assets", "asset", "fixed_asset", "debit", 1),
    ("1590", "1000", "Accumulated Depreciation", "asset", "accum_depr", "credit", 1),
    # 2xxx Liabilities
    ("2010", "2000", "Accounts Payable (Creditors)", "liability", "ap", "credit", 1),
    ("2100", "2000", "Crew & Vendor Payables", "liability", "ap", "credit", 1),
    ("2200", "2000", "Tax & Statutory Payables", "liability", "tax", "credit", 1),
    ("2300", "2000", "Loans & Equipment Financing", "liability", "general", "credit", 1),
    # 3xxx Equity / Capital / Drawings
    ("3010", "3000", "Owner & Partner Paid-In Capital", "equity", "capital", "credit", 1),
    ("3020", "3000", "Owner & Director Drawings", "drawings", "drawings", "debit", 1),
    ("3900", "3000", "Retained Earnings", "equity", "retained_earnings", "credit", 1),
    # 4xxx Income
    ("4010", "4000", "Project Production Income", "income", "project_income", "credit", 1),
    ("4020", "4000", "Company Other & Studio Income", "income", "other_income", "credit", 1),
    # 5xxx Direct Project Costs
    ("5010", "5000", "Direct Project Production Expense", "cogs", "direct_cost", "debit", 1),
    ("5020", "5000", "Crew Fees & Project Talent", "cogs", "direct_cost", "debit", 1),
    ("5030", "5000", "Equipment & Location Rentals", "cogs", "direct_cost", "debit", 1),
    # 6xxx Operating Overhead
    ("6010", "6000", "General Studio Overhead", "expense", "overhead", "debit", 1),
    ("6020", "6000", "Staff Salaries & Admin Payroll", "expense", "payroll", "debit", 1),
    ("6030", "6000", "Studio Rent, Utilities & Software", "expense", "overhead", "debit", 1),
    ("6200", "6000", "Depreciation Expense", "expense", "overhead", "debit", 1),
]

TABLE_DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS finance_entities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(24) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        entity_type VARCHAR(40) NOT NULL DEFAULT 'studio',
        base_currency CHAR(3) NOT NULL DEFAULT 'LKR',
        fiscal_year_start_month TINYINT NOT NULL DEFAULT 4,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_fiscal_periods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        period_code VARCHAR(16) NOT NULL,
        period_name VARCHAR(64) NOT NULL,
        fiscal_year INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'open',
        closed_by INT NULL,
        closed_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ffp_entity_code (entity_id, period_code),
        INDEX idx_ffp_entity_dates (entity_id, start_date, end_date),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        parent_id INT NULL,
        code VARCHAR(24) NOT NULL,
        name VARCHAR(120) NOT NULL,
        account_class VARCHAR(40) NOT NULL,
        sub_type VARCHAR(40) NOT NULL DEFAULT 'general',
        normal_balance VARCHAR(16) NOT NULL,
        hierarchy_path VARCHAR(255) NOT NULL DEFAULT '',
        description VARCHAR(255) NULL,
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        allow_direct_posting TINYINT(1) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fa_entity_code (entity_id, code),
        INDEX idx_fa_entity_class (entity_id, account_class, is_active),
        INDEX idx_fa_parent (parent_id),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES finance_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_bank_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        gl_account_id INT NOT NULL,
        account_kind VARCHAR(40) NOT NULL DEFAULT 'checking',
        bank_name VARCHAR(120) NOT NULL,
        account_label VARCHAR(120) NOT NULL,
        account_number_masked VARCHAR(32) NULL,
        currency_code CHAR(3) NOT NULL DEFAULT 'LKR',
        opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fba_entity_label (entity_id, account_label),
        INDEX idx_fba_gl (gl_account_id),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (gl_account_id) REFERENCES finance_accounts(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_tax_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        code VARCHAR(24) NOT NULL,
        name VARCHAR(100) NOT NULL,
        rate_pct DECIMAL(6,3) NOT NULL DEFAULT 0.000,
        tax_direction VARCHAR(40) NOT NULL DEFAULT 'none',
        liability_account_id INT NULL,
        is_recoverable TINYINT(1) NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ftc_entity_code (entity_id, code),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (liability_account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_counterparties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        user_id INT NULL,
        party_type VARCHAR(40) NOT NULL,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(30) NULL,
        tax_id VARCHAR(60) NULL,
        payment_terms_days INT NOT NULL DEFAULT 30,
        credit_limit DECIMAL(15,2) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fc_entity_user (entity_id, user_id),
        INDEX idx_fc_entity_type (entity_id, party_type, is_active),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        fiscal_period_id INT NOT NULL,
        voucher_no VARCHAR(36) NOT NULL UNIQUE,
        doc_type VARCHAR(40) NOT NULL,
        scope VARCHAR(40) NOT NULL,
        primary_project_id INT NULL,
        primary_user_id INT NULL,
        counterparty_id INT NULL,
        settlement_account_id INT NULL,
        bank_account_id INT NULL,
        tx_date DATE NOT NULL,
        due_date DATE NULL,
        currency_code CHAR(3) NOT NULL DEFAULT 'LKR',
        exchange_rate DECIMAL(14,6) NOT NULL DEFAULT 1.000000,
        subtotal_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        settled_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        payment_method VARCHAR(50) NULL,
        bank_ref VARCHAR(100) NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'posted',
        description VARCHAR(255) NOT NULL,
        notes TEXT NULL,
        parent_tx_id INT NULL,
        reversal_of_tx_id INT NULL,
        source_table VARCHAR(64) NULL,
        source_id INT NULL,
        created_by INT NULL,
        approved_by INT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        voided_by INT NULL,
        voided_at TIMESTAMP NULL DEFAULT NULL,
        void_reason VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ft_source (source_table, source_id),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (fiscal_period_id) REFERENCES finance_fiscal_periods(id) ON DELETE RESTRICT,
        FOREIGN KEY (primary_project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (primary_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (counterparty_id) REFERENCES finance_counterparties(id) ON DELETE SET NULL,
        FOREIGN KEY (settlement_account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (bank_account_id) REFERENCES finance_bank_accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_tx_id) REFERENCES finance_transactions(id) ON DELETE SET NULL,
        FOREIGN KEY (reversal_of_tx_id) REFERENCES finance_transactions(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_transaction_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        line_no INT NOT NULL DEFAULT 1,
        account_id INT NOT NULL,
        tax_code_id INT NULL,
        project_id INT NULL,
        department_id INT NULL,
        budget_item_id INT NULL,
        person_user_id INT NULL,
        cost_center_code VARCHAR(32) NULL,
        description VARCHAR(255) NOT NULL,
        quantity DECIMAL(12,3) NOT NULL DEFAULT 1.000,
        unit_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        line_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (tax_code_id) REFERENCES finance_tax_codes(id) ON DELETE SET NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE SET NULL,
        FOREIGN KEY (person_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_reconciliations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        bank_account_id INT NOT NULL,
        statement_date DATE NOT NULL,
        statement_balance DECIMAL(15,2) NOT NULL,
        cleared_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(40) NOT NULL DEFAULT 'draft',
        reconciled_by INT NULL,
        reconciled_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (bank_account_id) REFERENCES finance_bank_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (reconciled_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_ledger_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        fiscal_period_id INT NOT NULL,
        transaction_id INT NOT NULL,
        transaction_line_id INT NULL,
        entry_date DATE NOT NULL,
        account_id INT NOT NULL,
        scope VARCHAR(40) NOT NULL,
        project_id INT NULL,
        department_id INT NULL,
        person_user_id INT NULL,
        counterparty_id INT NULL,
        debit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        credit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        currency_code CHAR(3) NOT NULL DEFAULT 'LKR',
        fx_debit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        fx_credit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        reconciliation_id INT NULL,
        memo VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (fiscal_period_id) REFERENCES finance_fiscal_periods(id) ON DELETE RESTRICT,
        FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (transaction_line_id) REFERENCES finance_transaction_lines(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        FOREIGN KEY (person_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (counterparty_id) REFERENCES finance_counterparties(id) ON DELETE SET NULL,
        FOREIGN KEY (reconciliation_id) REFERENCES finance_reconciliations(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_settlements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        target_tx_id INT NOT NULL,
        settlement_tx_id INT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        settlement_date DATE NOT NULL,
        notes VARCHAR(255) NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fs_target (target_tx_id),
        INDEX idx_fs_settlement (settlement_tx_id),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (target_tx_id) REFERENCES finance_transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (settlement_tx_id) REFERENCES finance_transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_period_account_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT NOT NULL,
        fiscal_period_id INT NOT NULL,
        account_id INT NOT NULL,
        scope VARCHAR(40) NOT NULL,
        project_key INT NOT NULL DEFAULT 0,
        person_key INT NOT NULL DEFAULT 0,
        period_debit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        period_credit DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fpab_bucket (entity_id, fiscal_period_id, account_id, scope, project_key, person_key),
        FOREIGN KEY (entity_id) REFERENCES finance_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (fiscal_period_id) REFERENCES finance_fiscal_periods(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(40) NOT NULL,
        entity_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        byte_size INT NOT NULL DEFAULT 0,
        storage_driver VARCHAR(40) NOT NULL DEFAULT 'db_blob',
        payload MEDIUMTEXT NULL,
        checksum_sha256 CHAR(64) NULL,
        uploaded_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fatt_entity (entity_type, entity_id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS finance_audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(40) NOT NULL,
        entity_id INT NOT NULL,
        action VARCHAR(40) NOT NULL,
        actor_user_id INT NULL,
        before_json LONGTEXT NULL,
        after_json LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fal_entity (entity_type, entity_id, created_at DESC),
        INDEX idx_fal_actor (actor_user_id, created_at DESC),
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
    """
    CREATE TABLE IF NOT EXISTS web_vitals_telemetry (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        metric_name VARCHAR(24) NOT NULL,
        metric_value DECIMAL(12,4) NOT NULL,
        rating VARCHAR(24) NOT NULL DEFAULT 'unknown',
        route VARCHAR(160) NOT NULL DEFAULT '/',
        viewport VARCHAR(40) NULL,
        recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wvt_metric_time (metric_name, recorded_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    """,
]


def _coerce_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return datetime.strptime(value.strip()[:10], "%Y-%m-%d").date()
    return date.today()


def _to_decimal_2(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _ensure_default_entity(cursor):
    cursor.execute(
        "SELECT id FROM finance_entities WHERE code = %s",
        (DEFAULT_ENTITY_CODE,),
    )
    row = cursor.fetchone()
    if row:
        return row["id"] if isinstance(row, dict) else row[0]

    cursor.execute(
        """
        INSERT INTO finance_entities (code, name, entity_type, base_currency, fiscal_year_start_month, is_active)
        VALUES (%s, %s, 'studio', %s, 4, 1)
        """,
        (DEFAULT_ENTITY_CODE, DEFAULT_ENTITY_NAME, DEFAULT_BASE_CURRENCY),
    )
    return cursor.lastrowid


def ensure_fiscal_period(cursor, entity_id, target_date):
    """Return an existing or newly created monthly fiscal_period_id covering target_date."""
    dt = _coerce_date(target_date)
    period_code = f"{dt.year:04d}-{dt.month:02d}"
    cursor.execute(
        "SELECT id FROM finance_fiscal_periods WHERE entity_id = %s AND period_code = %s",
        (entity_id, period_code),
    )
    row = cursor.fetchone()
    if row:
        return row["id"] if isinstance(row, dict) else row[0]

    last_day = calendar.monthrange(dt.year, dt.month)[1]
    start_dt = date(dt.year, dt.month, 1)
    end_dt = date(dt.year, dt.month, last_day)
    fiscal_year = dt.year if dt.month >= 4 else dt.year - 1
    period_name = dt.strftime("%B %Y")

    cursor.execute(
        """
        INSERT INTO finance_fiscal_periods (entity_id, period_code, period_name, fiscal_year, start_date, end_date, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'open')
        """,
        (entity_id, period_code, period_name, fiscal_year, start_dt, end_dt),
    )
    return cursor.lastrowid


def _seed_chart_of_accounts(cursor, entity_id):
    cursor.execute(
        "SELECT id, code FROM finance_accounts WHERE entity_id = %s",
        (entity_id,),
    )
    code_to_id = {}
    for row in cursor.fetchall():
        if isinstance(row, dict):
            code_to_id[row["code"]] = row["id"]
        else:
            code_to_id[row[1]] = row[0]

    for code, parent_code, name, account_class, sub_type, normal_balance, allow_post in SEED_ACCOUNTS:
        if code in code_to_id:
            continue
        parent_id = code_to_id.get(parent_code) if parent_code else None
        hierarchy_path = f"{parent_code}/{code}" if parent_code else code
        cursor.execute(
            """
            INSERT INTO finance_accounts (
                entity_id, parent_id, code, name, account_class, sub_type,
                normal_balance, hierarchy_path, is_system, allow_direct_posting, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1, %s, 1)
            """,
            (
                entity_id,
                parent_id,
                code,
                name,
                account_class,
                sub_type,
                normal_balance,
                hierarchy_path,
                allow_post,
            ),
        )
        code_to_id[code] = cursor.lastrowid

    return code_to_id


def _seed_bank_and_tax_defaults(cursor, entity_id, code_to_id):
    bank_gl = code_to_id.get("1020")
    cash_gl = code_to_id.get("1010")
    tax_gl = code_to_id.get("2200")

    if bank_gl:
        cursor.execute(
            """
            INSERT IGNORE INTO finance_bank_accounts (
                entity_id, gl_account_id, account_kind, bank_name, account_label,
                currency_code, opening_balance, is_default, is_active
            ) VALUES (%s, %s, 'checking', 'Studio Main Bank', 'Studio Operating Account', %s, 0.00, 1, 1)
            """,
            (entity_id, bank_gl, DEFAULT_BASE_CURRENCY),
        )
    if cash_gl:
        cursor.execute(
            """
            INSERT IGNORE INTO finance_bank_accounts (
                entity_id, gl_account_id, account_kind, bank_name, account_label,
                currency_code, opening_balance, is_default, is_active
            ) VALUES (%s, %s, 'petty_cash', 'Studio Safe', 'Petty Cash Vault', %s, 0.00, 0, 1)
            """,
            (entity_id, cash_gl, DEFAULT_BASE_CURRENCY),
        )

    tax_seeds = [
        ("EXEMPT", "Tax Exempt / Zero-Rated", Decimal("0.000"), "none", None, 0),
        ("VAT-18", "Standard VAT 18%", Decimal("18.000"), "output", tax_gl, 1),
        ("WHT-5", "Withholding Tax 5%", Decimal("5.000"), "withholding", tax_gl, 0),
    ]
    for code, name, rate_pct, direction, liab_id, recoverable in tax_seeds:
        cursor.execute(
            """
            INSERT IGNORE INTO finance_tax_codes (
                entity_id, code, name, rate_pct, tax_direction,
                liability_account_id, is_recoverable, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
            """,
            (entity_id, code, name, rate_pct, direction, liab_id, recoverable),
        )


def _seed_fiscal_year_window(cursor, entity_id):
    today = date.today()
    for yr in range(today.year - 1, today.year + 2):
        for mo in range(1, 13):
            ensure_fiscal_period(cursor, entity_id, date(yr, mo, 1))


def apply_period_balance_delta(
    cursor,
    entity_id,
    fiscal_period_id,
    account_id,
    scope,
    project_id,
    person_user_id,
    debit_delta,
    credit_delta,
):
    """Incrementally update finance_period_account_balances inside an active transaction."""
    project_key = int(project_id or 0)
    person_key = int(person_user_id or 0)
    debit_val = _to_decimal_2(debit_delta)
    credit_val = _to_decimal_2(credit_delta)

    cursor.execute(
        """
        INSERT INTO finance_period_account_balances (
            entity_id, fiscal_period_id, account_id, scope, project_key, person_key,
            period_debit, period_credit
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            period_debit = ROUND(period_debit + VALUES(period_debit), 2),
            period_credit = ROUND(period_credit + VALUES(period_credit), 2)
        """,
        (
            entity_id,
            fiscal_period_id,
            account_id,
            scope,
            project_key,
            person_key,
            debit_val,
            credit_val,
        ),
    )


def _reverse_tx_period_balances(cursor, transaction_id):
    cursor.execute(
        """
        SELECT entity_id, fiscal_period_id, account_id, scope, project_id, person_user_id, debit, credit
        FROM finance_ledger_entries
        WHERE transaction_id = %s
        """,
        (transaction_id,),
    )
    rows = cursor.fetchall()
    for row in rows:
        if isinstance(row, dict):
            ent_id = row["entity_id"]
            fp_id = row["fiscal_period_id"]
            acc_id = row["account_id"]
            scope = row["scope"]
            proj_id = row["project_id"]
            usr_id = row["person_user_id"]
            deb = row["debit"]
            cred = row["credit"]
        else:
            ent_id, fp_id, acc_id, scope, proj_id, usr_id, deb, cred = row

        apply_period_balance_delta(
            cursor,
            ent_id,
            fp_id,
            acc_id,
            scope,
            proj_id,
            usr_id,
            -_to_decimal_2(deb),
            -_to_decimal_2(cred),
        )


def _resolve_payment_sync_context(cursor, payment_method):
    cursor.execute(
        "SELECT id FROM finance_entities WHERE code = %s",
        (DEFAULT_ENTITY_CODE,),
    )
    ent_row = cursor.fetchone()
    if not ent_row:
        return None
    entity_id = ent_row["id"] if isinstance(ent_row, dict) else ent_row[0]

    cursor.execute(
        "SELECT id, code FROM finance_accounts WHERE entity_id = %s AND code IN ('1010', '1020', '4010')",
        (entity_id,),
    )
    accounts = {}
    for r in cursor.fetchall():
        if isinstance(r, dict):
            accounts[r["code"]] = r["id"]
        else:
            accounts[r[1]] = r[0]

    if "4010" not in accounts or ("1020" not in accounts and "1010" not in accounts):
        return None

    is_cash = str(payment_method or "").strip().lower() == "cash"
    asset_acct_id = accounts.get("1010") if is_cash else (accounts.get("1020") or accounts.get("1010"))

    bank_kind = "petty_cash" if is_cash else "checking"
    cursor.execute(
        """
        SELECT id FROM finance_bank_accounts
        WHERE entity_id = %s AND account_kind = %s AND is_active = 1
        ORDER BY is_default DESC, id ASC LIMIT 1
        """,
        (entity_id, bank_kind),
    )
    bank_row = cursor.fetchone()
    if not bank_row:
        cursor.execute(
            "SELECT id FROM finance_bank_accounts WHERE entity_id = %s AND is_active = 1 ORDER BY is_default DESC, id ASC LIMIT 1",
            (entity_id,),
        )
        bank_row = cursor.fetchone()
    bank_acct_id = (bank_row["id"] if isinstance(bank_row, dict) else bank_row[0]) if bank_row else None

    return {
        "entity_id": entity_id,
        "asset_account_id": asset_acct_id,
        "income_account_id": accounts["4010"],
        "bank_account_id": bank_acct_id,
    }


def _sync_single_payment_row(cursor, pay_row, actor_user_id=None):
    pay_id = pay_row["id"] if isinstance(pay_row, dict) else pay_row[0]
    project_id = pay_row["project_id"] if isinstance(pay_row, dict) else pay_row[1]
    amount = _to_decimal_2(pay_row["amount"] if isinstance(pay_row, dict) else pay_row[2])
    payment_date = _coerce_date(pay_row["payment_date"] if isinstance(pay_row, dict) else pay_row[3])
    notes = pay_row["notes"] if isinstance(pay_row, dict) else pay_row[4]
    bank_ref = pay_row["bank_ref"] if isinstance(pay_row, dict) else pay_row[5]
    payment_method = (pay_row["payment_method"] if isinstance(pay_row, dict) else pay_row[6]) or "Bank Transfer"
    description = (pay_row["description"] if isinstance(pay_row, dict) else pay_row[7]) or f"Client Payment #{pay_id}"
    signatory_id = pay_row["signatory_id"] if isinstance(pay_row, dict) else pay_row[8]
    raw_project_name = pay_row.get("project_name") if isinstance(pay_row, dict) else (pay_row[9] if len(pay_row) > 9 else None)
    project_name = raw_project_name or f"Project #{project_id}"

    ctx = _resolve_payment_sync_context(cursor, payment_method)
    if not ctx:
        return None

    entity_id = ctx["entity_id"]
    fiscal_period_id = ensure_fiscal_period(cursor, entity_id, payment_date)
    asset_acct_id = ctx["asset_account_id"]
    income_acct_id = ctx["income_account_id"]
    bank_acct_id = ctx["bank_account_id"]

    clean_desc = str(description).strip()[:255] or f"Client payment for {project_name}"
    memo = f"{clean_desc} ({project_name})"[:255]
    voucher_no = f"PAY-{int(pay_id):06d}"

    cursor.execute(
        "SELECT id, total_amount, tx_date, description FROM finance_transactions WHERE source_table = 'payments' AND source_id = %s",
        (pay_id,),
    )
    existing = cursor.fetchone()
    if existing:
        tx_id = existing["id"] if isinstance(existing, dict) else existing[0]
        before_snapshot = {
            "total_amount": str(existing["total_amount"] if isinstance(existing, dict) else existing[1]),
            "tx_date": str(existing["tx_date"] if isinstance(existing, dict) else existing[2]),
            "description": existing["description"] if isinstance(existing, dict) else existing[3],
        }
        _reverse_tx_period_balances(cursor, tx_id)
        cursor.execute("DELETE FROM finance_ledger_entries WHERE transaction_id = %s", (tx_id,))
        cursor.execute("DELETE FROM finance_transaction_lines WHERE transaction_id = %s", (tx_id,))
        cursor.execute(
            """
            UPDATE finance_transactions
            SET entity_id = %s, fiscal_period_id = %s, primary_project_id = %s,
                settlement_account_id = %s, bank_account_id = %s, tx_date = %s,
                subtotal_amount = %s, tax_amount = 0.00, total_amount = %s, settled_amount = %s,
                payment_method = %s, bank_ref = %s, status = 'posted',
                description = %s, notes = %s, approved_by = COALESCE(%s, approved_by)
            WHERE id = %s
            """,
            (
                entity_id,
                fiscal_period_id,
                project_id,
                asset_acct_id,
                bank_acct_id,
                payment_date,
                amount,
                amount,
                amount,
                payment_method,
                bank_ref,
                clean_desc,
                notes,
                signatory_id,
                tx_id,
            ),
        )
        audit_action = "PAYMENT_SYNC_UPDATE"
    else:
        before_snapshot = None
        cursor.execute(
            """
            INSERT INTO finance_transactions (
                entity_id, fiscal_period_id, voucher_no, doc_type, scope,
                primary_project_id, settlement_account_id, bank_account_id,
                tx_date, currency_code, exchange_rate,
                subtotal_amount, tax_amount, total_amount, settled_amount,
                payment_method, bank_ref, status, description, notes,
                source_table, source_id, created_by, approved_by, approved_at
            ) VALUES (
                %s, %s, %s, 'income', 'project',
                %s, %s, %s,
                %s, %s, 1.000000,
                %s, 0.00, %s, %s,
                %s, %s, 'posted', %s, %s,
                'payments', %s, %s, %s, CURRENT_TIMESTAMP
            )
            """,
            (
                entity_id,
                fiscal_period_id,
                voucher_no,
                project_id,
                asset_acct_id,
                bank_acct_id,
                payment_date,
                DEFAULT_BASE_CURRENCY,
                amount,
                amount,
                amount,
                payment_method,
                bank_ref,
                clean_desc,
                notes,
                pay_id,
                actor_user_id or signatory_id,
                signatory_id,
            ),
        )
        tx_id = cursor.lastrowid
        audit_action = "PAYMENT_SYNC_INSERT"

    cursor.execute(
        """
        INSERT INTO finance_transaction_lines (
            transaction_id, line_no, account_id, project_id, description,
            quantity, unit_price, tax_amount, line_total
        ) VALUES (%s, 1, %s, %s, %s, 1.000, %s, 0.00, %s)
        """,
        (tx_id, income_acct_id, project_id, clean_desc, amount, amount),
    )
    line_id = cursor.lastrowid

    # Double-entry posting: Debit Cash/Bank (Asset), Credit Project Income (4010)
    entries = [
        (asset_acct_id, amount, Decimal("0.00")),
        (income_acct_id, Decimal("0.00"), amount),
    ]
    for acct_id, deb, cred in entries:
        cursor.execute(
            """
            INSERT INTO finance_ledger_entries (
                entity_id, fiscal_period_id, transaction_id, transaction_line_id,
                entry_date, account_id, scope, project_id, debit, credit,
                currency_code, fx_debit, fx_credit, memo
            ) VALUES (%s, %s, %s, %s, %s, %s, 'project', %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                entity_id,
                fiscal_period_id,
                tx_id,
                line_id,
                payment_date,
                acct_id,
                project_id,
                deb,
                cred,
                DEFAULT_BASE_CURRENCY,
                deb,
                cred,
                memo,
            ),
        )
        apply_period_balance_delta(
            cursor,
            entity_id,
            fiscal_period_id,
            acct_id,
            "project",
            project_id,
            None,
            deb,
            cred,
        )

    cursor.execute(
        """
        INSERT INTO finance_audit_logs (entity_type, entity_id, action, actor_user_id, before_json, after_json)
        VALUES ('finance_transaction', %s, %s, %s, %s, %s)
        """,
        (
            tx_id,
            audit_action,
            actor_user_id or signatory_id,
            json.dumps(before_snapshot) if before_snapshot else None,
            json.dumps(
                {
                    "source_table": "payments",
                    "source_id": pay_id,
                    "project_id": project_id,
                    "amount": str(amount),
                    "tx_date": str(payment_date),
                    "voucher_no": voucher_no,
                }
            ),
        ),
    )
    return tx_id


def sync_payment_to_ledger(cursor, payment_id, actor_user_id=None):
    """Mirror a payments row into finance_transactions, lines, GL entries, and period balances."""
    cursor.execute("SHOW TABLES LIKE 'finance_transactions'")
    if not cursor.fetchone():
        return None
    cursor.execute(
        """
        SELECT p.id, p.project_id, p.amount, p.payment_date, p.notes,
               p.bank_ref, p.payment_method, p.description, p.signatory_id,
               pr.project_name
        FROM payments p
        LEFT JOIN projects pr ON pr.id = p.project_id
        WHERE p.id = %s
        """,
        (payment_id,),
    )
    row = cursor.fetchone()
    if not row:
        return None
    return _sync_single_payment_row(cursor, row, actor_user_id=actor_user_id)


def purge_project_payment_sync(cursor, project_id):
    """Reverse period balances and remove payment-mirrored ledger entries when a project is deleted."""
    cursor.execute("SHOW TABLES LIKE 'finance_transactions'")
    if not cursor.fetchone():
        return
    cursor.execute(
        "SELECT id FROM finance_transactions WHERE source_table = 'payments' AND primary_project_id = %s",
        (project_id,),
    )
    tx_rows = cursor.fetchall()
    for r in tx_rows:
        tx_id = r["id"] if isinstance(r, dict) else r[0]
        _reverse_tx_period_balances(cursor, tx_id)
    if tx_rows:
        cursor.execute(
            "DELETE FROM finance_transactions WHERE source_table = 'payments' AND primary_project_id = %s",
            (project_id,),
        )


def _backfill_existing_payments(cursor):
    cursor.execute(
        """
        SELECT p.id, p.project_id, p.amount, p.payment_date, p.notes,
               p.bank_ref, p.payment_method, p.description, p.signatory_id,
               pr.project_name
        FROM payments p
        LEFT JOIN projects pr ON pr.id = p.project_id
        LEFT JOIN finance_transactions ft
          ON ft.source_table = 'payments' AND ft.source_id = p.id
        WHERE ft.id IS NULL
        ORDER BY p.id ASC
        """
    )
    missing_rows = cursor.fetchall()
    synced = 0
    for row in missing_rows:
        if _sync_single_payment_row(cursor, row) is not None:
            synced += 1
    return synced


def run_finance_migrations():
    """Idempotently create Phase 1 finance schema tables, seed defaults, and backfill payments."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        for ddl in TABLE_DDL_STATEMENTS:
            cursor.execute(ddl)
        conn.commit()

        entity_id = _ensure_default_entity(cursor)
        _seed_fiscal_year_window(cursor, entity_id)
        code_to_id = _seed_chart_of_accounts(cursor, entity_id)
        _seed_bank_and_tax_defaults(cursor, entity_id, code_to_id)
        conn.commit()

        synced_count = _backfill_existing_payments(cursor)
        conn.commit()
        print(f"Finance Migration: 15 tables verified, seeded entity_id={entity_id}, backfilled {synced_count} payments.")
        return True
    except Exception as e:
        conn.rollback()
        print("Error during Finance migration:", e)
        raise e
    finally:
        cursor.close()
        conn.close()
