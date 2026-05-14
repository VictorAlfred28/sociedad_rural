import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import BottomNav from '../components/BottomNav';
import ShareSheet from '../components/ShareSheet';
import BlurImage from '../components/BlurImage';
import ErrorBoundary from '../components/ErrorBoundary';
import { useAuth } from '../context/AuthContext';
import { RUBRO_COLOR, RUBRO_ICON, RUBRO_LABEL } from '../types/comercio';
import { usePromotionDetail } from '../hooks/usePromotionDetail';
import { useFavorites } from '../hooks/useFavorites';
import { useAnalytics } from '../hooks/useAnalytics';
import { useShare } from '../hooks/useShare';

// ─── Config ────────────────────────────────────────────────────────────────────
const TIPO_CFG = {
  promocion: { label: 'Promoción', icon: 'local_offer', bg: 'bg-orange-500' },
  descuento:  { label: 'Descuento',  icon: 'percent',      bg: 'bg-emerald-500' },
  beneficio:  { label: 'Beneficio',  icon: 'star',          bg: 'bg-violet-500' },
};

// ─── Component ─────────────────────────────────────────────────────────────────
export default function PromocionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  // ── Data via TanStack Query (cached, auto-retry, deduped) ─────────────────
  const { data: promocion, isLoading, isError } = usePromotionDetail(id, token);

  // ── Favoritos with optimistic updates + localStorage offline fallback ─────
  const { isFavorito, toggle: toggleFavorito, isToggling } = useFavorites(token);

  // ── Analytics (fire-and-forget, deduplicated per session) ─────────────────
  const { track } = useAnalytics(id, token);

  // ── Share (native API + ShareSheet fallback) ──────────────────────────────
  const { showSheet, setShowSheet, share } = useShare(track);

  // ── OG meta + view tracking ───────────────────────────────────────────────
  useEffect(() => {
    if (!promocion) return;

    document.title = `${promocion.titulo} | Sociedad Rural NC`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('og:type',        'website');
    setMeta('og:title',       promocion.titulo);
    setMeta('og:description', promocion.descripcion_corta || promocion.titulo);
    setMeta('og:url',         window.location.href);
    if (promocion.imagen_url) setMeta('og:image', promocion.imagen_url);

    track('view');

    return () => { document.title = 'Sociedad Rural Norte de Corrientes'; };
  }, [promocion]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenWhatsApp = () => {
    if (!promocion?.whatsapp) return;
    const numero = promocion.whatsapp.replace(/\D/g, '');
    if (numero) { track('whatsapp_click'); window.open(`https://wa.me/${numero}`, '_blank'); }
  };

  const handleOpenInstagram = () => {
    if (!promocion?.instagram_url) return;
    track('instagram_click');
    window.open(promocion.instagram_url, '_blank');
  };

  const handleOpenMap = () => {
    if (!promocion) return;
    const term = promocion.direccion
      ? `${promocion.comercio?.nombre_apellido} ${promocion.direccion} ${promocion.localidad || promocion.comercio?.municipio}`
      : `${promocion.comercio?.nombre_apellido} ${promocion.localidad || promocion.comercio?.municipio || ''}`;
    track('maps_click');
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term)}`, '_blank');
  };

  const descuentoLabel = promocion?.valor_descuento
    ? `${promocion.valor_descuento}${promocion.tipo_descuento === 'fijo' ? '$' : '%'}`
    : null;

  // ─── SKELETON ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-900 max-w-[1400px] mx-auto animate-pulse">
        <div className="h-72 shrink-0 bg-stone-200 dark:bg-stone-800 rounded-b-[2.5rem] w-full" />
        <div className="px-5 pt-6 flex-1 max-w-3xl mx-auto w-full space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-stone-200 dark:bg-stone-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-1/3" />
              <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-1/4" />
            </div>
          </div>
          <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded w-3/4" />
          <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-1/2" />
          <div className="space-y-2">
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-full" />
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-5/6" />
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-4/6" />
          </div>
          <div className="h-20 bg-stone-200 dark:bg-stone-800 rounded-2xl w-full" />
          <div className="h-12 bg-stone-200 dark:bg-stone-800 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  // ─── ERROR / NOT FOUND ────────────────────────────────────────────────────────
  if (isError || !promocion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 max-w-[1400px] mx-auto p-8 text-center">
        <span className="material-symbols-outlined text-7xl text-stone-300 mb-4">sentiment_dissatisfied</span>
        <h2 className="text-xl font-black uppercase tracking-tight font-display mb-2">Promoción no encontrada</h2>
        <p className="text-stone-400 text-sm mb-6">Es posible que haya sido removida o ya no esté disponible.</p>
        <button onClick={() => navigate(-1)} className="px-8 py-3 bg-[#245b31] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">
          Volver
        </button>
      </div>
    );
  }

  // ─── DERIVED ──────────────────────────────────────────────────────────────────
  const cfg        = TIPO_CFG[promocion.tipo || 'promocion'];
  const rubro      = promocion.categoria || promocion.comercio?.rubro || 'otro';
  const rubroColor = RUBRO_COLOR[rubro] || 'bg-stone-500';
  const rubroIcon  = RUBRO_ICON[rubro]  || 'storefront';
  const rubroLabel = RUBRO_LABEL[rubro] || rubro;
  const isVencida  = promocion.fecha_fin ? new Date() > new Date(promocion.fecha_fin + 'T23:59:59') : false;
  const favActive  = isFavorito(promocion.id);

  const shareData = {
    titulo: promocion.titulo,
    comercio: promocion.comercio?.nombre_apellido,
    descuento: descuentoLabel,
    url: window.location.href,
    imagen: promocion.imagen_url,
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary context="PromocionDetalle">
      {showSheet && (
        <ShareSheet
          titulo={shareData.titulo}
          comercio={shareData.comercio}
          descuento={shareData.descuento}
          url={shareData.url}
          imagen={shareData.imagen}
          onClose={() => setShowSheet(false)}
          onTrack={track}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 max-w-[1400px] mx-auto shadow-2xl overflow-x-hidden"
      >
        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <div className={`relative h-72 shrink-0 rounded-b-[2.5rem] overflow-hidden shadow-sm ${isVencida ? 'grayscale opacity-80' : ''}`}>
          {promocion.imagen_url ? (
            <BlurImage src={promocion.imagen_url} alt={promocion.titulo} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-stone-700 via-stone-800 to-stone-900 text-stone-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20" />
              <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full opacity-40 ${cfg.bg}`} />
              <div className={`absolute bottom-0 left-0 w-48 h-48 blur-[60px] rounded-full opacity-30 ${cfg.bg}`} />
              <span className="material-symbols-outlined text-8xl opacity-80 z-10" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
              <span className="mt-4 text-xs font-black uppercase tracking-widest opacity-60 z-10">{cfg.label} Institucional</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent pointer-events-none" />

          {/* Volver */}
          <button onClick={() => navigate(-1)} className="absolute top-4 left-4 size-10 rounded-2xl bg-white/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm z-10 active:scale-95">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          {/* Favorito + Compartir */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={() => toggleFavorito(promocion.id)}
              disabled={isToggling}
              className={`size-10 rounded-2xl backdrop-blur-md flex items-center justify-center transition-all active:scale-95 shadow-sm ${favActive ? 'bg-red-500 text-white' : 'bg-white/30 text-white hover:bg-white/40'}`}
              title={favActive ? 'Quitar de favoritos' : 'Guardar favorito'}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: favActive ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
            </button>
            <button
              onClick={() => share(shareData)}
              className="size-10 rounded-2xl bg-white/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
            </button>
          </div>

          {/* Badges */}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-10">
            {isVencida && (
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg bg-red-600 text-white backdrop-blur-md flex items-center gap-1 animate-pulse">
                <span className="material-symbols-outlined text-[12px]">timer_off</span> Vencida
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm bg-white/90 text-stone-800 backdrop-blur-md">{cfg.label}</span>
            {promocion.destacada && (
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm bg-amber-400 text-amber-900 backdrop-blur-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">star</span> Destacada
              </span>
            )}
          </div>
        </div>

        {/* ── MAIN ────────────────────────────────────────────────────────────── */}
        <main className={`flex-1 px-5 pt-6 pb-28 max-w-3xl mx-auto w-full ${isVencida ? 'opacity-80' : ''}`}>

          {/* COMERCIO HEADER */}
          <div className="flex items-center gap-4 mb-5">
            <div className={`size-14 rounded-full ${rubroColor} flex items-center justify-center shadow-md border-2 border-white dark:border-stone-800 shrink-0`}>
              <span className="material-symbols-outlined text-white text-2xl">{rubroIcon}</span>
            </div>
            <div>
              <h1 className="text-[11px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">{promocion.comercio?.nombre_apellido}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${rubroColor.replace('bg-', 'text-')} bg-opacity-10 border-current opacity-80`}>{rubroLabel}</span>
                {(promocion.localidad || promocion.comercio?.municipio) && (
                  <span className="text-[10px] font-bold text-stone-400 flex items-center gap-0.5 uppercase">
                    <span className="material-symbols-outlined text-[12px]">location_on</span>
                    {promocion.localidad || promocion.comercio?.municipio}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TÍTULO + PRECIOS */}
          <div className="mb-6">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-tight mb-2 text-stone-800 dark:text-white">{promocion.titulo}</h2>
            {promocion.subtitulo && <p className="text-sm font-bold text-stone-500 dark:text-stone-400 mb-3 uppercase tracking-tight">{promocion.subtitulo}</p>}
            {(promocion.precio_final || promocion.valor_descuento || promocion.precio_lista) && (
              <div className="flex flex-wrap items-end gap-3 mt-4">
                {(promocion.precio_final || promocion.valor_descuento) && (
                  <div className="text-3xl font-black text-[#245b31] dark:text-emerald-400 leading-none">
                    {promocion.precio_final ? `$${promocion.precio_final}` : `-${descuentoLabel}`}
                  </div>
                )}
                {promocion.precio_lista && <div className="text-sm font-bold text-stone-400 line-through mb-1">${promocion.precio_lista}</div>}
                {promocion.monto_descuento && (
                  <div className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-black uppercase tracking-widest mb-1">
                    Ahorrás ${promocion.monto_descuento}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-px w-full bg-stone-200 dark:bg-stone-800 mb-6" />

          {/* DESCRIPCIÓN */}
          {promocion.descripcion_corta && <p className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-4 leading-relaxed">{promocion.descripcion_corta}</p>}
          {promocion.descripcion && <div className="prose dark:prose-invert max-w-none text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-6 whitespace-pre-wrap">{promocion.descripcion}</div>}

          {/* INFO CARD */}
          {(promocion.fecha_fin || promocion.direccion || promocion.localidad || promocion.comercio?.municipio) && (
            <div className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border border-stone-100 dark:border-stone-700/50 mb-6 flex flex-col gap-3">
              {promocion.fecha_fin && (
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">event</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Válido hasta</p>
                    <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      {new Date(promocion.fecha_fin).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
              {(promocion.direccion || promocion.localidad || promocion.comercio?.municipio) && (
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ubicación</p>
                    <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      {promocion.direccion ? `${promocion.direccion}, ` : ''}{promocion.localidad || promocion.comercio?.municipio}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GALERÍA */}
          {promocion.imagenes_secundarias && promocion.imagenes_secundarias.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 italic">Galería</h3>
              <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-hide">
                {promocion.imagenes_secundarias.map((img, idx) => (
                  <div key={idx} className="shrink-0 w-40 h-28 rounded-xl overflow-hidden snap-center shadow-sm">
                    <BlurImage src={img} alt={`Imagen ${idx + 1}`} className="w-full h-full" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTACTO */}
          <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 italic">Contactar Comercio</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {!isVencida && promocion.whatsapp && (
              <button onClick={handleOpenWhatsApp} className="col-span-2 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20b958] text-white font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-95">
                <span className="material-symbols-outlined text-lg">chat</span>Contactar por WhatsApp
              </button>
            )}
            {promocion.instagram_url && (
              <button onClick={handleOpenInstagram} className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-95 ${!promocion.facebook_url ? 'col-span-2' : ''}`}>
                <span className="material-symbols-outlined text-lg">photo_camera</span>Instagram
              </button>
            )}
            {promocion.facebook_url && (
              <a href={promocion.facebook_url} target="_blank" rel="noreferrer" className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-95 ${!promocion.instagram_url ? 'col-span-2' : ''}`}>
                <span className="material-symbols-outlined text-lg">thumb_up</span>Facebook
              </a>
            )}
            <button onClick={handleOpenMap} className="col-span-2 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-95 hover:bg-stone-50 dark:hover:bg-stone-700">
              <span className="material-symbols-outlined text-lg">map</span>Ver en Mapa
            </button>
          </div>

          {/* COMPARTIR BANNER */}
          <button onClick={() => share(shareData)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 font-black uppercase text-xs tracking-widest transition-all active:scale-95 hover:border-[#245b31]/40 hover:text-[#245b31] dark:hover:text-emerald-400">
            <span className="material-symbols-outlined text-lg">share</span>Compartir esta promoción
          </button>

        </main>
        <BottomNav />
      </motion.div>
    </ErrorBoundary>
  );
}
