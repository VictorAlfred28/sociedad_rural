import React, { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import { Evento } from '../components/admin/GestionEventos';
import { useAuth } from '../context/AuthContext';
import paisaje from '../assets/paisaje.png';

export default function Eventos() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [filtroMunicipio, setFiltroMunicipio] = useState<string | null>(null);

  useEffect(() => {
    if (user?.municipio) {
      setFiltroMunicipio(user.municipio);
    }
  }, [user]);

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        setLoading(true);
        const url = filtroMunicipio
          ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/eventos?municipio=${encodeURIComponent(filtroMunicipio)}`
          : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/eventos`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Error al obtener eventos');
        setEventos(data.eventos || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEventos();
  }, [filtroMunicipio]);

  const now = new Date();

  // Null-safe: eventos_sociales pueden tener fecha/hora null
  const displayedEvents = eventos.filter(ev => {
    const fechaStr = (ev as any).fecha_evento || ev.fecha;
    if (!fechaStr) return tab === 'upcoming'; // Sin fecha → siempre upcoming
    const horaStr = ev.hora || '12:00:00';
    const dateObj = new Date(fechaStr + 'T' + horaStr);
    return tab === 'upcoming' ? dateObj >= now : dateObj < now;
  });

  // Imágenes placeholder por tipo
  const getImage = (ev: Evento) => {
    if (ev.imagen_url) return ev.imagen_url;
    if (ev.tipo === 'Social') return 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?q=80&w=800&auto=format&fit=crop';
    if (ev.tipo === 'Remate') return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop';
    if (ev.tipo === 'Festival' || ev.tipo === 'Exposición') return 'https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=800&auto=format&fit=crop';
    return 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=800&auto=format&fit=crop';
  };

  // Color del badge de tipo
  const getBadgeClass = (tipo: string) => {
    if (tipo === 'Social') return 'bg-gradient-to-r from-purple-600 to-pink-600';
    if (tipo === 'Remate') return 'bg-amber-700';
    return 'bg-emerald-700';
  };

  return (
    <div className="relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 max-w-md mx-auto shadow-2xl overflow-x-hidden">
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
        <header className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-4 justify-between border-b border-stone-200/50 dark:border-stone-700/50">
          <Link to="/home" className="text-stone-800 dark:text-stone-100 flex size-10 items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-stone-800 dark:text-stone-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center font-display uppercase italic">Agenda Rural</h1>
          <div className="flex w-10 items-center justify-end">
            <button className="flex size-10 items-center justify-center rounded-full hover:bg-stone-100 transition-colors">
              <span className="material-symbols-outlined text-stone-800 dark:text-stone-100">search</span>
            </button>
          </div>
        </header>

        <div className="px-4 py-4 space-y-3">
          {filtroMunicipio && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 rounded-2xl px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                <span>Zona: <strong>{filtroMunicipio}</strong></span>
              </div>
              <button
                onClick={() => setFiltroMunicipio(null)}
                className="flex items-center justify-center size-6 rounded-full bg-emerald-100 dark:bg-emerald-800/50 hover:bg-emerald-200 transition-colors"
                title="Ver todos los municipios"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {!filtroMunicipio && user?.municipio && (
            <div className="flex items-center justify-between text-[10px] text-stone-400 font-bold uppercase tracking-widest px-1">
              <span>Todas las localidades</span>
              <button onClick={() => setFiltroMunicipio(user.municipio)} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                Ver mi zona
              </button>
            </div>
          )}

          <div className="flex h-11 items-center justify-center rounded-2xl bg-stone-200/50 dark:bg-stone-800/50 p-1 border border-stone-200/50">
            <button
              onClick={() => setTab('upcoming')}
              className={`flex-1 flex items-center justify-center h-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'upcoming' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-stone-400'}`}
            >
              Próximos
            </button>
            <button
              onClick={() => setTab('past')}
              className={`flex-1 flex items-center justify-center h-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'past' ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-stone-400'}`}
            >
              Anteriores
            </button>
          </div>
        </div>

        <main className="flex-1 px-4 space-y-5 pb-24">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
              <span className="material-symbols-outlined text-4xl animate-spin text-emerald-600">autorenew</span>
              <p className="font-bold text-xs uppercase tracking-widest">Cargando eventos...</p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200/50 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          ) : displayedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
              <span className="material-symbols-outlined text-5xl opacity-20">event_busy</span>
              <p className="font-bold text-xs uppercase tracking-widest text-center px-8 leading-relaxed">
                {tab === 'upcoming' ? 'No hay próximos eventos programados para esta zona.' : 'No hay historial de eventos finalizados.'}
              </p>
            </div>
          ) : (
            displayedEvents.map(ev => {
              // Null-safe: soporte tanto para eventos (fecha) como eventos_sociales (fecha_evento)
              const fechaStr = (ev as any).fecha_evento || ev.fecha || null;
              const dateObj = fechaStr ? new Date(fechaStr + 'T12:00:00') : null;
              const month = dateObj ? dateObj.toLocaleDateString('es-AR', { month: 'short' }) : null;
              const day = dateObj ? dateObj.toLocaleDateString('es-AR', { day: '2-digit' }) : null;
              const esSocial = ev.tipo === 'Social';
              const horaDisplay = ev.hora ? ev.hora.slice(0, 5) : null;
              const lugarDisplay = ev.lugar && ev.lugar !== 'A definir' ? ev.lugar : null;

              return (
                <div key={ev.id} className="group relative flex flex-col overflow-hidden rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 shadow-sm border border-[#e5dfce] dark:border-stone-700/50 active:scale-[0.98] transition-transform">

                  {/* Imagen del evento */}
                  <div className="relative w-full aspect-[16/9] bg-stone-200 dark:bg-stone-900 overflow-hidden">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url("${getImage(ev)}")` }}
                    ></div>
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
                              <span className="material-symbols-outlined text-[16px]">instagram</span>
                            </div>
                            <span className="font-semibold text-stone-500 dark:text-stone-400">Publicación de redes sociales</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
