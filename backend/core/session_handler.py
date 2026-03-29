from flask import session, request, jsonify
from functools import wraps

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
            # Allow OPTIONS request for CORS
            if request.method == 'OPTIONS':
                return f(*args, **kwargs)
                
            if "user_role" not in session or session["user_role"] not in roles:
                return jsonify({"error": "Unauthorized"}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator

def set_user_session(user):
    """Stores user information in the Flask session."""
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["user_role"] = user["role"]

def clear_session():
    """Clears the current Flask session."""
    session.clear()

def get_current_user_id():
    """Returns the ID of the currently logged-in user, or None."""
    return session.get("user_id")

def get_current_user_role():
    """Returns the role of the currently logged-in user, or None."""
    return session.get("user_role")

def is_logged_in():
    """Checks if a user is currently logged in."""
    return "user_id" in session

def get_current_user_data():
    """Returns basic data for the logged-in user, or None."""
    if is_logged_in():
        return {
            "username": session.get("username"),
            "role": session.get("user_role")
        }
    return None
