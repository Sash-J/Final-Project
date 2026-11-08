# pyrefly: ignore [missing-import]
import mysql.connector
# pyrefly: ignore [missing-import]
from mysql.connector import pooling
import os
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()

db_config = {
    "host": os.getenv("DB_HOST", "visiondivision.lk"),
    "user": os.getenv("DB_USER", "visiondi_visiondivision_admin"),
    "password": os.getenv("DB_PASSWORD", "Vision2026DbPass!"),
    "database": os.getenv("DB_NAME", "visiondi_production"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "connection_timeout": 20,
    "init_command": "SET SESSION sql_mode = REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', '')",
}

# Connection Pool
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="vision_division_pool", pool_size=2, pool_reset_session=False, **db_config
    )
    print("DEBUG: MySQL Connection Pool initialized successfully (size=2).")
except mysql.connector.Error as err:
    print(f"ERROR: Failed to initialize Connection Pool: {err}")
    connection_pool = None


import time
# pyrefly: ignore [missing-import]
from mysql.connector.errors import PoolError
try:
    from .query_auditor import AuditedConnection
except ImportError:
    from services.query_auditor import AuditedConnection

def get_connection():
    """
    Fetches a connection from the pool if available.
    If the pool is exhausted (because max_user_connections = 1),
    it will wait up to a few seconds for the connection to be returned
    before failing, preventing the concurrent request crash.
    """
    raw_conn = None
    if connection_pool:
        retries = 50 # Wait up to 5 seconds
        while retries > 0:
            try:
                raw_conn = connection_pool.get_connection()
                if not raw_conn.is_connected():
                    raw_conn.reconnect(attempts=3, delay=1)
                break
            except PoolError:
                time.sleep(0.1)
                retries -= 1
        
        if not raw_conn:
            raw_conn = mysql.connector.connect(**db_config)
    else:
        raw_conn = mysql.connector.connect(**db_config)

    return AuditedConnection(raw_conn)
