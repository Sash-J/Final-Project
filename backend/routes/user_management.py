from flask import Blueprint, jsonify, request
import services.db_operations as db
import services.auth_operations as auth
from core.session_handler import (
    login_required,
    roles_required,
    get_current_user_id,
    get_current_user_role,
)

user_mgmt_bp = Blueprint("user_management", __name__)


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
    data = request.get_json()
    user_id = data.get("user_id")
    role = data.get("role")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if role:
        if role not in ["manager", "client", "production_crew"]:
            return jsonify({"error": "Invalid role"}), 400
        auth.update_user_role(user_id, role)
    auth.approve_user(user_id)
    return jsonify({"message": "User approved successfully"}), 200


@user_mgmt_bp.route("/api/admin/reject-user", methods=["POST"])
@roles_required("admin")
def reject_user_post():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    auth.delete_user(user_id)
    return jsonify({"message": "User registration rejected and removed"}), 200


@user_mgmt_bp.route("/api/admin/delete-user", methods=["POST"])
@roles_required("admin")
def delete_user_post():
    data = request.get_json()
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
    data = request.get_json()
    user_id = data.get("user_id")
    role = data.get("role")
    if not user_id or not role:
        return jsonify({"error": "user_id and role are required"}), 400
    if role not in ["manager", "client", "production_crew"]:
        return jsonify({"error": "Invalid role"}), 400
    auth.update_user_role(user_id, role)
    return jsonify({"message": "User role updated successfully"}), 200


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
