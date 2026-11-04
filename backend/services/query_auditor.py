import time
import inspect
import os
import re
from collections import deque
from datetime import datetime

# Configurable performance thresholds
SLOW_QUERY_THRESHOLD_MS = float(os.getenv("DB_SLOW_QUERY_THRESHOLD_MS", 300.0))
EXCESSIVE_QUERY_COUNT_THRESHOLD = int(os.getenv("DB_EXCESSIVE_QUERY_COUNT", 10))

# Global audit metrics (in-memory)
_metrics = {
    "started_at": datetime.utcnow().isoformat() + "Z",
    "total_queries": 0,
    "total_time_ms": 0.0,
    "slow_queries_count": 0,
    "recent_slow_queries": deque(maxlen=50),
    "recent_queries": deque(maxlen=50),
}


def _clean_sql(sql):
    """Normalize whitespace for clean log output."""
    if not sql:
        return ""
    return re.sub(r"\s+", " ", str(sql)).strip()


def _get_caller_info():
    """Extract the filename and function name that initiated the query."""
    try:
        stack = inspect.stack()
        for frame_info in stack[2:10]:
            filename = os.path.basename(frame_info.filename)
            # Skip internal auditing / database files
            if filename not in ("query_auditor.py", "database.py", "cursor.py", "pooling.py", "connection.py"):
                return f"{filename}:{frame_info.lineno} in {frame_info.function}()"
    except Exception:
        pass
    return "unknown"


def record_query(operation, params, duration_ms, rowcount=None):
    """Record query metrics, detect slow queries, and track request-level usage."""
    _metrics["total_queries"] += 1
    _metrics["total_time_ms"] += duration_ms

    cleaned_sql = _clean_sql(operation)
    caller = _get_caller_info()

    # Track within Flask request context if available
    try:
        from flask import g, has_request_context
        if has_request_context():
            g.db_query_count = getattr(g, "db_query_count", 0) + 1
            g.db_total_time_ms = getattr(g, "db_total_time_ms", 0.0) + duration_ms
            if not hasattr(g, "db_queries"):
                g.db_queries = []
            if len(g.db_queries) < 30:  # Avoid memory bloat per request
                g.db_queries.append({
                    "sql": cleaned_sql[:120],
                    "duration_ms": round(duration_ms, 2),
                    "caller": caller,
                })
    except Exception:
        pass

    record = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "duration_ms": round(duration_ms, 2),
        "caller": caller,
        "query": cleaned_sql[:300] + ("..." if len(cleaned_sql) > 300 else ""),
        "rowcount": rowcount,
    }

    _metrics["recent_queries"].append(record)

    # Detect slow query
    if duration_ms >= SLOW_QUERY_THRESHOLD_MS:
        _metrics["slow_queries_count"] += 1
        _metrics["recent_slow_queries"].append(record)
        print(f"[SLOW QUERY ALERT] {duration_ms:.1f}ms (threshold: {SLOW_QUERY_THRESHOLD_MS}ms) | {caller} | {cleaned_sql[:160]}")


class AuditedCursor:
    """Proxy wrapper for MySQL cursors that automatically instruments execute calls."""

    def __init__(self, raw_cursor):
        self._cursor = raw_cursor

    def execute(self, operation, params=None, multi=False):
        t0 = time.perf_counter()
        try:
            return self._cursor.execute(operation, params, multi)
        finally:
            duration_ms = (time.perf_counter() - t0) * 1000.0
            rowcount = getattr(self._cursor, "rowcount", None)
            record_query(operation, params, duration_ms, rowcount)

    def executemany(self, operation, seq_params):
        t0 = time.perf_counter()
        try:
            return self._cursor.executemany(operation, seq_params)
        finally:
            duration_ms = (time.perf_counter() - t0) * 1000.0
            rowcount = len(seq_params) if seq_params else 0
            record_query(f"{operation} [BATCH x{rowcount}]", None, duration_ms, rowcount)

    def close(self):
        return self._cursor.close()

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size) if size else self._cursor.fetchmany()

    def __getattr__(self, name):
        return getattr(self._cursor, name)

    def __iter__(self):
        return iter(self._cursor)


class AuditedConnection:
    """Proxy wrapper for MySQL connections that returns AuditedCursor instances."""

    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self, *args, **kwargs):
        raw_cursor = self._conn.cursor(*args, **kwargs)
        return AuditedCursor(raw_cursor)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._conn.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)


def get_performance_audit_summary():
    """Return in-depth query and database health summary."""
    total = _metrics["total_queries"]
    avg_ms = round(_metrics["total_time_ms"] / total, 2) if total > 0 else 0.0

    return {
        "audit_started_at": _metrics["started_at"],
        "total_queries_executed": total,
        "total_db_time_ms": round(_metrics["total_time_ms"], 2),
        "average_query_time_ms": avg_ms,
        "slow_query_threshold_ms": SLOW_QUERY_THRESHOLD_MS,
        "slow_queries_count": _metrics["slow_queries_count"],
        "slow_queries_percent": round((_metrics["slow_queries_count"] / total * 100), 2) if total > 0 else 0.0,
        "recent_slow_queries": list(_metrics["recent_slow_queries"]),
        "recent_queries": list(_metrics["recent_queries"])[-15:],
    }
