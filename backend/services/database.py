import mysql.connector
from mysql.connector import pooling
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database configuration
db_config = {
    "host": os.getenv("DB_HOST", "visiondivision.lk"),
    "user": os.getenv("DB_USER", "visiondi_visiondivision_admin"),
    "password": os.getenv("DB_PASSWORD", "Vision2026DbPass!"),
    "database": os.getenv("DB_NAME", "visiondi_production"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "connection_timeout": 5
}

# Initialize Connection Pool
# pooling_name ensures we can distinguish this pool in multi-threaded environments
# pool_size defaults to 5 which is sufficient for this volume
try:
    connection_pool = pooling.MySQLConnectionPool(
        pool_name="vision_division_pool",
        pool_size=5,
        **db_config
    )
    print("DEBUG: MySQL Connection Pool initialized successfully.")
except mysql.connector.Error as err:
    print(f"ERROR: Failed to initialize Connection Pool: {err}")
    connection_pool = None

def get_connection():
    """
    Fetches a connection from the pool if available, 
    otherwise falls back to a new direct connection.
    """
    if connection_pool:
        try:
            return connection_pool.get_connection()
        except mysql.connector.Error:
            # If pool is exhausted or failing, fallback to direct
            return mysql.connector.connect(**db_config)
    
    return mysql.connector.connect(**db_config)
