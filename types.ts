
export type UserRole = 'comun' | 'profesional' | 'comercial' | 'admin_camara' | 'superadmin' | 'SOCIO' | 'COMERCIO' | 'CAMARA_COMERCIO' | 'SUPERADMIN';
export type UserStatus = 'activo' | 'pendiente' | 'inactivo';
export type CommercePlan = 'gratuito' | 'premium';

export interface Camara {
  id: string;
  nombre: string;
  zona: string;
  limite_gratuitos: number;
}

export interface Profile {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  domicilio: string;
  ciudad: string;
  provincia: string;
  rol: UserRole;
  estado: UserStatus;
  is_moroso: boolean;
  camara_id?: string;
  comercio_id?: string;
  fecha_alta: string;
  cuit?: string; // Nuevo
  firebase_token?: string; // Nuevo
  is_active?: boolean; // Nuevo
  temp_password?: string; // Nuevo
}

export interface Municipio {
  id: string;
  nombre: string;
  coordenadas: { lat: number; lng: number };
  imagen_portada: string;
}

export interface Comercio {
  id: string;
  nombre: string;
  municipio_id: string;
  camara_id: string;
  direccion: string;
  telefono: string;
  email: string;
  lat: number;
  lng: number;
  descuento_base: number;
  rubro: string;
  tipo_plan: CommercePlan;
  estado: UserStatus;
  user_id?: string;
  categoria?: string;
  ubicacion?: string;
  cuit?: string;
  barrio?: string;
  provincia?: string;
  descripcion?: string;
  logo_url?: string;
}

export interface AuditLog {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  accion: string;
  detalle: string;
  timestamp: string;
  ip: string;
}

export interface DashboardStats {
  sociosActivos: number;
  sociosPendientes: number;
  recaudacionMensual: number;
  comerciosAdheridos: number;
}

export interface Promocion {
  id: string;
  comercio_id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: UserStatus;
  porcentaje_descuento?: number;
  comercio_nombre?: string; // Virtual para facilitar UI
}

export interface Evento {
  id: string;
  titulo: string;
  descripcion: string;
  imagen_url: string;
  fecha: string;
  lugar: string;
  estado: UserStatus;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'nuevo_socio' | 'nueva_promo' | 'sistema';
  link?: string;
  read: boolean;
  created_at: string;
}
