import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def test_connection():
    try:
        print(f"Attempting to connect to: {os.getenv('DB_HOST')}")
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            port=int(os.getenv("DB_PORT", 3306)),
            connection_timeout=5
        )
        print("✅ Successfully connected to the remote database!")
        
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        print(f"Tables found: {[t[0] for t in tables]}")
        
        conn.close()
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")

if __name__ == "__main__":
    test_connection()
