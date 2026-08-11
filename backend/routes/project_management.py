from flask import Blueprint, jsonify, request
from routes.notifications_management import notify_all_admins
from flask_cors import cross_origin
import services.db_operations as db
import services.auth_operations as auth
from core.session_handler import login_required, roles_required

project_bp = Blueprint("project_management", __name__)


@project_bp.route("/getTable", methods=["GET"])
@login_required
def getTable():
    return jsonify({"tables": db.get_tables()}), 200


@project_bp.route("/api/projects", methods=["GET"])
@login_required
def projects_get():
    return jsonify(db.get_projects()), 200


@project_bp.route("/api/projects/<int:project_id>", methods=["GET"])
@login_required
def project_detail_get(project_id):
    project = db.get_project_by_id(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify(project), 200


@project_bp.route("/api/projects", methods=["POST"])
@roles_required("admin", "manager")
def projects_post():
    data = request.get_json()
    project_name = data.get("project_name", "").strip()
    code_name = data.get("code_name", "").strip() or None
    start_date = data.get("start_date") or None
    end_date = data.get("end_date") or None
    location = data.get("location", "").strip() or None
    color = data.get("color", "#00c6e6")
    project_image_base64 = data.get("project_image")

    if not project_name:
        return jsonify({"error": "project_name is required"}), 400

    existing_project = db.check_color_exists(color)
    if existing_project:
        return (
            jsonify(
                {"error": f"Color already assigned to project: {existing_project}"}
            ),
            400,
        )

    project_image_url = project_image_base64 if project_image_base64 else None
    
    route_locations = data.get("route_locations", [])

    new_id = db.insert_project(
        project_name,
        code_name,
        start_date,
        end_date,
        location,
        color,
        project_image_url,
        route_locations,
    )

    client_ids = data.get("client_ids", [])
    if isinstance(client_ids, list):
        for c_id in client_ids:
            try:
                auth.assign_client_to_project(c_id, new_id)
            except:
                pass

    crew_ids = data.get("crew_ids", [])
    if isinstance(crew_ids, list):
        for cr_id in crew_ids:
            try:
                auth.assign_crew_to_project(cr_id, new_id)
            except:
                pass

    notify_all_admins(f"New project created: {project_name}.", "info")
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
@roles_required("admin", "manager")
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
        color = data.get("color", "#00c6e6")
        project_image_base64 = data.get("project_image")

        if not project_name:
            return jsonify({"error": "project_name is required"}), 400

        existing_project = db.check_color_exists(color, exclude_project_id=project_id)
        if existing_project:
            return (
                jsonify(
                    {"error": f"Color already assigned to project: {existing_project}"}
                ),
                400,
            )
        project_image_url = data.get("project_image_url")
        if project_image_base64 and project_image_base64.startswith("data:image"):
            project_image_url = project_image_base64
            
        route_locations = data.get("route_locations")
        
        db.update_project(
            project_id,
            project_name,
            code_name,
            start_date,
            end_date,
            color,
            project_image_url,
            route_locations,
        )

        client_ids = data.get("client_ids", [])
        if isinstance(client_ids, list):
            auth.clear_project_clients(project_id)
            for c_id in client_ids:
                try:
                    auth.assign_client_to_project(c_id, project_id)
                except:
                    pass

        # assign crew
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
@roles_required("admin", "manager")
def projects_delete(project_id):
    try:
        db.delete_project(project_id)
        return jsonify({"message": "Project deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@project_bp.route("/api/projects/<int:project_id>/hierarchy", methods=["PUT"])
@roles_required("admin", "manager")
@cross_origin(supports_credentials=True)
def update_project_hierarchy_endpoint(project_id):
    import json
    data = request.get_json()
    hierarchy_data = data.get("hierarchyData")
    try:
        hierarchy_str = json.dumps(hierarchy_data) if hierarchy_data else None
        db.update_project_crew_hierarchy(project_id, hierarchy_str)
        return jsonify({"message": "Hierarchy updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@project_bp.route("/api/projects/<int:project_id>/equipment", methods=["PUT"])
@login_required
@cross_origin(supports_credentials=True)
def update_project_equipment_endpoint(project_id):
    import json
    data = request.get_json()
    equipment_data = data.get("equipmentData")
    try:
        equipment_str = json.dumps(equipment_data) if equipment_data else None
        db.update_project_equipment(project_id, equipment_str)
        return jsonify({"message": "Equipment updated successfully"}), 200
    except Exception as e:
        with open('api_error.log', 'a') as f:
            f.write(f"ERROR: {str(e)}\\n")
            import traceback
            f.write(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# Payments
@project_bp.route("/api/projects/<int:project_id>/payments", methods=["GET"])
@login_required
def get_project_payments(project_id):
    try:
        payments = db.get_payments_for_project(project_id)
        return jsonify(payments), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@project_bp.route("/api/projects/<int:project_id>/payments", methods=["POST"])
@roles_required("admin", "manager")
def post_project_payment(project_id):
    try:
        data = request.get_json()
        amount = data.get("amount")
        payment_date = data.get("payment_date")
        notes = data.get("notes", "")

        if not amount or not payment_date:
            return jsonify({"error": "Amount and Payment Date are required"}), 400

        new_id = db.insert_payment(project_id, amount, payment_date, notes)
        return jsonify({"message": "Payment recorded successfully", "id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@project_bp.route("/api/projects/<int:project_id>/crew", methods=["GET"])
@login_required
def get_project_crew_members(project_id):
    try:
        crew_ids = auth.get_project_crew(project_id)
        crew_list = []
        for c_id in crew_ids:
            u_prof = auth.get_user_profile(c_id)
            if u_prof:
                crew_list.append({
                    "id": u_prof["id"],
                    "username": u_prof["username"],
                    "full_name": u_prof["full_name"],
                    "profile_image": u_prof["profile_image"]
                })
        return jsonify(crew_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- EQUIPMENT RELATIONAL DB ENDPOINTS ---

@project_bp.route("/api/projects/<int:project_id>/equipment_full", methods=["GET"])
@login_required
def get_project_equipment_full(project_id):
    try:
        data = db.get_project_equipment_full(project_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@project_bp.route("/api/projects/<int:project_id>/departments", methods=["POST"])
@login_required
def create_equipment_department(project_id):
    data = request.get_json()
    name = data.get('name', 'New Department')
    try:
        dept = db.create_equipment_department(project_id, name)
        return jsonify(dept), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@project_bp.route("/api/departments/<int:department_id>", methods=["PUT"])
@login_required
def update_equipment_department(department_id):
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name required"}), 400
    try:
        db.update_equipment_department(department_id, name)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@project_bp.route("/api/departments/<int:department_id>", methods=["DELETE"])
@login_required
def delete_equipment_department(department_id):
    try:
        db.delete_equipment_department(department_id)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@project_bp.route("/api/departments/<int:department_id>/items", methods=["POST"])
@login_required
def create_equipment_item(department_id):
    data = request.get_json()
    name = data.get('name', 'New Equipment')
    qty = data.get('qty', 1)
    try:
        item = db.create_equipment_item(department_id, name, qty)
        return jsonify(item), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@project_bp.route("/api/equipment/<int:item_id>", methods=["PUT"])
@login_required
def update_equipment_item(item_id):
    data = request.get_json()
    name = data.get('name')
    qty = data.get('qty')
    try:
        db.update_equipment_item(item_id, name, qty)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@project_bp.route("/api/equipment/<int:item_id>", methods=["DELETE"])
@login_required
def delete_equipment_item(item_id):
    try:
        db.delete_equipment_item(item_id)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@project_bp.route("/api/projects/<int:project_id>/routes/<string:route_id>", methods=["PUT"])
@roles_required("admin", "manager")
@cross_origin(supports_credentials=True)
def update_route(project_id, route_id):
    route_data = request.json
    try:
        from services.db_operations import update_project_route
        update_project_route(project_id, route_id, route_data)
        return jsonify({"status": "success", "message": "Route updated successfully"})
    except Exception as e:
        print(f"Error updating route: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@project_bp.route("/api/projects/<int:project_id>/routes/<string:route_id>", methods=["DELETE"])
@roles_required("admin", "manager")
@cross_origin(supports_credentials=True)
def delete_route(project_id, route_id):
    try:
        from services.db_operations import delete_project_route
        delete_project_route(project_id, route_id)
        return jsonify({"status": "success", "message": "Route deleted successfully"})
    except Exception as e:
        print(f"Error deleting route: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
