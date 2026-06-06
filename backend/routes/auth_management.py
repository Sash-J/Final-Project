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

auth_bp = Blueprint("auth_management", __name__)

# Bcrypt instance injected by app.py via init_auth(bcrypt)
_bcrypt = None


def init_auth(bcrypt_instance):
    global _bcrypt
    _bcrypt = bcrypt_instance


def validate_register_data(username, password, role, full_name, telephone, address):
    """Deep validation of registration data before database insertion."""

    # Username Validation
    if not re.match(r"^[a-zA-Z_]+$", username):
        return "Username can only contain letters and underscores."

    # Pass Validation
    if " " in password:
        return "Password cannot contain spaces."
    if len(password) < 8 or len(password) > 20:
        return "Password must be between 8 and 20 characters."
    if not any(c.isupper() for c in password) or not any(c.islower() for c in password):
        return "Password must contain both uppercase and lowercase letters."

    num_count = len(re.findall(r"\d", password))
    if num_count > 4:
        return "Password can contain at most 4 numbers."

    special_count = len(re.findall(r"[^a-zA-Z0-9\s]", password))
    if special_count != 1:
        return "Password must contain exactly one special character."

    # Role Guard
    allowed_roles = ["client", "production_crew"]
    if role not in allowed_roles:
        return "Forbidden role selection."

    # Metadata Validation
    if len(full_name) > 100:
        return "Full Name is too long (max 100 characters)."
    if not re.match(r"^[a-zA-Z\s]+$", full_name):
        return "Full Name can only contain letters and spaces."

    # Telephone Validation
    clean_phone = re.sub(r"[\s\-()]+", "", telephone)
    if not re.match(r"^\+?\d{10,15}$", clean_phone):
        return "Please enter a valid telephone number (10-15 digits)."

    # Address Validation
    if any(char in address for char in "<>{}[]"):
        return "Address contains prohibited special characters."

    return None


# Auth Routes
@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    user = auth.get_user_by_username(username)
    if (
        user
        and user["username"] == username
        and _bcrypt.check_password_hash(user["password_hash"], password)
    ):
        if not user.get("is_approved"):
            return (
                jsonify({"error": "Your account is pending admin approval"}),
                403,
            )

        set_user_session(user)
        profile = auth.get_user_profile(user["id"])
        return (
            jsonify(
                {
                    "message": "Logged in successfully",
                    "user": {
                        "username": user["username"],
                        "role": user["role"],
                        "theme_mode": user.get("theme_mode", "dark"),
                        "profile_image": (
                            profile.get("profile_image", "") if profile else ""
                        ),
                    },
                }
            ),
            200,
        )
    time.sleep(1)
    return jsonify({"error": "Invalid credentials"}), 401


@auth_bp.route("/api/logout", methods=["POST"])
def logout():
    clear_session()
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route("/api/me", methods=["GET"])
def get_me():
    from flask import session

    user_data = get_current_user_data()
    if user_data:
        profile = auth.get_user_profile(session.get("user_id"))
        if profile:
            user_data["profile_image"] = profile.get("profile_image", "")
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


@auth_bp.route("/api/check-connection", methods=["GET"])
def check_connection():
    try:
        auth.get_user_by_username("ping")
        return (
            jsonify(
                {
                    "status": "Database connection OK",
                    "message": "Backend is online and communicating with MySQL.",
                }
            ),
            200,
        )
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

    # security check, help from ChatGPT
    validation_error = validate_register_data(
        username, password, role, full_name, telephone, address
    )
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
        jsonify(
            {
                "message": "Registration successful. Pending admin approval.",
                "id": new_user_id,
            }
        ),
        201,
    )


@auth_bp.route("/api/profile", methods=["GET"])
@login_required
def get_profile():
    from core.session_handler import get_current_user_id

    user_id = get_current_user_id()
    profile = auth.get_user_profile(user_id)
    if not profile:
        return jsonify({"error": "User not found"}), 404
    return jsonify(profile), 200


@auth_bp.route("/api/profile", methods=["PUT"])
@login_required
def update_profile():
    from flask import session
    from core.session_handler import get_current_user_id

    user_id = get_current_user_id()
    data = request.get_json() or {}

    username = data.get("username", "").strip()
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip()
    new_password = data.get("password")

    if not username:
        return jsonify({"error": "Username is required"}), 400

    # Validate Username format
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return (
            jsonify(
                {"error": "Username can only contain letters, numbers and underscores."}
            ),
            400,
        )

    # Check if username is taken by someone else
    existing = auth.get_user_by_username(username)
    if existing and existing["id"] != user_id:
        return jsonify({"error": "Username already taken"}), 400

    hashed_pass = None
    if new_password:
        if " " in new_password:
            return jsonify({"error": "Password cannot contain spaces"}), 400
        if len(new_password) < 8 or len(new_password) > 20:
            return (
                jsonify({"error": "Password must be between 8 and 20 characters"}),
                400,
            )
        hashed_pass = _bcrypt.generate_password_hash(new_password).decode("utf-8")

    try:
        current_profile = auth.get_user_profile(user_id)
        existing_theme = (
            current_profile.get("theme_mode", "dark") if current_profile else "dark"
        )

        db_data = {
            "username": username,
            "full_name": full_name,
            "email": email,
            "profile_image": data.get("profile_image"),
            "theme_mode": data.get("theme_mode", existing_theme),
            "email_notifications": 1 if data.get("email_notifications") else 0,
            "pause_notifications": 1 if data.get("pause_notifications") else 0,
        }
        auth.update_user_profile(user_id, db_data, hashed_pass)
        session["username"] = username
        session["theme_mode"] = db_data["theme_mode"]
        return jsonify({"message": "Profile updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/api/profile/theme", methods=["PUT"])
@login_required
def update_theme():
    from flask import session
    from core.session_handler import get_current_user_id

    user_id = get_current_user_id()
    data = request.get_json() or {}
    theme_mode = data.get("theme_mode", "dark")
    if theme_mode not in ["light", "dark"]:
        return jsonify({"error": "Invalid theme mode"}), 400
    try:
        auth.update_user_theme(user_id, theme_mode)
        session["theme_mode"] = theme_mode
        return jsonify({"message": "Theme updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
