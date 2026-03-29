from services.database import get_connection

def migrate_budget_phases():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        print("Creating budget_phases table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budget_phases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phase_name VARCHAR(100) NOT NULL,
                sort_order INT DEFAULT 0
            )
        """)

        # Insert default phases
        print("Seeding budget_phases...")
        cursor.execute("SELECT COUNT(*) FROM budget_phases")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO budget_phases (id, phase_name, sort_order) VALUES (1, 'Pre-Production', 1)")
            cursor.execute("INSERT INTO budget_phases (id, phase_name, sort_order) VALUES (2, 'Production', 2)")
            cursor.execute("INSERT INTO budget_phases (id, phase_name, sort_order) VALUES (3, 'Post-Production', 3)")
        
        # Add phase_id to departments
        print("Checking for phase_id in departments...")
        cursor.execute("SHOW COLUMNS FROM departments LIKE 'phase_id'")
        if not cursor.fetchone():
            print("Adding phase_id to departments...")
            cursor.execute("ALTER TABLE departments ADD COLUMN phase_id INT DEFAULT 2")
            cursor.execute("ALTER TABLE departments ADD CONSTRAINT fk_dept_phase FOREIGN KEY (phase_id) REFERENCES budget_phases(id)")
        
        # Verify existing departments are in Production
        cursor.execute("UPDATE departments SET phase_id = 2 WHERE phase_id IS NULL")
        
        # Create budget_adjustments table
        print("Creating budget_adjustments table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budget_adjustments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                version_id INT NOT NULL,
                budget_item_id INT NOT NULL,
                adjustment_amount DECIMAL(15, 2) DEFAULT 0.00,
                adjustment_type ENUM('budget', 'finance') DEFAULT 'budget',
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
                FOREIGN KEY (budget_item_id) REFERENCES budget_items(id) ON DELETE CASCADE
            )
        """)

        conn.commit()
        print("Phased Budgeting Migration Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate_budget_phases()
