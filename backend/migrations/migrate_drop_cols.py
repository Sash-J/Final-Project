from services.database import get_connection

def drop_columns():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        print("Dropping additional2 and comment2 from project_budget_values...")
        cursor.execute("ALTER TABLE project_budget_values DROP COLUMN additional2, DROP COLUMN comment2;")
        conn.commit()
        print("Successfully dropped columns.")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    drop_columns()
