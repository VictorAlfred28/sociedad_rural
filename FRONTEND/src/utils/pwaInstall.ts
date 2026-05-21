/** Safari en iOS (no Chrome/Firefox iOS, no app instalada). */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isSafari;
}

/** PWA abierta desde pantalla de inicio (iOS: navigator.standalone). */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export function shouldShowIosInstallBanner(): boolean {
  return isIosSafari() && !isPwaStandalone();
}

export const IOS_INSTALL_BANNER_DISMISSED_KEY = 'pwa_ios_install_banner_dismissed';
