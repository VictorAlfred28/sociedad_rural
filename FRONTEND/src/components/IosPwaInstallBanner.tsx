import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  IOS_INSTALL_BANNER_DISMISSED_KEY,
  shouldShowIosInstallBanner,
} from '../utils/pwaInstall';

export default function IosPwaInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!shouldShowIosInstallBanner()) return;
    if (localStorage.getItem(IOS_INSTALL_BANNER_DISMISSED_KEY) === '1') return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(IOS_INSTALL_BANNER_DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-[90] md:left-auto md:right-4 md:max-w-sm"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-2xl border border-[#00c853]/30 bg-stone-900/95 text-white shadow-xl backdrop-blur-md px-4 py-3 flex gap-3 items-start">
        <span className="material-symbols-outlined text-[#00c853] text-xl shrink-0 mt-0.5" aria-hidden>
          ios_share
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-snug">
            Para instalar la app, tocá{' '}
            <span className="text-[#00c853]">compartir</span> y luego{' '}
            <span className="text-[#00c853]">&quot;Agregar a pantalla de inicio&quot;</span>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 size-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          aria-label="Cerrar aviso de instalación"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}
