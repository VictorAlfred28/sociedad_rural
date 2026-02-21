import { Profile, Comercio, AuditLog, DashboardStats, Camara } from '../types';
import { supabase } from './supabaseClient';

const env = (import.meta as any).env || {};
// Usamos las credenciales provistas como fallback para que funcione inmediatamente en el entorno de prueba
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://kkytfpokvhuaexttoxce.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreXRmcG9rdmh1YWV4dHRveGNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzQwMzgsImV4cCI6MjA4NjkxMDAzOH0.7ko625OocpzNF4qP08PAs_VaRODW4VNieiezgyLcdr0';

let API_BASE_URL = env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Asegurar que termine en /api/v1 para evitar errores de ruta
if (API_BASE_URL && !API_BASE_URL.endsWith('/api/v1')) {
  API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api/v1';
}

let localMemoryProfiles: Profile[] = [];

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

const handleNetworkError = (error: any, context: string) => {
  if (error.message.includes('Sesión expirada')) throw error;

  const isNetworkError = error.name === 'TypeError' ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('Network request failed');

  if (isNetworkError) {
    console.error(`❌ Error de RED en ${context}. Verifique conexión y configuración CORS:`, error);
    throw new Error(`No se pudo conectar con el servidor configurado en ${API_BASE_URL}. Verifique que el backend esté activo y que el dominio ${window.location.origin} esté permitido en CORS.`);
  }

  console.error(`❌ API Error [${context}]:`, error);
  throw error;
};

async function tryFetchOrFallback<T>(
  fetchFn: () => Promise<Response>,
  fallbackFn: () => Promise<T>,
  context: string = 'Operation'
): Promise<T> {
  try {
    const res = await fetchFn();
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error("Sesión expirada o permisos insuficientes.");
      }
      throw new Error(errorData.detail || `Error del servidor (${res.status}) en ${context}`);
    }
    return res.json();
  } catch (error: any) {
    // Si es error de red y hay fallback, usarlo
    const isNetworkError = error.name === 'TypeError' ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network request failed');

    if (isNetworkError) {
      console.warn(`⚠️ [Offline Mode] Backend inaccesible en: ${context}. Usando fallback local.`);
      return fallbackFn();
    }

    return handleNetworkError(error, context);
  }
}

export const ApiService = {
  system: {
    checkStatus: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) return { online: true, mode: 'Backend Python (Fase 8 - Enterprise)' };
        return { online: false, mode: 'Offline' };
      } catch { return { online: false, mode: 'Offline' }; }
    }
  },

  auth: {
    login: async (credentials: any) => {
      try {
        // Login siempre contra Backend Python para validar roles complejos
        const res = await fetch(`${API_BASE_URL}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(credentials),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Error de autenticación");
        }
        return res.json();
      } catch (error) {
        return handleNetworkError(error, "Auth Login");
      }
    },
    register: async (data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Error en el registro");
        }
        return res.json();
      } catch (error) {
        return handleNetworkError(error, "Auth Register");
      }
    },
    logout: async () => {
      localStorage.clear();
      await supabase.auth.signOut();
    },
    // Método rápido de validación QR
    validateQR: async (profileId: string) => {
      const res = await fetch(`${API_BASE_URL}/qr/validate/${profileId}`, { headers: getHeaders() });
      if (!res.ok) throw new Error("QR Inválido o sin permisos");
      return res.json();
    }
  },

  stats: {
    getQuota: async () => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/stats/quota`, { headers: getHeaders() }),
        async () => ({ used: 0, limit: 10, percent: 0, is_full: false }),
        "Get Quota"
      );
    }
  },

  camaras: {
    getAll: async (): Promise<Camara[]> => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/camaras`, { headers: getHeaders() }),
        async () => [],
        "Get Cámaras"
      );
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/admin/camaras`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Error al crear cámara");
      return res.json();
    },
    asignarComercios: async (id: string, comerciosIds: string[]) => {
      const res = await fetch(`${API_BASE_URL}/admin/camaras/${id}/asignar-comercios`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ comercios_ids: comerciosIds })
      });
      if (!res.ok) throw new Error("Error al asignar comercios");
      return res.json();
    }
  },

  socios: {
    getAll: async (limit: number = 100, offset: number = 0): Promise<Profile[]> => {
      return tryFetchOrFallback(
        // Soporte de paginación
        () => fetch(`${API_BASE_URL}/socios?limit=${limit}&offset=${offset}`, { headers: getHeaders() }),
        async () => {
          // Fallback directo a supabase (solo lectura)
          const { data } = await supabase.from('profiles').select('*').range(offset, offset + limit - 1);
          return (data as Profile[]) || [];
        },
        "Get Socios"
      );
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/socios`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      return res.json();
    },
    approve: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/socios/${id}/aprobar`, { method: 'POST', headers: getHeaders() });
      if (!res.ok) throw new Error("Error al aprobar");
      return res.json();
    },
    update: async (id: string, data: Partial<Profile>) => {
      const res = await fetch(`${API_BASE_URL}/socios/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Error al actualizar socio");
      return res.json();
    }
  },

  comercios: {
    getAll: async (limit: number = 100, offset: number = 0): Promise<Comercio[]> => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/comercios?limit=${limit}&offset=${offset}`, { headers: getHeaders() }),
        async () => [],
        "Get Comercios"
      );
    },
    create: async (data: Partial<Comercio>) => {
      try {
        const res = await fetch(`${API_BASE_URL}/comercios`, {
          method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Error al crear comercio");
        }
        return res.json();
      } catch (error) {
        return handleNetworkError(error, "Crear Comercio");
      }
    },
    update: async (id: string, data: Partial<Comercio>) => {
      try {
        const res = await fetch(`${API_BASE_URL}/comercios/${id}`, {
          method: 'PUT', headers: getHeaders(), body: JSON.stringify(data)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Error al actualizar comercio");
        }
        return res.json();
      } catch (error) {
        return handleNetworkError(error, "Actualizar Comercio");
      }
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/comercios/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    adminCreate: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/admin/comercios`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al crear comercio por admin");
      }
      return res.json();
    },
    approve: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/admin/comercios/${id}/approve`, {
        method: 'POST', headers: getHeaders()
      });
      if (!res.ok) throw new Error("Error al aprobar comercio");
      return res.json();
    }
  },

  payments: {
    createPreference: async (unitPrice: number, title: string) => {
      const res = await fetch(`${API_BASE_URL}/payments/preference`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ unit_price: unitPrice, title: title, quantity: 1, type: 'cuota' })
      });
      if (!res.ok) throw new Error("Error al iniciar pago");
      return res.json();
    }
  },

  dashboard: {
    getStats: async (): Promise<DashboardStats> => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/dashboard/stats`, { headers: getHeaders() }),
        async () => ({ sociosActivos: 0, sociosPendientes: 0, recaudacionMensual: 0, comerciosAdheridos: 0 }),
        "Dashboard Stats"
      );
    }
  },

  auditoria: {
    getAll: async (): Promise<AuditLog[]> => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/auditoria`, { headers: getHeaders() }),
        async () => [],
        "Auditoría Logs"
      );
    }
  },

  promociones: {
    getAll: async (limit: number = 100, offset: number = 0): Promise<any[]> => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/promociones?limit=${limit}&offset=${offset}`, { headers: getHeaders() }),
        async () => [],
        "Get Promociones"
      );
    }
  },

  eventos: {
    getAll: async (limit: number = 100, offset: number = 0): Promise<any[]> => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/eventos?limit=${limit}&offset=${offset}`, { headers: getHeaders() }),
        async () => [],
        "Get Eventos"
      );
    }
  },

  municipios: {
    getAll: async (): Promise<any[]> => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/municipios`, { headers: getHeaders() }),
        async () => [],
        "Get Municipios"
      );
    }
  },

  storage: {
    uploadImage: async (file: File, bucket: string = 'comercios'): Promise<string> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    }
  },

  user: {
    getMe: async (): Promise<Profile> => {
      const res = await fetch(`${API_BASE_URL}/users/profile`, { headers: getHeaders() });
      if (!res.ok) throw new Error("No se pudo obtener el perfil");
      return res.json();
    },
    updateLocation: async (lat: number, lng: number) => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/user/location-update`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ latitude: lat, longitude: lng }),
        }),
        async () => ({ success: true }),
        'Update Location'
      );
    },
    updateFCMToken: async (token: string) => {
      return tryFetchOrFallback(
        () => fetch(`${API_BASE_URL}/user/fcm-token`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ token: token }), // Sincronizado con el backend payload.get("token")
        }),
        async () => ({ success: true }),
        'Update FCM Token'
      );
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      const res = await fetch(`${API_BASE_URL}/user/change-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al cambiar contraseña");
      }
      return res.json();
    }
  },

  commerceSelf: {
    getProfile: async () => {
      const res = await fetch(`${API_BASE_URL}/my-commerce`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Error al obtener perfil comercial");
      return res.json();
    },
    updateProfile: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/my-commerce`, {
        method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Error al actualizar perfil comercial");
      return res.json();
    },
    getPromos: async () => {
      const res = await fetch(`${API_BASE_URL}/my-commerce/promos`, { headers: getHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    createPromo: async (data: any) => {
      const res = await fetch(`${API_BASE_URL}/my-commerce/promos`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Error al crear la promoción");
      }
      return res.json();
    },
    deletePromo: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/my-commerce/promos/${id}`, {
        method: 'DELETE', headers: getHeaders()
      });
      if (!res.ok) throw new Error("Error al eliminar promoción");
      return res.json();
    },
    validateMember: async (dniOrId: string) => {
      const res = await fetch(`${API_BASE_URL}/my-commerce/validate-member/${dniOrId}`, { headers: getHeaders() });
      if (!res.ok) throw new Error("No se pudo validar el socio");
      return res.json();
    }
  }
};