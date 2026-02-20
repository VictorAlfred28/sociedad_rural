import os

# Configuración de Gunicorn para Producción
host = "0.0.0.0"
port = os.getenv("PORT", "8000")
bind = f"{host}:{port}"

# Concurrencia
workers = 4  # Ajustar según CPU cores
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
