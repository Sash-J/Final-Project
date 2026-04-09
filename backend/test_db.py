import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

try:
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
    )
    if conn.is_connected():
        print("Connection Successful!")
        cursor = conn.cursor(dictionary=True)
        # Check if project_image column exists
        cursor.execute("SHOW COLUMNS FROM projects LIKE 'project_image'")
        row = cursor.fetchone()
        if not row:
            print("Adding project_image column...")
            cursor.execute(
                "ALTER TABLE projects ADD COLUMN project_image VARCHAR(500);"
            )
            conn.commit()
            print("Column added successfully.")
        else:
            print("project_image column already exists.")
        cursor.close()
    conn.close()
except Exception as e:
    print(f"Connection Failed: {e}")
