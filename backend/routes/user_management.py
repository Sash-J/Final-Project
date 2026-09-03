from flask import Blueprint, jsonify, request
import services.auth_operations as auth
from core.session_handler import login_required, roles_required

user_mgmt_bp = Blueprint("user_management", __name__)


def _is_valid_role(role):
    if not role:
        return False
    all_roles = {r["name"].lower() for r in auth.get_all_roles()}
    clean = str(role).strip().lower().replace("_", " ")
    return clean in all_roles or str(role).strip().lower() in all_roles


@user_mgmt_bp.route("/api/admin/pending-users", methods=["GET"])
@roles_required("admin")
def pending_users_get():
    return jsonify(auth.get_pending_users()), 200


@user_mgmt_bp.route("/api/admin/users", methods=["GET"])
@roles_required("admin")
def users_get():
    return jsonify(auth.get_all_users()), 200


@user_mgmt_bp.route("/api/clients", methods=["GET"])
@roles_required("admin", "manager")
def clients_get():
    return jsonify(auth.get_clients()), 200


@user_mgmt_bp.route("/api/admin/approve-user", methods=["POST"])
@roles_required("admin")
def approve_user_post():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    role = data.get("role")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    try:
        if role:
            auth.update_user_role(user_id, role)
        auth.approve_user(user_id)
        return jsonify({"message": "User approved successfully"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error", "detail": str(e)}), 500


@user_mgmt_bp.route("/api/admin/reject-user", methods=["POST"])
@roles_required("admin")
def reject_user_post():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    auth.delete_user(user_id)
    return jsonify({"message": "User registration rejected and removed"}), 200


@user_mgmt_bp.route("/api/admin/delete-user", methods=["POST"])
@roles_required("admin")
def delete_user_post():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if int(user_id) == 1:
        return jsonify({"error": "Cannot delete the primary admin account"}), 400
    auth.delete_user(user_id)
    return jsonify({"message": "User account deleted successfully"}), 200


@user_mgmt_bp.route("/api/admin/update-user-role", methods=["POST"])
@roles_required("admin")
def update_user_role_post():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    role = data.get("role")
    if not user_id or not role:
        return jsonify({"error": "user_id and role are required"}), 400
    try:
        auth.update_user_role(user_id, role)
        return jsonify({"message": "User role updated successfully"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error", "detail": str(e)}), 500


@user_mgmt_bp.route("/api/admin/roles", methods=["GET"])
@roles_required("admin")
def roles_get():
    return jsonify(auth.get_all_roles()), 200


@user_mgmt_bp.route("/api/admin/permissions", methods=["GET"])
@roles_required("admin")
def permissions_get():
    return jsonify(auth.get_all_permissions()), 200


@user_mgmt_bp.route("/api/crew", methods=["GET"])
@login_required
def get_crew_endpoint():
    return jsonify(auth.get_crew_users()), 200


@user_mgmt_bp.route("/api/admin/assign-client", methods=["POST"])
@roles_required("admin")
def assign_client_post():
    data = request.get_json()
    user_id = data.get("user_id")
    project_id = data.get("project_id")
    if not user_id or not project_id:
        return jsonify({"error": "user_id and project_id are required"}), 400
    try:
        auth.assign_client_to_project(user_id, project_id)
        return jsonify({"message": "Client assigned to project successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@user_mgmt_bp.route("/api/admin/remove-client", methods=["POST"])
@roles_required("admin")
def remove_client_post():
    data = request.get_json()
    user_id = data.get("user_id")
    project_id = data.get("project_id")
    if not user_id or not project_id:
        return jsonify({"error": "user_id and project_id are required"}), 400
    try:
        auth.remove_client_from_project(user_id, project_id)
        return jsonify({"message": "Client removed from project successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@user_mgmt_bp.route("/api/projects/<int:project_id>/clients", methods=["GET"])
@roles_required("admin", "manager")
def project_clients_get(project_id):
    return jsonify(auth.get_project_clients(project_id)), 200
