import React, { useState, useEffect, useRef } from 'react';
import BottomNav from '../components/BottomNav';
import { Link, useNavigate } from 'react-router-dom';
import { Evento } from '../components/admin/GestionEventos';
import { useAuth } from '../context/AuthContext';
import paisaje from '../assets/paisaje.png';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'eventos_filtro_municipio';
let cachedEventos: Evento[] | null = null;
let cachedTab: 'upcoming' | 'past' = 'upcoming';

export default function Eventos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>(cachedEventos || []);
  const [loading, setLoading] = useState(!cachedEventos);
  const [error, setError] = useState('');
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>(cachedTab);
  const [filtroMunicipio, setFiltroMunicipio] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY) || null
  );
  const [municipiosList, setMunicipiosList] = useState<{id: string, nombre: string}[]>([]);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const autoRetried = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (user?.municipio && !localStorage.getItem(STORAGE_KEY)) {
      setFiltroMunicipioSynced(user.municipio);
    }
  }, [user]);

  useEffect(() => {
    const fetchMunicipios = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`);
        const data = await res.json();
        setMunicipiosList(data.municipios || []);
      } catch (err) {
        console.error('Error fetching municipios', err);
      }
    };
    fetchMunicipios();
  }, []);

  const setFiltroMunicipioSynced = (val: string | null) => {
    setFiltroMunicipio(val);
    if (val) localStorage.setItem(STORAGE_KEY, val);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const handleClearFilter = () => {
    setFiltroMunicipioSynced(null);
    if (window.scrollY > 200) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        if (eventos.length === 0) setLoading(true);
        const url = filtroMunicipio
          ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/eventos?municipio=${encodeURIComponent(filtroMunicipio)}`
          : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/eventos`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Error al obtener eventos');
        setEventos(data.eventos || []);
        cachedEventos = data.eventos || [];
        autoRetried.current = false;
        setIsAutoRetrying(false);
      } catch (err: any) {
        if (!autoRetried.current) {
          autoRetried.current = true;
          setIsAutoRetrying(true);
          setError('');
          setTimeout(() => {
            setIsAutoRetrying(false);
            setFetchTrigger(t => t + 1);
          }, 1500);
        } else {
          setIsAutoRetrying(false);
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchEventos();
  }, [filtroMunicipio, fetchTrigger]);

  const handleRetry = () => {
    autoRetried.current = true;
    setError('');
    setIsAutoRetrying(false);
    setFetchTrigger(t => t + 1);
  };

  const now = new Date();

  const displayedEvents = eventos.filter(ev => {
    const fechaStr = (ev as any).fecha_evento || ev.fecha;
    if (!fechaStr) return tab === 'upcoming'; 
    const horaStr = ev.hora || '12:00:00';
    const dateObj = new Date(fechaStr + 'T' + horaStr);
    return tab === 'upcoming' ? dateObj >= now : dateObj < now;
  });

  const getImage = (ev: Evento) => {
    if (ev.imagen_url) return ev.imagen_url;
    if (ev.tipo === 'Social') return 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?q=80&w=800&auto=format&fit=crop';
    if (ev.tipo === 'Remate') return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop';
    if (ev.tipo === 'Festival' || ev.tipo === 'Exposición') return 'https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=800&auto=format&fit=crop';
    return 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=800&auto=format&fit=crop';
  };

  const getBadgeClass = (tipo: string) => {
    if (tipo === 'Social') return 'bg-gradient-to-r from-purple-600 to-pink-600';
    if (tipo === 'Remate') return 'bg-amber-700';
    return 'bg-emerald-700';
  };

  return (
    <div className={`relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 overflow-x-hidden ${isNative ? 'max-w-md mx-auto shadow-2xl' : 'w-full'}`}>
      {/* Fondo sutil */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url(${paisaje})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      ></div>

      <div className="relative z-10 flex-1 flex flex-col">
        <header className={`sticky top-0 z-50 flex items-center bg-white/80 dark:bg-stone-900/80 backdrop-blur-md justify-between border-b border-stone-200/50 dark:border-stone-700/50 ${isNative ? 'p-4' : 'px-8 py-4'}`}>
          <Link to="/home" className="text-stone-800 dark:text-stone-100 flex size-10 items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-stone-800 dark:text-stone-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center font-display uppercase italic">Agenda Rural</h1>
          <div className="flex w-10 items-center justify-end">
          </div>
        </header>

        <div className="px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 px-1">
              Filtrar por localidad
            </label>
            <div className="relative">
              <select
                value={filtroMunicipio || ''}
                onChange={(e) => setFiltroMunicipioSynced(e.target.value || null)}
                className="w-full appearance-none bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 rounded-2xl px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
              >
                <option value="">Todas las localidades</option>
                {municipiosList.map(m => (
                  <option key={m.id} value={m.nombre}>{m.nombre}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600 dark:text-emerald-400">
                expand_more
              </span>
            </div>
          </div>

          <div className="flex h-11 items-center justify-center rounded-2xl bg-stone-200/50 dark:bg-stone-800/50 p-1 border border-stone-200/50">
            <button
              onClick={() => { setTab('upcoming'); cachedTab = 'upcoming'; }}
              className={`flex-1 flex items-center justify-center h-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'upcoming' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-stone-400'}`}
            >
              Próximos
            </button>
            <button
              onClick={() => { setTab('past'); cachedTab = 'past'; }}
              className={`flex-1 flex items-center justify-center h-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'past' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-stone-400'}`}
            >
              Anteriores
            </button>
          </div>
        </div>

        <main className="flex-1 px-4 space-y-5 pb-24">
          {loading || isAutoRetrying ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
              <span className="material-symbols-outlined text-4xl animate-spin text-emerald-600">autorenew</span>
              <p className="font-bold text-xs uppercase tracking-widest">
                {isAutoRetrying ? 'Reintentando...' : 'Cargando eventos...'}
              </p>
              {isAutoRetrying && (
                <p className="text-[10px] text-stone-300 dark:text-stone-600">
                  Verificando conexión
                </p>
              )}
            </div>
          ) : error ? (
            /* CASO 4 — Error de red o backend (falló el auto-retry) */
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="size-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-amber-500">wifi_off</span>
              </div>
              <div className="text-center px-8 space-y-2">
                <p className="font-bold text-sm text-stone-700 dark:text-stone-300">
                  No pudimos cargar los eventos en este momento
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                  Intentá nuevamente en unos segundos
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-800 active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Reintentar
              </button>
            </div>
          ) : displayedEvents.length === 0 ? (
            /* CASOS 1, 2, 3 — Sin resultados (con o sin filtro) */
            <div className="flex flex-col items-center justify-center py-20 gap-5 col-span-full">
              <div className="size-16 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-stone-300 dark:text-stone-600">
                  {tab === 'upcoming' ? 'event_upcoming' : 'event_busy'}
                </span>
              </div>
              <div className="text-center px-8 space-y-2">
                {filtroMunicipio ? (
                  /* CASO 2 — Filtro de municipio sin resultados */
                  <>
                    <p className="font-bold text-sm text-stone-700 dark:text-stone-300">
                      No hay {tab === 'upcoming' ? 'próximos' : 'eventos pasados'} para {filtroMunicipio}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                      Podés explorar otros municipios o ver todos los eventos
                    </p>
                    <button
                      onClick={handleClearFilter}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">public</span>
                      Ver todos los municipios
                    </button>
                  </>
                ) : (
                  /* CASO 1 — Sin eventos en absoluto */
                  <>
                    <p className="font-bold text-sm text-stone-700 dark:text-stone-300">
                      {tab === 'upcoming'
                        ? 'No hay eventos disponibles en este momento'
                        : 'No hay historial de eventos finalizados'}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                      {tab === 'upcoming'
                        ? 'Pronto se publicarán nuevas actividades y novedades'
                        : 'Los eventos pasados aparecerán aquí una vez que hayan finalizado'}
                    </p>
                    {/* CASO 3 — Mensaje dinámico según municipios disponibles */}
                    {tab === 'upcoming' && (
                      <p className="mt-4 text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                        {municipiosList.length > 0
                          ? 'Próximamente se sumarán eventos locales de cada municipio'
                          : 'Próximamente se incorporarán nuevas localidades y eventos'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={isNative ? 'flex flex-col space-y-5' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto w-full'}>
              {displayedEvents.map(ev => {
                // Null-safe: soporte tanto para eventos (fecha) como eventos_sociales (fecha_evento)
                const fechaStr = (ev as any).fecha_evento || ev.fecha || ((ev as any).metadata?.timestamp ? (ev as any).metadata.timestamp.split('T')[0] : null);
              const dateObj = fechaStr ? new Date(fechaStr + 'T12:00:00') : null;
              const month = dateObj ? dateObj.toLocaleDateString('es-AR', { month: 'short' }) : null;
              const day = dateObj ? dateObj.toLocaleDateString('es-AR', { day: '2-digit' }) : null;
              const esSocial = ev.tipo === 'Social';
              const horaDisplay = ev.hora ? ev.hora.slice(0, 5) : null;
              const lugarDisplay = ev.lugar && ev.lugar !== 'A definir' ? ev.lugar : null;

              return (
                <div 
                  key={ev.id} 
                  onClick={() => {
                    if (ev.slug) {
                      navigate(`/eventos/${ev.slug}`);
                    } else {
                      const link = ev.link_instagram || ev.link_facebook || ev.link_externo;
                      if (link) window.open(link, '_blank');
                    }
                  }}
                  className="group relative flex flex-col overflow-hidden rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 shadow-sm border border-[#e5dfce] dark:border-stone-700/50 hover:shadow-md cursor-pointer active:scale-[0.98] transition-all"
                >

                  {/* Imagen del evento */}
                  <div className="relative w-full aspect-[16/9] bg-stone-200 dark:bg-stone-900 overflow-hidden">
                    <img 
                      src={getImage(ev)} 
                      alt={ev.titulo}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?q=80&w=800&auto=format&fit=crop';
                        e.currentTarget.onerror = null;
                      }}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent"></div>

                    {/* Badge tipo — diferenciado para Social (Instagram/FB) */}
                    <div className={`absolute top-4 left-4 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-lg flex items-center gap-1.5 ${getBadgeClass(ev.tipo)}`}>
                      {esSocial && <span style={{ fontSize: '10px' }}>📱</span>}
                      {ev.tipo}
                    </div>

                    {/* Badge fecha — null-safe */}
                    {dateObj ? (
                      <div className="absolute top-4 right-4 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-3 py-2 rounded-2xl flex flex-col items-center shadow-lg border border-stone-200/50">
                        <span className="text-[10px] font-black text-emerald-700 leading-none uppercase tracking-tighter">{month}</span>
                        <span className="text-2xl font-black text-stone-900 dark:text-stone-100 leading-none mt-1">{day}</span>
                      </div>
                    ) : (
                      <div className="absolute top-4 right-4 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl flex flex-col items-center shadow-lg border border-stone-200/50">
                        <span className="text-[9px] font-black text-stone-400 leading-none uppercase tracking-tighter">Fecha</span>
                        <span className="text-[10px] font-black text-stone-500 dark:text-stone-400 leading-none mt-0.5">A confirmar</span>
                      </div>
                    )}
                  </div>

                  {/* Decoración vegetal */}
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 text-[#8b9172] dark:text-stone-600 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none z-0">
                    <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/>
                      <path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/>
                    </svg>
                  </div>

                  {/* Contenido */}
                  <div className="flex flex-col p-5 gap-3 relative z-10">
                    <div>
                      <h3 className="text-stone-800 dark:text-stone-100 text-lg font-bold leading-tight font-display italic pr-4 uppercase tracking-tighter">
                        {ev.titulo}
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-2 line-clamp-2 leading-relaxed">
                        {ev.descripcion}
                      </p>

                      <div className="mt-4 flex flex-col gap-2">
                        {/* Ubicación — null-safe */}
                        {lugarDisplay ? (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(lugarDisplay)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-stone-700 dark:text-stone-300 text-[11px] font-bold hover:text-emerald-700 transition-colors"
                          >
                            <div className="size-7 rounded-full bg-emerald-700/10 text-emerald-700 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[16px]">location_on</span>
                            </div>
                            <span className="underline decoration-stone-300 underline-offset-2">{lugarDisplay}</span>
                          </a>
                        ) : (
                          <div className="flex items-center gap-2 text-stone-400 text-[11px] font-bold">
                            <div className="size-7 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-400 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[16px]">location_off</span>
                            </div>
                            <span>Lugar a confirmar</span>
                          </div>
                        )}

                        {/* Horario — null-safe */}
                        {horaDisplay ? (
                          <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 text-[11px] font-bold">
                            <div className="size-7 rounded-full bg-emerald-700/10 text-emerald-700 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[16px]">schedule</span>
                            </div>
                            <span>{horaDisplay} HS</span>
                          </div>
                        ) : esSocial ? (
                          <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                            <div className="size-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-500 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                            </div>
                            <span className="font-semibold text-stone-500 dark:text-stone-400">Publicación de redes sociales</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Botones Condicionales de Redes Sociales y Links */}
                      {(ev.link_instagram || ev.link_facebook || ev.link_whatsapp || ev.link_externo) && (
                        <div className="mt-4 pt-4 border-t border-stone-200/50 dark:border-stone-700/50 flex flex-wrap gap-2">
                          {ev.link_instagram && (
                            <a href={ev.link_instagram} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-sm">
                              <span className="material-symbols-outlined text-[14px]">photo_camera</span> IG
                            </a>
                          )}
                          {ev.link_facebook && (
                            <a href={ev.link_facebook} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1877F2] text-white text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-sm">
                              <span className="material-symbols-outlined text-[14px]">thumb_up</span> FB
                            </a>
                          )}
                          {ev.link_whatsapp && (
                            <a href={ev.link_whatsapp.startsWith('http') ? ev.link_whatsapp : `https://wa.me/${ev.link_whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] text-white text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-sm">
                              <span className="material-symbols-outlined text-[14px]">chat</span> WhatsApp
                            </a>
                          )}
                          {ev.link_externo && (
                            <a href={ev.link_externo} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-sm">
                              <span className="material-symbols-outlined text-[14px]">link</span> Entradas
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
