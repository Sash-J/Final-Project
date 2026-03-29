from flask import Blueprint, jsonify, request
from core.session_handler import roles_required
import os

prediction_bp = Blueprint('prediction_management', __name__)

# Load the budget model from the models directory
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgboost_budget_model.pkl")
model = None
try:
    import joblib
    import numpy as np
    import xgboost as xgb
    
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))
    MODEL_PATH = os.path.join(BASE_DIR, "models", "xgboost_budget_model.pkl")
    
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print("Budget model loaded successfully.")
except Exception as e:
    print(f"CRITICAL: Could not load machine learning dependencies or model: {e}")
    # We set model to None so the rest of the app still runs
    model = None

@prediction_bp.route("/api/predict-budget", methods=["POST"])
@roles_required("admin", "manager")
def predict_budget():
    if model is None:
        return jsonify({"error": "Budget prediction model not loaded on server."}), 500
    
    data = request.get_json()
    try:
        # Extract features in the exact order the model expects
        features = [
            float(data.get("shooting_days", 0)),
            float(data.get("crew_size", 0)),
            float(data.get("location_count", 0)),
            float(data.get("Indoor_shoot", 0)),
            float(data.get("within_colombo", 0)),
            float(data.get("crew_budget", 0)),
            float(data.get("light_budget", 0)),
            float(data.get("camera_budget", 0)),
            float(data.get("transport_budget", 0)),
            float(data.get("location_budget", 0)),
            float(data.get("post_budget", 0)),
            float(data.get("artist_popularity", 0)),
            float(data.get("vfx_required", 0))
        ]
        
        # XGBoost expects a 2D array
        input_data = np.array([features])
        prediction = model.predict(input_data)
        
        # Return as a standard float
        return jsonify({
            "predicted_total": float(prediction[0]),
            "currency": "Rs."
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 400
