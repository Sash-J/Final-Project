"""Phase 2 Financial Reports & Server-Rendered Print View (Profit & Loss, Trial Balance, GL, Capital/Drawings)."""

from datetime import date
import html

from .database import get_connection
from .finance_operations import _f, _serialize_rows
from .finance_validation import parse_iso_date, parse_optional_int

VALID_REPORT_TYPES = frozenset(
    {"pnl", "income_expense", "trial_balance", "general_ledger", "capital_drawings"}
)


def _format_money(val):
    return f"Rs {float(val or 0):,.2f}"


def generate_financial_report(
    report_type="pnl",
    scope="all",
    project_id=None,
    date_from=None,
    date_to=None,
    can_view_personal=True,
):
    """Generate structured financial statements from immutable double-entry ledger entries."""
    r_type = str(report_type or "pnl").strip().lower()
    if r_type not in VALID_REPORT_TYPES:
        raise ValueError(f"Unsupported report_type '{r_type}'.")

    req_scope = str(scope or "all").strip().lower()
    if req_scope not in ("all", "project", "company", "personal"):
        req_scope = "all"
    if not can_view_personal:
        if r_type == "capital_drawings":
            raise PermissionError("Forbidden: missing permission to view Capital & Drawings statements.")
        req_scope = "project"

    proj_id = parse_optional_int(project_id, "project_id")
    if proj_id:
        req_scope = "project"

    d_from = parse_iso_date(date_from, "date_from", required=False)
    d_to = parse_iso_date(date_to, "date_to", required=False)
    if d_from and d_to and d_to < d_from:
        raise ValueError("date_to cannot be earlier than date_from.")

    where = ["1=1"]
    params = []
    if req_scope != "all":
        where.append("fle.scope = %s")
        params.append(req_scope)
    if proj_id:
        where.append("fle.project_id = %s")
        params.append(proj_id)
    if d_from:
        where.append("fle.entry_date >= %s")
        params.append(d_from)
    if d_to:
        where.append("fle.entry_date <= %s")
        params.append(d_to)
    if not can_view_personal:
        where.append("fa.account_class NOT IN ('drawings', 'equity')")

    where_sql = " AND ".join(where)

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        meta = {
            "report_type": r_type,
            "scope": req_scope,
            "project_id": proj_id,
            "date_from": d_from.strftime("%Y-%m-%d") if d_from else None,
            "date_to": d_to.strftime("%Y-%m-%d") if d_to else None,
            "generated_on": date.today().strftime("%Y-%m-%d"),
        }

        if r_type in ("pnl", "income_expense"):
            cursor.execute(
                f"""
                SELECT
                    fa.id AS account_id, fa.code, fa.name, fa.account_class, fa.sub_type,
                    COALESCE(SUM(fle.debit), 0) AS debit,
                    COALESCE(SUM(fle.credit), 0) AS credit
                FROM finance_ledger_entries fle
                JOIN finance_accounts fa ON fa.id = fle.account_id
                WHERE {where_sql}
                GROUP BY fa.id, fa.code, fa.name, fa.account_class, fa.sub_type
                ORDER BY fa.code ASC
                """,
                tuple(params),
            )
            rows = cursor.fetchall()

            income_lines = []
            cogs_lines = []
            expense_lines = []
            drawings_memo = []
            capital_memo = []

            for r in rows:
                deb = float(r["debit"] or 0)
                cred = float(r["credit"] or 0)
                cls = r["account_class"]
                sub = r["sub_type"]
                item = {
                    "account_id": r["account_id"],
                    "code": r["code"],
                    "name": r["name"],
                    "account_class": cls,
                    "sub_type": sub,
                }
                if cls == "income":
                    item["amount"] = round(cred - deb, 2)
                    if item["amount"] != 0:
                        income_lines.append(item)
                elif cls == "cogs":
                    item["amount"] = round(deb - cred, 2)
                    if item["amount"] != 0:
                        cogs_lines.append(item)
                elif cls == "expense":
                    item["amount"] = round(deb - cred, 2)
                    if item["amount"] != 0:
                        expense_lines.append(item)
                elif cls == "drawings" and can_view_personal:
                    item["amount"] = round(deb - cred, 2)
                    if item["amount"] != 0:
                        drawings_memo.append(item)
                elif sub == "capital" and can_view_personal:
                    item["amount"] = round(cred - deb, 2)
                    if item["amount"] != 0:
                        capital_memo.append(item)

            total_revenue = round(sum(x["amount"] for x in income_lines), 2)
            total_cogs = round(sum(x["amount"] for x in cogs_lines), 2)
            gross_profit = round(total_revenue - total_cogs, 2)
            total_operating_expenses = round(sum(x["amount"] for x in expense_lines), 2)
            # Net Profit strictly excludes Owner Drawings & Capital Injections
            net_profit = round(gross_profit - total_operating_expenses, 2)

            return {
                "meta": meta,
                "sections": {
                    "income": income_lines,
                    "cogs": cogs_lines,
                    "operating_expenses": expense_lines,
                },
                "equity_memo": {
                    "capital_injections": capital_memo,
                    "owner_drawings": drawings_memo,
                    "total_capital": round(sum(x["amount"] for x in capital_memo), 2),
                    "total_drawings": round(sum(x["amount"] for x in drawings_memo), 2),
                },
                "totals": {
                    "total_revenue": total_revenue,
                    "total_cogs": total_cogs,
                    "gross_profit": gross_profit,
                    "total_operating_expenses": total_operating_expenses,
                    "net_profit": net_profit,
                },
            }

        if r_type == "trial_balance":
            cursor.execute(
                f"""
                SELECT
                    fa.id AS account_id, fa.code, fa.name, fa.account_class, fa.normal_balance,
                    COALESCE(SUM(fle.debit), 0) AS debit,
                    COALESCE(SUM(fle.credit), 0) AS credit
                FROM finance_ledger_entries fle
                JOIN finance_accounts fa ON fa.id = fle.account_id
                WHERE {where_sql}
                GROUP BY fa.id, fa.code, fa.name, fa.account_class, fa.normal_balance
                HAVING debit != 0 OR credit != 0
                ORDER BY fa.code ASC
                """,
                tuple(params),
            )
            tb_rows = []
            tot_dr = 0.0
            tot_cr = 0.0
            for r in cursor.fetchall():
                deb = round(float(r["debit"] or 0), 2)
                cred = round(float(r["credit"] or 0), 2)
                tot_dr += deb
                tot_cr += cred
                net_dr = round(max(0.0, deb - cred), 2)
                net_cr = round(max(0.0, cred - deb), 2)
                tb_rows.append(
                    {
                        "account_id": r["account_id"],
                        "code": r["code"],
                        "name": r["name"],
                        "account_class": r["account_class"],
                        "period_debit": deb,
                        "period_credit": cred,
                        "closing_debit": net_dr,
                        "closing_credit": net_cr,
                    }
                )
            return {
                "meta": meta,
                "rows": tb_rows,
                "totals": {
                    "total_debit": round(tot_dr, 2),
                    "total_credit": round(tot_cr, 2),
                    "is_balanced": round(tot_dr, 2) == round(tot_cr, 2),
                },
            }

        if r_type == "general_ledger":
            cursor.execute(
                f"""
                SELECT
                    fle.id, fle.entry_date, ft.voucher_no, ft.doc_type, fle.scope,
                    fa.code AS account_code, fa.name AS account_name,
                    p.project_name, COALESCE(u.full_name, u.username) AS person_name,
                    fle.debit, fle.credit, fle.memo
                FROM finance_ledger_entries fle
                JOIN finance_transactions ft ON ft.id = fle.transaction_id
                JOIN finance_accounts fa ON fa.id = fle.account_id
                LEFT JOIN projects p ON p.id = fle.project_id
                LEFT JOIN users u ON u.id = fle.person_user_id
                WHERE {where_sql}
                ORDER BY fle.entry_date ASC, fle.id ASC
                LIMIT 1000
                """,
                tuple(params),
            )
            gl_rows = _serialize_rows(cursor.fetchall())
            tot_dr = round(sum(float(r["debit"] or 0) for r in gl_rows), 2)
            tot_cr = round(sum(float(r["credit"] or 0) for r in gl_rows), 2)
            return {
                "meta": meta,
                "rows": gl_rows,
                "totals": {"total_debit": tot_dr, "total_credit": tot_cr, "row_count": len(gl_rows)},
            }

        # r_type == "capital_drawings"
        cursor.execute(
            f"""
            SELECT
                COALESCE(u.id, 0) AS user_id,
                COALESCE(u.full_name, u.username, fc.name, 'Studio Equity Pool') AS owner_name,
                u.role,
                COALESCE(SUM(CASE WHEN fa.sub_type = 'capital' THEN fle.credit - fle.debit ELSE 0 END), 0) AS capital_contributed,
                COALESCE(SUM(CASE WHEN fa.account_class = 'drawings' THEN fle.debit - fle.credit ELSE 0 END), 0) AS drawings_taken
            FROM finance_ledger_entries fle
            JOIN finance_accounts fa ON fa.id = fle.account_id
            LEFT JOIN users u ON u.id = fle.person_user_id
            LEFT JOIN finance_counterparties fc ON fc.id = fle.counterparty_id
            WHERE ({where_sql})
              AND (fa.sub_type = 'capital' OR fa.account_class = 'drawings')
            GROUP BY user_id, owner_name, u.role
            ORDER BY owner_name ASC
            """,
            tuple(params),
        )
        owners = []
        tot_cap = 0.0
        tot_drw = 0.0
        for r in cursor.fetchall():
            cap = _f(r["capital_contributed"])
            drw = _f(r["drawings_taken"])
            tot_cap += cap
            tot_drw += drw
            owners.append(
                {
                    "user_id": r["user_id"],
                    "owner_name": r["owner_name"],
                    "role": r["role"],
                    "capital_contributed": cap,
                    "drawings_taken": drw,
                    "net_equity": round(cap - drw, 2),
                }
            )

        return {
            "meta": meta,
            "owners": owners,
            "totals": {
                "total_capital": round(tot_cap, 2),
                "total_drawings": round(tot_drw, 2),
                "net_equity": round(tot_cap - tot_drw, 2),
            },
        }
    finally:
        cursor.close()
        conn.close()


def render_finance_print_html(report_data):
    """Render an escaped, standalone printable HTML financial statement (Web Trick #10)."""
    meta = report_data.get("meta", {})
    r_type = meta.get("report_type", "pnl")
    title_map = {
        "pnl": "Profit & Loss Statement",
        "income_expense": "Income & Expense Statement",
        "trial_balance": "Trial Balance",
        "general_ledger": "General Ledger Statement",
        "capital_drawings": "Capital & Drawings Equity Statement",
    }
    title = html.escape(title_map.get(r_type, "Financial Statement"))
    scope_lbl = html.escape(str(meta.get("scope", "all")).upper())
    period_str = html.escape(
        f"{meta.get('date_from') or 'Inception'} to {meta.get('date_to') or meta.get('generated_on', '')}"
    )

    body_html = ""
    if r_type in ("pnl", "income_expense"):
        sec = report_data["sections"]
        tot = report_data["totals"]
        eq = report_data.get("equity_memo", {})

        def _rows_html(items):
            if not items:
                return '<tr><td colspan="2" class="muted">No entries in period</td></tr>'
            return "".join(
                f"<tr><td>{html.escape(i['code'])} &mdash; {html.escape(i['name'])}</td><td class='num'>{_format_money(i['amount'])}</td></tr>"
                for i in items
            )

        body_html = f"""
        <h2>Operating Revenue</h2>
        <table><tbody>{_rows_html(sec['income'])}<tr class="subtotal"><td>Total Revenue</td><td class="num">{_format_money(tot['total_revenue'])}</td></tr></tbody></table>
        <h2>Direct Project Costs (COGS)</h2>
        <table><tbody>{_rows_html(sec['cogs'])}<tr class="subtotal"><td>Gross Profit</td><td class="num">{_format_money(tot['gross_profit'])}</td></tr></tbody></table>
        <h2>Company Operating Expenses</h2>
        <table><tbody>{_rows_html(sec['operating_expenses'])}<tr class="grand"><td>Net Profit / (Loss)</td><td class="num">{_format_money(tot['net_profit'])}</td></tr></tbody></table>
        <div class="memo">
          <strong>Accountable Capital &amp; Drawings (Excluded from P&amp;L Net Profit):</strong>
          Capital Injected: {_format_money(eq.get('total_capital', 0))} |
          Owner Drawings: {_format_money(eq.get('total_drawings', 0))}
        </div>
        """
    elif r_type == "trial_balance":
        tot = report_data["totals"]
        rows = "".join(
            f"<tr><td>{html.escape(r['code'])}</td><td>{html.escape(r['name'])}</td>"
            f"<td class='num'>{_format_money(r['period_debit'])}</td><td class='num'>{_format_money(r['period_credit'])}</td>"
            f"<td class='num'>{_format_money(r['closing_debit'])}</td><td class='num'>{_format_money(r['closing_credit'])}</td></tr>"
            for r in report_data["rows"]
        )
        body_html = f"""
        <table>
          <thead><tr><th>Code</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net Dr</th><th class="num">Net Cr</th></tr></thead>
          <tbody>{rows}<tr class="grand"><td colspan="2">Total</td><td class="num">{_format_money(tot['total_debit'])}</td><td class="num">{_format_money(tot['total_credit'])}</td><td colspan="2">Balanced: {'YES' if tot['is_balanced'] else 'NO'}</td></tr></tbody>
        </table>
        """
    elif r_type == "general_ledger":
        tot = report_data["totals"]
        rows = "".join(
            f"<tr><td>{html.escape(str(r['entry_date']))}</td><td>{html.escape(str(r['voucher_no']))}</td>"
            f"<td>{html.escape(str(r['account_code']))} {html.escape(str(r['account_name']))}</td>"
            f"<td>{html.escape(str(r.get('memo') or ''))}</td>"
            f"<td class='num'>{_format_money(r['debit'])}</td><td class='num'>{_format_money(r['credit'])}</td></tr>"
            for r in report_data["rows"]
        )
        body_html = f"""
        <table>
          <thead><tr><th>Date</th><th>Voucher</th><th>Account</th><th>Memo</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
          <tbody>{rows}<tr class="grand"><td colspan="4">Total ({tot['row_count']} postings)</td><td class="num">{_format_money(tot['total_debit'])}</td><td class="num">{_format_money(tot['total_credit'])}</td></tr></tbody>
        </table>
        """
    else:
        tot = report_data["totals"]
        rows = "".join(
            f"<tr><td>{html.escape(str(o['owner_name']))}</td><td>{html.escape(str(o.get('role') or '-'))}</td>"
            f"<td class='num'>{_format_money(o['capital_contributed'])}</td><td class='num'>{_format_money(o['drawings_taken'])}</td>"
            f"<td class='num'>{_format_money(o['net_equity'])}</td></tr>"
            for o in report_data["owners"]
        )
        body_html = f"""
        <table>
          <thead><tr><th>Director / Partner</th><th>Role</th><th class="num">Capital Injected</th><th class="num">Drawings Taken</th><th class="num">Net Equity</th></tr></thead>
          <tbody>{rows}<tr class="grand"><td colspan="2">Total</td><td class="num">{_format_money(tot['total_capital'])}</td><td class="num">{_format_money(tot['total_drawings'])}</td><td class="num">{_format_money(tot['net_equity'])}</td></tr></tbody>
        </table>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Vision Division &mdash; {title}</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; color: #111827; margin: 32px; }}
    header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }}
    h1 {{ margin: 0; font-size: 20px; }}
    h2 {{ font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; margin: 22px 0 8px; color: #374151; }}
    .meta {{ font-size: 12px; color: #4b5563; text-align: right; }}
    table {{ width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }}
    th, td {{ padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }}
    th {{ background: #f3f4f6; font-weight: 600; }}
    .num {{ text-align: right; font-variant-numeric: tabular-nums; }}
    tr.subtotal td {{ font-weight: 600; background: #f9fafb; }}
    tr.grand td {{ font-weight: 700; border-top: 2px solid #111827; border-bottom: 2px solid #111827; background: #f3f4f6; }}
    .muted {{ color: #6b7280; font-style: italic; }}
    .memo {{ margin-top: 18px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #0969da; font-size: 12px; }}
    @media print {{ body {{ margin: 16px; }} button.print-btn {{ display: none; }} }}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Vision Division Studio</h1>
      <div>{title}</div>
    </div>
    <div class="meta">
      <div>Scope: <strong>{scope_lbl}</strong></div>
      <div>Period: {period_str}</div>
      <div>Generated: {html.escape(str(meta.get('generated_on', '')))}</div>
      <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
    </div>
  </header>
  {body_html}
</body>
</html>"""

