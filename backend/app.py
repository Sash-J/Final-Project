from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from functools import wraps
from db_operations import (
    get_tables,
    get_projects,
    insert_project,
    get_departments,
    insert_department,
    get_categories,
    insert_category,
    get_budget_items,
    insert_budget_item,
    get_budget_values,
    insert_budget_value,
    get_hierarchy,
    get_budget_values_for_project,
    insert_budget_values_batch,
    get_user_by_username,
    create_user,
    get_pending_users,
    approve_user,
    insert_super_batch,
    get_all_users,
)

app = Flask(__name__)
app.secret_key = "super_secret_key"  # Change this in production
CORS(app, supports_credentials=True)
bcrypt = Bcrypt(app)


# ── Auth Decorators ───────────────────────────────────────────────────────────


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        return f(*args, **kwargs)

    return decorated_function


def roles_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user_role" not in session or session["user_role"] not in roles:
                return jsonify({"error": "Unauthorized"}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator


# ── Auth Routes ───────────────────────────────────────────────────────────────


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = get_user_by_username(username)
    if user and bcrypt.check_password_hash(user["password_hash"], password):
        if not user.get("is_approved"):
            return (
                jsonify({"error": "Your account is pending admin approval"}),
                403,
            )

        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["user_role"] = user["role"]
        return (
            jsonify(
                {
                    "message": "Logged in successfully",
                    "user": {"username": user["username"], "role": user["role"]},
                }
            ),
            200,
        )

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/api/me", methods=["GET"])
def get_me():
    if "user_id" in session:
        return (
            jsonify(
                {
                    "logged_in": True,
                    "user": {
                        "username": session["username"],
                        "role": session["user_role"],
                    },
                }
            ),
            200,
        )
    return jsonify({"logged_in": False}), 200


@app.route("/api/init-admin", methods=["GET"])
def init_admin():
    # Only for initial setup!
    existing = get_user_by_username("admin")
    if existing:
        return jsonify({"message": "Admin already exists"}), 200

    hashed = bcrypt.generate_password_hash("admin123").decode("utf-8")
    create_user("admin", hashed, "admin", is_approved=1)
    return jsonify({"message": "Admin user created: admin / admin123"}), 201


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password")
    role = data.get("role", "client")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    existing = get_user_by_username(username)
    if existing:
        return jsonify({"error": "Username already exists"}), 400

    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    create_user(username, hashed, role, is_approved=0)
    return (
        jsonify({"message": "Registration successful. Pending admin approval."}),
        201,
    )


@app.route("/api/admin/pending-users", methods=["GET"])
@roles_required("admin")
def pending_users_get():
    return jsonify(get_pending_users()), 200


@app.route("/api/admin/users", methods=["GET"])
@roles_required("admin")
def users_get():
    return jsonify(get_all_users()), 200


@app.route("/api/admin/approve-user", methods=["POST"])
@roles_required("admin")
def approve_user_post():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    approve_user(user_id)
    return jsonify({"message": "User approved successfully"}), 200


# ── Tables ────────────────────────────────────────────────────────────────────


@app.route("/getTable", methods=["GET"])
@login_required
def getTable():
    return jsonify({"tables": get_tables()}), 200


# ── Projects ──────────────────────────────────────────────────────────────────


@app.route("/projects", methods=["GET"])
@login_required
def projects_get():
    return jsonify(get_projects()), 200


@app.route("/projects", methods=["POST"])
@roles_required("admin")
def projects_post():
    data = request.get_json()
    project_name = data.get("project_name", "").strip()
    if not project_name:
        return jsonify({"error": "project_name is required"}), 400
    new_id = insert_project(project_name)
    return jsonify({"message": "Project added successfully", "id": new_id}), 201


# ── Departments ───────────────────────────────────────────────────────────────


@app.route("/departments", methods=["GET"])
@login_required
def departments_get():
    return jsonify(get_departments()), 200


@app.route("/departments", methods=["POST"])
@roles_required("admin")
def departments_post():
    data = request.get_json()
    department_name = data.get("department_name", "").strip()
    if not department_name:
        return jsonify({"error": "department_name is required"}), 400
    new_id = insert_department(department_name)
    return jsonify({"message": "Department added successfully", "id": new_id}), 201


# ── Categories ────────────────────────────────────────────────────────────────


@app.route("/categories", methods=["GET"])
@login_required
def categories_get():
    return jsonify(get_categories()), 200


@app.route("/categories", methods=["POST"])
@roles_required("admin")
def categories_post():
    data = request.get_json()
    category_name = data.get("category_name", "").strip()
    department_id = data.get("department_id")
    if not category_name or not department_id:
        return jsonify({"error": "category_name and department_id are required"}), 400
    new_id = insert_category(category_name, department_id)
    return jsonify({"message": "Category added successfully", "id": new_id}), 201


# ── Budget Items ──────────────────────────────────────────────────────────────


@app.route("/budget-items", methods=["GET"])
@login_required
def budget_items_get():
    return jsonify(get_budget_items()), 200


@app.route("/budget-items", methods=["POST"])
@roles_required("admin", "manager")
def budget_items_post():
    data = request.get_json()
    item_name = data.get("item_name", "").strip()
    category_id = data.get("category_id")
    if not item_name or not category_id:
        return jsonify({"error": "item_name and category_id are required"}), 400
    new_id = insert_budget_item(item_name, category_id)
    return jsonify({"message": "Budget item added successfully", "id": new_id}), 201


# ── Project Budget Values ─────────────────────────────────────────────────────


@app.route("/budget-values", methods=["GET"])
@login_required
def budget_values_get():
    return jsonify(get_budget_values()), 200


@app.route("/budget-values", methods=["POST"])
@roles_required("admin", "manager")
def budget_values_post():
    data = request.get_json()
    project_id = data.get("project_id")
    budget_item_id = data.get("budget_item_id")
    quantity = data.get("quantity", 0)
    rate = data.get("rate", 0)
    total = data.get("total", 0)
    if not project_id or not budget_item_id:
        return jsonify({"error": "project_id and budget_item_id are required"}), 400
    new_id = insert_budget_value(project_id, budget_item_id, quantity, rate, total)
    return jsonify({"message": "Budget value added successfully", "id": new_id}), 201


# ── Hierarchy ─────────────────────────────────────────────────────────────────


@app.route("/hierarchy", methods=["GET"])
@login_required
def hierarchy_get():
    return jsonify(get_hierarchy()), 200


# ── Budget values per project ──────────────────────────────────────────────────


@app.route("/budget-values/project/<int:project_id>", methods=["GET"])
@login_required
def budget_values_for_project(project_id):
    return jsonify(get_budget_values_for_project(project_id)), 200


# ── Batch insert / upsert ─────────────────────────────────────────────────────


@app.route("/budget-values/batch", methods=["POST"])
@roles_required("admin", "manager")
def budget_values_batch():
    data = request.get_json()
    project_id = data.get("project_id")
    values = data.get("values", [])
    if not project_id:
        return jsonify({"error": "project_id is required"}), 400
    if not values:
        return jsonify({"error": "No values provided"}), 400
    affected = insert_budget_values_batch(project_id, values)
    return jsonify({"message": f"{affected} rows saved", "affected": affected}), 200


# ── Super Batch ───────────────────────────────────────────────────────────────


@app.route("/admin/super-batch", methods=["POST"])
@roles_required("admin")
def super_batch_post():
    data = request.get_json()
    rows = data.get("rows", [])
    if not rows:
        return jsonify({"error": "No data provided"}), 400
    try:
        affected = insert_super_batch(rows)
        return (
            jsonify({"message": f"Successfully processed {affected} records"}),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Server started on port 5000")
    app.run(debug=True)
