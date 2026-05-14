/**
 * ComercioAnalytics — Panel simple de métricas para el comercio.
 * Muestra vistas, clics WhatsApp, Maps, Instagram, shares y favoritos
 * de los últimos 30 días. Diseño mobile-first, premium e institucional.
 */
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface PromoMetrica {
  promocion_id: string;
  titulo: string;
  imagen_url: string | null;
  activo: boolean;
  vistas: number;
  whatsapp_clicks: number;
  instagram_clicks: number;
  maps_clicks: number;
  shares: number;
  favoritos: number;
  total_interacciones: number;
}

interface Totales {
  vistas: number;
  whatsapp_clicks: number;
  instagram_clicks: number;
  maps_clicks: number;
  shares: number;
  favoritos: number;
}

interface Props {
  token: string;
  apiUrl?: string;
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Metric card config ────────────────────────────────────────────────────────
const METRIC_CONFIG = [
  { key: 'vistas',          label: 'Vistas',      icon: 'visibility',  color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'whatsapp_clicks', label: 'WhatsApp',    icon: 'chat',         color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
  { key: 'maps_clicks',     label: 'Mapa',        icon: 'map',          color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { key: 'shares',          label: 'Compartidos', icon: 'share',        color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  { key: 'favoritos',       label: 'Favoritos',   icon: 'favorite',     color: 'text-red-500 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20' },
  { key: 'instagram_clicks',label: 'Instagram',   icon: 'photo_camera', color: 'text-pink-600 dark:text-pink-400',    bg: 'bg-pink-50 dark:bg-pink-900/20' },
];

export default function ComercioAnalytics({ token }: Props) {
  const [metricas, setMetricas] = useState<PromoMetrica[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`${API}/api/ofertas/analytics/mis-metricas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setMetricas(data.metricas || []);
        setTotales(data.totales || null);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [token]);

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-pulse space-y-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-20 bg-stone-200 dark:bg-stone-700 rounded-2xl" />
          ))}
        </div>
        <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded w-1/3 mx-auto" />
        {[1,2,3].map(i => <div key={i} className="h-16 bg-stone-200 dark:bg-stone-700 rounded-2xl" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="material-symbols-outlined text-4xl text-stone-300 mb-3">bar_chart</span>
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Sin datos disponibles aún</p>
        <p className="text-[10px] text-stone-400 mt-1">Los datos aparecerán cuando los socios vean tus promociones</p>
      </div>
    );
  }

  const noData = metricas.length === 0;

  return (
    <div className="py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-stone-700 dark:text-stone-200">Estadísticas</h2>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Últimos 30 días</p>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[#245b31]/10 text-[#245b31] border border-[#245b31]/20">
          En vivo
        </span>
      </div>

      {/* Totales grid */}
      {totales && (
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {METRIC_CONFIG.map((cfg, idx) => {
            const val = totales[cfg.key as keyof Totales] || 0;
            return (
              <motion.div
                key={cfg.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`rounded-2xl p-3 text-center ${cfg.bg} border border-white/60 dark:border-stone-700/50 shadow-sm`}
              >
                <span className={`material-symbols-outlined text-xl block mb-1 ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {cfg.icon}
                </span>
                <span className="text-2xl font-black text-stone-800 dark:text-white block leading-none">{val}</span>
                <span className={`text-[9px] font-black uppercase tracking-wider ${cfg.color} mt-1 block`}>{cfg.label}</span>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Por promoción */}
      {noData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="size-16 rounded-[1.5rem] bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-4 border border-stone-200 dark:border-stone-700">
            <span className="material-symbols-outlined text-3xl text-stone-300">analytics</span>
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">Sin interacciones aún</p>
          <p className="text-[10px] text-stone-400 mt-1 max-w-[200px] leading-relaxed">Cuando los socios vean y usen tus promociones, aparecerán aquí las estadísticas</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="h-px bg-stone-200 dark:bg-stone-700 flex-1" />
            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Por Promoción</span>
            <div className="h-px bg-stone-200 dark:bg-stone-700 flex-1" />
          </div>

          <div className="space-y-2.5">
            {metricas.map((m, idx) => (
              <motion.div
                key={m.promocion_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.06 }}
                className="bg-white dark:bg-stone-800 rounded-2xl p-3.5 border border-stone-100 dark:border-stone-700/50 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  {/* Thumbnail */}
                  <div className="size-10 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-700 shrink-0 border border-stone-200 dark:border-stone-600">
                    {m.imagen_url ? (
                      <img src={m.imagen_url} alt={m.titulo} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg text-stone-400">local_offer</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-tight text-stone-800 dark:text-white truncate">{m.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${m.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'}`}>
                        {m.activo ? 'Activa' : 'Inactiva'}
                      </span>
                      <span className="text-[9px] text-stone-400 font-bold">{m.total_interacciones} interacciones</span>
                    </div>
                  </div>
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { val: m.vistas,          icon: 'visibility',   color: 'text-blue-500' },
                    { val: m.whatsapp_clicks,  icon: 'chat',         color: 'text-green-500' },
                    { val: m.maps_clicks,      icon: 'map',          color: 'text-orange-500' },
                    { val: m.shares,           icon: 'share',        color: 'text-violet-500' },
                    { val: m.favoritos,        icon: 'favorite',     color: 'text-red-500' },
                  ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5 bg-stone-50 dark:bg-stone-700/50 rounded-xl py-1.5">
                      <span className={`material-symbols-outlined text-[14px] ${stat.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
                      <span className="text-[10px] font-black text-stone-700 dark:text-stone-200">{stat.val}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
