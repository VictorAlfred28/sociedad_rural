/**
 * usePromotionDetail — TanStack Query hook for a single promotion detail.
 * Caches per ID. Refetches in background when user revisits.
 */
import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface PromocionDetail {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descripcion_corta: string | null;
  descripcion: string | null;
  tipo: 'promocion' | 'descuento' | 'beneficio';
  precio_lista: number | null;
  precio_final: number | null;
  porcentaje_descuento: number | null;
  monto_descuento: number | null;
  valor_descuento: number | null;
  tipo_descuento: string | null;
  whatsapp: string | null;
  direccion: string | null;
  localidad: string | null;
  ubicacion: string | null;
  categoria: string | null;
  destacada: boolean;
  imagenes_secundarias: string[] | null;
  imagen_url: string | null;
  fecha_fin: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  comercio?: { nombre_apellido: string; rubro: string; municipio: string };
}

async function fetchPromotionDetail(id: string, token?: string | null): Promise<PromocionDetail> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}/api/ofertas/publicas/${id}`, { headers });
  if (!res.ok) throw new Error('Promoción no encontrada');
  const data = await res.json();
  return data.oferta;
}

export function usePromotionDetail(id: string | undefined, token?: string | null) {
  return useQuery({
    queryKey: ['promocion', id],
    queryFn: () => fetchPromotionDetail(id!, token),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
