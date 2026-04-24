#!/bin/bash
# start.sh - Script para levantar el entorno de producción

echo "Deteniendo contenedores previos si existen..."
docker-compose down

echo "Iniciando despliegue de contenedores (Frontend y Backend)..."
# Levantar en background, reconstruyendo imagenes
docker-compose up -d --build

echo "Limpiando imagenes huerfanas de Docker para liberar espacio..."
docker image prune -f

echo "Sistema en ejecución:"
docker-compose ps
