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
            "INSERT IGNORE INTO client_projects (user_id, project_id) VALUES (%s, %s)",
            (int(user_id), int(project_id)),
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
    import json
    query = f"""
    SELECT p.*,
           GROUP_CONCAT(DISTINCT u_client.username ORDER BY u_client.id SEPARATOR ', ') as client_usernames,
           GROUP_CONCAT(DISTINCT u_client.id ORDER BY u_client.id SEPARATOR ',') as client_ids,
           GROUP_CONCAT(DISTINCT COALESCE(u_client.verified_level, u_client.role) ORDER BY u_client.id SEPARATOR ', ') as client_verified_levels,
           GROUP_CONCAT(DISTINCT u_client.role ORDER BY u_client.id SEPARATOR ', ') as client_roles,
           GROUP_CONCAT(DISTINCT u_crew.username SEPARATOR ', ') as crew_usernames,
           GROUP_CONCAT(DISTINCT u_crew.id SEPARATOR ',') as crew_ids,
           (SELECT COUNT(*) FROM budget_versions bv WHERE bv.project_id = p.id) as version_count,
           (SELECT JSON_ARRAYAGG(
               JSON_OBJECT(
                   'id', u.id,
                   'username', u.username,
                   'role', u.role,
                   'verified_level', COALESCE(u.verified_level, u.role)
               )
            )
            FROM client_projects cp2
            JOIN users u ON cp2.user_id = u.id
            WHERE cp2.project_id = p.id
           ) as client_details,
           (SELECT COALESCE(SUM(total), 0) FROM project_budget_values 
            WHERE version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
           ) as total_budget,
           (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE project_id = p.id) as total_paid
    FROM projects p
    JOIN {junction_table} j ON p.id = j.project_id
    LEFT JOIN client_projects cp ON p.id = cp.project_id
    LEFT JOIN users u_client ON cp.user_id = u_client.id
    LEFT JOIN crew_projects crp ON p.id = crp.project_id
    LEFT JOIN users u_crew ON crp.user_id = u_crew.id
    WHERE j.user_id = %s
    GROUP BY p.id
    ORDER BY p.id DESC
    """
    with db_cursor() as cursor:
        cursor.execute(query, (user_id,))
        result = cursor.fetchall()

    for row in result:
        raw_cd = row.get("client_details")
        if isinstance(raw_cd, str):
            try:
                row["client_details"] = json.loads(raw_cd)
            except Exception:
                row["client_details"] = []
        elif not raw_cd:
            row["client_details"] = []

    return result


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
    """Fetches assigned roles and aggregated permissions for a user, incorporating per-user overrides."""
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

            # Admins automatically receive all system permissions
            if any(str(r).strip().lower() == "admin" for r in roles):
                cursor.execute("SELECT name FROM permissions ORDER BY id ASC")
                permissions = [row["name"] for row in cursor.fetchall()]
                return roles, permissions

            # 2. Fetch unique permissions for assigned roles
            role_permissions = set()
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
                role_permissions = {row["name"] for row in cursor.fetchall()}

            # 3. Apply custom per-user overrides from user_permissions
            cursor.execute(
                """
                SELECT p.name, up.is_granted
                FROM user_permissions up
                INNER JOIN permissions p ON p.id = up.permission_id
                WHERE up.user_id = %s
                """,
                (user_id,),
            )
            override_rows = cursor.fetchall()
            effective_perms = set(role_permissions)
            for row in override_rows:
                perm_name = row["name"]
                if row["is_granted"]:
                    effective_perms.add(perm_name)
                else:
                    effective_perms.discard(perm_name)

            permissions = sorted(list(effective_perms))

        return roles, permissions
    except Exception as e:
        print(f"Error fetching user roles and permissions: {e}")
        return roles, permissions


PERMISSION_CATALOG = [
    {
        "category": "Projects",
        "description": "Project lifecycle, metadata, routes, and archive management",
        "permissions": [
            {"key": "project.view", "label": "View Projects", "description": "Browse project directory, cards, and overview metrics"},
            {"key": "project.create", "label": "Create Projects", "description": "Initialize new productions with initial crew and details"},
            {"key": "project.edit", "label": "Edit Projects", "description": "Update project information, cover art, dates, and locations"},
            {"key": "project.status", "label": "Archive / Restore Projects", "description": "Toggle project status between Active and Completed"},
            {"key": "project.delete", "label": "Delete Projects", "description": "Permanently remove a project and all associated records"},
        ],
    },
    {
        "category": "Maps & Routes",
        "description": "Project travel itineraries, shoot location waypoints, and transport crew assignments",
        "permissions": [
            {"key": "map.view", "label": "View Maps & Routes", "description": "View project route waypoints, driving paths, stopover metrics, and open the full route modal"},
            {"key": "map.route.create", "label": "Create Routes", "description": "Add new transit and shooting routes to a project"},
            {"key": "map.route.edit", "label": "Edit Routes & Waypoints", "description": "Modify stops, addresses, departure times, dates, and vehicle types"},
            {"key": "map.route.delete", "label": "Delete Routes", "description": "Permanently remove routes from project itinerary"},
            {"key": "map.crew.assign", "label": "Assign Crew to Routes", "description": "Assign or remove production crew members on transport routes"},
        ],
    },
    {
        "category": "Budgets",
        "description": "Production budgeting, cost line items, and version publishing",
        "permissions": [
            {"key": "budget.view", "label": "View Budgets", "description": "Inspect budget summaries, version histories, and client vault"},
            {"key": "budget.create", "label": "Create Budgets", "description": "Access the Budget Form and generate new budget versions"},
            {"key": "budget.edit", "label": "Edit Budgets", "description": "Modify budget item rates, unit days, quantities, and expenses"},
            {"key": "budget.publish", "label": "Publish Budgets", "description": "Lock and publish approved budget revisions to stakeholders"},
        ],
    },
    {
        "category": "Finances",
        "description": "Client payments, cash flow, balances, and expenditures",
        "permissions": [
            {"key": "finance.view", "label": "View Financial Records", "description": "View financial dashboard metrics, paid amounts, and balances"},
            {"key": "finance.edit", "label": "Record Payments & Expenses", "description": "Add client payment receipts, expenses, and transaction logs"},
        ],
    },
    {
        "category": "Schedules",
        "description": "Production timelines, calendars, call sheets, and shifts",
        "permissions": [
            {"key": "schedule.view", "label": "View Schedules", "description": "View production timeline, calendar events, and call sheets"},
            {"key": "schedule.edit", "label": "Edit Schedules", "description": "Create, modify, reschedule, or remove calendar entries and shifts"},
        ],
    },
    {
        "category": "Milestones",
        "description": "Project target dates, deliverable tracking, and milestone notes",
        "permissions": [
            {"key": "milestone.view", "label": "View Milestones", "description": "View milestone roadmap and deliverable completion status"},
            {"key": "milestone.create", "label": "Create Milestones", "description": "Add new deliverables and target milestones to project timeline"},
            {"key": "milestone.edit", "label": "Edit Milestones", "description": "Update milestone status, dates, descriptions, and client notes"},
            {"key": "milestone.delete", "label": "Delete Milestones", "description": "Remove milestone deliverables from the timeline"},
        ],
    },
    {
        "category": "Production & Equipment",
        "description": "Gear inventory, department allocations, and camera assets",
        "permissions": [
            {"key": "production.view", "label": "View Production", "description": "View production gear allocations and department rosters"},
            {"key": "production.edit", "label": "Edit Production", "description": "Update general production configurations and assignments"},
            {"key": "equipment.view", "label": "View Equipment", "description": "View gear catalogs, department lists, and allocations"},
            {"key": "equipment.edit", "label": "Edit Equipment", "description": "Add, modify, and delete equipment inventory and departments"},
        ],
    },
    {
        "category": "Crew Hierarchy",
        "description": "Department tree nodes, structural reporting, and node dragging",
        "permissions": [
            {"key": "hierarchy.node.add", "label": "Add Hierarchy Node", "description": "Create new department and operational nodes in tree"},
            {"key": "hierarchy.node.edit", "label": "Edit Hierarchy Node", "description": "Modify node names, assign personnel, and configure roles"},
            {"key": "hierarchy.node.delete", "label": "Delete Hierarchy Node", "description": "Remove department nodes from organizational structure"},
            {"key": "hierarchy.node.drag", "label": "Drag Hierarchy Nodes", "description": "Reparent and reorder nodes on interactive tree canvas"},
            {"key": "hierarchy.delete", "label": "Delete Hierarchy", "description": "Remove complete hierarchy trees or department structures"},
        ],
    },
    {
        "category": "User Administration",
        "description": "User moderation, roles, verification tiers, and permissions",
        "permissions": [
            {"key": "user.view", "label": "View Users", "description": "Access User Management pipeline and review user profiles"},
            {"key": "user.approve", "label": "Approve Registrations", "description": "Approve pending account registrations into the system"},
            {"key": "user.reject", "label": "Reject Registrations", "description": "Decline and remove pending registration applications"},
            {"key": "user.edit", "label": "Edit User Profiles", "description": "Update user roles, contact numbers, skills, and details"},
            {"key": "user.delete", "label": "Delete User Accounts", "description": "Permanently remove user accounts from the database"},
            {"key": "employee.delete", "label": "Delete Employee Profiles", "description": "Delete employee accounts (legacy standard)"},
            {"key": "user.verification", "label": "Assign Verification Levels", "description": "Assign Diamond, Gold, Silver, or White security tiers"},
            {"key": "user.permissions", "label": "Manage Permissions", "description": "Customize granular permission overrides for any user"},
        ],
    },
]


def get_permission_catalog():
    """Returns the organized permission catalog for UI presentation."""
    return PERMISSION_CATALOG


def get_user_permissions_detail(user_id):
    """Fetches comprehensive permissions details for a user, including role baseline and overrides."""
    user = get_user_profile(user_id)
    if not user:
        return None

    roles, effective_permissions = get_user_roles_and_permissions(user_id)

    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT p.name
            FROM permissions p
            INNER JOIN role_permissions rp ON rp.permission_id = p.id
            INNER JOIN user_roles ur ON ur.role_id = rp.role_id
            WHERE ur.user_id = %s
            ORDER BY p.name ASC
            """,
            (user_id,),
        )
        role_permissions = [row["name"] for row in cursor.fetchall()]

        cursor.execute(
            """
            SELECT p.name, up.is_granted
            FROM user_permissions up
            INNER JOIN permissions p ON p.id = up.permission_id
            WHERE up.user_id = %s
            """,
            (user_id,),
        )
        overrides = {row["name"]: bool(row["is_granted"]) for row in cursor.fetchall()}

        cursor.execute("SELECT id, name FROM permissions ORDER BY name ASC")
        all_perms = cursor.fetchall()

    is_admin_user = any(str(r).strip().lower() == "admin" for r in roles)

    return {
        "user_id": user["id"],
        "username": user["username"],
        "full_name": user.get("full_name") or user["username"],
        "profile_image": user.get("profile_image") or "",
        "roles": roles,
        "is_admin": is_admin_user,
        "verified_level": user.get("verified_level") or get_highest_tier_for_roles(roles),
        "role_permissions": role_permissions,
        "overrides": overrides,
        "effective_permissions": effective_permissions,
        "all_permissions": all_perms,
        "catalog": PERMISSION_CATALOG,
    }


def update_user_permissions(user_id, grants=None, revokes=None):
    """
    Saves granular permission overrides for a user.
    - grants: list of permission names to explicitly grant (is_granted = 1)
    - revokes: list of permission names to explicitly revoke (is_granted = 0)
    """
    grants = grants or []
    revokes = revokes or []

    with db_cursor(commit=True) as cursor:
        all_targets = list(set(grants + revokes))
        if not all_targets:
            return True

        format_strings = ",".join(["%s"] * len(all_targets))
        cursor.execute(
            f"SELECT id, name FROM permissions WHERE name IN ({format_strings})",
            tuple(all_targets),
        )
        perm_map = {row["name"]: row["id"] for row in cursor.fetchall()}

        for p_name in grants:
            p_id = perm_map.get(p_name)
            if p_id:
                cursor.execute(
                    """
                    INSERT INTO user_permissions (user_id, permission_id, is_granted)
                    VALUES (%s, %s, 1)
                    ON DUPLICATE KEY UPDATE is_granted = 1
                    """,
                    (user_id, p_id),
                )

        for p_name in revokes:
            p_id = perm_map.get(p_name)
            if p_id:
                cursor.execute(
                    """
                    INSERT INTO user_permissions (user_id, permission_id, is_granted)
                    VALUES (%s, %s, 0)
                    ON DUPLICATE KEY UPDATE is_granted = 0
                    """,
                    (user_id, p_id),
                )

    return True


def reset_user_permissions(user_id):
    """Deletes all custom permission overrides for a user, restoring role defaults."""
    with db_cursor(commit=True) as cursor:
        cursor.execute("DELETE FROM user_permissions WHERE user_id = %s", (user_id,))
    return True
