import sys
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_bcrypt import Bcrypt

# Fix for Vercel ModuleNotFoundError: Ensure current directory is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import re

app = Flask(__name__)
app.secret_key = "super_secret_key"  # Change this in production

# Production Cookie Settings (Required for Vercel HTTPS)
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True
)

# Dynamic CORS Reflector (The most robust way for Vercel)
CORS(app, supports_credentials=True)

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin:
        # If the origin is from Vercel or localhost, approve it
        if ".vercel.app" in origin or "localhost" in origin:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

@app.route("/api/health")
def health():
    return jsonify({"status": "healthy", "message": "Vercel Backend is Online!"}), 200
# Note: Re-compiled Regex origin allows any of your branch deployments to work correctly.
bcrypt = Bcrypt(app)

# ── Blueprint Registration ────────────────────────────────────────────────────

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


# ── Root Route ────────────────────────────────────────────────────────────────


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Budget API is active and running!"}), 200


# ── Run (For Local Development Only) ──────────────────────────────────────────

if __name__ == "__main__":
    print("Server started on port 5000")
    app.run(debug=True, host="127.0.0.1")
