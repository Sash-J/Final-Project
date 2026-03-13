from database import get_connection


# ── Tables ────────────────────────────────────────────────────────────────────


def get_tables():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES;")
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return [table[0] for table in result]


# ── Projects ──────────────────────────────────────────────────────────────────


def get_projects():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM projects ORDER BY id DESC")
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def insert_project(project_name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO projects (project_name) VALUES (%s)", (project_name,))
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


# ── Departments ───────────────────────────────────────────────────────────────


def get_departments():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM departments ORDER BY id DESC")
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result


def insert_department(department_name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO departments (department_name) VALUES (%s)", (department_name,)
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


# ── Categories ────────────────────────────────────────────────────────────────


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
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO categories (category_name, department_id) VALUES (%s, %s)",
        (category_name, department_id),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


# ── Budget Items ──────────────────────────────────────────────────────────────


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


# ── Project Budget Values ─────────────────────────────────────────────────────


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


def insert_budget_value(project_id, budget_item_id, quantity, rate, total):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO project_budget_values
           (project_id, budget_item_id, quantity, rate, total)
           VALUES (%s, %s, %s, %s, %s)""",
        (project_id, budget_item_id, quantity, rate, total),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return new_id


# ── Hierarchy (departments → categories → budget items) ───────────────────────


def get_hierarchy():
    """Returns a nested structure: departments → categories → budget items."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM departments ORDER BY id")
    departments = cursor.fetchall()

    for dept in departments:
        cursor.execute(
            "SELECT * FROM categories WHERE department_id = %s ORDER BY id",
            (dept["id"],),
        )
        categories = cursor.fetchall()
        for cat in categories:
            cursor.execute(
                "SELECT * FROM budget_items WHERE category_id = %s ORDER BY id",
                (cat["id"],),
            )
            cat["items"] = cursor.fetchall()
        dept["categories"] = categories

    cursor.close()
    conn.close()
    return departments


# ── Budget values for a specific project (for pre-fill) ───────────────────────


def get_budget_values_for_project(project_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT budget_item_id, quantity, rate, additional1, additional2, comment1, comment2, total
        FROM project_budget_values
        WHERE project_id = %s
        """,
        (project_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    # Return as a dict keyed by budget_item_id for fast lookup in React
    return {str(row["budget_item_id"]): row for row in rows}


# ── Batch insert / upsert budget values ───────────────────────────────────────


def insert_budget_values_batch(project_id, values):
    """
    values: list of { budget_item_id, quantity, rate, total }
    Uses INSERT ... ON DUPLICATE KEY UPDATE so re-submitting a project
    updates existing rows rather than duplicating them.
    Requires a UNIQUE KEY on (project_id, budget_item_id) — add it once:
        ALTER TABLE project_budget_values
        ADD UNIQUE KEY uq_project_item (project_id, budget_item_id);
    """
    if not values:
        return 0

    conn = get_connection()
    cursor = conn.cursor()
    sql = """
        INSERT INTO project_budget_values
            (project_id, budget_item_id, quantity, rate, additional1, additional2, comment1, comment2, total)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            quantity    = VALUES(quantity),
            rate        = VALUES(rate),
            additional1 = VALUES(additional1),
            additional2 = VALUES(additional2),
            comment1    = VALUES(comment1),
            comment2    = VALUES(comment2),
            total       = VALUES(total)
    """
    rows = [
        (
            project_id,
            v["budget_item_id"],
            v["quantity"],
            v["rate"],
            v.get("additional1", 0),
            v.get("additional2", 0),
            v.get("comment1", ""),
            v.get("comment2", ""),
            v["total"],
        )
        for v in values
    ]
    cursor.executemany(sql, rows)
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()
    return affected


# ── Users ─────────────────────────────────────────────────────────────────────


def get_user_by_username(username):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user


def create_user(username, password_hash, role, is_approved=0):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, password_hash, role, is_approved) VALUES (%s, %s, %s, %s)",
        (username, password_hash, role, is_approved),
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


def approve_user(user_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_approved = 1 WHERE id = %s", (user_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return True


def insert_super_batch(rows):
    """
    rows: list of { project_name, department_name, category_name, item_name, quantity, rate }
    Creates entities if they don't exist and links them.
    Returns count of budget values affected.
    """
    if not rows:
        return 0

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    affected = 0

    try:
        for row in rows:
            p_name = row.get("project_name", "").strip()
            d_name = row.get("department_name", "").strip()
            c_name = row.get("category_name", "").strip()
            i_name = row.get("item_name", "").strip()
            qty = float(row.get("quantity", 0))
            rate = float(row.get("rate", 0))
            total = round(qty * rate, 2)

            if not all([p_name, d_name, c_name, i_name]):
                continue

            # 1. Project
            cursor.execute("SELECT id FROM projects WHERE project_name = %s", (p_name,))
            p_res = cursor.fetchone()
            if p_res:
                p_id = p_res["id"]
            else:
                cursor.execute(
                    "INSERT INTO projects (project_name) VALUES (%s)", (p_name,)
                )
                p_id = cursor.lastrowid

            # 2. Department
            cursor.execute(
                "SELECT id FROM departments WHERE department_name = %s", (d_name,)
            )
            d_res = cursor.fetchone()
            if d_res:
                d_id = d_res["id"]
            else:
                cursor.execute(
                    "INSERT INTO departments (department_name) VALUES (%s)", (d_name,)
                )
                d_id = cursor.lastrowid

            # 3. Category
            cursor.execute(
                "SELECT id FROM categories WHERE category_name = %s AND department_id = %s",
                (c_name, d_id),
            )
            c_res = cursor.fetchone()
            if c_res:
                c_id = c_res["id"]
            else:
                cursor.execute(
                    "INSERT INTO categories (category_name, department_id) VALUES (%s, %s)",
                    (c_name, d_id),
                )
                c_id = cursor.lastrowid

            # 4. Budget Item
            cursor.execute(
                "SELECT id FROM budget_items WHERE item_name = %s AND category_id = %s",
                (i_name, c_id),
            )
            i_res = cursor.fetchone()
            if i_res:
                i_id = i_res["id"]
            else:
                cursor.execute(
                    "INSERT INTO budget_items (item_name, category_id) VALUES (%s, %s)",
                    (i_name, c_id),
                )
                i_id = cursor.lastrowid

            # 5. Budget Value
            cursor.execute(
                """INSERT INTO project_budget_values 
                   (project_id, budget_item_id, quantity, rate, total)
                   VALUES (%s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE 
                   quantity = VALUES(quantity), rate = VALUES(rate), total = VALUES(total)""",
                (p_id, i_id, qty, rate, total),
            )
            affected += 1

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

    return affected
