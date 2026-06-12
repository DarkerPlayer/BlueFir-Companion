import sqlite3
import json
import os

DB_PATH = r'C:\Users\17875\.local\share\mimocode\mimocode.db'
PROJECT_ID = 'cde238f3-c34f-4724-862a-7404c659f8f8'

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get current project sessions
c.execute('SELECT id, title, time_created FROM session WHERE project_id = ? ORDER BY time_created DESC', (PROJECT_ID,))
sessions = c.fetchall()
print('=== PROJECT SESSIONS ===')
for s in sessions:
    print(f"{s['id']} | {s['title'][:80]} | {s['time_created']}")

print()

# For each session, get message count
for s in sessions:
    c.execute('SELECT COUNT(*) FROM message WHERE session_id = ?', (s['id'],))
    msg_count = c.fetchone()[0]
    c.execute('SELECT COUNT(*) FROM part WHERE session_id = ?', (s['id'],))
    part_count = c.fetchone()[0]
    print(f"{s['id']} - messages: {msg_count} - parts: {part_count}")

conn.close()
