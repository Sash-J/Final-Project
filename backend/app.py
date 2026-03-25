from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from functools import wraps
import db_operations as db
import auth_operations as auth

print("DEBUG: app.py starting with db_operations imported as db and auth_operations as auth")
app = Flask(__name__)
app.secret_key = "super_secret_key"  # Change this in production
CORS(
    app,
    supports_credentials=True,
    origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
)
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
            if request.method == 'OPTIONS':
                return f(*args, **kwargs)
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

    user = auth.get_user_by_username(username)
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
    existing = auth.get_user_by_username("admin")
    if existing:
        return jsonify({"message": "Admin already exists"}), 200

    hashed = bcrypt.generate_password_hash("admin123").decode("utf-8")
    auth.create_user("admin", hashed, "admin", is_approved=1)
    return jsonify({"message": "Admin user created: admin / admin123"}), 201


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password")
    role = data.get("role", "client")
    full_name = data.get("full_name", "").strip()
    address = data.get("address", "").strip()
    telephone = data.get("telephone", "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    existing_user = auth.get_user_by_username(username)
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400

    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    auth.create_user(username, hashed, role, is_approved=0, full_name=full_name, address=address, telephone=telephone)
    return (
        jsonify({"message": "Registration successful. Pending admin approval."}),
        201,
    )


@app.route("/api/admin/pending-users", methods=["GET"])
@roles_required("admin")
def pending_users_get():
    return jsonify(auth.get_pending_users()), 200


@app.route("/api/admin/users", methods=["GET"])
@roles_required("admin")
def users_get():
    return jsonify(auth.get_all_users()), 200


@app.route("/api/clients", methods=["GET"])
@roles_required("admin", "manager")
def clients_get():
    return jsonify(auth.get_clients()), 200


@app.route("/api/admin/approve-user", methods=["POST"])
@roles_required("admin")
def approve_user_post():
    data = request.get_json()
    user_id = data.get("user_id")
    role = data.get("role")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if role:
        if role not in ["manager", "client", "production_crew"]:
            return jsonify({"error": "Invalid role"}), 400
        auth.update_user_role(user_id, role)
    auth.approve_user(user_id)
    return jsonify({"message": "User approved successfully"}), 200


@app.route("/api/admin/reject-user", methods=["POST"])
@roles_required("admin")
def reject_user_post():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    auth.delete_user(user_id)
    return jsonify({"message": "User registration rejected and removed"}), 200


@app.route("/api/admin/delete-user", methods=["POST"])
@roles_required("admin")
def delete_user_post():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    # Prevent deleting the main admin (ID 1)
    if int(user_id) == 1:
        return jsonify({"error": "Cannot delete the primary admin account"}), 400
    auth.delete_user(user_id)
    return jsonify({"message": "User account deleted successfully"}), 200


@app.route("/api/admin/update-user-role", methods=["POST"])
@roles_required("admin")
def update_user_role_post():
    data = request.get_json()
    user_id = data.get("user_id")
    role = data.get("role")
    if not user_id or not role:
        return jsonify({"error": "user_id and role are required"}), 400
    if role not in ["manager", "client", "production_crew"]:
        return jsonify({"error": "Invalid role"}), 400
    auth.update_user_role(user_id, role)
    return jsonify({"message": "User role updated successfully"}), 200


@app.route("/api/crew", methods=["GET"])
@login_required
def get_crew_endpoint():
    return jsonify(auth.get_crew_users()), 200


# ── Tables ────────────────────────────────────────────────────────────────────


@app.route("/getTable", methods=["GET"])
@login_required
def getTable():
    return jsonify({"tables": db.get_tables()}), 200


# ── Projects ──────────────────────────────────────────────────────────────────


@app.route("/api/projects", methods=["GET"])
@login_required
def projects_get():
    return jsonify(db.get_projects()), 200


@app.route("/api/projects", methods=["POST"])
@roles_required("admin")
def projects_post():
    data = request.get_json()
    project_name = data.get("project_name", "").strip()
    code_name = data.get("code_name", "").strip() or None
    start_date = data.get("start_date") or None
    end_date = data.get("end_date") or None
    location = data.get("location", "").strip() or None

    if not project_name:
        return jsonify({"error": "project_name is required"}), 400
    
    new_id = db.insert_project(project_name, code_name, start_date, end_date, location)
    
    # Handle client assignments
    client_ids = data.get("client_ids", [])
    if isinstance(client_ids, list):
        for c_id in client_ids:
            try:
                auth.assign_client_to_project(c_id, new_id)
            except:
                pass

    # Handle crew assignments
    crew_ids = data.get("crew_ids", [])
    if isinstance(crew_ids, list):
        for cr_id in crew_ids:
            try:
                auth.assign_crew_to_project(cr_id, new_id)
            except:
                pass

    return jsonify({"message": "Project added successfully", "id": new_id}), 201


@app.route("/api/projects/<int:project_id>/status", methods=["PUT"])
@login_required
def update_project_status_endpoint(project_id):
    data = request.get_json()
    status = data.get("status")
    if status not in ["in_progress", "completed"]:
        return jsonify({"error": "Invalid status"}), 400
    try:
        db.update_project_status(project_id, status)
        return jsonify({"message": f"Project marked as {status}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


from flask_cors import cross_origin

@app.route("/api/projects/<int:project_id>", methods=["PUT"])
@roles_required("admin")
@cross_origin(supports_credentials=True)
def projects_put(project_id):
    try:
        data = request.get_json()
        print(f"DEBUG: Updating project {project_id} with data: {data}")
        project_name = data.get("project_name", "").strip()
        code_name = data.get("code_name", "").strip() or None
        start_date = data.get("start_date") or None
        end_date = data.get("end_date") or None
        location = data.get("location", "").strip() or None

        if not project_name:
            return jsonify({"error": "project_name is required"}), 400
        
        db.update_project(project_id, project_name, code_name, start_date, end_date, location)
        
        # Sync client assignments
        client_ids = data.get("client_ids", [])
        if isinstance(client_ids, list):
            auth.clear_project_clients(project_id)
            for c_id in client_ids:
                try:
                    auth.assign_client_to_project(c_id, project_id)
                except:
                    pass

        # Sync crew assignments
        crew_ids = data.get("crew_ids", [])
        if isinstance(crew_ids, list):
            auth.clear_project_crew(project_id)
            for cr_id in crew_ids:
                try:
                    auth.assign_crew_to_project(cr_id, project_id)
                except:
                    pass
                    
        return jsonify({"message": "Project updated successfully"}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
@roles_required("admin")
def projects_delete(project_id):
    try:
        db.delete_project(project_id)
        return jsonify({"message": "Project deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Departments ───────────────────────────────────────────────────────────────


@app.route("/api/departments", methods=["GET"])
@login_required
def departments_get():
    return jsonify(db.get_departments()), 200


@app.route("/api/departments", methods=["POST"])
@roles_required("admin")
def departments_post():
    data = request.get_json()
    department_name = data.get("department_name", "").strip()
    if not department_name:
        return jsonify({"error": "department_name is required"}), 400
    new_id = db.insert_department(department_name)
    return jsonify({"message": "Department added successfully", "id": new_id}), 201


# ── Categories ────────────────────────────────────────────────────────────────


@app.route("/api/categories", methods=["GET"])
@login_required
def categories_get():
    return jsonify(db.get_categories()), 200


@app.route("/api/categories", methods=["POST"])
@roles_required("admin")
def categories_post():
    data = request.get_json()
    category_name = data.get("category_name", "").strip()
    department_id = data.get("department_id")
    if not category_name or not department_id:
        return jsonify({"error": "category_name and department_id are required"}), 400
    new_id = db.insert_category(category_name, department_id)
    return jsonify({"message": "Category added successfully", "id": new_id}), 201


# ── Budget Items ──────────────────────────────────────────────────────────────


@app.route("/api/budget-items", methods=["GET"])
@login_required
def budget_items_get():
    return jsonify(db.get_budget_items()), 200


@app.route("/api/budget-items", methods=["POST"])
@roles_required("admin", "manager")
def budget_items_post():
    data = request.get_json()
    item_name = data.get("item_name", "").strip()
    category_id = data.get("category_id")
    if not item_name or not category_id:
        return jsonify({"error": "item_name and category_id are required"}), 400
    new_id = db.insert_budget_item(item_name, category_id)
    return jsonify({"message": "Budget item added successfully", "id": new_id}), 201


@app.route("/api/budget-items/reorder", methods=["POST"])
@roles_required("admin", "manager")
def budget_items_reorder():
    data = request.get_json()
    ordered_ids = data.get("ordered_ids", [])
    if not ordered_ids:
        return jsonify({"error": "ordered_ids are required"}), 400
    try:
        db.update_budget_items_order(ordered_ids)
        return jsonify({"message": "Budget items reordered successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/categories/reorder", methods=["POST"])
@roles_required("admin", "manager")
def categories_reorder():
    data = request.get_json()
    ordered_ids = data.get("ordered_ids", [])
    if not ordered_ids:
        return jsonify({"error": "ordered_ids are required"}), 400
    try:
        db.update_categories_order(ordered_ids)
        return jsonify({"message": "Categories reordered successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Project Budget Values ─────────────────────────────────────────────────────


@app.route("/api/budget-values", methods=["GET"])
@login_required
def budget_values_get():
    return jsonify(db.get_budget_values()), 200


@app.route("/api/budget-values", methods=["POST"])
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
    new_id = db.insert_budget_value(project_id, budget_item_id, quantity, rate, total)
    return jsonify({"message": "Budget value added successfully", "id": new_id}), 201


# ── Hierarchy ─────────────────────────────────────────────────────────────────


@app.route("/api/hierarchy", methods=["GET"])
@login_required
def hierarchy_get():
    return jsonify(db.get_hierarchy()), 200


# ── Budget values per project ──────────────────────────────────────────────────


@app.route("/api/budget-values/project/<int:project_id>", methods=["GET"])
@login_required
def budget_values_for_project(project_id):
    version_id = request.args.get("version_id")
    if version_id:
        try:
            version_id = int(version_id)
        except ValueError:
            version_id = None
            
    return jsonify(db.get_budget_values_for_project(project_id, version_id)), 200


@app.route("/api/projects/<int:project_id>/budget-versions", methods=["POST"])
@roles_required("admin", "manager")
def budget_versions_post(project_id):
    data = request.get_json()
    source_version_id = data.get("source_version_id")
    try:
        new_id = db.create_budget_version(project_id, source_version_id)
        return jsonify({"message": "New budget version created", "id": new_id}), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/projects/<int:project_id>/budget-versions", methods=["GET"])
@login_required
def budget_versions_get(project_id):
    try:
        versions = db.get_budget_versions(project_id)
        return jsonify(versions), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/budget-versions/<int:version_id>", methods=["DELETE"])
@roles_required("admin", "manager")
def budget_version_delete(version_id):
    try:
        db.delete_budget_version(version_id)
        return jsonify({"message": "Budget version deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Batch insert / upsert ─────────────────────────────────────────────────────


@app.route("/api/budget-values/batch", methods=["POST"])
@roles_required("admin", "manager")
def budget_values_batch():
    data = request.get_json()
    project_id = data.get("project_id")
    version_id = data.get("version_id")
    values = data.get("values", [])
    client_ids = data.get("client_ids", None)
    
    if not project_id or not version_id:
        return jsonify({"error": "project_id and version_id are required"}), 400
    if not values:
        return jsonify({"error": "No values provided"}), 400
        
    try:
        affected = db.insert_budget_values_batch(project_id, version_id, values, client_ids)
        return jsonify({"message": f"{affected} rows saved", "affected": affected}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500




# ── Client Dashboard ────────────────────────────────────────────────────────────


@app.route("/api/client/dashboard", methods=["GET"])
@roles_required("client", "manager", "admin", "production_crew")
def client_dashboard_get():
    user_id = session.get("user_id")
    role = session.get("user_role")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    if role == "production_crew":
        projects = auth.get_crew_projects(user_id)
    else:
        projects = auth.get_client_projects(user_id)
        
    # Enhance each project with its payment history
    for proj in projects:
        proj["payments"] = db.get_payments_for_project(proj["id"])
        
    return jsonify(projects), 200


@app.route("/api/admin/assign-client", methods=["POST"])
@roles_required("admin")
def assign_client_post():
    data = request.get_json()
    user_id = data.get("user_id")
    project_id = data.get("project_id")
    if not user_id or not project_id:
        return jsonify({"error": "user_id and project_id are required"}), 400
    try:
        auth.assign_client_to_project(user_id, project_id)
        return jsonify({"message": "Client assigned to project successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/admin/remove-client", methods=["POST"])
@roles_required("admin")
def remove_client_post():
    data = request.get_json()
    user_id = data.get("user_id")
    project_id = data.get("project_id")
    if not user_id or not project_id:
        return jsonify({"error": "user_id and project_id are required"}), 400
    try:
        auth.remove_client_from_project(user_id, project_id)
        return jsonify({"message": "Client removed from project successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/projects/<int:project_id>/clients", methods=["GET"])
@roles_required("admin", "manager")
def project_clients_get(project_id):
    return jsonify(auth.get_project_clients(project_id)), 200


@app.route("/api/admin/payments", methods=["POST"])
@roles_required("admin", "manager")
def payments_post():
    data = request.get_json()
    project_id = data.get("project_id")
    amount = data.get("amount")
    payment_date = data.get("payment_date")
    notes = data.get("notes", "")
    
    if not project_id or amount is None or not payment_date:
        return jsonify({"error": "project_id, amount, and payment_date are required"}), 400
        
    try:
        new_id = db.insert_payment(project_id, amount, payment_date, notes)
        return jsonify({"message": "Payment recorded successfully", "id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Milestones ────────────────────────────────────────────────────────────────

@app.route("/api/projects/<int:project_id>/milestones", methods=["GET"])
@login_required
def get_milestones(project_id):
    return jsonify(db.get_project_milestones(project_id)), 200

@app.route("/api/projects/<int:project_id>/milestones", methods=["POST"])
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
    # Robustly parse assignee flag; default to 1 for Admin/Manager if missing or null
    raw_ivd = data.get("is_visiondivision")
    try:
        if raw_ivd is not None and str(raw_ivd).strip() != "":
            is_visiondivision = int(raw_ivd)
        else:
            is_visiondivision = 1 if user_role in ["admin", "manager"] else 0
    except (ValueError, TypeError):
        is_visiondivision = 1 if user_role in ["admin", "manager"] else 0
    
    try:
        new_id = db.insert_milestone(project_id, title, description, target_date, status, client_note, is_visiondivision)
        return jsonify({"message": "Milestone created", "id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/milestones/<int:milestone_id>", methods=["PUT"])
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
    raw_ivd = data.get("is_visiondivision")
    is_visiondivision = None
    if raw_ivd is not None and str(raw_ivd).strip() != "":
        try:
            is_visiondivision = int(raw_ivd)
        except (ValueError, TypeError):
            is_visiondivision = None
    
    # Validation for role
    user_role = session.get("user_role")
    milestone = db.get_milestone_by_id(milestone_id)
    if not milestone:
        return jsonify({"error": "Milestone not found"}), 404
        
    if user_role == "client" and milestone.get("is_visiondivision"):
        # Clients can only update status and client_note for visiondivision milestones
        if title is not None or description is not None or target_date is not None:
            return jsonify({"error": "Clients cannot edit core details of VisionDivision milestones"}), 403
            
        try:
            db.update_milestone(milestone_id, status=status, client_note=client_note)
            return jsonify({"message": "Milestone updated"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    # Admins or clients on their own milestones can edit everything
    try:
        db.update_milestone(milestone_id, status=status, client_note=client_note, title=title, description=description, target_date=target_date, is_visiondivision=is_visiondivision)
        return jsonify({"message": "Milestone fully updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/milestones/<int:milestone_id>", methods=["DELETE"])
@login_required
def remove_milestone(milestone_id):
    user_role = session.get("user_role")
    milestone = db.get_milestone_by_id(milestone_id)
    if not milestone:
        return jsonify({"error": "Milestone not found"}), 404
        
    if user_role == "client" and milestone.get("is_visiondivision"):
        return jsonify({"error": "Clients cannot delete VisionDivision milestones"}), 403
        
    try:
        db.delete_milestone(milestone_id)
        return jsonify({"message": "Milestone deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Schedule ──────────────────────────────────────────────────────────────────



@app.route("/api/schedule/tasks", methods=["GET"])
@login_required
def schedule_tasks_get():
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    if not year or not month:
        return jsonify({"error": "year and month are required"}), 400
    try:
        tasks = db.get_schedule_tasks(year, month)
        return jsonify(tasks), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/tasks", methods=["POST"])
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
        new_id = db.insert_schedule_task(
            title, description, task_date, created_by, 
            is_visiondivision=1, 
            project_id=project_id, 
            task_color=task_color
        )
        return (
            jsonify({"message": "Schedule task created", "id": new_id}),
            201,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/tasks/<int:task_id>", methods=["DELETE"])
@roles_required("admin", "manager")
def schedule_task_delete(task_id):
    try:
        db.delete_schedule_task(task_id)
        return jsonify({"message": "Schedule task deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/tasks/<int:task_id>", methods=["PUT"])
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
        db.update_schedule_task(
            task_id, title, description, project_id, task_color
        )
        return jsonify({"message": "Schedule task updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/tasks/<int:task_id>/notes", methods=["GET"])
@login_required
def task_notes_get(task_id):
    try:
        notes = db.get_task_notes(task_id)
        return jsonify(notes), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/tasks/<int:task_id>/notes", methods=["POST"])
@login_required
def task_notes_post(task_id):
    data = request.get_json()
    note_text = data.get("note_text", "").strip()
    if not note_text:
        return jsonify({"error": "note_text is required"}), 400

    user_id = session.get("user_id")
    try:
        new_id = db.insert_task_note(task_id, user_id, note_text)
        return (
            jsonify({"message": "Note added successfully", "id": new_id}),
            201,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500






# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Server started on port 5000")
    app.run(debug=True, host='127.0.0.1')
