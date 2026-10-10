from flask import session, request, jsonify
from functools import wraps


# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        return f(*args, **kwargs)

    return decorated_function


def _normalize_role(r):
    """Helper to produce consistent role strings for comparison."""
    if not r:
        return ""
    return str(r).strip().lower().replace("_", " ")


# Check role decorator (case-insensitive & matches against all assigned DB roles)
def roles_required(*roles):
    norm_required = {_normalize_role(r) for r in roles}

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if request.method == "OPTIONS":
                return f(*args, **kwargs)

            if "user_id" not in session:
                return jsonify({"error": "Login required"}), 401

            # Check both user_roles list and legacy user_role
            user_roles = list(session.get("user_roles") or [])
            if session.get("user_role"):
                user_roles.append(session.get("user_role"))

            norm_user_roles = {_normalize_role(r) for r in user_roles}

            if not (norm_required & norm_user_roles):
                return jsonify({"error": "Unauthorized"}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator


# Check permission decorator
def permissions_required(*permissions):
    """Requires the user to have at least one of the specified DB permissions."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if request.method == "OPTIONS":
                return f(*args, **kwargs)

            if "user_id" not in session:
                return jsonify({"error": "Login required"}), 401

            # Admins automatically have full access
            user_roles = [_normalize_role(r) for r in (session.get("user_roles") or [])]
            if "admin" in user_roles or _normalize_role(session.get("user_role")) == "admin":
                return f(*args, **kwargs)

            user_permissions = set(session.get("user_permissions") or [])
            if not any(p in user_permissions for p in permissions):
                return jsonify({"error": "Forbidden: missing required permission"}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def set_user_session(user):
    """Stores user information, database roles, and permissions in the Flask session."""
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    
    # User roles & permissions from DB
    roles = user.get("roles")
    if not roles and user.get("role"):
        roles = [user.get("role")]
    elif not roles:
        roles = []

    primary_role = roles[0] if roles else user.get("role", "")
    session["user_role"] = primary_role
    session["user_roles"] = roles
    session["user_permissions"] = user.get("permissions", [])
    session["theme_mode"] = user.get("theme_mode", "dark")


def clear_session():
    """Clears the current Flask session."""
    session.clear()


def get_current_user_id():
    """Returns the ID of the currently logged-in user, or None."""
    return session.get("user_id")


def get_current_user_role():
    """Returns the primary role of the currently logged-in user, or None."""
    return session.get("user_role")


def get_current_user_roles():
    """Returns all assigned DB roles of the currently logged-in user."""
    return session.get("user_roles", [])


def get_current_user_permissions():
    """Returns all assigned DB permissions of the currently logged-in user."""
    return session.get("user_permissions", [])


def is_logged_in():
    """Checks if a user is currently logged in."""
    return "user_id" in session


def has_role(*roles):
    """Helper to check if current user has any of the specified roles."""
    if not is_logged_in():
        return False
    norm_required = {_normalize_role(r) for r in roles}
    user_roles = list(session.get("user_roles") or [])
    if session.get("user_role"):
        user_roles.append(session.get("user_role"))
    norm_user = {_normalize_role(r) for r in user_roles}
    return bool(norm_required & norm_user)


def has_permission(*permissions):
    """Helper to check if current user has any of the specified permissions."""
    if not is_logged_in():
        return False
    user_roles = [_normalize_role(r) for r in (session.get("user_roles") or [])]
    if "admin" in user_roles or _normalize_role(session.get("user_role")) == "admin":
        return True
    user_permissions = set(session.get("user_permissions") or [])
    return any(p in user_permissions for p in permissions)


def get_current_user_data():
    """Returns basic data for the logged-in user, including RBAC info, or None."""
    if is_logged_in():
        return {
            "id": session.get("user_id"),
            "username": session.get("username"),
            "role": session.get("user_role"),
            "roles": session.get("user_roles", []),
            "permissions": session.get("user_permissions", []),
            "theme_mode": session.get("theme_mode", "dark"),
            "profile_image": "",
        }
    return None


