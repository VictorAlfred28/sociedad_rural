import { createClient } from '@supabase/supabase-js';

// Obtenemos las variables de entorno.
const env = (import.meta as any).env || {};

// Usamos las credenciales provistas como fallback para que funcione inmediatamente en el entorno de prueba
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://kkytfpokvhuaexttoxce.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreXRmcG9rdmh1YWV4dHRveGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzQwMzgsImV4cCI6MjA4NjkxMDAzOH0.7ko625OocpzNF4qP08PAs_VaRODW4VNieiezgyLcdr0';

// Exportamos la instancia única del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);