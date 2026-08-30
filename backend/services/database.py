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
    "connection_timeout": 5,
}

# Connection Pool
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="vision_division_pool", pool_size=2, **db_config
    )
    print("DEBUG: MySQL Connection Pool initialized successfully (size=2).")
except mysql.connector.Error as err:
    print(f"ERROR: Failed to initialize Connection Pool: {err}")
    connection_pool = None


import time
# pyrefly: ignore [missing-import]
from mysql.connector.errors import PoolError

def get_connection():
    """
    Fetches a connection from the pool if available.
    If the pool is exhausted (because max_user_connections = 1),
    it will wait up to a few seconds for the connection to be returned
    before failing, preventing the concurrent request crash.
    """
    if connection_pool:
        retries = 50 # Wait up to 5 seconds
        while retries > 0:
            try:
                return connection_pool.get_connection()
            except PoolError:
                time.sleep(0.1)
                retries -= 1
        
        # As a final fallback (likely to fail if max connections is strictly 1)
        return mysql.connector.connect(**db_config)

    return mysql.connector.connect(**db_config)
