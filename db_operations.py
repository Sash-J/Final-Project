from database import get_connection


def get_tables():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SHOW TABLES;")
    result = cursor.fetchall()

    cursor.close()
    conn.close()

    return [table[0] for table in result]
