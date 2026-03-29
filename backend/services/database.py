import mysql.connector
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "sql12.freesqldatabase.com"),
        user=os.getenv("DB_USER", "sql12821656"),
        password=os.getenv("DB_PASSWORD", "PIRddhZMKg"),
        database=os.getenv("DB_NAME", "sql12821656"),
        port=int(os.getenv("DB_PORT", 3306)),
        connection_timeout=5
    )
