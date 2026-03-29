from .database import get_connection

# ── User Authentication & Management ──────────────────────────────────────────

def get_user_by_username(username):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user


def create_user(username, password_hash, role, is_approved=0, full_name=None, address=None, telephone=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO users (username, password_hash, role, is_approved, full_name, address, telephone) 
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (username, password_hash, role, is_approved, full_name, address, telephone),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def get_pending_users():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role, is_approved FROM users WHERE is_approved = 0")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return users


def get_all_users():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role, is_approved FROM users")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return users


def get_clients():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username FROM users WHERE role = 'client' AND is_approved = 1 ORDER BY username")
    clients = cursor.fetchall()
    cursor.close()
    conn.close()
    return clients


def get_crew_users():
    """Returns all users with the role 'production_crew'."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username FROM users WHERE role = 'production_crew'")
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def approve_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_approved = 1 WHERE id = %s", (user_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True


def delete_user(user_id):
    """Permanently deletes a user and their associations from the database."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # 1. Delete project associations first to respect foreign keys
        cursor.execute("DELETE FROM client_projects WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM crew_projects WHERE user_id = %s", (user_id,))
        
        # 2. Delete the user record
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
    return True


def update_user_role(user_id, role):
    """Updates the role of an existing user."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET role = %s WHERE id = %s", (role, user_id))
    conn.commit()
    cursor.close()
    conn.close()
    return True

# ── Client Dashboard & Project Assignment ─────────────────────────────────────

def assign_client_to_project(user_id, project_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO client_projects (user_id, project_id) VALUES (%s, %s)",
            (user_id, project_id),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def remove_client_from_project(user_id, project_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM client_projects WHERE user_id = %s AND project_id = %s",
            (user_id, project_id),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def clear_project_clients(project_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM client_projects WHERE project_id = %s", (project_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def get_client_projects(user_id):
    """Returns projects assigned to a client."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT p.id, p.project_name, p.client_name, p.created_at, p.start_date, p.end_date, p.status, p.location, p.code_name,
           (SELECT COALESCE(SUM(total), 0) FROM project_budget_values 
            WHERE version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
           ) as total_budget,
           (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE project_id = p.id) as total_paid
    FROM projects p
    JOIN client_projects cp ON p.id = cp.project_id
    WHERE cp.user_id = %s
    ORDER BY p.id DESC
    """
    cursor.execute(query, (user_id,))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def get_crew_projects(user_id):
    """Returns projects assigned to a production crew member."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT p.id, p.project_name, p.client_name, p.created_at, p.start_date, p.end_date, p.status, p.location, p.code_name,
           (SELECT COALESCE(SUM(total), 0) FROM project_budget_values 
            WHERE version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
           ) as total_budget,
           (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE project_id = p.id) as total_paid
    FROM projects p
    JOIN crew_projects crp ON p.id = crp.project_id
    WHERE crp.user_id = %s
    ORDER BY p.id DESC
    """
    cursor.execute(query, (user_id,))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def get_project_clients(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Returns the list of client user IDs assigned to this project
    cursor.execute("SELECT user_id FROM client_projects WHERE project_id = %s", (project_id,))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return [row["user_id"] for row in result]

def get_project_crew(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Returns the list of crew user IDs assigned to this project
    cursor.execute("SELECT user_id FROM crew_projects WHERE project_id = %s", (project_id,))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return [row["user_id"] for row in result]

def get_all_admins_and_managers():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_approved = 1")
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return [row["id"] for row in result]

def assign_crew_to_project(user_id, project_id):
    """Links a production crew member to a project."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT IGNORE INTO crew_projects (user_id, project_id) VALUES (%s, %s)",
            (user_id, project_id),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def clear_project_crew(project_id):
    """Removes all crew members assigned to a project."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM crew_projects WHERE project_id = %s", (project_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
