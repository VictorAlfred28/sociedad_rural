import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// Tipos basados en nuestro backend Pydantic
export interface Socio {
    id: string;
    nombre_apellido: string;
    dni: string;
    email: string;
    telefono: string;
    rol: 'SOCIO' | 'ADMIN' | 'COMERCIO' | 'CAMARA';
    estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'SUSPENDIDO' | 'RESTRINGIDO';
    motivo?: string;
    password_changed?: boolean;
    municipio?: string;
    direccion?: string;
    foto_url?: string;
    titular_id?: string | null;
    tipo_vinculo?: string | null;
    user_roles?: string[];
    numero_socio?: string;                          // Número único de 4 dígitos
    barrio?: string;                                // Localidad/barrio de residencia
    created_at?: string;                            // Fecha de creación del usuario
    sonido_notificaciones_habilitado?: boolean;     // Preferencia de sonido en notificaciones
}

interface AuthContextType {
    user: Socio | null;
    token: string | null;
    login: (token: string, userData: Socio, refreshToken?: string) => void;
    logout: () => void;
    updateUser: (userData: Partial<Socio>) => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Decodifica un JWT y retorna el payload sin validar la firma */
function decodeJwtPayload(token: string): { exp?: number } | null {
    try {
        const base64Payload = token.split('.')[1];
        const payload = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<Socio | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const performRefresh = async (refreshToken: string) => {
        try {
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!SUPABASE_URL || !SUPABASE_KEY) return;

            const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!resp.ok) {
                // Refresh falló (sesión revocada), hacer logout
                doLogout();
                return;
            }

            const data = await resp.json();
            if (data.access_token) {
                setToken(data.access_token);
                localStorage.setItem('token', data.access_token);
                if (data.refresh_token) {
                    localStorage.setItem('refresh_token', data.refresh_token);
                    scheduleTokenRefresh(data.access_token, data.refresh_token);
                }
            }
        } catch (err) {
            console.error('Error renovando token:', err);
        }
    };

    const scheduleTokenRefresh = (accessToken: string, refreshToken: string) => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

        const payload = decodeJwtPayload(accessToken);
        if (!payload?.exp) return;

        const expiresAtMs = payload.exp * 1000;
        const now = Date.now();
        // Renovar 5 minutos antes de que expire
        const refreshInMs = expiresAtMs - now - (5 * 60 * 1000);

        if (refreshInMs <= 0) {
            performRefresh(refreshToken);
            return;
        }

        refreshTimerRef.current = setTimeout(() => {
            performRefresh(refreshToken);
        }, refreshInMs);
    };

    const doLogout = () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('socio');
        localStorage.removeItem('refresh_token');
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedSocio = localStorage.getItem('socio');
        const storedRefreshToken = localStorage.getItem('refresh_token');

        if (storedToken && storedSocio) {
            setToken(storedToken);
            try {
                setUser(JSON.parse(storedSocio));
            } catch (e) {
                console.error("Error parsing stored user data");
            }

            if (storedRefreshToken) {
                scheduleTokenRefresh(storedToken, storedRefreshToken);
            }
        }
        setIsLoading(false);

        // Listener para errores 401 globales (Token expirado o inválido)
        const handleUnauthorized = () => {
            console.warn("Sesión expirada o no autorizada. Redirigiendo...");
            doLogout();
        };
        window.addEventListener('auth-unauthorized', handleUnauthorized);

        return () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            window.removeEventListener('auth-unauthorized', handleUnauthorized);
        };
    }, []);

    const login = (newToken: string, userData: Socio, refreshToken?: string) => {
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('socio', JSON.stringify(userData));
        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
            scheduleTokenRefresh(newToken, refreshToken);
        }
    };

    const logout = () => doLogout();

    const updateUser = (userData: Partial<Socio>) => {
        setUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...userData };
            localStorage.setItem('socio', JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            updateUser,
            isAuthenticated: !!token && !!user,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
