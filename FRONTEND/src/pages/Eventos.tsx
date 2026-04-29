import React, { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import { Evento } from '../components/admin/GestionEventos';
import { useAuth } from '../context/AuthContext';

export default function Eventos() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [filtroMunicipio, setFiltroMunicipio] = useState<string | null>(null);

  useEffect(() => {
    // Si el usuario tiene municipio al cargar, seteamos el filtro
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
  const displayedEvents = eventos.filter(ev => {
    const dateObj = new Date(ev.fecha + 'T' + ev.hora);
    return tab === 'upcoming' ? dateObj >= now : dateObj < now;
  });

  // Random placeholder images depending on the event type
  const getImage = (ev: Evento) => {
    if (ev.imagen_url) return ev.imagen_url;
    if (ev.tipo === 'Remate') return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop';
    if (ev.tipo === 'Festival' || ev.tipo === 'Exposición') return 'https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=800&auto=format&fit=crop';
    return 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=800&auto=format&fit=crop';
  };

  return (
    <div className="relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 max-w-md mx-auto shadow-2xl overflow-x-hidden">
      {/* Fondo con imagen sutil de ganadería/campo */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: "url('/src/assets/vaquita.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      ></div>
      <div className="relative z-10 flex-1 flex flex-col">
      <header className="sticky top-0 z-50 flex items-center bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-md p-4 justify-between border-b border-emerald-600/10">
        <Link to="/home" className="text-slate-900 dark:text-slate-100 flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center">Eventos y Remates</h1>
        <div className="flex w-10 items-center justify-end">
          <button className="flex size-10 items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-slate-900 dark:text-slate-100">search</span>
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {filtroMunicipio && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary">
            <div className="flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span>Mostrando en: <strong>{filtroMunicipio}</strong></span>
            </div>
            <button
              onClick={() => setFiltroMunicipio(null)}
              className="flex items-center justify-center size-6 rounded-md hover:bg-primary/20 transition-colors"
              title="Ver todos los municipios"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {!filtroMunicipio && user?.municipio && (
          <div className="flex items-center justify-between text-xs text-slate-500 italic pb-1">
            <span>Mostrando todos los municipios</span>
            <button onClick={() => setFiltroMunicipio(user.municipio)} className="text-primary hover:underline font-medium">
              Filtrar por mi municipio
            </button>
          </div>
        )}

        <div className="flex h-12 items-center justify-center rounded-xl bg-slate-200/50 dark:bg-slate-800/50 p-1 border border-primary/5">

          <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-[:checked]:bg-white dark:has-[:checked]:bg-slate-700 has-[:checked]:shadow-sm has-[:checked]:text-primary text-slate-600 dark:text-slate-400 text-sm font-semibold transition-all">
            <span>Próximos</span>
            <input
              checked={tab === 'upcoming'}
              onChange={() => setTab('upcoming')}
              className="hidden" name="event-toggle" type="radio" value="upcoming"
            />
          </label>
          <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-[:checked]:bg-white dark:has-[:checked]:bg-slate-700 has-[:checked]:shadow-sm has-[:checked]:text-primary text-slate-600 dark:text-slate-400 text-sm font-semibold transition-all">
            <span>Anteriores</span>
            <input
              checked={tab === 'past'}
              onChange={() => setTab('past')}
              className="hidden" name="event-toggle" type="radio" value="past"
            />
          </label>
        </div>
      </div>

      <main className="flex-1 px-4 space-y-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <span className="material-symbols-outlined text-4xl animate-spin text-primary">autorenew</span>
            <p className="font-semibold tracking-wide">Cargando eventos...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        ) : displayedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <span className="material-symbols-outlined text-5xl opacity-50">event_busy</span>
            <p className="font-semibold tracking-wide text-center px-4">
              {tab === 'upcoming' ? 'No hay próximos eventos programados.' : 'No hay eventos finalizados.'}
            </p>
          </div>
        ) : (
          displayedEvents.map(ev => {
            const dateObj = new Date(ev.fecha + 'T12:00:00');
            const month = dateObj.toLocaleDateString('es-AR', { month: 'short' });
            const day = dateObj.toLocaleDateString('es-AR', { day: '2-digit' });

            return (
              <div key={ev.id} className="group relative flex flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-primary/10 hover:shadow-md transition-shadow">
                <div className="relative w-full aspect-[16/9] bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url("${getImage(ev)}")` }}></div>

                  <div className="absolute top-3 left-3 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                    {ev.tipo}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-lg flex flex-col items-center shadow-lg border border-primary/10">
                    <span className="text-xs font-bold text-primary leading-none uppercase">{month}</span>
                    <span className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none mt-1">{day}</span>
                  </div>
                </div>
                <div className="flex flex-col p-4 gap-3">
                  <div>
                    <h3 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-snug">{ev.titulo}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{ev.descripcion}</p>

                    <div className="mt-3 space-y-1">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(ev.lugar)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm hover:text-primary transition-colors group/link"
                      >
                        <span className="material-symbols-outlined text-sm text-primary group-hover/link:animate-bounce">location_on</span>
                        <span className="group-hover/link:underline">{ev.lugar}</span>
                      </a>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                        <span className="material-symbols-outlined text-sm text-primary">schedule</span>
                        <span>{ev.hora.slice(0, 5)} HS</span>
                      </div>
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
