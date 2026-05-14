/**
 * useShare — Cross-platform sharing hook.
 * Supports: Capacitor native, navigator.share() web API, clipboard fallback.
 * Tracks analytics on share events.
 */
import { useCallback, useState } from 'react';

export interface ShareData {
  titulo: string;
  comercio?: string;
  descuento?: string | null;
  url: string;
  imagen?: string | null;
}

export function useShare(onTrack?: (evento: string) => void) {
  const [isSharing, setIsSharing] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const buildText = (data: ShareData): string => {
    const parts: string[] = [];
    if (data.descuento) parts.push(`🎉 ¡${data.descuento} OFF en ${data.comercio || 'Sociedad Rural'}!`);
    else parts.push(`🎉 Beneficio en ${data.comercio || 'Sociedad Rural NC'}`);
    parts.push(`📢 ${data.titulo}`);
    parts.push(`🔗 ${data.url}`);
    return parts.join('\n');
  };

  /** Attempt native share; opens ShareSheet if not available on desktop */
  const share = useCallback(async (data: ShareData) => {
    setIsSharing(true);
    onTrack?.('share');

    try {
      if (navigator.share) {
        await navigator.share({
          title: data.titulo,
          text: buildText(data),
          url: data.url,
        });
      } else {
        // Desktop fallback: open custom sheet
        setShowSheet(true);
      }
    } catch (err: any) {
      // AbortError = user cancelled, not a real error
      if (err?.name !== 'AbortError') {
        setShowSheet(true);
      }
    } finally {
      setIsSharing(false);
    }
  }, [onTrack]);

  const copyLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  const shareToWhatsApp = useCallback((data: ShareData) => {
    onTrack?.('share_whatsapp');
    const text = encodeURIComponent(buildText(data));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [onTrack]);

  const shareToFacebook = useCallback((url: string) => {
    onTrack?.('share_facebook');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  }, [onTrack]);

  return {
    share,
    copyLink,
    shareToWhatsApp,
    shareToFacebook,
    isSharing,
    showSheet,
    setShowSheet,
  };
}
