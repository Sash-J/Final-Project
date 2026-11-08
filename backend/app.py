import sys
import os
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from flask_bcrypt import Bcrypt

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.sanitizer import sanitize_data

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "super_secret_key")

# Intelligent Cookie Detection
is_production = os.getenv("FLASK_ENV") == "production"

cookie_settings = {
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_SECURE": is_production,
    "SESSION_COOKIE_SAMESITE": "Lax",
}

if is_production:
    cookie_settings["SESSION_COOKIE_DOMAIN"] = ".visiondivision.lk"

app.config.update(cookie_settings)

CORS(app, supports_credentials=True)


@app.before_request
def sanitize_incoming_requests():
    """
    Defense-in-depth sanitization for all incoming JSON requests.
    Strips XSS vectors, script tags, dangerous protocols, and HTML markup
    before payloads reach route handlers, services, or the database.
    """
    if request.is_json:
        try:
            data = request.get_json(silent=True)
            if data is not None:
                sanitized = sanitize_data(data)
                request._cached_json = (sanitized, sanitized)
        except Exception:
            pass


@app.after_request
def add_cors_headers(response):
    # Attach database query audit diagnostic headers
    try:
        db_count = getattr(g, "db_query_count", 0)
        db_time = getattr(g, "db_total_time_ms", 0.0)
        if db_count > 0:
            response.headers["X-DB-Queries"] = str(db_count)
            response.headers["X-DB-Time-MS"] = f"{db_time:.1f}"
            if db_count >= 10:
                print(f"[DB AUDIT ALERT] Potential N+1 query loop: {request.method} {request.path} executed {db_count} DB queries in {db_time:.1f}ms")
    except Exception:
        pass

    origin = request.headers.get("Origin")
    if origin:
        # Authorized origins
        if (
            "localhost" in origin
            or "127.0.0.1" in origin
            or "visiondivision.lk" in origin
            or "pinggy" in origin
            or "loca.lt" in origin
        ):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type,Authorization"
            )
            response.headers["Access-Control-Allow-Methods"] = (
                "GET,PUT,POST,DELETE,OPTIONS"
            )
    return response


@app.route("/api/health")
def health():
    return (
        jsonify({"status": "healthy", "message": "Vision Division API is Online!"}),
        200,
    )


bcrypt = Bcrypt(app)


from routes.auth_management import auth_bp, init_auth
from routes.user_management import user_mgmt_bp
from routes.project_management import project_bp
from routes.budget_management import budget_bp
from routes.schedule_management import schedule_bp
from routes.milestone_management import milestone_bp
from routes.notifications_management import notifications_bp

init_auth(bcrypt)

# Register Blueprints and Run Migrations
app.register_blueprint(auth_bp)
app.register_blueprint(user_mgmt_bp)
app.register_blueprint(project_bp)
app.register_blueprint(budget_bp)
app.register_blueprint(schedule_bp)
app.register_blueprint(milestone_bp)
app.register_blueprint(notifications_bp)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Budget API is active and running!"}), 200


if __name__ == "__main__":
    print("Server starting on port 5000...")
    try:
        from services.db_operations import (
            run_budget_migration,
            run_project_locations_migration,
            create_role_permissions,
            create_user_roles,
            sync_verified_levels_migration,
            run_indexing_migration,
        )

        run_indexing_migration()
        run_budget_migration()
        run_project_locations_migration()
        create_role_permissions()
        create_user_roles()
        sync_verified_levels_migration()
        print("Startup migrations successfully completed.")
    except Exception as e:
        print("Error running migrations on startup:", e)

    print("Server started on port 5000")
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1")
    # use_reloader=False prevents subprocess duplication on Windows that locks the remote MySQL pool
    app.run(debug=debug_mode, host="127.0.0.1", port=5000, use_reloader=False)
