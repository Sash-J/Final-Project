from services.database import get_connection

def create_tables():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create schedule_tasks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS schedule_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        task_date DATE NOT NULL,
        created_by INT NOT NULL,
        is_visiondivision BOOLEAN DEFAULT 1,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
    """)
    
    # Create task_notes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS task_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        note_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES schedule_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Tables created successfully")

if __name__ == "__main__":
    create_tables()
