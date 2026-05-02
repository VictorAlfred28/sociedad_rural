-- Crear tabla de logs para webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(255) NOT NULL,
    external_id VARCHAR(255),
    payload_json JSONB,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agregar campo evento_id a la tabla notificaciones
ALTER TABLE notificaciones 
ADD COLUMN IF NOT EXISTS evento_id UUID;
