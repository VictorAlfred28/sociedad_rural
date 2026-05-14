/**
 * useAnalytics — Fire-and-forget analytics tracker.
 * Debounces "view" events to avoid spam. Deduplicates events per session.
 * NON-BLOCKING: never awaited in UI, never throws to user.
 */
import { useCallback, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** In-memory set of events fired this session to prevent duplicates */
const firedEvents = new Set<string>();

export function useAnalytics(promocionId: string | undefined, token?: string | null) {
  const viewFiredRef = useRef(false);

  const track = useCallback((tipo_evento: string) => {
    if (!promocionId) return;

    const eventKey = `${promocionId}:${tipo_evento}`;

    // Deduplicate non-click events (views) per session
    if (tipo_evento === 'view') {
      if (viewFiredRef.current) return;
      viewFiredRef.current = true;
    }

    // Deduplicate all events per session (clicks can fire multiple times per promo, but not per page load)
    if (firedEvents.has(eventKey)) return;
    firedEvents.add(eventKey);

    // Fire-and-forget — never blocks UI
    void fetch(`${API}/api/ofertas/${promocionId}/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tipo_evento, comercio_id: promocionId }),
    }).catch(() => {
      // Silent failure — analytics must never break UX
      firedEvents.delete(eventKey);
    });
  }, [promocionId, token]);

  return { track };
}
