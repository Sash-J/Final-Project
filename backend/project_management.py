from flask import Blueprint, jsonify, request
from flask_cors import cross_origin
import db_operations as db
import auth_operations as auth
from session_handler import login_required, roles_required

project_bp = Blueprint('project_management', __name__)

# ── Project Routes ────────────────────────────────────────────────────────────

@project_bp.route("/getTable", methods=["GET"])
@login_required
def getTable():
    return jsonify({"tables": db.get_tables()}), 200


@project_bp.route("/api/projects", methods=["GET"])
@login_required
def projects_get():
    return jsonify(db.get_projects()), 200


@project_bp.route("/api/projects", methods=["POST"])
@roles_required("admin")
def projects_post():
    data = request.get_json()
    project_name = data.get("project_name", "").strip()
    code_name = data.get("code_name", "").strip() or None
    start_date = data.get("start_date") or None
    end_date = data.get("end_date") or None
    location = data.get("location", "").strip() or None

    if not project_name:
        return jsonify({"error": "project_name is required"}), 400

    new_id = db.insert_project(project_name, code_name, start_date, end_date, location)

    # Handle client assignments
    client_ids = data.get("client_ids", [])
    if isinstance(client_ids, list):
        for c_id in client_ids:
            try:
                auth.assign_client_to_project(c_id, new_id)
            except:
                pass

    # Handle crew assignments
    crew_ids = data.get("crew_ids", [])
    if isinstance(crew_ids, list):
        for cr_id in crew_ids:
            try:
                auth.assign_crew_to_project(cr_id, new_id)
            except:
                pass

    return jsonify({"message": "Project added successfully", "id": new_id}), 201


@project_bp.route("/api/projects/<int:project_id>/status", methods=["PUT"])
@login_required
def update_project_status_endpoint(project_id):
    data = request.get_json()
    status = data.get("status")
    if status not in ["in_progress", "completed"]:
        return jsonify({"error": "Invalid status"}), 400
    try:
        db.update_project_status(project_id, status)
        return jsonify({"message": f"Project marked as {status}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@project_bp.route("/api/projects/<int:project_id>", methods=["PUT"])
@roles_required("admin")
@cross_origin(supports_credentials=True)
def projects_put(project_id):
    try:
        data = request.get_json()
        print(f"DEBUG: Updating project {project_id} with data: {data}")
        project_name = data.get("project_name", "").strip()
        code_name = data.get("code_name", "").strip() or None
        start_date = data.get("start_date") or None
        end_date = data.get("end_date") or None
        location = data.get("location", "").strip() or None

        if not project_name:
            return jsonify({"error": "project_name is required"}), 400

        db.update_project(
            project_id, project_name, code_name, start_date, end_date, location
        )

        # Sync client assignments
        client_ids = data.get("client_ids", [])
        if isinstance(client_ids, list):
            auth.clear_project_clients(project_id)
            for c_id in client_ids:
                try:
                    auth.assign_client_to_project(c_id, project_id)
                except:
                    pass

        # Sync crew assignments
        crew_ids = data.get("crew_ids", [])
        if isinstance(crew_ids, list):
            auth.clear_project_crew(project_id)
            for cr_id in crew_ids:
                try:
                    auth.assign_crew_to_project(cr_id, project_id)
                except:
                    pass

        return jsonify({"message": "Project updated successfully"}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@project_bp.route("/api/projects/<int:project_id>", methods=["DELETE"])
@roles_required("admin")
def projects_delete(project_id):
    try:
        db.delete_project(project_id)
        return jsonify({"message": "Project deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
