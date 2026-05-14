import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ShareSheetProps {
  titulo: string;
  comercio: string | undefined;
  descuento: string | null;
  url: string;
  imagen?: string | null;
  onClose: () => void;
  onTrack?: (evento: string) => void;
}

export default function ShareSheet({ titulo, comercio, descuento, url, imagen, onClose, onTrack }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const texto = descuento
    ? `🎉 ¡${descuento} OFF en ${comercio || 'Sociedad Rural'}!\n📢 ${titulo}\n🔗 ${url}`
    : `🎉 Beneficio en ${comercio || 'Sociedad Rural'}!\n📢 ${titulo}\n🔗 ${url}`;

  const handleNativeShare = async () => {
    onTrack?.('share');
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: texto, url });
      } else {
        handleCopy();
      }
    } catch (_) {}
    onClose();
  };

  const handleWhatsApp = () => {
    onTrack?.('share_whatsapp');
    const encoded = encodeURIComponent(texto);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    onClose();
  };

  const handleFacebook = () => {
    onTrack?.('share_facebook');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    onClose();
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }, [url]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-[2rem] p-6 pb-10 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-stone-300 dark:bg-stone-700 mx-auto mb-5" />

          {/* Preview card */}
          {imagen && (
            <div className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800 rounded-2xl p-3 mb-5 border border-stone-100 dark:border-stone-700">
              <img src={imagen} alt={titulo} className="w-12 h-12 rounded-xl object-cover shrink-0" loading="lazy" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-tight text-stone-800 dark:text-white truncate">{titulo}</p>
                {comercio && <p className="text-[10px] text-stone-500 uppercase tracking-wider truncate">{comercio}</p>}
              </div>
            </div>
          )}

          <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4">Compartir vía</h3>

          <div className="grid grid-cols-4 gap-3 mb-5">
            {/* Compartir nativo */}
            <button
              onClick={handleNativeShare}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-[#245b31]/10 hover:bg-[#245b31]/20 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-2xl text-[#245b31]">share</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300">Compartir</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 active:scale-95 transition-all"
            >
              <span className="text-2xl">💬</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300">WhatsApp</span>
            </button>

            {/* Facebook */}
            <button
              onClick={handleFacebook}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 active:scale-95 transition-all"
            >
              <span className="text-2xl">📘</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300">Facebook</span>
            </button>

            {/* Copiar enlace */}
            <button
              onClick={handleCopy}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-2xl text-stone-600 dark:text-stone-300">{copied ? 'check_circle' : 'link'}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300">{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-black uppercase text-xs tracking-widest hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
          >
            Cancelar
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
