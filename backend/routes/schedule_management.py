from flask import Blueprint, jsonify, request, session
import services.db_operations as db
from services.database import get_connection
from core.session_handler import login_required, roles_required, get_current_user_id
from routes.notifications_management import notify_project_stakeholders

schedule_bp = Blueprint('schedule_management', __name__)

# ── Schedule DB Operations ──────────────────────────────────────────────────

def get_schedule_tasks(year, month):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT t.*, u.username as creator_name, p.project_name
        FROM schedule_tasks t
        JOIN users u ON t.created_by = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE YEAR(t.task_date) = %s AND MONTH(t.task_date) = %s
        ORDER BY t.task_date ASC, t.id ASC
    """
    cursor.execute(query, (year, month))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result

def insert_schedule_task(title, description, task_date, created_by, is_visiondivision=1, project_id=None, task_color='#a78bfa'):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO schedule_tasks (title, description, task_date, created_by, is_visiondivision, project_id, task_color) 
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (title, description, task_date, created_by, is_visiondivision, project_id, task_color),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id

def update_schedule_task(task_id, title, description, project_id=None, task_color='#a78bfa'):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """UPDATE schedule_tasks 
           SET title = %s, description = %s, project_id = %s, task_color = %s 
           WHERE id = %s""",
        (title, description, project_id, task_color, task_id),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return True

def delete_schedule_task(task_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM schedule_tasks WHERE id = %s", (task_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True

def get_task_notes(task_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT n.*, u.username, u.role
        FROM task_notes n
        JOIN users u ON n.user_id = u.id
        WHERE n.task_id = %s
        ORDER BY n.created_at ASC
    """
    cursor.execute(query, (task_id,))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result

def insert_task_note(task_id, user_id, note_text):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO task_notes (task_id, user_id, note_text) 
           VALUES (%s, %s, %s)""",
        (task_id, user_id, note_text),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id

# ── Schedule Routes ─────────────────────────────────────────────────────────

@schedule_bp.route("/api/schedule/tasks", methods=["GET"])
@login_required
def schedule_tasks_get():
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    if not year or not month:
        return jsonify({"error": "year and month are required"}), 400
    try:
        tasks = get_schedule_tasks(year, month)
        return jsonify(tasks), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@schedule_bp.route("/api/schedule/tasks", methods=["POST"])
@roles_required("admin", "manager")
def schedule_tasks_post():
    data = request.get_json()
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    task_date = data.get("task_date")
    project_id = data.get("project_id")
    task_color = data.get("task_color", "#a78bfa")
    
    if not title or not task_date:
        return jsonify({"error": "title and task_date are required"}), 400

    created_by = session.get("user_id")
    try:
        new_id = insert_schedule_task(
            title, description, task_date, created_by, 
            is_visiondivision=1, 
            project_id=project_id, 
            task_color=task_color
        )
        
        # Notify project stakeholders
        if project_id:
            proj_name = db.get_project_name(project_id)
            notify_project_stakeholders(
                project_id, 
                f"New task added to schedule for {proj_name}: {title}", 
                exclude_user_id=created_by,
                msg_type="info"
            )
            
        return (
            jsonify({"message": "Schedule task created", "id": new_id}),
            201,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@schedule_bp.route("/api/schedule/tasks/<int:task_id>", methods=["DELETE"])
@roles_required("admin", "manager")
def schedule_task_delete(task_id):
    try:
        delete_schedule_task(task_id)
        return jsonify({"message": "Schedule task deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@schedule_bp.route("/api/schedule/tasks/<int:task_id>", methods=["PUT"])
@roles_required("admin", "manager")
def schedule_task_put(task_id):
    data = request.get_json()
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    project_id = data.get("project_id")
    task_color = data.get("task_color", "#a78bfa")
    
    if not title:
        return jsonify({"error": "title is required"}), 400

    try:
        update_schedule_task(
            task_id, title, description, project_id, task_color
        )
        # Notify stakeholders
        if project_id:
            proj_name = db.get_project_name(project_id)
            sender_id = get_current_user_id()
            notify_project_stakeholders(
                project_id, 
                f"Schedule task updated in {proj_name}: {title}", 
                exclude_user_id=sender_id,
                msg_type="info"
            )
            
        return jsonify({"message": "Schedule task updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@schedule_bp.route("/api/schedule/tasks/<int:task_id>/notes", methods=["GET"])
@login_required
def task_notes_get(task_id):
    try:
        notes = get_task_notes(task_id)
        return jsonify(notes), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@schedule_bp.route("/api/schedule/tasks/<int:task_id>/notes", methods=["POST"])
@login_required
def task_notes_post(task_id):
    data = request.get_json()
    note_text = data.get("note_text", "").strip()
    if not note_text:
        return jsonify({"error": "note_text is required"}), 400

    user_id = get_current_user_id()
    try:
        new_id = insert_task_note(task_id, user_id, note_text)
        # Notify stakeholders (find project_id from task)
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT project_id, title FROM schedule_tasks WHERE id = %s", (task_id,))
        task = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if task and task['project_id']:
            proj_name = db.get_project_name(task['project_id'])
            notify_project_stakeholders(
                task['project_id'], 
                f"New note on task '{task['title']}' in {proj_name}", 
                exclude_user_id=user_id,
                msg_type="info"
            )

        return (
            jsonify({"message": "Note added successfully", "id": new_id}),
            201,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
