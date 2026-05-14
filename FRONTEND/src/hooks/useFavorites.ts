/**
 * useFavorites — Manages user favorites with optimistic updates.
 * Uses TanStack Query for cache management + localStorage fallback for offline.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LS_KEY = 'srnc_favoritos_cache';

function readLocalFavoritos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocalFavoritos(ids: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {}
}

async function fetchFavoritos(token: string): Promise<string[]> {
  const res = await fetch(`${API}/api/ofertas/favoritos/lista`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return readLocalFavoritos();
  const data = await res.json();
  const ids = data.favoritos as string[];
  writeLocalFavoritos(ids);
  return ids;
}

async function toggleFavoritoApi(id: string, token: string): Promise<{ es_favorito: boolean }> {
  const res = await fetch(`${API}/api/ofertas/${id}/favoritos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Error al actualizar favorito');
  return res.json();
}

export function useFavorites(token: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['favoritos', token],
    queryFn: () => fetchFavoritos(token!),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: () => (token ? readLocalFavoritos() : []),
  });

  const mutation = useMutation({
    mutationFn: (id: string) => toggleFavoritoApi(id, token!),
    // Optimistic update — instant UI feedback
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['favoritos', token] });
      const prev = queryClient.getQueryData<string[]>(['favoritos', token]) || [];
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      queryClient.setQueryData(['favoritos', token], next);
      writeLocalFavoritos(next);
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      // Rollback on error
      if (ctx?.prev) {
        queryClient.setQueryData(['favoritos', token], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favoritos', token] });
    },
  });

  const isFavorito = (id: string) => (query.data || []).includes(id);

  return {
    favoritos: query.data || [],
    isFavorito,
    toggle: (id: string) => {
      if (!token) return;
      mutation.mutate(id);
    },
    isToggling: mutation.isPending,
    isLoading: query.isLoading,
  };
}
