/**
 * usePromotions — TanStack Query hook for public promotions list.
 * Caches for 5 min, deduplicates concurrent requests, retries automatically.
 */
import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Oferta {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: 'promocion' | 'descuento' | 'beneficio';
  valor_descuento: number | null;
  tipo_descuento: string | null;
  fecha_fin: string | null;
  imagen_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  created_at?: string;
  destacada?: boolean;
  comercio?: { nombre_apellido: string; rubro: string; municipio: string };
}

export interface Comercio {
  id: string;
  nombre_apellido: string;
  rubro: string;
  municipio: string;
  telefono: string;
}

export interface Municipio {
  id: string;
  nombre: string;
}

async function fetchPublicOfertas(): Promise<Oferta[]> {
  const res = await fetch(`${API}/api/ofertas/publicas`);
  if (!res.ok) throw new Error('Error cargando promociones');
  const data = await res.json();
  return data.ofertas || [];
}

async function fetchComercios(): Promise<Comercio[]> {
  const res = await fetch(`${API}/api/comercios`);
  if (!res.ok) throw new Error('Error cargando comercios');
  const data = await res.json();
  return data.comercios || [];
}

async function fetchMunicipios(): Promise<Municipio[]> {
  const res = await fetch(`${API}/api/municipios`);
  if (!res.ok) throw new Error('Error cargando municipios');
  const data = await res.json();
  const list = data.municipios || [];
  return [...list].sort((a: Municipio, b: Municipio) => a.nombre.localeCompare(b.nombre));
}

async function fetchProfesionales() {
  const res = await fetch(`${API}/api/profesionales`);
  if (!res.ok) throw new Error('Error cargando profesionales');
  const data = await res.json();
  return data.profesionales || [];
}

/** Cached list of public promotions — staleTime 5 min */
export function useOfertas() {
  return useQuery({
    queryKey: ['ofertas-publicas'],
    queryFn: fetchPublicOfertas,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/** Cached list of comercios — staleTime 10 min (changes rarely) */
export function useComercios() {
  return useQuery({
    queryKey: ['comercios'],
    queryFn: fetchComercios,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
  });
}

/** Cached list of municipios — staleTime 30 min (rarely changes) */
export function useMunicipios() {
  return useQuery({
    queryKey: ['municipios'],
    queryFn: fetchMunicipios,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

/** Lazy-loaded profesionales — only fetches once enabled */
export function useProfesionales(enabled = true) {
  return useQuery({
    queryKey: ['profesionales'],
    queryFn: fetchProfesionales,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    enabled,
    retry: 2,
  });
}
