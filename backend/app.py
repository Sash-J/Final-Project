import sys
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_bcrypt import Bcrypt

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import re

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "super_secret_key")

# Intelligent Cookie Detection
is_production = os.getenv("FLASK_ENV") == "production"

cookie_settings = {
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_SECURE": is_production,
    "SESSION_COOKIE_SAMESITE": "None" if is_production else "Lax",
}

if is_production:
    cookie_settings["SESSION_COOKIE_DOMAIN"] = ".visiondivision.lk"

app.config.update(cookie_settings)

CORS(app, supports_credentials=True)


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        # Authorized origins
        if (
            "localhost" in origin
            or "127.0.0.1" in origin
            or "visiondivision.lk" in origin
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
from routes.prediction_management import prediction_bp

init_auth(bcrypt)

app.register_blueprint(auth_bp)
app.register_blueprint(user_mgmt_bp)
app.register_blueprint(project_bp)
app.register_blueprint(budget_bp)
app.register_blueprint(schedule_bp)
app.register_blueprint(milestone_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(prediction_bp)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Budget API is active and running!"}), 200


if __name__ == "__main__":
    print("Server started on port 5000")
    app.run(debug=False, host="127.0.0.1")
