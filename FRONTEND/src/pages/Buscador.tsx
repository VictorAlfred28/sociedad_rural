import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from '../components/BottomNav';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const HISTORY_KEY = 'lupita_history';

interface Item {
  id: string;
  nombre: string;
  tipo: 'evento' | 'comercio' | 'profesional' | 'municipio' | 'producto';
  subtipo?: string;
  municipio?: string;
  slug?: string;
}

function norm(s?: string) {
  if (!s || typeof s !== 'string') return '';
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hit(field: string | undefined, q: string) {
  return norm(field).includes(norm(q));
}

function getHist(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function pushHist(q: string) {
  const next = [q, ...getHist().filter(h => h !== q)].slice(0, 5);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

const TYPE_CFG = {
  evento:      { label: 'Eventos',       icon: 'event',         cls: 'text-emerald-600',   bg: 'bg-emerald-50' },
  comercio:    { label: 'Comercios',     icon: 'storefront',    cls: 'text-amber-600',     bg: 'bg-amber-50' },
  profesional: { label: 'Profesionales', icon: 'person_pin',    cls: 'text-blue-600',      bg: 'bg-blue-50' },
  municipio:   { label: 'Municipios',    icon: 'location_city', cls: 'text-purple-600',    bg: 'bg-purple-50' },
  producto:    { label: 'Productos',     icon: 'category',      cls: 'text-rose-600',      bg: 'bg-rose-50' },
} as const;

export default function Buscador() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,   setQuery]   = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [hist,    setHist]    = useState<string[]>(getHist);

  const [allItems,    setAllItems]    = useState<Item[]>([]);
  const [municipios,  setMunicipios]  = useState<{id:string,nombre:string}[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);
  
  // Filtro activo
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => setDbQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const fetchAll = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const [evR, comR, profR, munR] = await Promise.allSettled([
        fetch(`${API}/api/eventos`).then(r => r.json()),
        fetch(`${API}/api/comercios`).then(r => r.json()),
        fetch(`${API}/api/profesionales`).then(r => r.json()),
        fetch(`${API}/api/municipios`).then(r => r.json()),
      ]);

      const items: Item[] = [];

      if (evR.status === 'fulfilled')
        for (const ev of evR.value.eventos || [])
          items.push({ id: ev.id, nombre: ev.titulo, tipo: 'evento',
            subtipo: ev.tipo || 'Evento',
            municipio: ev.lugar && ev.lugar !== 'A definir' ? ev.lugar : undefined,
            slug: ev.slug });

      if (comR.status === 'fulfilled')
        for (const c of comR.value.comercios || [])
          items.push({ id: c.id, nombre: c.nombre_comercio, tipo: 'comercio',
            subtipo: c.rubro || 'Comercio', municipio: c.municipio });

      if (profR.status === 'fulfilled') {
        const profs = profR.value.profesionales || profR.value.data || [];
        for (const p of profs)
          items.push({ id: p.id, nombre: p.nombre_apellido || p.nombre || '',
            tipo: 'profesional', subtipo: p.titulo || p.rubro || 'Profesional',
            municipio: p.municipio });
      }

      let munList: {id:string,nombre:string}[] = [];
      if (munR.status === 'fulfilled') {
        munList = munR.value.municipios || [];
        for (const m of munList)
          items.push({ id: m.id, nombre: m.nombre, tipo: 'municipio', subtipo: 'Municipio' });
      }

      setAllItems(items);
      setMunicipios(munList);
      setLoaded(true);
    } catch (e) {
      console.error('[Buscador]', e);
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* filter */
  let results = dbQuery.length >= 2
    ? allItems.filter(i =>
        hit(i.nombre, dbQuery) ||
        hit(i.subtipo, dbQuery) ||
        hit(i.municipio, dbQuery) ||
        hit(i.tipo, dbQuery)
      )
    : [];

  if (activeFilter && dbQuery.length >= 2) {
      results = results.filter(i => i.tipo === activeFilter);
  }

  const grouped = {
    evento:      results.filter(r => r.tipo === 'evento').slice(0, 5),
    comercio:    results.filter(r => r.tipo === 'comercio').slice(0, 5),
    profesional: results.filter(r => r.tipo === 'profesional').slice(0, 5),
    municipio:   results.filter(r => r.tipo === 'municipio').slice(0, 5),
    producto:    results.filter(r => r.tipo === 'producto').slice(0, 5),
  };
  
  const total = Object.values(grouped).reduce((a, b) => a + b.length, 0);

  /* actions */
  const select = (item: Item) => {
    pushHist(item.nombre);
    setHist(getHist());
    if (item.tipo === 'evento')
      item.slug ? navigate(`/eventos/${item.slug}`) : navigate('/eventos');
    else if (item.tipo === 'municipio')
      navigate(`/eventos?municipio=${encodeURIComponent(item.nombre)}`);
    else
      navigate('/promociones');
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    pushHist(query.trim());
    setHist(getHist());
    navigate(`/eventos?q=${encodeURIComponent(query.trim())}`);
  };

  const clear = () => { setQuery(''); setDbQuery(''); inputRef.current?.focus(); };

  const showEmpty   = dbQuery.length < 2;
  const showNoRes   = dbQuery.length >= 2 && total === 0 && !loading;
  const showResults = dbQuery.length >= 2 && total > 0;

  return (
    <div className="relative min-h-screen flex flex-col font-display max-w-md mx-auto shadow-2xl overflow-hidden bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <div className="pt-10 px-5 pb-3 bg-white dark:bg-stone-950 shadow-sm z-10">
        <h1 className="text-2xl font-black text-stone-800 dark:text-stone-100 uppercase tracking-tight mb-4">
          Buscador
        </h1>
        
        {/* Input */}
        <form onSubmit={submit}>
          <div className="flex items-center gap-2 px-4 py-3 bg-stone-100 dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <span className={`material-symbols-outlined text-[22px] text-stone-400 shrink-0 ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'autorenew' : 'search'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar eventos, comercios..."
              className="flex-1 bg-transparent text-base text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 outline-none min-w-0"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={clear}
                className="shrink-0 size-7 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined text-[16px] text-stone-500 dark:text-stone-300">close</span>
              </button>
            )}
          </div>
        </form>

        {/* Filtros horizontales */}
        {dbQuery.length >= 2 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveFilter(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${!activeFilter ? 'bg-emerald-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}
            >
              Todos
            </button>
            {(Object.keys(TYPE_CFG) as (keyof typeof TYPE_CFG)[]).map(tipo => {
              if (tipo === 'producto') return null; // opcional, si hay pocos
              return (
                <button
                  key={tipo}
                  onClick={() => setActiveFilter(tipo)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeFilter === tipo ? 'bg-emerald-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}
                >
                  {TYPE_CFG[tipo].label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        {showEmpty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {hist.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-xs font-black uppercase tracking-widest text-stone-400">Recientes</p>
                  <button onClick={() => { localStorage.removeItem(HISTORY_KEY); setHist([]); }}
                    className="text-xs text-stone-400 hover:text-red-400 transition-colors">
                    Borrar
                  </button>
                </div>
                <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">
                  {hist.map((h, i) => (
                    <div key={h}>
                      <button onClick={() => { setQuery(h); setDbQuery(h); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-left">
                        <span className="material-symbols-outlined text-[18px] text-stone-300">history</span>
                        <span className="text-[15px] font-medium text-stone-700 dark:text-stone-200 truncate flex-1">{h}</span>
                        <span className="material-symbols-outlined text-[16px] text-stone-200">north_west</span>
                      </button>
                      {i < hist.length - 1 && <div className="h-[1px] bg-stone-100 dark:bg-stone-800 mx-4" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {municipios.length > 0 && (
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-stone-400 px-1 mb-3">Explorar Municipios</p>
                <div className="flex flex-wrap gap-2 px-1">
                  {municipios.slice(0, 10).map(m => (
                    <button key={m.id}
                      onClick={() => navigate(`/eventos?municipio=${encodeURIComponent(m.nombre)}`)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[13px] text-stone-600 dark:text-stone-300 font-semibold transition-all active:scale-95 shadow-sm">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">location_on</span>
                      {m.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loaded && !loading && (
              <div className="flex flex-col items-center justify-center pt-10 opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2 text-stone-300">search</span>
                <p className="text-sm text-stone-400 font-medium">Escribí para empezar a buscar</p>
              </div>
            )}
          </motion.div>
        )}

        {showNoRes && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center pt-16 px-4">
            <div className="size-20 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-stone-300 dark:text-stone-600">search_off</span>
            </div>
            <p className="text-lg font-black text-stone-800 dark:text-stone-200 mb-1">Sin resultados</p>
            <p className="text-sm text-stone-500 dark:text-stone-400 text-center mb-6">
              No encontramos nada para "{dbQuery}". Intentá con otras palabras.
            </p>
            <button onClick={clear} className="px-6 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold active:scale-95 transition-transform">
              Limpiar búsqueda
            </button>
          </motion.div>
        )}

        {showResults && (
          <div className="space-y-5">
            {(Object.keys(grouped) as (keyof typeof grouped)[]).map(tipo => {
              const items = grouped[tipo];
              if (!items.length) return null;
              if (activeFilter && activeFilter !== tipo) return null;
              
              const cfg = TYPE_CFG[tipo];
              
              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={tipo}>
                  <p className={`text-xs font-black uppercase tracking-widest mb-2 px-1 ${cfg.cls}`}>
                    {cfg.label}
                  </p>
                  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">
                    {items.map((item, i) => (
                      <div key={item.id}>
                        <button onClick={() => select(item)}
                          className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800 active:bg-stone-100 dark:active:bg-stone-800 transition-colors text-left">
                          <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                            <span className={`material-symbols-outlined text-[20px] ${cfg.cls}`}>
                              {cfg.icon}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold text-stone-800 dark:text-stone-100 truncate">{item.nombre}</p>
                            <p className="text-[12px] font-medium text-stone-400 dark:text-stone-500 truncate mt-0.5">
                              {item.subtipo}{item.municipio ? ` • ${item.municipio}` : ''}
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-stone-300 dark:text-stone-600 shrink-0">
                            chevron_right
                          </span>
                        </button>
                        {i < items.length - 1 && <div className="h-[1px] bg-stone-50 dark:bg-stone-800 mx-4" />}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
            
            {!activeFilter && (
              <button onClick={() => submit()}
                className="w-full py-4 mt-2 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 font-bold text-sm hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                Ver todos los resultados
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav scrollContainerRef={scrollRef} />
    </div>
  );
}
