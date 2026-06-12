import sqlite3
import json
import sys

DB_PATH = r'C:\Users\17875\.local\share\mimocode\mimocode.db'
SESSION_ID = sys.argv[1] if len(sys.argv) > 1 else 'ses_1467764d8ffel085IQV01Nja4P'

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get session info
c.execute('SELECT * FROM session WHERE id = ?', (SESSION_ID,))
session = c.fetchone()
print('=== SESSION INFO ===')
print(f"ID: {session['id']}")
print(f"Title: {session['title']}")
print(f"Time: {session['time_created']}")
print()

# Get all messages with parts
c.execute('SELECT id, agent_id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created', (SESSION_ID,))
messages = c.fetchall()

for msg in messages:
    msg_data = json.loads(msg['data'])
    role = msg_data.get('role', 'unknown')
    agent_id = msg['agent_id'] or 'main'
    
    print(f'--- MESSAGE {msg["id"]} (role={role}, agent={agent_id}) ---')
    
    # Get parts for this message
    c.execute('SELECT id, data FROM part WHERE message_id = ? ORDER BY time_created', (msg['id'],))
    parts = c.fetchall()
    
    for part in parts:
        part_data = json.loads(part['data'])
        ptype = part_data.get('type', 'unknown')
        
        if ptype == 'text':
            text = part_data.get('text', '')
            print(f'  [TEXT]: {text[:500]}')
        elif ptype == 'tool':
            tool = part_data.get('tool', 'unknown')
            state = part_data.get('state', {})
            input_val = str(state.get('input', ''))[:300]
            output_val = str(state.get('output', ''))[:300]
            print(f'  [TOOL: {tool}]')
            print(f'    Input: {input_val}')
            print(f'    Output: {output_val}')
        elif ptype == 'step-start':
            print(f'  [STEP-START]')
        elif ptype == 'step-finish':
            tokens = part_data.get('tokens', {})
            print(f'  [STEP-FINISH] tokens: {tokens}')
        else:
            print(f'  [{ptype}]: {str(part_data)[:200]}')
    
    print()

conn.close()
