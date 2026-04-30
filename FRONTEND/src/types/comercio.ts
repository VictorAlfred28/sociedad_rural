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

export const RUBROS_COMERCIO = [
  { value: "agropecuario", label: "Agropecuario" },
  { value: "veterinaria", label: "Veterinaria" },
  { value: "maquinaria_agricola", label: "Maquinaria Agrícola" },
  { value: "insumos_agricolas", label: "Insumos Agrícolas" },
  { value: "alimentacion", label: "Alimentación" },
  { value: "construccion", label: "Construcción" },
  { value: "transporte", label: "Transporte" },
  { value: "vestimentas", label: "Vestimentas e Indumentarias" },
  { value: "gurises", label: "Gurises (Ropa y Art. Infantiles)" },
  { value: "servicios_profesionales", label: "Servicios Profesionales" },
  { value: "comercio_general", label: "Comercio General" },
  { value: "otro", label: "Otro" }
];
