from .database import get_connection


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
    location=None,
    color="#00c6e6",
    project_image=None,
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO projects (project_name, code_name, start_date, end_date, location, color, project_image) 
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (project_name, code_name, start_date, end_date, location, color, project_image),
    )
    new_id = cursor.lastrowid
    
    # Add default equipment departments
    cursor.execute(
        "INSERT INTO project_equipment_departments (project_id, name) VALUES (%s, %s)",
        (new_id, "Electrical")
    )
    cursor.execute(
        "INSERT INTO project_equipment_departments (project_id, name) VALUES (%s, %s)",
        (new_id, "Art")
    )
    
    conn.commit()
    cursor.close()
    conn.close()
    return new_id


def update_project(
    project_id,
    project_name,
    code_name=None,
    start_date=None,
    end_date=None,
    location=None,
    color="#00c6e6",
    project_image=None,
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """UPDATE projects 
           SET project_name = %s, code_name = %s, start_date = %s, end_date = %s, location = %s, color = %s, project_image = %s 
           WHERE id = %s""",
        (
            project_name,
            code_name,
            start_date,
            end_date,
            location,
            color,
            project_image,
            project_id,
        ),
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
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE projects SET equipment_data = %s WHERE id = %s",
            (equipment_json_str, project_id),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def update_project_crew_hierarchy(project_id, hierarchy_json_str):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE projects SET crew_hierarchy_data = %s WHERE id = %s",
            (hierarchy_json_str, project_id),
        )
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
                COALESCE((
                    SELECT SUM(total) FROM budget_item_breakdowns bib 
                    WHERE bib.version_id = pv.version_id AND bib.budget_item_id = pv.budget_item_id
                ), pv.total) as total,
                (pv.is_itemized OR EXISTS (
                    SELECT 1 FROM budget_item_breakdowns bib 
                    WHERE bib.version_id = pv.version_id AND bib.budget_item_id = pv.budget_item_id
                )) as is_itemized
            FROM project_budget_values pv
            WHERE pv.version_id = %s
        """
        params = (version_id,)
    else:
        query = """
            SELECT 
                pv.budget_item_id, pv.quantity, pv.rate, pv.rate_type, 
                pv.rate_multiplier, pv.gross_revenue, pv.additional1, pv.comment1,
                COALESCE((
                    SELECT SUM(total) FROM budget_item_breakdowns bib 
                    WHERE bib.version_id = pv.version_id AND bib.budget_item_id = pv.budget_item_id
                ), pv.total) as total,
                (pv.is_itemized OR EXISTS (
                    SELECT 1 FROM budget_item_breakdowns bib 
                    WHERE bib.version_id = pv.version_id AND bib.budget_item_id = pv.budget_item_id
                )) as is_itemized
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
    
    # Get hero data from projects table
    cursor.execute('SELECT equipment_data FROM projects WHERE id = %s', (project_id,))
    project = cursor.fetchone()
    
    import json
    hero_data = None
    hero_secondary_data = None
    if project and project.get('equipment_data'):
        try:
            parsed = json.loads(project['equipment_data'])
            if isinstance(parsed, dict):
                hero_data = parsed.get('hero', parsed)
                hero_secondary_data = parsed.get('heroSecondary', None)
            else:
                hero_data = parsed
        except Exception:
            pass

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
