from services.db_operations import get_connection

conn = get_connection()
cursor = conn.cursor(dictionary=True)
cursor.execute('SELECT id FROM projects')
projects = cursor.fetchall()

for p in projects:
    cursor.execute('SELECT COUNT(*) as count FROM project_equipment_departments WHERE project_id = %s', (p['id'],))
    count = cursor.fetchone()['count']
    if count == 0:
        cursor.execute('INSERT INTO project_equipment_departments (project_id, name) VALUES (%s, %s)', (p['id'], 'Lighting'))
        cursor.execute('INSERT INTO project_equipment_departments (project_id, name) VALUES (%s, %s)', (p['id'], 'Art'))

conn.commit()
cursor.close()
conn.close()
print('Done!')
