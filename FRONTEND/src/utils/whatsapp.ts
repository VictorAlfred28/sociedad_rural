import { sanitizePhone } from './validations';

/** Detecta móviles y tablets para abrir WhatsApp App vs Web. */
export function isMobileOrTablet(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  return /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
}

/** Normaliza teléfono para wa.me / web.whatsapp.com (solo dígitos). */
export function normalizeWhatsAppPhone(phone: string): string | null {
  const digits = sanitizePhone(phone);
  if (!digits || digits.length < 8) return null;
  return digits;
}

/** URL de WhatsApp según dispositivo. */
export function getWhatsAppUrl(phone: string, message?: string): string | null {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return null;

  const base = isMobileOrTablet()
    ? `https://wa.me/${digits}`
    : `https://web.whatsapp.com/send?phone=${digits}`;

  if (!message) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}text=${encodeURIComponent(message)}`;
}

/** Abre WhatsApp App en móvil o WhatsApp Web en desktop. */
export function openWhatsAppSmart(phone: string, message?: string): boolean {
  const url = getWhatsAppUrl(phone, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
