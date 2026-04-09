import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

print("Starting migration script...", flush=True)

try:
    print(f"Connecting to {os.getenv('DB_HOST')}...", flush=True)
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME'),
        connection_timeout=10
    )
    if conn.is_connected():
        print('Connection Successful!', flush=True)
        cursor = conn.cursor(dictionary=True)
        # Check if project_image column exists
        cursor.execute("SHOW COLUMNS FROM projects LIKE 'project_image'")
        row = cursor.fetchone()
        if not row:
            print("Adding project_image column (LONGTEXT)...", flush=True)
            cursor.execute("ALTER TABLE projects ADD COLUMN project_image LONGTEXT;")
            conn.commit()
            print("Column added successfully.", flush=True)
        else:
            print("project_image column already exists. Modifying to LONGTEXT just in case...", flush=True)
            cursor.execute("ALTER TABLE projects MODIFY COLUMN project_image LONGTEXT;")
            conn.commit()
            print("Column modified to LONGTEXT.", flush=True)
        cursor.close()
    conn.close()
except Exception as e:
    print(f"Migration Failed: {e}", flush=True)
