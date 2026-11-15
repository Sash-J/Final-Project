"""Phase 2 Finance Workspace API Blueprint: double-entry ledger, reports, AR/AP, and telemetry."""

from flask import Blueprint, Response, jsonify, request

from core.session_handler import (
    get_current_user_id,
    has_permission,
    permissions_required,
)
from services import finance_operations as fin_ops
from services.finance_reports import generate_financial_report, render_finance_print_html
from services.telemetry_service import get_combined_performance_telemetry

finance_bp = Blueprint("finance_bp", __name__)


def _handle_service_error(err):
    if isinstance(err, PermissionError):
        return jsonify({"error": str(err)}), 403
    if isinstance(err, ValueError):
        return jsonify({"error": str(err)}), 400
    return jsonify({"error": str(err)}), 500


@finance_bp.route("/api/finance/workspace-init", methods=["GET"])
@permissions_required("finance.view")
def finance_workspace_init():
    """Single batched endpoint returning Overview KPIs, Watchlist, Buckets, Trajectory & Taxonomy."""
    try:
        scope = request.args.get("scope", "all")
        timeframe = request.args.get("timeframe", "6M")
        can_personal = has_permission("finance.personal.view")
        data = fin_ops.get_finance_workspace_init(
            scope=scope, timeframe=timeframe, can_view_personal=can_personal
        )
        return jsonify(data), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/taxonomy", methods=["GET"])
@permissions_required("finance.view")
def finance_taxonomy_get():
    try:
        return jsonify(fin_ops.get_finance_taxonomy()), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/accounts", methods=["POST"])
@permissions_required("finance.accounts.manage")
def finance_accounts_post():
    try:
        data = request.get_json(silent=True) or {}
        res = fin_ops.create_account(data, actor_user_id=get_current_user_id())
        return jsonify({"message": "Account created successfully", "account": res}), 201
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/accounts/<int:account_id>", methods=["PUT"])
@permissions_required("finance.accounts.manage")
def finance_accounts_put(account_id):
    try:
        data = request.get_json(silent=True) or {}
        res = fin_ops.update_account(account_id, data, actor_user_id=get_current_user_id())
        return jsonify({"message": "Account updated successfully", "account": res}), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/counterparties", methods=["POST"])
@permissions_required("finance.accounts.manage")
def finance_counterparties_post():
    try:
        data = request.get_json(silent=True) or {}
        res = fin_ops.create_counterparty(data, actor_user_id=get_current_user_id())
        return jsonify({"message": "Counterparty added successfully", "counterparty": res}), 201
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/fiscal-periods/<int:period_id>", methods=["PUT"])
@permissions_required("finance.approve")
def finance_period_status_put(period_id):
    try:
        data = request.get_json(silent=True) or {}
        res = fin_ops.update_fiscal_period_status(
            period_id, data.get("status"), actor_user_id=get_current_user_id()
        )
        return jsonify({"message": "Fiscal period updated", "period": res}), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/transactions", methods=["GET"])
@permissions_required("finance.view")
def finance_transactions_list():
    try:
        can_personal = has_permission("finance.personal.view")
        res = fin_ops.get_transactions_ledger(request.args, can_view_personal=can_personal)
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/transactions/<int:tx_id>", methods=["GET"])
@permissions_required("finance.view")
def finance_transaction_detail(tx_id):
    try:
        can_personal = has_permission("finance.personal.view")
        res = fin_ops.get_transaction_detail(tx_id, can_view_personal=can_personal)
        if not res:
            return jsonify({"error": "Transaction not found"}), 404
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/transactions", methods=["POST"])
@permissions_required("finance.edit")
def finance_transactions_create():
    try:
        data = request.get_json(silent=True) or {}
        can_personal = has_permission("finance.personal.view")
        req_scope = str(data.get("scope") or "").strip().lower()
        req_doc = str(data.get("doc_type") or "").strip().lower()
        if not can_personal and (req_scope != "project" or req_doc in ("drawing", "capital")):
            return jsonify(
                {"error": "Forbidden: missing finance.personal.view permission for company/personal entries."}
            ), 403

        res = fin_ops.post_voucher(
            data,
            actor_user_id=get_current_user_id(),
            can_approve=has_permission("finance.approve"),
        )
        return jsonify({"message": "Voucher recorded successfully", "voucher": res}), 201
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/transactions/<int:tx_id>/post", methods=["POST"])
@permissions_required("finance.approve")
def finance_transaction_approve_post(tx_id):
    try:
        res = fin_ops.approve_post_voucher(tx_id, actor_user_id=get_current_user_id())
        return jsonify({"message": "Voucher posted to General Ledger", "voucher": res}), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/transactions/<int:tx_id>/void", methods=["POST"])
@permissions_required("finance.approve")
def finance_transaction_void(tx_id):
    try:
        data = request.get_json(silent=True) or {}
        res = fin_ops.void_voucher(
            tx_id,
            actor_user_id=get_current_user_id(),
            void_reason=data.get("void_reason") or data.get("reason") or "",
        )
        return jsonify({"message": "Voucher reversed and voided safely", "result": res}), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/settlements", methods=["POST"])
@permissions_required("finance.edit")
def finance_settlements_create():
    try:
        data = request.get_json(silent=True) or {}
        res = fin_ops.settle_counterparty_transaction(data, actor_user_id=get_current_user_id())
        return jsonify({"message": "Settlement allocated successfully", "settlement": res}), 201
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/ledger", methods=["GET"])
@permissions_required("finance.view")
def finance_general_ledger():
    try:
        can_personal = has_permission("finance.personal.view")
        res = fin_ops.get_general_ledger_entries(request.args, can_view_personal=can_personal)
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/projects", methods=["GET"])
@permissions_required("finance.view")
def finance_projects_list():
    try:
        return jsonify(fin_ops.get_project_finances()), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/projects/<int:project_id>", methods=["GET"])
@permissions_required("finance.view")
def finance_project_detail(project_id):
    try:
        res = fin_ops.get_project_finances(project_id=project_id)
        if not res:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/company", methods=["GET"])
@permissions_required("finance.personal.view")
def finance_company_overview():
    try:
        res = fin_ops.get_company_finances(
            date_from=request.args.get("date_from"),
            date_to=request.args.get("date_to"),
        )
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/personal", methods=["GET"])
@permissions_required("finance.personal.view")
def finance_personal_overview():
    try:
        user_id = request.args.get("person_user_id")
        project_id = request.args.get("project_id")
        res = fin_ops.get_personal_finances(
            person_user_id=int(user_id) if user_id else None,
            project_id=int(project_id) if project_id else None,
        )
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/debtors-creditors", methods=["GET"])
@permissions_required("finance.view")
def finance_debtors_creditors():
    try:
        res = fin_ops.get_debtors_creditors(party_filter=request.args.get("type", "all"))
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/reports", methods=["GET"])
@permissions_required("finance.view")
def finance_reports_get():
    try:
        can_personal = has_permission("finance.personal.view")
        res = generate_financial_report(
            report_type=request.args.get("report_type", "pnl"),
            scope=request.args.get("scope", "all"),
            project_id=request.args.get("project_id"),
            date_from=request.args.get("date_from"),
            date_to=request.args.get("date_to"),
            can_view_personal=can_personal,
        )
        return jsonify(res), 200
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/reports/print-view", methods=["GET"])
@permissions_required("finance.export")
def finance_reports_print_view():
    """Server-rendered standalone HTML financial statement view (Web Trick #10)."""
    try:
        can_personal = has_permission("finance.personal.view")
        report_data = generate_financial_report(
            report_type=request.args.get("report_type", "pnl"),
            scope=request.args.get("scope", "all"),
            project_id=request.args.get("project_id"),
            date_from=request.args.get("date_from"),
            date_to=request.args.get("date_to"),
            can_view_personal=can_personal,
        )
        html_doc = render_finance_print_html(report_data)
        return Response(html_doc, status=200, mimetype="text/html")
    except Exception as e:
        return _handle_service_error(e)


@finance_bp.route("/api/finance/telemetry", methods=["GET"])
@permissions_required("finance.view")
def finance_telemetry_summary():
    """Expose combined RUM Web Vitals and SQL query performance audit summary."""
    try:
        return jsonify(get_combined_performance_telemetry()), 200
    except Exception as e:
        return _handle_service_error(e)

