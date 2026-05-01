import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const HISTORY_KEY = 'lupita_history';

interface Item {
  id: string;
  nombre: string;
  tipo: 'evento' | 'comercio' | 'profesional' | 'municipio';
  subtipo?: string;
  municipio?: string;
  slug?: string;
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function hit(field: string, q: string) {
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
  evento:      { label: 'Eventos',       icon: 'event',         cls: 'text-emerald-600' },
  comercio:    { label: 'Comercios',     icon: 'storefront',    cls: 'text-amber-600'   },
  profesional: { label: 'Profesionales', icon: 'person_pin',    cls: 'text-blue-600'    },
  municipio:   { label: 'Municipios',    icon: 'location_city', cls: 'text-purple-600'  },
} as const;

export default function Lupita() {
  const navigate = useNavigate();
  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query,   setQuery]   = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [open,    setOpen]    = useState(false);
  const [hist,    setHist]    = useState<string[]>(getHist);

  const [allItems,    setAllItems]    = useState<Item[]>([]);
  const [municipios,  setMunicipios]  = useState<{id:string,nombre:string}[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => setDbQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  /* fetch once on first focus */
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
      console.error('[Lupita]', e);
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  /* click outside */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* filter */
  const results = dbQuery.length >= 2
    ? allItems.filter(i =>
        hit(i.nombre, dbQuery) ||
        hit(i.subtipo ?? '', dbQuery) ||
        hit(i.municipio ?? '', dbQuery))
    : [];

  const grouped = {
    evento:      results.filter(r => r.tipo === 'evento').slice(0, 4),
    comercio:    results.filter(r => r.tipo === 'comercio').slice(0, 4),
    profesional: results.filter(r => r.tipo === 'profesional').slice(0, 4),
    municipio:   results.filter(r => r.tipo === 'municipio').slice(0, 3),
  };
  const total = Object.values(grouped).reduce((a, b) => a + b.length, 0);

  /* actions */
  const select = (item: Item) => {
    pushHist(item.nombre);
    setHist(getHist());
    setOpen(false);
    setQuery('');
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
    setOpen(false);
    navigate(`/eventos?q=${encodeURIComponent(query.trim())}`);
  };

  const clear = () => { setQuery(''); setDbQuery(''); inputRef.current?.focus(); };

  const showEmpty   = open && dbQuery.length < 2;
  const showNoRes   = open && dbQuery.length >= 2 && total === 0 && !loading;
  const showResults = open && total > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Input ── */}
      <form onSubmit={submit}>
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl transition-shadow duration-200"
          style={{
            background: 'rgba(255,255,255,0.76)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.62)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          }}
        >
          <span
            className={`material-symbols-outlined text-[20px] text-stone-400 shrink-0 ${loading ? 'animate-spin' : ''}`}
          >
            {loading ? 'autorenew' : 'search'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => { setOpen(true); fetchAll(); }}
            placeholder="Buscar eventos, comercios o profesionales..."
            className="flex-1 bg-transparent text-sm text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 outline-none min-w-0"
          />
          {query ? (
            <button
              type="button"
              onClick={clear}
              className="shrink-0 size-6 rounded-full bg-stone-200/80 dark:bg-stone-700 flex items-center justify-center active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-[14px] text-stone-500">close</span>
            </button>
          ) : null}
        </div>
      </form>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-2xl z-50 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(230,230,230,0.8)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            maxHeight: '370px',
            overflowY: 'auto',
          }}
        >
          {/* Empty/initial state */}
          {showEmpty && (
            <div className="p-3 space-y-3">
              {hist.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Recientes</p>
                    <button onClick={() => { localStorage.removeItem(HISTORY_KEY); setHist([]); }}
                      className="text-[9px] text-stone-400 hover:text-red-400 transition-colors">
                      Borrar
                    </button>
                  </div>
                  {hist.map(h => (
                    <button key={h} onClick={() => { setQuery(h); setDbQuery(h); }}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-stone-50 transition-colors text-left">
                      <span className="material-symbols-outlined text-[16px] text-stone-400">history</span>
                      <span className="text-sm text-stone-600 truncate">{h}</span>
                    </button>
                  ))}
                  {municipios.length > 0 && <div className="border-t border-stone-100 my-1" />}
                </div>
              )}
              {municipios.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 px-1 mb-2">Municipios</p>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {municipios.slice(0, 7).map(m => (
                      <button key={m.id}
                        onClick={() => { setOpen(false); navigate(`/eventos?municipio=${encodeURIComponent(m.nombre)}`); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs text-stone-600 font-medium transition-colors active:scale-95">
                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                        {m.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!loaded && !loading && (
                <p className="text-xs text-stone-400 text-center py-3">
                  Escribí para buscar eventos, comercios o profesionales
                </p>
              )}
            </div>
          )}

          {/* No results */}
          {showNoRes && (
            <div className="flex flex-col items-center gap-3 py-8 px-4">
              <span className="material-symbols-outlined text-3xl text-stone-300">search_off</span>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-stone-600">No encontramos resultados</p>
                <p className="text-xs text-stone-400">Intentá con otra palabra o explorá por municipio</p>
              </div>
              <button onClick={clear} className="text-xs text-emerald-700 font-bold hover:underline">
                Limpiar búsqueda
              </button>
            </div>
          )}

          {/* Grouped results */}
          {showResults && (
            <div className="py-1">
              {(Object.keys(grouped) as (keyof typeof grouped)[]).map(tipo => {
                const items = grouped[tipo];
                if (!items.length) return null;
                const cfg = TYPE_CFG[tipo];
                return (
                  <div key={tipo}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 px-4 pt-2.5 pb-1">
                      {cfg.label}
                    </p>
                    {items.map(item => (
                      <button key={item.id} onClick={() => select(item)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left">
                        <span className={`material-symbols-outlined text-[19px] shrink-0 ${cfg.cls}`}>
                          {cfg.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-stone-800 truncate">{item.nombre}</p>
                          <p className="text-[10px] text-stone-400 truncate">
                            {item.subtipo}{item.municipio ? ` — ${item.municipio}` : ''}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-[15px] text-stone-300 shrink-0">
                          arrow_forward_ios
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
              <div className="px-4 pt-2 pb-3 mt-1 border-t border-stone-100">
                <button onClick={() => submit()}
                  className="w-full text-center text-xs text-emerald-700 font-bold hover:underline active:opacity-70">
                  Ver todos los resultados para "{dbQuery}"
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
