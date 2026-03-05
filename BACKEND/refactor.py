import re
import sys

with open('main.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add BackgroundTasks to import
if 'BackgroundTasks' not in code:
    code = code.replace(
        'from fastapi import FastAPI, HTTPException, status, Request',
        'from fastapi import FastAPI, HTTPException, status, Request, BackgroundTasks'
    )

# 2. Add background_tasks to endpoint imports and signatures
def replace_auditoria(match):
    sig = match.group(1) # e.g. "async def login(req: Request"
    body = match.group(2) # up to registrar_auditoria(
    
    if 'BackgroundTasks' not in sig:
        # inject before closing parenthesis
        if sig.endswith(', )'):
            sig = sig[:-3] + ', background_tasks: BackgroundTasks)'
        elif sig.endswith(' )'):
            sig = sig[:-2] + ', background_tasks: BackgroundTasks)'
        else:
            sig = sig[:-1] + ', background_tasks: BackgroundTasks)'
            
    # Also change async def to def to prevent event loop blocking on I/O
    if sig.startswith('async def '):
        sig = sig.replace('async def ', 'def ')
        
    return f'{sig}:{body}background_tasks.add_task(registrar_auditoria, '

# Endpoints with auditing
pattern = re.compile(r'(async def [a-zA-Z0-9_]+\([^)]*\)):([\s\S]*?)registrar_auditoria\(')
code = pattern.sub(replace_auditoria, code)

# 3. For any remaining async def that we missed but don't have auditing, we should also make them sync if they call supabase
# This is a broad optimization for FastAPI + Synchronous Supabase Python SDK
code = re.sub(r'async def ([a-zA-Z0-9_]+)\(', r'def \1(', code)

# 4. Fix Mass Assignment
# Find update_data = {k: v for k, v in req.dict().items() if v is not None}
mass_assign_fix = '''update_data = {k: v for k, v in req.dict().items() if v is not None and k not in ("rol", "estado")}'''
code = code.replace(
    '''update_data = {k: v for k, v in req.dict().items() if v is not None}''',
    mass_assign_fix
)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Refactoring complete.")
