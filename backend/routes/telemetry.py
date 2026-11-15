"""Routes for Phase 0 Real-User Monitoring (RUM) Web Vitals telemetry."""

from flask import Blueprint, current_app, jsonify, request

from core.session_handler import permissions_required
from services.telemetry_service import (
    get_web_vitals_summary,
    persist_web_vital_to_db,
    record_web_vital,
)

telemetry_bp = Blueprint("telemetry_bp", __name__)


@telemetry_bp.route("/api/telemetry/web-vitals", methods=["POST"])
def ingest_web_vital():
    """Accept lightweight sendBeacon/fetch Web Vitals payloads from client browsers."""
    payload = request.get_json(silent=True)
    if payload is None and request.data:
        # sendBeacon text/plain fallback if a browser omits application/json MIME
        try:
            import json
            payload = json.loads(request.data.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            payload = None

    if payload is None:
        return jsonify({"error": "Invalid telemetry payload."}), 400

    record, error = record_web_vital(payload)
    if error:
        return jsonify({"error": error}), 400

    if not current_app.config.get("TESTING"):
        persist_web_vital_to_db(record)

    return jsonify({"status": "recorded", "metric": record}), 202


@telemetry_bp.route("/api/telemetry/web-vitals", methods=["GET"])
@permissions_required("project.view")
def read_web_vitals_summary():
    """Expose aggregated Real-User Web Vitals summary for authorized administrators."""
    return jsonify(get_web_vitals_summary()), 200

