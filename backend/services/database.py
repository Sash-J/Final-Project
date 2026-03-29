import mysql.connector
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "productions"),
        port=int(os.getenv("DB_PORT", 3306)),
        connection_timeout=5
    )
