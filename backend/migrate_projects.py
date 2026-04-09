import mysql.connector
import sys
import os

# Add backend directory to path to reach config
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.database import get_connection

def migrate_db():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Add color column to projects table
        print("Checking for 'color' column in 'projects'...")
        cursor.execute("SHOW COLUMNS FROM projects LIKE 'color'")
        result = cursor.fetchone()
        
        if not result:
            print("Adding 'color' column to 'projects'...")
            cursor.execute("ALTER TABLE projects ADD COLUMN color VARCHAR(7) DEFAULT '#00c6e6'")
            conn.commit()
            print("Successfully added 'color' column.")
        else:
            print("'color' column already exists.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate_db()
