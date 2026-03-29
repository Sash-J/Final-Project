import services.auth_operations as auth
from routes.notifications_management import notify_all_admins
import time
import re
from flask import Blueprint, jsonify, request
from core.session_handler import (
    login_required,
    set_user_session,
    clear_session,
    get_current_user_data,
)

auth_bp = Blueprint('auth_management', __name__)

# Bcrypt instance injected by app.py via init_auth(bcrypt)
_bcrypt = None

def init_auth(bcrypt_instance):
    global _bcrypt
    _bcrypt = bcrypt_instance

def validate_register_data(username, password, role, full_name, telephone, address):
    """Deep validation of registration data before database insertion."""
    
    # 1. Username Validation: A-Z, a-z, _ only
    if not re.match(r"^[a-zA-Z_]+$", username):
        return "Username can only contain letters and underscores."

    # 2. Password Validation
    if len(password) < 8 or len(password) > 20:
        return "Password must be between 8 and 20 characters."
    if not any(c.isupper() for c in password) or not any(c.islower() for c in password):
        return "Password must contain both uppercase and lowercase letters."
    
    num_count = len(re.findall(r"\d", password))
    if num_count > 4:
        return "Password can contain at most 4 numbers."
    
    special_count = len(re.findall(r"[^a-zA-Z0-9\s]", password))
    if special_count > 1:
        return "Password can contain at most 1 special character."

    # 3. Role Guard: Public registration can only be 'client' or 'production_crew'
    allowed_roles = ["client", "production_crew"]
    if role not in allowed_roles:
        return "Forbidden role selection."

    # 4. Metadata Length Constraints
    if len(full_name) > 100:
        return "Full Name is too long (max 100 characters)."
    if len(telephone) > 20:
        return "Telephone is too long (max 20 characters)."
    if len(address) > 500:
        return "Address is too long (max 500 characters)."

    return None

# ── Auth Routes ───────────────────────────────────────────────────────────────

@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = auth.get_user_by_username(username)
    if user and _bcrypt.check_password_hash(user["password_hash"], password):
        if not user.get("is_approved"):
            return (
                jsonify({"error": "Your account is pending admin approval"}),
                403,
            )

        set_user_session(user)
        return (
            jsonify(
                {
                    "message": "Logged in successfully",
                    "user": {"username": user["username"], "role": user["role"]},
                }
            ),
            200,
        )

    # Brute Force Mitigation: Subtle delay on failed login
    time.sleep(1)
    return jsonify({"error": "Invalid credentials"}), 401


@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    clear_session()
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route("/api/me", methods=["GET"])
def get_me():
    user_data = get_current_user_data()
    if user_data:
        return (
            jsonify(
                {
                    "logged_in": True,
                    "user": user_data,
                }
            ),
            200,
        )
    return jsonify({"logged_in": False}), 200


@auth_bp.route("/api/init-admin", methods=["GET"])
def init_admin():
    try:
        # 1. Check if user already exists
        existing = auth.get_user_by_username("admin")
        if existing:
            return jsonify({"message": "Admin already exists"}), 200

        # 2. Safety check for bcrypt
        if not _bcrypt:
            return jsonify({"error": "Bcrypt not initialized. Check app.py."}), 500

        # 3. Create admin with empty strings for metadata (prevent NULL crashes)
        hashed = _bcrypt.generate_password_hash("admin123").decode("utf-8")
        auth.create_user(
            username="admin",
            password_hash=hashed,
            role="admin",
            is_approved=1,
            full_name="Default Admin",
            address="",
            telephone=""
        )
        return jsonify({"message": "Admin user created: admin / admin123"}), 201
    except Exception as e:
        return jsonify({"error": str(e), "context": "Error during admin user initialization. Your database might be refusing specific values or the 'users' table is missing columns."}), 500


@auth_bp.route("/api/check-connection", methods=["GET"])
def check_connection():
    try:
        auth.get_user_by_username("ping")
        return jsonify({"status": "Database connection OK", "message": "Backend is online and communicating with MySQL."}), 200
    except Exception as e:
        return jsonify({"status": "Database connection FAILED", "error": str(e)}), 500


@auth_bp.route("/api/register", methods=["POST"])
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

    # Backend Security Parity Check
    validation_error = validate_register_data(username, password, role, full_name, address, telephone)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    existing_user = auth.get_user_by_username(username)
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400

    hashed = _bcrypt.generate_password_hash(password).decode("utf-8")
    new_user_id = auth.create_user(
        username,
        hashed,
        role,
        is_approved=0,
        full_name=full_name,
        address=address,
        telephone=telephone,
    )
    notify_all_admins(f"New user registered: {username}. Awaiting approval.", "info")
    return (
        jsonify({"message": "Registration successful. Pending admin approval.", "id": new_user_id}),
        201,
    )
