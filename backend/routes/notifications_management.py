from flask import Blueprint, jsonify, request, session
from services.database import get_connection
from core.session_handler import login_required

# coding help from OpenAI
notifications_bp = Blueprint("notifications_management", __name__)


def create_notification(user_id, message, msg_type="info"):
    """Utility function to insert a notification into the DB."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO notifications (user_id, message, type) VALUES (%s, %s, %s)",
            (user_id, message, msg_type),
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error creating notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def notify_all_admins(message, msg_type="info"):
    """Broadcasts a notification to all users with the 'admin' role."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE role = 'admin'")
        admins = cursor.fetchall()
        for admin in admins:
            create_notification(admin["id"], message, msg_type)
        return True
    except Exception as e:
        print(f"Error notifying admins: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def notify_project_stakeholders(
    project_id, message, exclude_user_id=None, msg_type="info"
):
    """
    Finds all relevant users for a project and notifies them:
    - All assigned clients
    - All assigned crew
    - All Admins & Managers
    - Excludes the user who triggered the change
    """
    import services.auth_operations as auth

    clients = auth.get_project_clients(project_id)
    crew = auth.get_project_crew(project_id)
    admins_managers = auth.get_all_admins_and_managers()

    all_targets = set(clients + crew + admins_managers)

    if exclude_user_id:
        all_targets.discard(exclude_user_id)

    for target_id in all_targets:
        create_notification(target_id, message, msg_type)

    return True


@notifications_bp.route("/api/notifications", methods=["GET"])
@login_required
def get_notifications():
    user_id = session.get("user_id")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT * FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT 50",
            (user_id,),
        )
        notifications = cursor.fetchall()
        return jsonify(notifications), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@notifications_bp.route("/api/notifications/unread-count", methods=["GET"])
@login_required
def get_unread_count():
    user_id = session.get("user_id")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id = %s AND is_read = FALSE",
            (user_id,),
        )
        count = cursor.fetchone()[0]
        return jsonify({"unread_count": count}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@notifications_bp.route("/api/notifications/<int:note_id>/read", methods=["PUT"])
@login_required
def mark_as_read(note_id):
    user_id = session.get("user_id")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
            (note_id, user_id),
        )
        conn.commit()
        return jsonify({"message": "Notification marked as read"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@notifications_bp.route("/api/notifications/read-all", methods=["PUT"])
@login_required
def mark_all_read():
    user_id = session.get("user_id")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE notifications SET is_read = TRUE WHERE user_id = %s", (user_id,)
        )
        conn.commit()
        return jsonify({"message": "All notifications marked as read"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@notifications_bp.route("/api/notifications/<int:note_id>", methods=["DELETE"])
@login_required
def delete_notification(note_id):
    user_id = session.get("user_id")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM notifications WHERE id = %s AND user_id = %s",
            (note_id, user_id),
        )
        conn.commit()
        return jsonify({"message": "Notification deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
