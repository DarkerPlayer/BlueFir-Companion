import sqlite3
import json

DB_PATH = r'C:\Users\17875\.local\share\mimocode\mimocode.db'
PROJECT_ID = 'cde238f3-c34f-4724-862a-7404c659f8f8'

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get all user messages for this project to find explicit statements
c.execute('''
    SELECT m.id, m.session_id, m.time_created, 
           json_extract(m.data, '$.role') as role,
           p.data as part_data
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.project_id = ?
      AND json_extract(m.data, '$.role') = 'user'
      AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created
''', (PROJECT_ID,))

print('=== USER MESSAGES (explicit statements) ===')
for row in c.fetchall():
    part_data = json.loads(row['part_data'])
    text = part_data.get('text', '')
    if len(text) > 50:  # Skip very short messages
        print(f"\n[Session: {row['session_id']}]")
        print(f"Time: {row['time_created']}")
        print(f"Text: {text[:500]}")
        print("---")

conn.close()
