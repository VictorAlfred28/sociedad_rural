export interface ComercioDTO {
  nombre_comercio: string;
  cuit: string;
  email: string;
  telefono: string;
  rubro: string;
  direccion: string;
  municipio: string;
  provincia?: string;
  password?: string;
  barrio?: string;
}

/**
 * FUENTE ÚNICA DE CATEGORÍAS DE COMERCIO
 * Usar este array en TODO el proyecto: formularios, filtros, selects, búsquedas.
 * Valores (value) deben coincidir con los usados en Supabase/backend.
 */
export const RUBROS_COMERCIO = [
  { value: "agropecuario",           label: "Agropecuario" },
  { value: "veterinaria",            label: "Veterinaria" },
  { value: "maquinaria_agricola",    label: "Maquinaria Agrícola" },
  { value: "insumos_agricolas",      label: "Insumos Agrícolas" },
  { value: "alimentacion",           label: "Alimentación" },
  { value: "combustible",            label: "Combustible" },
  { value: "construccion",           label: "Construcción" },
  { value: "transporte",             label: "Transporte" },
  { value: "vestimentas",            label: "Vestimentas e Indumentarias" },
  { value: "gurises",                label: "Gurises (Ropa y Art. Infantiles)" },
  { value: "servicios",              label: "Servicios Generales" },
  { value: "socios_profesionales",   label: "Socios Profesionales" },
  { value: "comercio_general",       label: "Comercio General" },
  { value: "otro",                   label: "Otro" },
];

/** Mapa de icono Material Symbols por rubro */
export const RUBRO_ICON: Record<string, string> = {
  agropecuario:        'agriculture',
  veterinaria:         'vaccines',
  maquinaria_agricola: 'precision_manufacturing',
  insumos_agricolas:   'science',
  alimentacion:        'restaurant',
  combustible:         'local_gas_station',
  construccion:        'construction',
  transporte:          'local_shipping',
  vestimentas:         'checkroom',
  gurises:             'child_care',
  servicios:           'handyman',
  socios_profesionales:'work',
  comercio_general:    'storefront',
  otro:                'category',
};

/** Mapa de color Tailwind por rubro */
export const RUBRO_COLOR: Record<string, string> = {
  agropecuario:        'bg-lime-500',
  veterinaria:         'bg-cyan-500',
  maquinaria_agricola: 'bg-orange-500',
  insumos_agricolas:   'bg-emerald-500',
  alimentacion:        'bg-amber-500',
  combustible:         'bg-red-600',
  construccion:        'bg-stone-500',
  transporte:          'bg-blue-500',
  vestimentas:         'bg-pink-500',
  gurises:             'bg-yellow-500',
  servicios:           'bg-cyan-600',
  socios_profesionales:'bg-violet-500',
  comercio_general:    'bg-rose-500',
  otro:                'bg-slate-500',
};

/** Label legible por rubro */
export const RUBRO_LABEL: Record<string, string> = Object.fromEntries(
  RUBROS_COMERCIO.map(r => [r.value, r.label])
);
