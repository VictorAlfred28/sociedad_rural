import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
users = s.auth.admin.list_users()
profs = s.table('profiles').select('*').execute().data

with open('debug_db.txt', 'w') as f:
    f.write('--- AUTH USERS ---\n')
    for u in users:
        f.write(f'{u.email} {u.id}\n')
    f.write('\n--- PROFILES ---\n')
    for p in profs:
        f.write(f'Email: {p.get("email")} | ID: {p.get("id")} | DNI: {p.get("dni")} | Rol: {p.get("rol")} | Estado: {p.get("estado")}\n')
