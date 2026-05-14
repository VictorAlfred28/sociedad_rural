-- Migration: Favoritos and Analytics
-- Adds support for tracking user favorites and promotion interaction analytics.

-- 1. Favoritos
CREATE TABLE IF NOT EXISTS favoritos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    promocion_id UUID REFERENCES promociones(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(usuario_id, promocion_id)
);

-- Habilitar RLS para favoritos
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propios favoritos" 
    ON favoritos FOR SELECT 
    USING (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden insertar sus propios favoritos" 
    ON favoritos FOR INSERT 
    WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios favoritos" 
    ON favoritos FOR DELETE 
    USING (auth.uid() = usuario_id);


-- 2. Analytics
CREATE TABLE IF NOT EXISTS promociones_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    promocion_id UUID REFERENCES promociones(id) ON DELETE CASCADE,
    comercio_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo_evento VARCHAR(50) NOT NULL, -- 'view', 'whatsapp_click', 'instagram_click', 'maps_click', 'share'
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Opcional, puede ser publico
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS para analytics
ALTER TABLE promociones_analytics ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar analytics (vistas, clicks)
CREATE POLICY "Public puede insertar analytics" 
    ON promociones_analytics FOR INSERT 
    WITH CHECK (true);

-- Solo el comercio dueño puede ver sus analytics
CREATE POLICY "Comercios pueden ver sus analytics" 
    ON promociones_analytics FOR SELECT 
    USING (auth.uid() = comercio_id);

