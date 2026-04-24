#!/bin/bash
# install.sh - Script de instalación y configuración para VPS Ubuntu/Debian
# Este script asume un entorno Linux estándar para el VPS

set -e

echo "==============================================="
echo "Preparando instalación en entorno Producción..."
echo "==============================================="

# Actualizar sistema
echo "[1/4] Actualizando sistema operativo e instalando dependencias base..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git unzip apt-transport-https ca-certificates software-properties-common

# Instalar Docker si no está instalado
if ! command -v docker &> /dev/null
then
    echo "[2/4] Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo "[2/4] Docker ya está instalado."
fi

# Instalar Docker Compose
if ! command -v docker-compose &> /dev/null
then
    echo "[3/4] Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "[3/4] Docker Compose ya está instalado."
fi

# Configurar entorno
echo "[4/4] Copiando ejemplos de .env si no existen..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "NOTA: Configurado backend/.env (por favor revisa las credenciales)"
fi

if [ ! -f frontend/.env.production ]; then
    cp frontend/.env.example frontend/.env.production
    echo "NOTA: Configurado frontend/.env.production (por favor revisa las variables)"
fi

echo "==============================================="
echo "Instalación completada. Revisa los archivos .env"
echo "Para iniciar el sistema usa: ./scripts/start.sh"
echo "==============================================="
