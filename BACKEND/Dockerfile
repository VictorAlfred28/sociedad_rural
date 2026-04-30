FROM python:3.11-slim

# Evitar que Python escriba archivos .pyc
ENV PYTHONDONTWRITEBYTECODE=1
# Forzar a que la salida de Python no use buffer (bueno para logs de Docker)
ENV PYTHONUNBUFFERED=1
# Configurar zona horaria local
ENV TZ=America/Argentina/Buenos_Aires

WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar paquetes
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# El puerto 8000 suele ser interno, Easypanel lo enruta al dominio automáticamente
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
