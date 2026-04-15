-- =========================================================================
-- SISTEMA DE HISTORIAL DE CHAT PARA ASISTENTE VIRTUAL
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB, -- Para guardar el modo (Básico, Técnico, etc.) o resultados de visión
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Índices para mejorar la búsqueda por usuario
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history(created_at);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver y crear sus propios mensajes
DROP POLICY IF EXISTS "Usuarios pueden ver su propio historial de chat" ON public.chat_history;
CREATE POLICY "Usuarios pueden ver su propio historial de chat" 
ON public.chat_history FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios pueden insertar su propio historial de chat" ON public.chat_history;
CREATE POLICY "Usuarios pueden insertar su propio historial de chat" 
ON public.chat_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);
