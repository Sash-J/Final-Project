from contextlib import contextmanager
from .database import get_connection


@contextmanager
def db_cursor(dictionary=True, commit=False):
    """Context manager for acquiring and safely releasing DB connections and cursors.

    Uses buffered=True so that SELECT result sets are fully consumed into memory
    immediately. This prevents 'Commands out of sync' errors when additional
    queries are executed on the same cursor after a fetchone().
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=dictionary, buffered=True)
    try:
        yield cursor
        if commit:
            conn.commit()
    except Exception:
        if commit:
            conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_user_by_username(username):
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        return cursor.fetchone()


TIER_PRIORITY = {
    "Diamond": 6,
    "Golden Level 3": 5,
    "Golden Level 2": 4,
    "Gold level 1": 3,
    "Silver": 2,
    "Frosted Crystal": 1,
}


def get_tier_for_role(role_name):
    """Maps a given role name to its corresponding verification tier."""
    if not role_name:
        return "Frosted Crystal"
    r = str(role_name).strip().lower().replace("_", " ")
    if "admin" in r:
        return "Diamond"
    elif "director" in r:
        return "Golden Level 3"
    elif "manager" in r:
        return "Golden Level 2"
    elif "client (full access)" in r or (r.startswith("client") and "full" in r):
        return "Gold level 1"
    elif "viewer" in r:
        return "Frosted Crystal"
    elif any(x in r for x in ["accountant", "coordinator", "department head", "crew", "client (half access)"]):
        return "Silver"
    return "Silver"


def get_highest_tier_for_roles(role_names):
    """Returns the highest priority tier among multiple assigned roles."""
    if not role_names:
        return "Frosted Crystal"
    tiers = [get_tier_for_role(r) for r in role_names if r]
    if not tiers:
        return "Frosted Crystal"
    return max(tiers, key=lambda t: TIER_PRIORITY.get(t, 0))


def create_user(
    username,
    password_hash,
    role,
    is_approved=0,
    full_name=None,
    address=None,
    telephone=None,
    gender=None,
    skill=None,
    verified_level=None,
):
    if not verified_level:
        verified_level = get_tier_for_role(role)

    with db_cursor(commit=True) as cursor:
        cursor.execute(
            """INSERT INTO users (username, password_hash, role, is_approved, full_name, address, telephone, gender, skill, verified_level) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (username, password_hash, role, is_approved, full_name, address, telephone, gender, skill, verified_level),
        )
        new_id = cursor.lastrowid

        # Link into user_roles junction table
        r_norm = str(role).strip().lower().replace("_", " ")
        cursor.execute("SELECT id FROM roles WHERE LOWER(name) = %s", (r_norm,))
        role_row = cursor.fetchone()
        if role_row:
            cursor.execute(
                "INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (%s, %s)",
                (new_id, role_row["id"]),
            )
        return new_id


def _fetch_users_with_roles(only_pending=False):
    query = """
        SELECT u.id, u.username, u.role, u.is_approved, u.full_name, u.telephone, u.gender, u.skill, u.verified_level, u.profile_image,
               COALESCE(r.name, u.role) AS role_name
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
    """
    if only_pending:
        query += " WHERE u.is_approved = 0"
    query += " ORDER BY u.id ASC"

    with db_cursor() as cursor:
        cursor.execute(query)
        rows = cursor.fetchall()

    user_map = {}
    for row in rows:
        uid = row["id"]
        if uid not in user_map:
            user_map[uid] = {
                "id": uid,
                "username": row["username"],
                "full_name": row.get("full_name"),
                "telephone": row.get("telephone"),
                "gender": row.get("gender"),
                "skill": row.get("skill"),
                "verified_level": row.get("verified_level"),
                "profile_image": row.get("profile_image"),
                "role": row["role"],
                "is_approved": row["is_approved"],
                "roles": [],
            }
        if row["role_name"] and row["role_name"] not in user_map[uid]["roles"]:
            user_map[uid]["roles"].append(row["role_name"])

    for u in user_map.values():
        all_user_roles = u["roles"] if u["roles"] else ([u["role"]] if u["role"] else [])
        calculated_tier = get_highest_tier_for_roles(all_user_roles)
        if not u["verified_level"] or u["verified_level"] != calculated_tier:
            u["verified_level"] = calculated_tier

    return list(user_map.values())


def get_pending_users():
    return _fetch_users_with_roles(only_pending=True)


def get_all_users():
    return _fetch_users_with_roles(only_pending=False)


def _get_users_by_roles(role_names):
    placeholders = ",".join(["%s"] * len(role_names))
    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT DISTINCT u.id, u.username, u.full_name, u.profile_image
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE LOWER(r.name) IN ({placeholders}) AND u.is_approved = 1
            ORDER BY u.username ASC
            """,
            [r.lower() for r in role_names],
        )
        return cursor.fetchall()


def get_clients():
    """Returns all approved client users from DB roles."""
    return _get_users_by_roles(["client (full access)", "client (half access)"])


def get_crew_users():
    """Returns all users with crew or department head roles from DB roles."""
    return _get_users_by_roles(["crew", "department head"])


def approve_user(user_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute("UPDATE users SET is_approved = 1 WHERE id = %s", (user_id,))
        cursor.execute("""
            SELECT r.name FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = %s
        """, (user_id,))
        current_roles = [row["name"] for row in cursor.fetchall()]
        if not current_roles:
            cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            user_row = cursor.fetchone()
            if user_row and user_row.get("role"):
                current_roles = [user_row["role"]]
        v_level = get_highest_tier_for_roles(current_roles)
        cursor.execute("UPDATE users SET verified_level = %s WHERE id = %s", (v_level, user_id))
        return True


def delete_user(user_id):
    """Permanently deletes a user and all associations from the database."""
    with db_cursor(commit=True) as cursor:
        cursor.execute("DELETE FROM client_projects WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM crew_projects WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        return True


def update_user_role(user_id, role):
    """Updates the role of an existing user in both users and user_roles.

    The users.role column is a legacy ENUM restricted to the original role names.
    We sync it only for ENUM-compatible values; new DB roles (Director, Accountant,
    etc.) are stored exclusively in the user_roles junction table.
    Raises ValueError if the role name is not found in the roles table.
    """
    # Legacy ENUM values accepted by users.role column
    _LEGACY_ENUM_ROLES = {"admin", "manager", "client", "production_crew"}

    r_norm = str(role).strip().lower().replace("_", " ")
    with db_cursor(commit=True) as cursor:
        # Support both role name string and numeric ID
        if str(role).strip().isdigit():
            cursor.execute("SELECT id, name FROM roles WHERE id = %s", (int(role),))
        else:
            cursor.execute("SELECT id, name FROM roles WHERE LOWER(name) = %s", (r_norm,))
        role_row = cursor.fetchone()
        if not role_row:
            raise ValueError(f"Role '{role}' not found in database.")
        role_id = role_row["id"]
        role_name = role_row["name"]

        # Only sync users.role for ENUM-safe legacy values; clear it for newer DB roles
        legacy_value = role_name.lower().replace(" ", "_")
        if legacy_value in _LEGACY_ENUM_ROLES:
            cursor.execute(
                "UPDATE users SET role = %s WHERE id = %s",
                (legacy_value, user_id),
            )
        else:
            cursor.execute(
                "UPDATE users SET role = NULL WHERE id = %s",
                (user_id,),
            )

        # user_roles is the authoritative source — replace existing entry
        cursor.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
        cursor.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)",
            (user_id, role_id),
        )

        v_level = get_highest_tier_for_roles([role_name])
        cursor.execute("UPDATE users SET verified_level = %s WHERE id = %s", (v_level, user_id))
        return True


def get_all_roles():
    """Returns all roles from the database."""
    with db_cursor() as cursor:
        cursor.execute("SELECT id, name FROM roles ORDER BY id ASC")
        return cursor.fetchall()


def get_assignable_roles():
    """Returns roles available for self-registration or basic assignment."""
    with db_cursor() as cursor:
        cursor.execute(
            """SELECT id, name FROM roles 
               WHERE LOWER(name) IN (
                   'client (full access)', 'client (half access)',
                   'crew', 'department head',
                   'director', 'manager', 'accountant', 'coordinator', 'viewer'
               ) 
               ORDER BY id ASC"""
        )
        return cursor.fetchall()


def get_all_permissions():
    """Returns all permissions from the database."""
    with db_cursor() as cursor:
        cursor.execute("SELECT id, name FROM permissions ORDER BY id ASC")
        return cursor.fetchall()


def assign_client_to_project(user_id, project_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            "INSERT INTO client_projects (user_id, project_id) VALUES (%s, %s)",
            (user_id, project_id),
        )


def remove_client_from_project(user_id, project_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            "DELETE FROM client_projects WHERE user_id = %s AND project_id = %s",
            (user_id, project_id),
        )


def clear_project_clients(project_id):
    with db_cursor(commit=True) as cursor:
        cursor.execute("DELETE FROM client_projects WHERE project_id = %s", (project_id,))


def _get_user_assigned_projects(user_id, junction_table):
    query = f"""
    SELECT p.id, p.project_name, p.client_name, p.created_at, p.start_date, p.end_date, p.status, p.location, p.code_name,
           (SELECT COALESCE(SUM(total), 0) FROM project_budget_values 
            WHERE version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
           ) as total_budget,
           (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE project_id = p.id) as total_paid
    FROM projects p
    JOIN {junction_table} j ON p.id = j.project_id
    WHERE j.user_id = %s
    ORDER BY p.id DESC
    """
    with db_cursor() as cursor:
        cursor.execute(query, (user_id,))
        return cursor.fetchall()


def get_client_projects(user_id):
    """Returns projects assigned to a client."""
    return _get_user_assigned_projects(user_id, "client_projects")


def get_crew_projects(user_id):
    """Returns projects assigned to a production crew member."""
    return _get_user_assigned_projects(user_id, "crew_projects")


def _get_project_member_ids(project_id, junction_table):
    with db_cursor() as cursor:
        cursor.execute(
            f"SELECT user_id FROM {junction_table} WHERE project_id = %s", (project_id,)
        )
        return [row["user_id"] for row in cursor.fetchall()]


def get_project_clients(project_id):
    return _get_project_member_ids(project_id, "client_projects")


def get_project_crew(project_id):
    return _get_project_member_ids(project_id, "crew_projects")


def get_all_admins_and_managers():
    """Returns user IDs for admins and managers based on DB roles."""
    with db_cursor() as cursor:
        cursor.execute("""
            SELECT DISTINCT u.id
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE LOWER(r.name) IN ('admin', 'manager') AND u.is_approved = 1
        """)
        return [row["id"] for row in cursor.fetchall()]


def assign_crew_to_project(user_id, project_id):
    """Links a production crew member to a project."""
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            "INSERT IGNORE INTO crew_projects (user_id, project_id) VALUES (%s, %s)",
            (user_id, project_id),
        )


def clear_project_crew(project_id):
    """Removes all crew members assigned to a project."""
    with db_cursor(commit=True) as cursor:
        cursor.execute("DELETE FROM crew_projects WHERE project_id = %s", (project_id,))


def get_user_profile(user_id):
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id, username, role, full_name, email, profile_image, theme_mode, email_notifications, pause_notifications FROM users WHERE id = %s",
            (user_id,),
        )
        return cursor.fetchone()


def update_user_profile(user_id, data, password_hash=None):
    with db_cursor(commit=True) as cursor:
        if password_hash:
            cursor.execute(
                """UPDATE users SET 
                   username = %s, full_name = %s, email = %s, profile_image = %s,
                   theme_mode = %s, email_notifications = %s, pause_notifications = %s,
                   password_hash = %s
                   WHERE id = %s""",
                (
                    data["username"],
                    data["full_name"],
                    data["email"],
                    data["profile_image"],
                    data["theme_mode"],
                    data["email_notifications"],
                    data["pause_notifications"],
                    password_hash,
                    user_id,
                ),
            )
        else:
            cursor.execute(
                """UPDATE users SET 
                   username = %s, full_name = %s, email = %s, profile_image = %s,
                   theme_mode = %s, email_notifications = %s, pause_notifications = %s
                   WHERE id = %s""",
                (
                    data["username"],
                    data["full_name"],
                    data["email"],
                    data["profile_image"],
                    data["theme_mode"],
                    data["email_notifications"],
                    data["pause_notifications"],
                    user_id,
                ),
            )
        return True


def update_user_theme(user_id, theme_mode):
    with db_cursor(commit=True) as cursor:
        cursor.execute(
            "UPDATE users SET theme_mode = %s WHERE id = %s",
            (theme_mode, user_id),
        )
        return True


def get_user_roles_and_permissions(user_id):
    """Fetches assigned roles and aggregated permissions for a user."""
    roles = []
    permissions = []
    try:
        with db_cursor() as cursor:
            # 1. Fetch assigned role names from user_roles
            cursor.execute(
                """
                SELECT r.id, r.name
                FROM roles r
                INNER JOIN user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = %s
                ORDER BY r.id ASC
                """,
                (user_id,),
            )
            role_rows = cursor.fetchall()
            roles = [row["name"] for row in role_rows]
            role_ids = [row["id"] for row in role_rows]

            # Fallback for unmigrated users
            if not roles:
                cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
                user_row = cursor.fetchone()
                if user_row and user_row.get("role"):
                    legacy_role = user_row["role"]
                    roles.append(legacy_role)
                    cursor.execute(
                        "SELECT id FROM roles WHERE LOWER(name) = %s",
                        (legacy_role.lower().replace("_", " "),),
                    )
                    matched_role = cursor.fetchone()
                    if matched_role:
                        role_ids.append(matched_role["id"])

            # 2. Fetch unique permissions for assigned roles
            if role_ids:
                format_strings = ",".join(["%s"] * len(role_ids))
                cursor.execute(
                    f"""
                    SELECT DISTINCT p.name
                    FROM permissions p
                    INNER JOIN role_permissions rp ON rp.permission_id = p.id
                    WHERE rp.role_id IN ({format_strings})
                    """,
                    tuple(role_ids),
                )
                permissions = [row["name"] for row in cursor.fetchall()]

        return roles, permissions
    except Exception as e:
        print(f"Error fetching user roles and permissions: {e}")
        return roles, permissions
