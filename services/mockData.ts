import { Profile, Comercio, Municipio, AuditLog, DashboardStats } from '../types';

export const mockStats: DashboardStats = {
  sociosActivos: 1251,
  sociosPendientes: 15,
  recaudacionMensual: 4500000,
  comerciosAdheridos: 85
};

export const mockProfiles: Profile[] = [
  { id: '1', dni: '35123456', nombre: 'Juan', apellido: 'Pérez', email: 'juan.perez@email.com', telefono: '3794555555', domicilio: 'San Martín 123', ciudad: 'Corrientes', provincia: 'Corrientes', rol: 'comun', estado: 'activo', fecha_alta: '2023-01-15' },
  { id: '2', dni: '28987654', nombre: 'María', apellido: 'González', email: 'maria.g@email.com', telefono: '3794444444', domicilio: 'Belgrano 456', ciudad: 'Goya', provincia: 'Corrientes', rol: 'profesional', estado: 'pendiente', fecha_alta: '2023-10-20' },
  { id: '3', dni: '40111222', nombre: 'Carlos', apellido: 'Rodríguez', email: 'carlos.rod@email.com', telefono: '3794333333', domicilio: 'Junín 789', ciudad: 'Curuzú Cuatiá', provincia: 'Corrientes', rol: 'comercial', estado: 'activo', comercio_id: '101', fecha_alta: '2023-05-10' },
  { id: '4', dni: '33444555', nombre: 'Ana', apellido: 'Martínez', email: 'ana.m@email.com', telefono: '3794222222', domicilio: 'Salta 321', ciudad: 'Mercedes', provincia: 'Corrientes', rol: 'profesional', estado: 'activo', fecha_alta: '2023-02-28' },
  { id: '5', dni: '22333444', nombre: 'Roberto', apellido: 'Sánchez', email: 'roberto.s@email.com', telefono: '3794111111', domicilio: 'Córdoba 654', ciudad: 'Bella Vista', provincia: 'Corrientes', rol: 'comun', estado: 'inactivo', fecha_alta: '2022-11-05' },
  // Usuario agregado para consistencia con captura
  { id: '6', dni: '99887766', nombre: 'Victor', apellido: 'Alfredo', email: 'victoralfredo2498@gmail.com', telefono: '-', domicilio: 'Sin domicilio', ciudad: 'Corrientes', provincia: 'Corrientes', rol: 'comun', estado: 'pendiente', fecha_alta: '2023-11-01' },
];

export const mockComercios: Comercio[] = [
  { id: '101', nombre: 'AgroInsumos Norte', municipio_id: '1', direccion: 'Ruta 12 Km 1000', telefono: '3794000001', email: 'contacto@agroinsumos.com', lat: -27.469, lng: -58.830, descuento_base: 15, rubro: 'Insumos Agrícolas', camara_id: '1', tipo_plan: 'premium', estado: 'activo' },
  { id: '102', nombre: 'Talabartería El Correntino', municipio_id: '2', direccion: 'España 440', telefono: '3777000002', email: 'ventas@elcorrentino.com', lat: -29.143, lng: -59.264, descuento_base: 10, rubro: 'Indumentaria y Cuero', camara_id: '1', tipo_plan: 'gratuito', estado: 'activo' },
  { id: '103', nombre: 'Veterinaria San Roque', municipio_id: '3', direccion: 'Pujol 880', telefono: '3774000003', email: 'vet@sanroque.com', lat: -29.791, lng: -58.053, descuento_base: 20, rubro: 'Veterinaria', camara_id: '1', tipo_plan: 'premium', estado: 'pendiente' },
];

export const mockMunicipios: Municipio[] = [
  { id: '1', nombre: 'Corrientes Capital', coordenadas: { lat: -27.469, lng: -58.830 }, imagen_portada: 'https://picsum.photos/800/400?random=1' },
  { id: '2', nombre: 'Goya', coordenadas: { lat: -29.143, lng: -59.264 }, imagen_portada: 'https://picsum.photos/800/400?random=2' },
  { id: '3', nombre: 'Curuzú Cuatiá', coordenadas: { lat: -29.791, lng: -58.053 }, imagen_portada: 'https://picsum.photos/800/400?random=3' },
];

export const mockAuditLogs: AuditLog[] = [
  { id: '1', usuario_id: '99', usuario_nombre: 'Admin Principal', accion: 'LOGIN', detalle: 'Inicio de sesión exitoso', timestamp: '2023-10-25 08:30:00', ip: '192.168.1.1' },
  { id: '2', usuario_id: '99', usuario_nombre: 'Admin Principal', accion: 'UPDATE_SOCIO', detalle: 'Aprobación de socio profesional ID 4', timestamp: '2023-10-25 09:15:00', ip: '192.168.1.1' },
  { id: '3', usuario_id: '99', usuario_nombre: 'Admin Principal', accion: 'CREATE_COMERCIO', detalle: 'Alta de comercio "Veterinaria San Roque"', timestamp: '2023-10-24 16:45:00', ip: '192.168.1.15' },
];

export const mockRevenueData = [
  { name: 'May', value: 3500000 },
  { name: 'Jun', value: 3800000 },
  { name: 'Jul', value: 4200000 },
  { name: 'Ago', value: 4100000 },
  { name: 'Sep', value: 4500000 },
  { name: 'Oct', value: 4800000 },
];