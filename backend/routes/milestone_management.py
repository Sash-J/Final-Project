from flask import Blueprint, jsonify, request, session
from services.database import get_connection
from core.session_handler import login_required, roles_required

milestone_bp = Blueprint('milestone_management', __name__)

# ── Milestone DB Operations ─────────────────────────────────────────────────

def get_project_milestones(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM project_milestones WHERE project_id = %s ORDER BY target_date ASC, id ASC", (project_id,))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result

def insert_milestone(project_id, title, description, target_date, status='pending', client_note='', is_visiondivision=0):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO project_milestones (project_id, title, description, target_date, status, client_note, is_visiondivision)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (project_id, title, description, target_date, status, client_note, is_visiondivision)
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id

def update_milestone(milestone_id, status=None, client_note=None, title=None, description=None, target_date=None, is_visiondivision=None):
    conn = get_connection()
    cursor = conn.cursor()
    updates = []
    params = []
    if status is not None:
        updates.append("status = %s")
        params.append(status)
    if client_note is not None:
        updates.append("client_note = %s")
        params.append(client_note)
    if title is not None:
        updates.append("title = %s")
        params.append(title)
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    if target_date is not None:
        updates.append("target_date = %s")
        params.append(target_date)
    if is_visiondivision is not None:
        updates.append("is_visiondivision = %s")
        params.append(is_visiondivision)
        
    if not updates:
        return True

    params.append(milestone_id)
    query = f"UPDATE project_milestones SET {', '.join(updates)} WHERE id = %s"
    
    cursor.execute(query, tuple(params))
    conn.commit()
    cursor.close()
    conn.close()
    return True

def delete_milestone(milestone_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM project_milestones WHERE id = %s", (milestone_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True

def get_milestone_by_id(milestone_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM project_milestones WHERE id = %s", (milestone_id,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result

# ── Milestone Routes ─────────────────────────────────────────────────────────

@milestone_bp.route("/api/projects/<int:project_id>/milestones", methods=["GET"])
@login_required
def get_milestones(project_id):
    return jsonify(get_project_milestones(project_id)), 200

@milestone_bp.route("/api/projects/<int:project_id>/milestones", methods=["POST"])
@login_required
def create_milestone(project_id):
    data = request.get_json()
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    target_date = data.get("target_date")
    status = data.get("status", "pending")
    client_note = data.get("client_note", "")
    
    if not title or not target_date:
        return jsonify({"error": "title and target_date are required"}), 400
        
    user_role = session.get("user_role")
    raw_ivd = data.get("is_visiondivision")
    try:
        if raw_ivd is not None and str(raw_ivd).strip() != "":
            is_visiondivision = int(raw_ivd)
        else:
            is_visiondivision = 1 if user_role in ["admin", "manager"] else 0
    except (ValueError, TypeError):
        is_visiondivision = 1 if user_role in ["admin", "manager"] else 0
    
    try:
        new_id = insert_milestone(project_id, title, description, target_date, status, client_note, is_visiondivision)
        return jsonify({"message": "Milestone created", "id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@milestone_bp.route("/api/milestones/<int:milestone_id>", methods=["PUT"])
@login_required
def edit_milestone(milestone_id):
    if session.get("user_role") == "production_crew":
        return jsonify({"error": "Production crew cannot edit milestones"}), 403
    data = request.get_json()
    status = data.get("status")
    client_note = data.get("client_note")
    title = data.get("title")
    description = data.get("description")
    target_date = data.get("target_date")
    if title is not None and not str(title).strip():
        return jsonify({"error": "Title cannot be empty"}), 400
    if target_date is not None and not str(target_date).strip():
        return jsonify({"error": "Target date cannot be empty"}), 400

    raw_ivd = data.get("is_visiondivision")
    is_visiondivision = None
    if raw_ivd is not None and str(raw_ivd).strip() != "":
        try:
            is_visiondivision = int(raw_ivd)
        except (ValueError, TypeError):
            is_visiondivision = None
    
    user_role = session.get("user_role")
    milestone = get_milestone_by_id(milestone_id)
    if not milestone:
        return jsonify({"error": "Milestone not found"}), 404
        
    if user_role == "client" and milestone.get("is_visiondivision"):
        if title is not None or description is not None or target_date is not None:
            return jsonify({"error": "Clients cannot edit core details of VisionDivision milestones"}), 403
            
        try:
            update_milestone(milestone_id, status=status, client_note=client_note)
            return jsonify({"message": "Milestone updated"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    try:
        update_milestone(milestone_id, status=status, client_note=client_note, title=title, description=description, target_date=target_date, is_visiondivision=is_visiondivision)
        return jsonify({"message": "Milestone fully updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@milestone_bp.route("/api/milestones/<int:milestone_id>", methods=["DELETE"])
@login_required
def remove_milestone(milestone_id):
    user_role = session.get("user_role")
    milestone = get_milestone_by_id(milestone_id)
    if not milestone:
        return jsonify({"error": "Milestone not found"}), 404
        
    if user_role == "client" and milestone.get("is_visiondivision"):
        return jsonify({"error": "Clients cannot delete VisionDivision milestones"}), 403
        
    try:
        delete_milestone(milestone_id)
        return jsonify({"message": "Milestone deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
