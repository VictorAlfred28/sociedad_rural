import os

with open("main.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
last_def_idx = -1

for i, line in enumerate(lines):
    # Fix import
    if line.startswith("from fastapi import FastAPI"):
        if "BackgroundTasks" not in line:
            line = line.replace("Request", "Request, BackgroundTasks")
    
    # Track def
    if line.strip().startswith("async def ") or line.strip().startswith("def "):
        last_def_idx = len(new_lines)
    
    # Fix mass assignment
    masstarget = "update_data = {k: v for k, v in req.dict().items() if v is not None}"
    massfix = "update_data = {k: v for k, v in req.dict().items() if v is not None and k not in ('rol', 'estado')}"
    if masstarget in line:
        line = line.replace(masstarget, massfix)
    
    # Check auditing
    if "registrar_auditoria(" in line and "def registrar_auditoria" not in line:
        line = line.replace("registrar_auditoria(", "background_tasks.add_task(registrar_auditoria, ")
        # Now fix the signature
        if last_def_idx != -1:
            sig = new_lines[last_def_idx]
            if "BackgroundTasks" not in sig:
                sig = sig.replace("):", ", background_tasks: BackgroundTasks):")
            new_lines[last_def_idx] = sig

    new_lines.append(line)

# Make all async defs sync defs for blocking IO optimization
final_lines = []
for line in new_lines:
    if line.strip().startswith("async def "):
        line = line.replace("async def ", "def ", 1)
    final_lines.append(line)

with open("main.py", "w", encoding="utf-8") as f:
    f.writelines(final_lines)

print("Refactorización segura y bloqueos síncronos optimizados.")
