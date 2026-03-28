from flask import Blueprint, jsonify, request
import db_operations as db
import auth_operations as auth
from session_handler import login_required, roles_required, get_current_user_id, get_current_user_role

budget_bp = Blueprint('budget_management', __name__)

# ── Departments ───────────────────────────────────────────────────────────────

@budget_bp.route("/api/departments", methods=["GET"])
@login_required
def departments_get():
    return jsonify(db.get_departments()), 200


@budget_bp.route("/api/departments", methods=["POST"])
@roles_required("admin")
def departments_post():
    data = request.get_json()
    department_name = data.get("department_name", "").strip()
    if not department_name:
        return jsonify({"error": "department_name is required"}), 400
    new_id = db.insert_department(department_name)
    return jsonify({"message": "Department added successfully", "id": new_id}), 201


# ── Categories ────────────────────────────────────────────────────────────────

@budget_bp.route("/api/categories", methods=["GET"])
@login_required
def categories_get():
    return jsonify(db.get_categories()), 200


@budget_bp.route("/api/categories", methods=["POST"])
@roles_required("admin")
def categories_post():
    data = request.get_json()
    category_name = data.get("category_name", "").strip()
    department_id = data.get("department_id")
    if not category_name or not department_id:
        return jsonify({"error": "category_name and department_id are required"}), 400
    new_id = db.insert_category(category_name, department_id)
    return jsonify({"message": "Category added successfully", "id": new_id}), 201


@budget_bp.route("/api/categories/reorder", methods=["POST"])
@roles_required("admin", "manager")
def categories_reorder():
    data = request.get_json()
    ordered_ids = data.get("ordered_ids", [])
    if not ordered_ids:
        return jsonify({"error": "ordered_ids are required"}), 400
    try:
        db.update_categories_order(ordered_ids)
        return jsonify({"message": "Categories reordered successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Budget Items ──────────────────────────────────────────────────────────────

@budget_bp.route("/api/budget-items", methods=["GET"])
@login_required
def budget_items_get():
    return jsonify(db.get_budget_items()), 200


@budget_bp.route("/api/budget-items", methods=["POST"])
@roles_required("admin", "manager")
def budget_items_post():
    data = request.get_json()
    item_name = data.get("item_name", "").strip()
    category_id = data.get("category_id")
    if not item_name or not category_id:
        return jsonify({"error": "item_name and category_id are required"}), 400
    new_id = db.insert_budget_item(item_name, category_id)
    return jsonify({"message": "Budget item added successfully", "id": new_id}), 201


@budget_bp.route("/api/budget-items/reorder", methods=["POST"])
@roles_required("admin", "manager")
def budget_items_reorder():
    data = request.get_json()
    ordered_ids = data.get("ordered_ids", [])
    if not ordered_ids:
        return jsonify({"error": "ordered_ids are required"}), 400
    try:
        db.update_budget_items_order(ordered_ids)
        return jsonify({"message": "Budget items reordered successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Budget Values ─────────────────────────────────────────────────────────────

@budget_bp.route("/api/budget-values", methods=["GET"])
@login_required
def budget_values_get():
    return jsonify(db.get_budget_values()), 200


@budget_bp.route("/api/budget-values", methods=["POST"])
@roles_required("admin", "manager")
def budget_values_post():
    data = request.get_json()
    project_id = data.get("project_id")
    budget_item_id = data.get("budget_item_id")
    quantity = data.get("quantity", 0)
    rate = data.get("rate", 0)
    total = data.get("total", 0)
    if not project_id or not budget_item_id:
        return jsonify({"error": "project_id and budget_item_id are required"}), 400
    new_id = db.insert_budget_value(project_id, budget_item_id, quantity, rate, total)
    return jsonify({"message": "Budget value added successfully", "id": new_id}), 201


@budget_bp.route("/api/budget-values/project/<int:project_id>", methods=["GET"])
@login_required
def budget_values_for_project(project_id):
    version_id = request.args.get("version_id")
    if version_id:
        try:
            version_id = int(version_id)
        except ValueError:
            version_id = None
    return jsonify(db.get_budget_values_for_project(project_id, version_id)), 200


@budget_bp.route("/api/budget-values/batch", methods=["POST"])
@roles_required("admin", "manager")
def budget_values_batch():
    data = request.get_json()
    project_id = data.get("project_id")
    version_id = data.get("version_id")
    values = data.get("values", [])
    client_ids = data.get("client_ids", None)

    if not project_id or not version_id:
        return jsonify({"error": "project_id and version_id are required"}), 400
    if not values:
        return jsonify({"error": "No values provided"}), 400

    try:
        affected = db.insert_budget_values_batch(
            project_id, version_id, values, client_ids
        )
        return jsonify({"message": f"{affected} rows saved", "affected": affected}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Budget Versions ───────────────────────────────────────────────────────────

@budget_bp.route("/api/projects/<int:project_id>/budget-versions", methods=["POST"])
@roles_required("admin", "manager")
def budget_versions_post(project_id):
    data = request.get_json()
    source_version_id = data.get("source_version_id")
    try:
        new_id = db.create_budget_version(project_id, source_version_id)
        return jsonify({"message": "New budget version created", "id": new_id}), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@budget_bp.route("/api/projects/<int:project_id>/budget-versions", methods=["GET"])
@login_required
def budget_versions_get(project_id):
    try:
        versions = db.get_budget_versions(project_id)
        return jsonify(versions), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@budget_bp.route("/api/budget-versions/<int:version_id>", methods=["DELETE"])
@roles_required("admin", "manager")
def budget_version_delete(version_id):
    try:
        db.delete_budget_version(version_id)
        return jsonify({"message": "Budget version deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Hierarchy ─────────────────────────────────────────────────────────────────

@budget_bp.route("/api/hierarchy", methods=["GET"])
@login_required
def hierarchy_get():
    return jsonify(db.get_hierarchy()), 200


# ── Client Dashboard ──────────────────────────────────────────────────────────

@budget_bp.route("/api/client/dashboard", methods=["GET"])
@roles_required("client", "manager", "admin", "production_crew")
def client_dashboard_get():
    user_id = get_current_user_id()
    role = get_current_user_role()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    if role == "production_crew":
        projects = auth.get_crew_projects(user_id)
    else:
        projects = auth.get_client_projects(user_id)

    # Enhance each project with its payment history
    for proj in projects:
        proj["payments"] = db.get_payments_for_project(proj["id"])

    return jsonify(projects), 200


# ── Payments ──────────────────────────────────────────────────────────────────

@budget_bp.route("/api/admin/payments", methods=["POST"])
@roles_required("admin", "manager")
def payments_post():
    data = request.get_json()
    project_id = data.get("project_id")
    amount = data.get("amount")
    payment_date = data.get("payment_date")
    notes = data.get("notes", "")

    if not project_id or amount is None or not payment_date:
        return (
            jsonify({"error": "project_id, amount, and payment_date are required"}),
            400,
        )

    try:
        new_id = db.insert_payment(project_id, amount, payment_date, notes)
        return jsonify({"message": "Payment recorded successfully", "id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@budget_bp.route("/api/admin/finance/summary", methods=["GET"])
@roles_required("admin", "manager")
def finance_summary_get():
    try:
        summary = db.get_admin_financial_summary()
        return jsonify(summary), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@budget_bp.route("/api/admin/finance/projects", methods=["GET"])
@roles_required("admin", "manager")
def finance_projects_get():
    try:
        projects = db.get_all_projects_financials()
        return jsonify(projects), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
