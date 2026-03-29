from flask import Flask, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.secret_key = "super_secret_key"  # Change this in production
CORS(
    app,
    supports_credentials=True,
    origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
)
bcrypt = Bcrypt(app)

# ── Blueprint Registration ────────────────────────────────────────────────────

from routes.auth_management import auth_bp, init_auth
from routes.user_management import user_mgmt_bp
from routes.project_management import project_bp
from routes.budget_management import budget_bp
from routes.schedule_management import schedule_bp
from routes.milestone_management import milestone_bp
from routes.prediction_management import prediction_bp

init_auth(bcrypt)

app.register_blueprint(auth_bp)
app.register_blueprint(user_mgmt_bp)
app.register_blueprint(project_bp)
app.register_blueprint(budget_bp)
app.register_blueprint(schedule_bp)
app.register_blueprint(milestone_bp)
app.register_blueprint(prediction_bp)


# ── Root Route ────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Budget API is active and running!"}), 200


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Server started on port 5000")
    app.run(debug=True, host="127.0.0.1")
