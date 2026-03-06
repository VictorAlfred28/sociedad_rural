import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

interface AuthContextType {
    user: Socio | null;
    token: string | null;
    login: (token: string, userData: Socio) => void;
    logout: () => void;
    updateUser: (userData: Socio) => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<Socio | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Al cargar la app, revisamos si hay una sesión activa guardada
        const storedToken = localStorage.getItem('token');
        const storedSocio = localStorage.getItem('socio');

        if (storedToken && storedSocio) {
            setToken(storedToken);
            try {
                setUser(JSON.parse(storedSocio));
            } catch (e) {
                console.error("Error parsing stored user data");
            }
        }
        setIsLoading(false);
    }, []);

    const login = (newToken: string, userData: Socio) => {
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('socio', JSON.stringify(userData));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('socio');
    };

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
