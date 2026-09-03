from .database import get_connection


def run_rbac_migration():
    """Ensures RBAC tables, roles, permissions, and user_roles are populated and synchronized."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Ensure core RBAC tables exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL UNIQUE
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL UNIQUE
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS role_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            role_id INT NOT NULL,
            permission_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
            FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            role_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        )
        """)
        conn.commit()

        # 2. Seed standard roles
        standard_roles = [
            "Admin",
            "Director",
            "Manager",
            "Accountant",
            "Coordinator",
            "Viewer",
            "Client",
            "Production Crew",
        ]
        cursor.executemany("INSERT IGNORE INTO roles (name) VALUES (%s)", [(r,) for r in standard_roles])
        conn.commit()

        # 3. Seed standard permissions
        standard_permissions = [
            "user.view",
            "user.approve",
            "user.reject",
            "user.edit",
            "employee.delete",
            "project.view",
            "project.create",
            "project.edit",
            "project.delete",
            "budget.view",
            "budget.edit",
            "budget.publish",
            "production.view",
            "production.edit",
            "schedule.view",
            "schedule.edit",
            "finance.view",
            "finance.edit",
        ]
        cursor.executemany("INSERT IGNORE INTO permissions (name) VALUES (%s)", [(p,) for p in standard_permissions])
        conn.commit()

        # 4. Fetch all roles and permissions maps
        cursor.execute("SELECT id, name FROM roles")
        role_map = {r["name"].lower(): r["id"] for r in cursor.fetchall()}
        cursor.execute("SELECT id, name FROM permissions")
        perm_map = {p["name"]: p["id"] for p in cursor.fetchall()}

        # 5. Role-Permission assignments
        role_permission_mappings = {
            "admin": standard_permissions,
            "manager": [
                "user.view", "project.view", "project.create", "project.edit",
                "budget.view", "budget.edit", "production.view", "production.edit",
                "schedule.view", "schedule.edit", "finance.view"
            ],
            "director": [
                "user.view", "project.view", "budget.view", "production.view",
                "schedule.view", "finance.view"
            ],
            "accountant": [
                "project.view", "budget.view", "budget.edit", "finance.view", "finance.edit"
            ],
            "production crew": [
                "production.view", "production.edit", "schedule.view"
            ],
            "client": [
                "project.view", "budget.view", "schedule.view"
            ],
            "coordinator": [
                "project.view", "production.view", "schedule.view", "schedule.edit"
            ],
            "viewer": [
                "project.view", "schedule.view"
            ],
        }

        cursor.execute("SELECT role_id, permission_id FROM role_permissions")
        existing_rp = {(row["role_id"], row["permission_id"]) for row in cursor.fetchall()}

        to_insert_rp = []
        for r_name, p_names in role_permission_mappings.items():
            r_id = role_map.get(r_name)
            if not r_id:
                continue
            for p_name in p_names:
                p_id = perm_map.get(p_name)
                if p_id and (r_id, p_id) not in existing_rp:
                    to_insert_rp.append((r_id, p_id))

        if to_insert_rp:
            cursor.executemany(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES (%s, %s)",
                to_insert_rp,
            )
            conn.commit()

        # 6. Migrate existing users from users.role to user_roles
        cursor.execute("SELECT user_id, role_id FROM user_roles")
        existing_ur = {(row["user_id"], row["role_id"]) for row in cursor.fetchall()}

        cursor.execute("SELECT id, role FROM users WHERE role IS NOT NULL AND role != ''")
        users_list = cursor.fetchall()
        to_insert_ur = []
        for u in users_list:
            u_id = u["id"]
            u_role = u["role"].strip().lower()
            if u_role == "production_crew":
                u_role = "production crew"

            target_role_id = role_map.get(u_role)
            if target_role_id and (u_id, target_role_id) not in existing_ur:
                to_insert_ur.append((u_id, target_role_id))

        if to_insert_ur:
            cursor.executemany(
                "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)",
                to_insert_ur,
            )
            conn.commit()

        print("RBAC Migration: successfully synchronized roles, permissions, and user_roles.")
    except Exception as e:
        print("Error during RBAC migration:", e)
    finally:
        cursor.close()
        conn.close()


def create_role_permissions():
    run_rbac_migration()


def create_user_roles():
    run_rbac_migration()


def get_phases():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM budget_phases ORDER BY sort_order ASC")
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def get_tables():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES;")
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return [table[0] for table in result]


def get_projects():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT p.*, 
               GROUP_CONCAT(DISTINCT u_client.username SEPARATOR ', ') as client_usernames,
               GROUP_CONCAT(DISTINCT u_client.id SEPARATOR ',') as client_ids,
               GROUP_CONCAT(DISTINCT u_crew.username SEPARATOR ', ') as crew_usernames,
               GROUP_CONCAT(DISTINCT u_crew.id SEPARATOR ',') as crew_ids,
               (SELECT COUNT(*) FROM budget_versions bv WHERE bv.project_id = p.id) as version_count
        FROM projects p
        LEFT JOIN client_projects cp ON p.id = cp.project_id
        LEFT JOIN users u_client ON cp.user_id = u_client.id
        LEFT JOIN crew_projects crp ON p.id = crp.project_id
        LEFT JOIN users u_crew ON crp.user_id = u_crew.id
        GROUP BY p.id
        ORDER BY p.id DESC
    """
    cursor.execute(query)
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def insert_project(
    project_name,
    code_name=None,
    start_date=None,
    end_date=None,
    color="#00c6e6",
    project_image=None,
    route_locations=None,
):
    import json
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        """INSERT INTO projects (project_name, code_name, start_date, end_date, color, project_image) 
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (project_name, code_name, start_date, end_date, color, project_image),
    )
    new_id = cursor.lastrowid

    if color:
        cursor.execute(
            """UPDATE schedule_tasks SET task_color = %s WHERE project_id = %s""",
            (color, new_id),
        )

    conn.commit()
    cursor.close()
    conn.close()
    return True


def update_project(
    project_id,
    project_name,
    code_name=None,
    start_date=None,
    end_date=None,
    color="#00c6e6",
    project_image=None,
    route_locations=None,
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """UPDATE projects 
           SET project_name = %s, code_name = %s, start_date = %s, end_date = %s, color = %s, project_image = %s 
           WHERE id = %s""",
        (project_name, code_name, start_date, end_date, color, project_image, project_id),
    )

    if color:
        cursor.execute(
            """UPDATE schedule_tasks SET task_color = %s WHERE project_id = %s""",
            (color, project_id),
        )

    conn.commit()
    cursor.close()
    conn.close()
    return True


def update_project_equipment(project_id, equipment_json_str):
    import json
    conn = get_connection()
    cursor = conn.cursor()
    try:

        # Clear existing hero data
        cursor.execute("DELETE FROM project_equipment_heroes WHERE project_id = %s", (project_id,))
        
        if equipment_json_str:
            data = json.loads(equipment_json_str) if isinstance(equipment_json_str, str) else equipment_json_str
            hero = data.get('hero') or {}
            hero_secondary = data.get('heroSecondary') or {}
            
            cursor.execute(
                """INSERT INTO project_equipment_heroes 
                   (project_id, hero_label, hero_name, hero_details, hero_status, 
                    secondary_label, secondary_name, secondary_details, secondary_status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    project_id,
                    hero.get('label', ''), hero.get('name', ''), hero.get('details', ''), hero.get('status', ''),
                    hero_secondary.get('label', ''), hero_secondary.get('name', ''), hero_secondary.get('details', ''), hero_secondary.get('status', '')
                )
            )

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def update_project_crew_hierarchy(project_id, hierarchy_json_str):
    import json
    conn = get_connection()
    cursor = conn.cursor()
    try:

        # Clear existing relational hierarchy
        cursor.execute("DELETE FROM project_crew_hierarchy_members WHERE node_id IN (SELECT id FROM project_crew_hierarchy_nodes WHERE project_id = %s)", (project_id,))
        cursor.execute("DELETE FROM project_crew_hierarchy_nodes WHERE project_id = %s", (project_id,))

        if hierarchy_json_str:
            hierarchy = json.loads(hierarchy_json_str) if isinstance(hierarchy_json_str, str) else hierarchy_json_str
            
            def insert_node(node, parent_id=None):
                if not node:
                    return
                node_id = str(node.get('id', ''))
                dept = node.get('department', '')
                if node_id:
                    cursor.execute(
                        "INSERT INTO project_crew_hierarchy_nodes (id, project_id, parent_id, department) VALUES (%s, %s, %s, %s)",
                        (node_id, project_id, parent_id, dept)
                    )
                    members = node.get('members', [])
                    seen_members = set()
                    for mem in members:
                        m_name = mem.get('name', '').strip()
                        m_role = mem.get('role', '').strip()
                        key = (m_name.lower(), m_role.lower())
                        if key not in seen_members and m_name:
                            cursor.execute(
                                "INSERT INTO project_crew_hierarchy_members (node_id, name, role) VALUES (%s, %s, %s)",
                                (node_id, m_name, m_role)
                            )
                            seen_members.add(key)
                    children = node.get('children', [])
                    for child in children:
                        insert_node(child, node_id)
            
            insert_node(hierarchy)

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
    return True


def delete_project(project_id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM client_projects WHERE project_id = %s", (project_id,)
        )
        cursor.execute("DELETE FROM crew_projects WHERE project_id = %s", (project_id,))
        cursor.execute(
            "DELETE FROM project_budget_values WHERE project_id = %s", (project_id,)
        )
        cursor.execute("DELETE FROM payments WHERE project_id = %s", (project_id,))
        cursor.execute(
            "DELETE FROM budget_versions WHERE project_id = %s", (project_id,)
        )

        cursor.execute("DELETE FROM projects WHERE id = %s", (project_id,))

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
    return True


def get_project_name(project_id):
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    cursor.execute("SELECT project_name FROM projects WHERE id = %s", (project_id,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result[0] if result else "Unknown Project"


def check_color_exists(color, exclude_project_id=None):
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    if exclude_project_id:
        cursor.execute(
            "SELECT project_name FROM projects WHERE color = %s AND id != %s",
            (color, exclude_project_id),
        )
    else:
        cursor.execute("SELECT project_name FROM projects WHERE color = %s", (color,))
    result = cursor.fetchone()
    cursor.close()
    conn.close()
    return result[0] if result else None


def get_project_by_id(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    query = """
        SELECT p.*, 
               GROUP_CONCAT(DISTINCT u_client.username SEPARATOR ', ') as client_usernames,
               GROUP_CONCAT(DISTINCT u_client.id SEPARATOR ',') as client_ids,
               GROUP_CONCAT(DISTINCT u_crew.username SEPARATOR ', ') as crew_usernames,
               GROUP_CONCAT(DISTINCT u_crew.id SEPARATOR ',') as crew_ids,
               (SELECT COUNT(*) FROM budget_versions bv WHERE bv.project_id = p.id) as version_count,
               (SELECT COALESCE(SUM(total), 0) FROM project_budget_values pbv 
                WHERE pbv.version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
               ) as latest_budget_total,
               (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE project_id = p.id) as total_paid
        FROM projects p
        LEFT JOIN client_projects cp ON p.id = cp.project_id
        LEFT JOIN users u_client ON cp.user_id = u_client.id
        LEFT JOIN crew_projects crp ON p.id = crp.project_id
        LEFT JOIN users u_crew ON crp.user_id = u_crew.id
        WHERE p.id = %s
        GROUP BY p.id
    """
    cursor.execute(query, (project_id,))
    result = cursor.fetchone()

    if result:
        result["latest_budget_total"] = float(result["latest_budget_total"] or 0)
        result["total_paid"] = float(result["total_paid"] or 0)
        result["balance"] = result["latest_budget_total"] - result["total_paid"]

        # Fetch Map Routes
        cursor.execute("SELECT * FROM project_map_routes WHERE project_id = %s", (project_id,))
        routes = cursor.fetchall()
        route_locations = []
        if routes:
            route_ids = tuple([r['id'] for r in routes])
            if len(route_ids) == 1:
                cursor.execute("SELECT * FROM project_map_route_locations WHERE route_id = %s ORDER BY sequence", (route_ids[0],))
            else:
                format_strings = ','.join(['%s'] * len(route_ids))
                cursor.execute(f"SELECT * FROM project_map_route_locations WHERE route_id IN ({format_strings}) ORDER BY sequence", route_ids)
            locs = cursor.fetchall()
            
            for r in routes:
                r_locs = [l for l in locs if l['route_id'] == r['id']]
                route_locations.append({
                    "id": r['id'],
                    "title": r['title'],
                    "color": r['color'],
                    "startTime": r.get('start_time', '08:00'),
                    "startDate": r.get('start_date', ''),
                    "vehicleType": r.get('vehicle_type', 'sedan'),
                    "locations": [{"id": l['id'], "name": l['name'], "address": l['address']} for l in r_locs]
                })
        result['route_locations'] = route_locations

        # Fetch Crew Hierarchy
        cursor.execute("SELECT * FROM project_crew_hierarchy_nodes WHERE project_id = %s", (project_id,))
        nodes = cursor.fetchall()
        if nodes:
            node_ids = tuple([n['id'] for n in nodes])
            if len(node_ids) == 1:
                cursor.execute("SELECT * FROM project_crew_hierarchy_members WHERE node_id = %s", (node_ids[0],))
            else:
                format_strings = ','.join(['%s'] * len(node_ids))
                cursor.execute(f"SELECT * FROM project_crew_hierarchy_members WHERE node_id IN ({format_strings})", node_ids)
            members = cursor.fetchall()

            node_dict = {}
            for n in nodes:
                node_dict[n['id']] = {
                    "id": n['id'],
                    "department": n['department'],
                    "members": [{"name": m['name'], "role": m['role']} for m in members if m['node_id'] == n['id']],
                    "children": []
                }
            
            root_node = None
            for n in nodes:
                if n['parent_id']:
                    parent = node_dict.get(n['parent_id'])
                    if parent:
                        parent['children'].append(node_dict[n['id']])
                else:
                    root_node = node_dict[n['id']]
            result['crew_hierarchy_data'] = root_node
        else:
            result['crew_hierarchy_data'] = None
            
        # Fetch Equipment Hero Data
        cursor.execute("SELECT * FROM project_equipment_heroes WHERE project_id = %s", (project_id,))
        hero_data = cursor.fetchone()
        
        # In get_project_by_id, equipment_data historically contained hero and heroSecondary.
        # The frontend parses it if it exists.
        if hero_data:
            import json
            hero_payload = {
                "hero": {
                    "label": hero_data['hero_label'],
                    "name": hero_data['hero_name'],
                    "details": hero_data['hero_details'],
                    "status": hero_data['hero_status']
                },
                "heroSecondary": {
                    "label": hero_data['secondary_label'],
                    "name": hero_data['secondary_name'],
                    "details": hero_data['secondary_details'],
                    "status": hero_data['secondary_status']
                } if hero_data['secondary_name'] else None
            }
            result['equipment_data'] = json.dumps(hero_payload)

    cursor.close()
    conn.close()
    return result


def insert_department(department_name, phase_id=2):
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    cursor.execute(
        "SELECT COALESCE(MAX(sort_order), 0) FROM departments WHERE phase_id = %s",
        (phase_id,),
    )
    max_order = cursor.fetchone()[0]

    cursor.execute(
        "INSERT INTO departments (department_name, phase_id, sort_order) VALUES (%s, %s, %s)",
        (department_name, phase_id, max_order + 1),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def get_departments():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT d.*, p.phase_name FROM departments d LEFT JOIN budget_phases p ON d.phase_id = p.id ORDER BY d.sort_order ASC, d.id DESC"
    )
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def update_departments_order(ordered_ids):
    """
    Updates the sort_order for a list of department IDs.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for index, dept_id in enumerate(ordered_ids):
            cursor.execute(
                "UPDATE departments SET sort_order = %s WHERE id = %s",
                (index, dept_id),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
    return True


def get_categories():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT c.*, d.department_name
        FROM categories c
        JOIN departments d ON c.department_id = d.id
        ORDER BY c.id DESC
    """
    )
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def insert_category(category_name, department_id):
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    cursor.execute(
        "SELECT COALESCE(MAX(sort_order), 0) FROM categories WHERE department_id = %s",
        (department_id,),
    )
    max_order = cursor.fetchone()[0]

    cursor.execute(
        "INSERT INTO categories (category_name, department_id, sort_order) VALUES (%s, %s, %s)",
        (category_name, department_id, max_order + 1),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def get_budget_items():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT b.*, c.category_name
        FROM budget_items b
        JOIN categories c ON b.category_id = c.id
        ORDER BY b.id DESC
    """
    )
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def insert_budget_item(item_name, category_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO budget_items (item_name, category_id) VALUES (%s, %s)",
        (item_name, category_id),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def update_budget_items_order(ordered_ids):
    """
    Updates the sort_order for a list of budget item IDs.
    Expects a list of IDs in the new order.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for index, item_id in enumerate(ordered_ids):
            cursor.execute(
                "UPDATE budget_items SET sort_order = %s WHERE id = %s",
                (index, item_id),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
    return True


def update_categories_order(ordered_ids):
    """
    Updates the sort_order for a list of category IDs.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for index, cat_id in enumerate(ordered_ids):
            cursor.execute(
                "UPDATE categories SET sort_order = %s WHERE id = %s",
                (index, cat_id),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()
    return True


def get_budget_values():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT pbv.*, p.project_name, b.item_name
        FROM project_budget_values pbv
        JOIN projects p ON pbv.project_id = p.id
        JOIN budget_items b ON pbv.budget_item_id = b.id
        ORDER BY pbv.id DESC
    """
    )
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def insert_budget_value(
    project_id,
    budget_item_id,
    quantity,
    rate,
    total,
    rate_type="day",
    rate_multiplier=1.0,
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO project_budget_values
           (project_id, budget_item_id, quantity, rate, rate_type, rate_multiplier, total)
           VALUES (%s, %s, %s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE
           quantity = VALUES(quantity),
           rate = VALUES(rate),
           rate_type = VALUES(rate_type),
           rate_multiplier = VALUES(rate_multiplier),
           total = VALUES(total)""",
        (project_id, budget_item_id, quantity, rate, rate_type, rate_multiplier, total),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def get_hierarchy():
    """
    Returns the hierarchy grouped by phase using a single optimized JOIN query.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    query = """
        SELECT 
            p.id as phase_id, p.phase_name,
            d.id as dept_id, d.department_name,
            c.id as cat_id, c.category_name,
            i.id as item_id, i.item_name
        FROM budget_phases p
        LEFT JOIN departments d ON p.id = d.phase_id
        LEFT JOIN categories c ON d.id = c.department_id
        LEFT JOIN budget_items i ON c.id = i.category_id
        ORDER BY p.sort_order, d.sort_order, d.id, c.sort_order, i.sort_order
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    phases = []
    phase_map = {}

    for row in rows:
        p_id = row["phase_id"]
        if p_id not in phase_map:
            phase = {
                "phase_id": p_id,
                "phase_name": row["phase_name"],
                "departments": [],
                "_dept_map": {},
            }
            phases.append(phase)
            phase_map[p_id] = phase

        phase = phase_map[p_id]
        d_id = row["dept_id"]

        if d_id and d_id not in phase["_dept_map"]:
            dept = {
                "id": d_id,
                "department_name": row["department_name"],
                "categories": [],
                "_cat_map": {},
            }
            phase["departments"].append(dept)
            phase["_dept_map"][d_id] = dept

        if d_id:
            dept = phase["_dept_map"][d_id]
            c_id = row["cat_id"]
            if c_id and c_id not in dept["_cat_map"]:
                cat = {"id": c_id, "category_name": row["category_name"], "items": []}
                dept["categories"].append(cat)
                dept["_cat_map"][c_id] = cat

            if c_id:
                cat = dept["_cat_map"][c_id]
                i_id = row["item_id"]
                if i_id:
                    cat["items"].append(
                        {"id": i_id, "item_name": row["item_name"], "category_id": c_id}
                    )

    for p in phases:
        p.pop("_dept_map")
        for d in p["departments"]:
            d.pop("_cat_map")

    return phases


def get_budget_values_for_project(project_id, version_id=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)

    if version_id:
        query = """
            SELECT 
                pv.budget_item_id, pv.quantity, pv.rate, pv.rate_type, 
                pv.rate_multiplier, pv.gross_revenue, pv.additional1, pv.comment1,
                pv.total, pv.is_itemized
            FROM project_budget_values pv
            WHERE pv.version_id = %s
        """
        params = (version_id,)
    else:
        query = """
            SELECT 
                pv.budget_item_id, pv.quantity, pv.rate, pv.rate_type, 
                pv.rate_multiplier, pv.gross_revenue, pv.additional1, pv.comment1,
                pv.total, pv.is_itemized
            FROM project_budget_values pv
            WHERE pv.version_id = (
                SELECT id FROM budget_versions 
                WHERE project_id = %s 
                ORDER BY version_number DESC LIMIT 1
            )
        """
        params = (project_id,)

    cursor.execute(query, params)
    rows = cursor.fetchall()

    result = {
        str(row["budget_item_id"]): {
            **row,
            "is_itemized": bool(row.get("is_itemized", 0)),
        }
        for row in rows
    }

    v_id = version_id
    if not v_id and rows:
        v_id = rows[0].get("version_id")

    if not v_id:
        cursor.execute(
            "SELECT id FROM budget_versions WHERE project_id = %s ORDER BY version_number DESC LIMIT 1",
            (project_id,),
        )
        rv = cursor.fetchone()
        v_id = rv["id"] if rv else None

    if v_id:
        cursor.execute(
            """
            SELECT budget_item_id, SUM(total) as agg_total 
            FROM budget_item_breakdowns 
            WHERE version_id = %s 
            GROUP BY budget_item_id
        """,
            (v_id,),
        )
        for b_row in cursor.fetchall():
            bid_str = str(b_row["budget_item_id"])
            if bid_str not in result:
                result[bid_str] = {
                    "budget_item_id": b_row["budget_item_id"],
                    "quantity": 0,
                    "rate": 0,
                    "rate_type": "day",
                    "rate_multiplier": 1,
                    "gross_revenue": 0,
                    "additional1": 0,
                    "comment1": "",
                    "total": b_row["agg_total"] or 0,
                    "is_itemized": True,
                }
            else:
                result[bid_str]["is_itemized"] = True
                result[bid_str]["total"] = (
                    b_row["agg_total"] or result[bid_str]["total"]
                )

    cursor.close()
    conn.close()
    return result


def get_budget_versions(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, version_number, published_to_crew, published_to_client, created_at, published_at FROM budget_versions WHERE project_id = %s ORDER BY version_number ASC",
        (project_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows


def publish_budget_version(version_id, published_to_crew, published_to_client):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """UPDATE budget_versions 
               SET published_to_crew = %s, published_to_client = %s,
                   published_at = CASE WHEN %s = 1 OR %s = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
               WHERE id = %s""",
            (1 if published_to_crew else 0, 1 if published_to_client else 0,
             1 if published_to_crew else 0, 1 if published_to_client else 0, version_id),
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def create_budget_version(project_id, source_version_id=None):
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    try:
        cursor.execute(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM budget_versions WHERE project_id = %s",
            (project_id,),
        )
        next_version = cursor.fetchone()[0]

        cursor.execute(
            "INSERT INTO budget_versions (project_id, version_number) VALUES (%s, %s)",
            (project_id, next_version),
        )
        new_version_id = cursor.lastrowid

        if source_version_id:
            cursor.execute(
                """
                INSERT INTO project_budget_values (
                    project_id, budget_item_id, version_id, quantity, rate, rate_type, 
                    rate_multiplier, additional1, comment1, total, gross_revenue, is_itemized
                )
                SELECT 
                    project_id, budget_item_id, %s, quantity, rate, rate_type, 
                    rate_multiplier, additional1, comment1, total, gross_revenue, is_itemized
                FROM project_budget_values
                WHERE version_id = %s
                """,
                (new_version_id, source_version_id),
            )

            cursor.execute(
                """
                INSERT INTO budget_item_breakdowns (
                    project_id, version_id, budget_item_id, description, quantity, 
                    rate_type, rate_multiplier, rate, gross_revenue, additional1, total
                )
                SELECT 
                    project_id, %s, budget_item_id, description, quantity, 
                    rate_type, rate_multiplier, rate, gross_revenue, additional1, total
                FROM budget_item_breakdowns
                WHERE version_id = %s
                """,
                (new_version_id, source_version_id),
            )

        conn.commit()
        return new_version_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def delete_budget_version(version_id):
    conn = get_connection()
    cursor = conn.cursor(buffered=True)
    try:
        cursor.execute(
            "SELECT project_id FROM budget_versions WHERE id = %s", (version_id,)
        )
        row = cursor.fetchone()
        if not row:
            return False
        project_id = row[0]

        cursor.execute(
            "DELETE FROM project_budget_values WHERE version_id = %s", (version_id,)
        )

        cursor.execute("DELETE FROM budget_versions WHERE id = %s", (version_id,))

        cursor.execute(
            "SELECT id FROM budget_versions WHERE project_id = %s ORDER BY version_number ASC, created_at ASC",
            (project_id,),
        )
        remaining = cursor.fetchall()
        for idx, (v_id,) in enumerate(remaining):
            cursor.execute(
                "UPDATE budget_versions SET version_number = %s WHERE id = %s",
                (idx + 1, v_id),
            )

        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def insert_budget_values_batch(project_id, version_id, values, client_ids=None):
    """
    values: list of { budget_item_id, quantity, rate, total }
    client_ids: optional list of user_ids (role='client') to associate with the project
    Uses INSERT ... ON DUPLICATE KEY UPDATE so re-submitting a project
    updates existing rows rather than duplicating them.
    """
    if not values:
        return 0

    conn = get_connection()
    cursor = conn.cursor()

    try:
        sql = """
            INSERT INTO project_budget_values
                (project_id, version_id, budget_item_id, quantity, rate, rate_type, rate_multiplier, gross_revenue, additional1, comment1, total, is_itemized)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                quantity    = VALUES(quantity),
                rate        = VALUES(rate),
                rate_type   = VALUES(rate_type),
                rate_multiplier = VALUES(rate_multiplier),
                gross_revenue = VALUES(gross_revenue),
                additional1 = VALUES(additional1),
                comment1    = VALUES(comment1),
                total       = VALUES(total),
                is_itemized  = VALUES(is_itemized)
        """
        rows = [
            (
                project_id,
                version_id,
                v["budget_item_id"],
                v["quantity"],
                v["rate"],
                v.get("rate_type", "day"),
                v.get("rate_multiplier", 1.0),
                v.get("gross_revenue", 0),
                v.get("additional1", 0),
                v.get("comment1", ""),
                v["total"],
                v.get("is_itemized", 0),
            )
            for v in values
        ]
        cursor.executemany(sql, rows)
        affected = cursor.rowcount

        if client_ids is not None:
            cursor.execute(
                "DELETE FROM client_projects WHERE project_id = %s", (project_id,)
            )
            if client_ids:
                client_sql = (
                    "INSERT INTO client_projects (user_id, project_id) VALUES (%s, %s)"
                )
                client_rows = [(c_id, project_id) for c_id in client_ids]
                cursor.executemany(client_sql, client_rows)

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

    return affected


def get_budget_item_breakdowns(project_id, version_id, budget_item_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT * FROM budget_item_breakdowns 
        WHERE project_id = %s AND version_id = %s AND budget_item_id = %s
        ORDER BY id ASC
    """
    cursor.execute(query, (project_id, version_id, budget_item_id))
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def get_all_budget_breakdowns(project_id, version_id=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    if version_id:
        query = """
            SELECT * FROM budget_item_breakdowns 
            WHERE project_id = %s AND version_id = %s
            ORDER BY budget_item_id ASC, id ASC
        """
        params = (project_id, version_id)
    else:
        query = """
            SELECT * FROM budget_item_breakdowns 
            WHERE project_id = %s AND version_id = (
                SELECT id FROM budget_versions 
                WHERE project_id = %s 
                ORDER BY version_number DESC LIMIT 1
            )
            ORDER BY budget_item_id ASC, id ASC
        """
        params = (project_id, project_id)
        
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    breakdowns = {}
    for row in rows:
        item_id = str(row['budget_item_id'])
        if item_id not in breakdowns:
            breakdowns[item_id] = []
        breakdowns[item_id].append(row)
    return breakdowns


def save_budget_item_breakdowns_batch(
    project_id, version_id, budget_item_id, breakdown_items
):
    def to_float(val, default=0.0):
        try:
            if val is None or val == "":
                return default
            return float(val)
        except (ValueError, TypeError):
            return default

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM budget_item_breakdowns WHERE project_id = %s AND version_id = %s AND budget_item_id = %s",
            (project_id, version_id, budget_item_id),
        )

        if breakdown_items:
            query = """
                INSERT INTO budget_item_breakdowns 
                (project_id, version_id, budget_item_id, description, quantity, rate_type, rate_multiplier, rate, gross_revenue, additional1, total)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            rows = [
                (
                    project_id,
                    version_id,
                    budget_item_id,
                    b.get("description", ""),
                    to_float(b.get("quantity"), 0.0),
                    b.get("rate_type", "day"),
                    to_float(b.get("rate_multiplier"), 1.0),
                    to_float(b.get("rate"), 0.0),
                    to_float(b.get("gross_revenue"), 0.0),
                    to_float(b.get("additional1"), 0.0),
                    to_float(b.get("total"), 0.0),
                )
                for b in breakdown_items
            ]
            cursor.executemany(query, rows)

        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def insert_payment(project_id, amount, payment_date, notes=""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO payments (project_id, amount, payment_date, notes) VALUES (%s, %s, %s, %s)",
        (project_id, amount, payment_date, notes),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


def get_payments_for_project(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, amount, payment_date, status, notes FROM payments WHERE project_id = %s ORDER BY payment_date DESC",
        (project_id,),
    )
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def get_admin_financial_summary():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT 
            SUM((SELECT COALESCE(SUM(total), 0) FROM project_budget_values pbv 
                 WHERE pbv.version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
            )) as gross_revenue,
            SUM((SELECT COALESCE(SUM(gross_revenue), 0) FROM project_budget_values pbv 
                 WHERE pbv.version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
            )) as gross_profit,
            (SELECT COALESCE(SUM(amount), 0) FROM payments) as total_received
        FROM projects p
    """
    cursor.execute(query)
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    if result:
        result["gross_revenue"] = float(result["gross_revenue"] or 0)
        result["gross_profit"] = float(result["gross_profit"] or 0)
        result["total_received"] = float(result["total_received"] or 0)
        result["pending_balance"] = result["gross_revenue"] - result["total_received"]

    return result


def get_all_projects_financials():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT 
            p.id, 
            p.project_name, 
            p.code_name,
            p.status,
            (SELECT COALESCE(SUM(gross_revenue), 0) FROM project_budget_values pbv 
             WHERE pbv.version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
            ) as latest_gross_total,
            (SELECT COALESCE(SUM(total), 0) FROM project_budget_values pbv 
             WHERE pbv.version_id = (SELECT id FROM budget_versions WHERE project_id = p.id ORDER BY version_number DESC LIMIT 1)
            ) as latest_budget_total,
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE project_id = p.id) as total_paid
        FROM projects p
        ORDER BY p.id DESC
    """
    cursor.execute(query)
    result = cursor.fetchall()

    for res in result:
        res["latest_gross_total"] = float(res["latest_gross_total"] or 0)
        res["latest_budget_total"] = float(res["latest_budget_total"] or 0)
        res["total_paid"] = float(res["total_paid"] or 0)
        res["balance"] = res["latest_budget_total"] - res["total_paid"]

    cursor.close()
    conn.close()
    return result


# milestones
def update_project_status(project_id, status):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE projects SET status = %s WHERE id = %s", (status, project_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return True


def run_project_locations_migration():
    pass


def run_budget_migration():
    print("Migration: Starting...")
    conn = get_connection()
    print("Migration: Connected.")
    cursor = conn.cursor()
    try:
        print("Migration: Creating budget_versions table...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS budget_versions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                version_number INT NOT NULL,
                published_to_crew TINYINT(1) DEFAULT 0,
                published_to_client TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """
        )

        print("Migration: Checking for published_to_crew column...")
        cursor.execute("SHOW COLUMNS FROM budget_versions LIKE 'published_to_crew'")
        if not cursor.fetchone():
            print("Migration: Adding published_to_crew column...")
            cursor.execute(
                "ALTER TABLE budget_versions ADD COLUMN published_to_crew TINYINT(1) DEFAULT 0"
            )

        print("Migration: Checking for published_to_client column...")
        cursor.execute("SHOW COLUMNS FROM budget_versions LIKE 'published_to_client'")
        if not cursor.fetchone():
            print("Migration: Adding published_to_client column...")
            cursor.execute(
                "ALTER TABLE budget_versions ADD COLUMN published_to_client TINYINT(1) DEFAULT 0"
            )

        print("Migration: Checking for published_at column...")
        cursor.execute("SHOW COLUMNS FROM budget_versions LIKE 'published_at'")
        if not cursor.fetchone():
            print("Migration: Adding published_at column...")
            cursor.execute(
                "ALTER TABLE budget_versions ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL"
            )

        print("Migration: Checking for version_id column...")
        cursor.execute("SHOW COLUMNS FROM project_budget_values LIKE 'version_id'")
        if not cursor.fetchone():
            print("Migration: Adding version_id column...")
            cursor.execute(
                "ALTER TABLE project_budget_values ADD COLUMN version_id INT"
            )

        print("Migration: Creating Version 1 for existing projects...")
        cursor.execute(
            """
            INSERT INTO budget_versions (project_id, version_number)
            SELECT DISTINCT project_id, 1 
            FROM project_budget_values 
            WHERE project_id NOT IN (SELECT DISTINCT project_id FROM budget_versions)
        """
        )

        print("Migration: Linking budget values to Version 1...")
        cursor.execute(
            """
            UPDATE project_budget_values pbv
            JOIN budget_versions bv ON pbv.project_id = bv.project_id AND bv.version_number = 1
            SET pbv.version_id = bv.id
            WHERE pbv.version_id IS NULL
        """
        )

        print("Migration: Updating index...")
        try:
            cursor.execute("ALTER TABLE project_budget_values DROP INDEX project_id")
            print("Migration: Dropped old index.")
        except:
            pass
        try:
            cursor.execute(
                "CREATE UNIQUE INDEX idx_version_item ON project_budget_values (version_id, budget_item_id)"
            )
            print("Migration: Created new unique index.")
        except:
            pass

        print("Migration: Checking for is_itemized column...")
        cursor.execute("SHOW COLUMNS FROM project_budget_values LIKE 'is_itemized'")
        if not cursor.fetchone():
            print("Migration: Adding is_itemized column...")
            cursor.execute(
                "ALTER TABLE project_budget_values ADD COLUMN is_itemized TINYINT(1) DEFAULT 0"
            )

        print("Migration: Creating budget_item_breakdowns table...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS budget_item_breakdowns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                version_id INT NOT NULL,
                budget_item_id INT NOT NULL,
                description TEXT,
                quantity DECIMAL(15, 2) DEFAULT 0,
                rate_type VARCHAR(50) DEFAULT 'day',
                rate_multiplier DECIMAL(15, 2) DEFAULT 1.0,
                rate DECIMAL(15, 2) DEFAULT 0,
                gross_revenue DECIMAL(15, 2) DEFAULT 0,
                additional1 DECIMAL(15, 2) DEFAULT 0,
                total DECIMAL(15, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
                FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE CASCADE
            )
        """
        )

        print("Migration: Checking for email column in users...")
        cursor.execute("SHOW COLUMNS FROM users LIKE 'email'")
        if not cursor.fetchone():
            print("Migration: Adding email column to users...")
            cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL")

        print("Migration: Checking for profile_image column in users...")
        cursor.execute("SHOW COLUMNS FROM users LIKE 'profile_image'")
        if not cursor.fetchone():
            print("Migration: Adding profile_image column to users...")
            cursor.execute("ALTER TABLE users ADD COLUMN profile_image LONGTEXT NULL")

        print("Migration: Checking for theme_mode column in users...")
        cursor.execute("SHOW COLUMNS FROM users LIKE 'theme_mode'")
        if not cursor.fetchone():
            print("Migration: Adding theme_mode column to users...")
            cursor.execute("ALTER TABLE users ADD COLUMN theme_mode VARCHAR(50) DEFAULT 'dark'")

        print("Migration: Checking for email_notifications column in users...")
        cursor.execute("SHOW COLUMNS FROM users LIKE 'email_notifications'")
        if not cursor.fetchone():
            print("Migration: Adding email_notifications column to users...")
            cursor.execute("ALTER TABLE users ADD COLUMN email_notifications TINYINT(1) DEFAULT 1")

        print("Migration: Checking for pause_notifications column in users...")
        cursor.execute("SHOW COLUMNS FROM users LIKE 'pause_notifications'")
        if not cursor.fetchone():
            print("Migration: Adding pause_notifications column to users...")
            cursor.execute("ALTER TABLE users ADD COLUMN pause_notifications TINYINT(1) DEFAULT 0")

        try:
            cursor.execute("ALTER TABLE project_map_routes ADD COLUMN start_time VARCHAR(10) DEFAULT '08:00'")
            print("Migration: Added start_time to project_map_routes.")
        except Exception as e:
            if "Duplicate column name" not in str(e):
                print(f"Migration error for project_map_routes: {e}")

        print("Migration: Creating department_crew_assignments table...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS department_crew_assignments (
                project_id INT NOT NULL,
                department_id INT NOT NULL,
                user_id INT NOT NULL,
                PRIMARY KEY (project_id, department_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """
        )

        print("Migration: Creating category_crew_assignments table...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS category_crew_assignments (
                project_id INT NOT NULL,
                category_id INT NOT NULL,
                user_id INT NOT NULL,
                PRIMARY KEY (project_id, category_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """
        )

        print("Migration: Creating budget_item_crew_assignments table...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS budget_item_crew_assignments (
                project_id INT NOT NULL,
                budget_item_id INT NOT NULL,
                user_id INT NOT NULL,
                PRIMARY KEY (project_id, budget_item_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """
        )

        print("Migration: Committing...")
        conn.commit()
        print("Migration: Success!")
        return "Migration Success"
    except Exception as e:
        print(f"Migration: Error - {str(e)}")
        conn.rollback()
        return f"Migration failed: {str(e)}"
    finally:
        cursor.close()
        conn.close()


def get_project_department_crew(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT dca.department_id, u.id as user_id, u.username, u.full_name, u.profile_image
        FROM department_crew_assignments dca
        JOIN users u ON dca.user_id = u.id
        WHERE dca.project_id = %s
    """
    cursor.execute(query, (project_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    # Group by department_id
    result = {}
    for r in rows:
        dept_id = str(r["department_id"])
        if dept_id not in result:
            result[dept_id] = []
        result[dept_id].append({
            "id": r["user_id"],
            "username": r["username"],
            "full_name": r["full_name"],
            "profile_image": r["profile_image"]
        })
    return result


def update_project_department_crew(project_id, department_id, user_ids):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Clear existing assignments for this project and department
        cursor.execute(
            "DELETE FROM department_crew_assignments WHERE project_id = %s AND department_id = %s",
            (project_id, department_id)
        )
        # Add new assignments
        if user_ids:
            insert_query = """
                INSERT INTO department_crew_assignments (project_id, department_id, user_id)
                VALUES (%s, %s, %s)
            """
            rows = [(project_id, department_id, u_id) for u_id in user_ids]
            cursor.executemany(insert_query, rows)
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def get_project_category_crew(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT cca.category_id, u.id as user_id, u.username, u.full_name, u.profile_image
        FROM category_crew_assignments cca
        JOIN users u ON cca.user_id = u.id
        WHERE cca.project_id = %s
    """
    cursor.execute(query, (project_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    result = {}
    for r in rows:
        cat_id = str(r["category_id"])
        if cat_id not in result:
            result[cat_id] = []
        result[cat_id].append({
            "id": r["user_id"],
            "username": r["username"],
            "full_name": r["full_name"],
            "profile_image": r["profile_image"]
        })
    return result

def update_project_category_crew(project_id, category_id, user_ids):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM category_crew_assignments WHERE project_id = %s AND category_id = %s",
            (project_id, category_id)
        )
        if user_ids:
            insert_query = """
                INSERT INTO category_crew_assignments (project_id, category_id, user_id)
                VALUES (%s, %s, %s)
            """
            rows = [(project_id, category_id, u_id) for u_id in user_ids]
            cursor.executemany(insert_query, rows)
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def get_project_budget_item_crew(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
        SELECT bca.budget_item_id, u.id as user_id, u.username, u.full_name, u.profile_image
        FROM budget_item_crew_assignments bca
        JOIN users u ON bca.user_id = u.id
        WHERE bca.project_id = %s
    """
    cursor.execute(query, (project_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    
    result = {}
    for r in rows:
        item_id = str(r["budget_item_id"])
        if item_id not in result:
            result[item_id] = []
        result[item_id].append({
            "id": r["user_id"],
            "username": r["username"],
            "full_name": r["full_name"],
            "profile_image": r["profile_image"]
        })
    return result

def update_project_budget_item_crew(project_id, budget_item_id, user_ids):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM budget_item_crew_assignments WHERE project_id = %s AND budget_item_id = %s",
            (project_id, budget_item_id)
        )
        if user_ids:
            insert_query = """
                INSERT INTO budget_item_crew_assignments (project_id, budget_item_id, user_id)
                VALUES (%s, %s, %s)
            """
            rows = [(project_id, budget_item_id, u_id) for u_id in user_ids]
            cursor.executemany(insert_query, rows)
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()




# --- EQUIPMENT RELATIONAL DB OPERATIONS ---

def get_project_equipment_full(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Get hero data from new tables
    cursor.execute('SELECT * FROM project_equipment_heroes WHERE project_id = %s', (project_id,))
    hero_row = cursor.fetchone()
    
    hero_data = None
    hero_secondary_data = None
    
    if hero_row:
        hero_data = {
            "label": hero_row['hero_label'],
            "name": hero_row['hero_name'],
            "details": hero_row['hero_details'],
            "status": hero_row['hero_status']
        }
        if hero_row['secondary_name']:
            hero_secondary_data = {
                "label": hero_row['secondary_label'],
                "name": hero_row['secondary_name'],
                "details": hero_row['secondary_details'],
                "status": hero_row['secondary_status']
            }

    # Get departments
    cursor.execute('SELECT * FROM project_equipment_departments WHERE project_id = %s ORDER BY created_at', (project_id,))
    departments = cursor.fetchall()
    
    # Get items for these departments
    if departments:
        dept_ids = tuple([d['id'] for d in departments])
        if len(dept_ids) == 1:
            cursor.execute('SELECT * FROM project_equipment_items WHERE department_id = %s ORDER BY created_at', (dept_ids[0],))
        else:
            format_strings = ','.join(['%s'] * len(dept_ids))
            cursor.execute(f'SELECT * FROM project_equipment_items WHERE department_id IN ({format_strings}) ORDER BY created_at', dept_ids)
        items = cursor.fetchall()
        
        # Group items by department
        for d in departments:
            d['items'] = [i for i in items if i['department_id'] == d['id']]
            # Format IDs as strings for frontend
            d['id'] = str(d['id'])
            for item in d['items']:
                item['id'] = str(item['id'])
    
    cursor.close()
    conn.close()
    
    return {
        'hero': hero_data,
        'heroSecondary': hero_secondary_data,
        'departments': departments
    }

def create_equipment_department(project_id, name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO project_equipment_departments (project_id, name) VALUES (%s, %s)', (project_id, name))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return {'id': str(new_id), 'name': name, 'items': []}

def update_equipment_department(department_id, name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE project_equipment_departments SET name = %s WHERE id = %s', (name, department_id))
    conn.commit()
    cursor.close()
    conn.close()
    return True

def delete_equipment_department(department_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM project_equipment_departments WHERE id = %s', (department_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True

def create_equipment_item(department_id, name, qty=1):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO project_equipment_items (department_id, name, qty) VALUES (%s, %s, %s)', (department_id, name, qty))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return {'id': str(new_id), 'name': name, 'qty': qty}

def update_equipment_item(item_id, name=None, qty=None):
    conn = get_connection()
    cursor = conn.cursor()
    if name is not None and qty is not None:
        cursor.execute('UPDATE project_equipment_items SET name = %s, qty = %s WHERE id = %s', (name, qty, item_id))
    elif name is not None:
        cursor.execute('UPDATE project_equipment_items SET name = %s WHERE id = %s', (name, item_id))
    elif qty is not None:
        cursor.execute('UPDATE project_equipment_items SET qty = %s WHERE id = %s', (qty, item_id))
    conn.commit()
    cursor.close()
    conn.close()
    return True

def delete_equipment_item(item_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM project_equipment_items WHERE id = %s', (item_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True


def update_project_route(project_id, route_id, route_data):
    conn = get_connection()
    cursor = conn.cursor()
    
    title = route_data.get('title', '')
    route_color = route_data.get('color', '#ffffff')
    start_time = route_data.get('startTime', '08:00')
    start_date = route_data.get('startDate', '')
    vehicle_type = route_data.get('vehicleType', 'sedan')

    # Delete existing locations for this specific route
    cursor.execute("DELETE FROM project_map_route_locations WHERE route_id = %s", (route_id,))
    
    # Check if route exists to UPSERT
    cursor.execute("SELECT id FROM project_map_routes WHERE id = %s", (route_id,))
    if cursor.fetchone():
        cursor.execute(
            "UPDATE project_map_routes SET title=%s, color=%s, start_time=%s, start_date=%s, vehicle_type=%s WHERE id=%s",
            (title, route_color, start_time, start_date, vehicle_type, route_id)
        )
    else:
        cursor.execute(
            "INSERT INTO project_map_routes (id, project_id, title, color, start_time, start_date, vehicle_type) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (route_id, project_id, title, route_color, start_time, start_date, vehicle_type)
        )
        
    locations = route_data.get('locations', [])
    for i, loc in enumerate(locations):
        loc_id = str(loc.get('id', ''))
        loc_name = loc.get('name', '')
        loc_address = loc.get('address', '')
        if loc_id:
            cursor.execute(
                "INSERT INTO project_map_route_locations (id, route_id, name, address, sequence) VALUES (%s, %s, %s, %s, %s)",
                (loc_id, route_id, loc_name, loc_address, i)
            )

    conn.commit()
    cursor.close()
    conn.close()


def delete_project_route(project_id, route_id):
    conn = get_connection()
    cursor = conn.cursor()
    
    # Delete locations first
    cursor.execute("DELETE FROM project_map_route_locations WHERE route_id = %s", (route_id,))
    # Delete route
    cursor.execute("DELETE FROM project_map_routes WHERE id = %s", (route_id,))

    conn.commit()
    cursor.close()
    conn.close()


def get_budget_full_data(project_id, version_id=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    if not version_id:
        cursor.execute("SELECT id FROM budget_versions WHERE project_id = %s ORDER BY version_number DESC LIMIT 1", (project_id,))
        rv = cursor.fetchone()
        version_id = rv["id"] if rv else None

    if not version_id:
        cursor.close()
        conn.close()
        return {"hierarchy": [], "values": {}, "breakdowns": []}

    query = """
    SELECT p.id as phase_id, p.phase_name, d.id as dept_id, d.department_name, c.id as cat_id, c.category_name, i.id as item_id, i.item_name FROM budget_phases p LEFT JOIN departments d ON p.id = d.phase_id LEFT JOIN categories c ON d.id = c.department_id LEFT JOIN budget_items i ON c.id = i.category_id ORDER BY p.sort_order, d.sort_order, d.id, c.sort_order, i.sort_order;
    SELECT pv.budget_item_id, pv.quantity, pv.rate, pv.rate_type, pv.rate_multiplier, pv.gross_revenue, pv.additional1, pv.comment1, pv.total, pv.is_itemized FROM project_budget_values pv WHERE pv.version_id = %s;
    SELECT budget_item_id, SUM(total) as agg_total FROM budget_item_breakdowns WHERE version_id = %s GROUP BY budget_item_id;
    SELECT * FROM budget_item_breakdowns WHERE project_id = %s AND version_id = %s ORDER BY budget_item_id ASC, id ASC;
    """
    
    results = cursor.execute(query, (version_id, version_id, project_id, version_id), multi=True)
    
    # 1: Hierarchy
    hierarchy_rows = next(results).fetchall()
    # 2: Values
    values_rows = next(results).fetchall()
    # 3: Aggs
    agg_rows = next(results).fetchall()
    # 4: Breakdowns
    breakdowns = next(results).fetchall()
    
    cursor.close()
    conn.close()
    
    phases = []
    phase_map = {}
    for row in hierarchy_rows:
        p_id = row['phase_id']
        if p_id not in phase_map:
            phase = {'phase_id': p_id, 'phase_name': row['phase_name'], 'departments': [], '_dept_map': {}}
            phases.append(phase)
            phase_map[p_id] = phase
        phase = phase_map[p_id]
        d_id = row['dept_id']
        if d_id and d_id not in phase['_dept_map']:
            dept = {'id': d_id, 'department_name': row['department_name'], 'categories': [], '_cat_map': {}}
            phase['departments'].append(dept)
            phase['_dept_map'][d_id] = dept
        if d_id:
            dept = phase['_dept_map'][d_id]
            c_id = row['cat_id']
            if c_id and c_id not in dept['_cat_map']:
                cat = {'id': c_id, 'category_name': row['category_name'], 'items': []}
                dept['categories'].append(cat)
                dept['_cat_map'][c_id] = cat
            if c_id:
                cat = dept['_cat_map'][c_id]
                i_id = row['item_id']
                if i_id:
                    cat['items'].append({'id': i_id, 'item_name': row['item_name'], 'category_id': c_id})
    for p in phases:
        p.pop('_dept_map', None)
        for d in p['departments']:
            d.pop('_cat_map', None)
            
    values_map = {
        str(row['budget_item_id']): {**row, 'is_itemized': bool(row.get('is_itemized', 0))}
        for row in values_rows
    }
    
    for b_row in agg_rows:
        bid_str = str(b_row['budget_item_id'])
        if bid_str not in values_map:
            values_map[bid_str] = {
                'budget_item_id': b_row['budget_item_id'], 'quantity': 0, 'rate': 0, 'rate_type': 'day', 'rate_multiplier': 1, 'gross_revenue': 0, 'additional1': 0, 'comment1': '', 'total': b_row['agg_total'] or 0, 'is_itemized': True
            }
        else:
            values_map[bid_str]['is_itemized'] = True
            values_map[bid_str]['total'] = b_row['agg_total'] or values_map[bid_str]['total']
            
    return {'hierarchy': phases, 'values': values_map, 'breakdowns': breakdowns}


def get_budget_crew_init(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    query = '''
        SELECT dca.department_id, u.id as user_id, u.username, u.full_name, u.profile_image
        FROM department_crew_assignments dca
        JOIN users u ON dca.user_id = u.id
        WHERE dca.project_id = %s;
        
        SELECT cca.category_id, u.id as user_id, u.username, u.full_name, u.profile_image
        FROM category_crew_assignments cca
        JOIN users u ON cca.user_id = u.id
        WHERE cca.project_id = %s;
        
        SELECT bca.budget_item_id, u.id as user_id, u.username, u.full_name, u.profile_image
        FROM budget_item_crew_assignments bca
        JOIN users u ON bca.user_id = u.id
        WHERE bca.project_id = %s;
        
        SELECT cp.user_id, u.username, u.full_name, u.profile_image
        FROM crew_projects cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.project_id = %s;
        
        SELECT id, version_number, published_to_crew, published_to_client, created_at, published_at 
        FROM budget_versions WHERE project_id = %s ORDER BY version_number ASC;
    '''
    
    results = cursor.execute(query, (project_id, project_id, project_id, project_id, project_id), multi=True)
    
    dept_rows = next(results).fetchall()
    dept_assign = {}
    for r in dept_rows:
        dept_id = str(r["department_id"])
        if dept_id not in dept_assign: dept_assign[dept_id] = []
        dept_assign[dept_id].append({"id": r["user_id"], "username": r["username"], "full_name": r["full_name"], "profile_image": r["profile_image"]})
        
    cat_rows = next(results).fetchall()
    cat_assign = {}
    for r in cat_rows:
        cat_id = str(r["category_id"])
        if cat_id not in cat_assign: cat_assign[cat_id] = []
        cat_assign[cat_id].append({"id": r["user_id"], "username": r["username"], "full_name": r["full_name"], "profile_image": r["profile_image"]})
        
    item_rows = next(results).fetchall()
    item_assign = {}
    for r in item_rows:
        item_id = str(r["budget_item_id"])
        if item_id not in item_assign: item_assign[item_id] = []
        item_assign[item_id].append({"id": r["user_id"], "username": r["username"], "full_name": r["full_name"], "profile_image": r["profile_image"]})
        
    crew_rows = next(results).fetchall()
    project_crew = [{"id": r["user_id"], "username": r["username"], "full_name": r["full_name"], "profile_image": r["profile_image"]} for r in crew_rows]
    
    version_rows = next(results).fetchall()
    
    cursor.close()
    conn.close()
    
    return {
        "department_crew": dept_assign,
        "category_crew": cat_assign,
        "budget_item_crew": item_assign,
        "project_crew": project_crew,
        "budget_versions": version_rows
    }
