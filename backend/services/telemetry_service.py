"""In-memory Real-User Monitoring (RUM) store for Web Vitals telemetry in Phase 0.

Uses a bounded ring buffer so beacon ingestion never consumes scarce DB pool connections.
"""

from collections import deque
from datetime import datetime, timezone
import math
import threading

ALLOWED_METRIC_NAMES = frozenset(
    {"CLS", "FID", "FCP", "LCP", "TTFB", "INP", "FIN_TTI"}
)
ALLOWED_RATINGS = frozenset({"good", "needs-improvement", "poor", "unknown"})
MAX_METRIC_VALUE = 600_000.0  # 10 minutes upper bound in ms (CLS < 100)

_VITALS_BUFFER = deque(maxlen=250)
_BUFFER_LOCK = threading.Lock()


def _clean_text(value, max_len=120):
    if value is None:
        return ""
    return str(value).strip()[:max_len]


def _classify_rating(name, value, provided_rating=None):
    if provided_rating in ALLOWED_RATINGS:
        return provided_rating
    if name == "CLS":
        return "good" if value <= 0.1 else ("needs-improvement" if value <= 0.25 else "poor")
    if name == "LCP":
        return "good" if value <= 2500 else ("needs-improvement" if value <= 4000 else "poor")
    if name == "FCP":
        return "good" if value <= 1800 else ("needs-improvement" if value <= 3000 else "poor")
    if name == "FID":
        return "good" if value <= 100 else ("needs-improvement" if value <= 300 else "poor")
    if name == "TTFB":
        return "good" if value <= 800 else ("needs-improvement" if value <= 1800 else "poor")
    if name == "INP":
        return "good" if value <= 200 else ("needs-improvement" if value <= 500 else "poor")
    return "unknown"


def validate_web_vital_payload(payload):
    """Validate and normalize a single Web Vital beacon payload.

    Returns (normalized_record, error_message).
    """
    if not isinstance(payload, dict):
        return None, "Payload must be a JSON object."

    name = _clean_text(payload.get("name"), max_len=24).upper()
    if name not in ALLOWED_METRIC_NAMES:
        return None, f"Unsupported metric name: {name or 'missing'}."

    try:
        numeric_value = float(payload.get("value"))
    except (TypeError, ValueError):
        return None, "Metric value must be a valid finite number."

    if not math.isfinite(numeric_value) or numeric_value < 0 or numeric_value > MAX_METRIC_VALUE:
        return None, "Metric value is out of allowed bounds."

    delta_raw = payload.get("delta")
    delta_value = numeric_value
    if delta_raw is not None:
        try:
            delta_candidate = float(delta_raw)
            if math.isfinite(delta_candidate) and 0 <= abs(delta_candidate) <= MAX_METRIC_VALUE:
                delta_value = delta_candidate
        except (TypeError, ValueError):
            pass

    route = _clean_text(payload.get("route") or "/", max_len=160)
    if not route.startswith("/"):
        route = "/" + route

    metric_id = _clean_text(payload.get("id"), max_len=80)
    navigation_type = _clean_text(payload.get("navigationType") or "navigate", max_len=40)
    rating = _classify_rating(name, numeric_value, _clean_text(payload.get("rating"), 24))

    record = {
        "id": metric_id,
        "name": name,
        "value": round(numeric_value, 4 if name == "CLS" else 2),
        "delta": round(delta_value, 4 if name == "CLS" else 2),
        "rating": rating,
        "route": route,
        "navigation_type": navigation_type,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
    return record, None


def record_web_vital(payload):
    """Validate and append one Web Vital metric into the bounded ring buffer."""
    record, error = validate_web_vital_payload(payload)
    if error:
        return None, error

    with _BUFFER_LOCK:
        _VITALS_BUFFER.append(record)
    return record, None


def persist_web_vital_to_db(record):
    """Best-effort persistence into web_vitals_telemetry without failing RUM beacon delivery."""
    try:
        from .database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO web_vitals_telemetry (metric_name, metric_value, rating, route, viewport)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    record["name"],
                    record["value"],
                    record["rating"],
                    record["route"],
                    record.get("navigation_type", "navigate")[:40],
                ),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()
    except Exception:
        pass


def get_web_vitals_summary():
    """Return aggregated per-metric percentiles/averages and recent samples."""
    with _BUFFER_LOCK:
        samples = list(_VITALS_BUFFER)

    by_metric = {}
    for item in samples:
        by_metric.setdefault(item["name"], []).append(item["value"])

    aggregates = {}
    for name, values in by_metric.items():
        ordered = sorted(values)
        count = len(ordered)
        p75_index = min(count - 1, max(0, math.ceil(0.75 * count) - 1))
        aggregates[name] = {
            "count": count,
            "avg": round(sum(ordered) / count, 4 if name == "CLS" else 2),
            "p75": ordered[p75_index],
            "latest": samples[-1]["value"] if samples and samples[-1]["name"] == name else values[-1],
        }

    return {
        "sample_count": len(samples),
        "metrics": aggregates,
        "recent": samples[-25:][::-1],
    }


def get_combined_performance_telemetry():
    """Combine Web Vitals RUM metrics (DB + live buffer) with backend SQL query auditor metrics."""
    from .query_auditor import get_performance_audit_summary

    rum = get_web_vitals_summary()
    persisted_metrics = []
    try:
        from .database import get_connection
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(
                """
                SELECT metric_name,
                       COUNT(*) AS samples,
                       ROUND(AVG(metric_value), 3) AS avg_value,
                       MAX(recorded_at) AS last_recorded_at
                FROM web_vitals_telemetry
                GROUP BY metric_name
                ORDER BY metric_name ASC
                """
            )
            persisted_metrics = [
                {
                    "metric_name": r["metric_name"],
                    "samples": int(r["samples"] or 0),
                    "avg_value": float(r["avg_value"] or 0),
                    "last_recorded_at": r["last_recorded_at"].isoformat() if r["last_recorded_at"] else None,
                }
                for r in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()
    except Exception:
        pass

    return {
        "web_vitals": rum,
        "persisted_web_vitals": persisted_metrics,
        "db_audit": get_performance_audit_summary(),
    }


def clear_web_vitals_buffer():
    """Reset the in-memory telemetry buffer (intended for unit testing)."""
    with _BUFFER_LOCK:
        _VITALS_BUFFER.clear()

