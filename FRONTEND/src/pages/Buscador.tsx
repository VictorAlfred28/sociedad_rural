import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from '../components/BottomNav';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const HISTORY_KEY = 'lupita_history';

interface Item {
  id: string;
  nombre: string;
  tipo: 'evento' | 'comercio' | 'profesional' | 'municipio' | 'producto' | 'Módulo' | 'Categoría';
  subtipo?: string;
  municipio?: string;
  slug?: string;
  icon?: string;
  route?: string;
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
  if (!q.trim()) return;
  const next = [q.trim(), ...getHist().filter(h => h !== q.trim())].slice(0, 5);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

const searchMap = [
  {
    keywords: ["cuota", "pago", "deuda", "aportes", "pagar", "saldo", "vencimiento"],
    route: "/cuotas",
    type: "Módulo" as const,
    title: "Aportes / Cuotas",
    icon: "account_balance_wallet"
  },
  {
    keywords: ["beneficios", "descuentos", "promociones", "ofertas", "promo", "comercios", "adheridos", "locales"],
    route: "/promociones?tab=ofertas",
    type: "Módulo" as const,
    title: "Beneficios del Socio",
    icon: "sell"
  },
  {
    keywords: ["combustible", "nafta", "estacion", "ypf", "shell", "gasoil", "servicio"],
    route: "/promociones?tab=comercios&categoria=combustible",
    type: "Categoría" as const,
    title: "Combustibles",
    icon: "local_gas_station"
  },
  {
    keywords: ["ropa", "vestimenta", "indumentaria", "calzado", "accesorios", "zapatos"],
    route: "/promociones?tab=comercios&categoria=vestimentas",
    type: "Categoría" as const,
    title: "Vestimentas e Indumentarias",
    icon: "checkroom"
  },
  {
    keywords: ["comida", "alimento", "restaurante", "supermercado", "kiosco", "gastronomia", "alimentacion", "alimentos", "comidas"],
    route: "/promociones?tab=comercios&categoria=alimentacion",
    type: "Categoría" as const,
    title: "Alimentación",
    icon: "restaurant"
  },
  {
    keywords: ["servicios", "taller", "mecanico", "reparacion", "electricista", "plomero", "oficios"],
    route: "/promociones?tab=comercios&categoria=servicios",
    type: "Categoría" as const,
    title: "Servicios Generales",
    icon: "handyman"
  },
  {
    keywords: ["eventos", "agenda", "actividades", "calendario", "rurales", "feria", "remate", "expo", "exposicion", "evento"],
    route: "/eventos",
    type: "Módulo" as const,
    title: "Agenda Rural",
    icon: "event"
  },
  {
    keywords: ["pasaporte", "ñande", "carnet", "credencial", "qr", "credenciales"],
    route: "/carnet",
    type: "Módulo" as const,
    title: "Ñande Pasaporte",
    icon: "badge"
  },
  {
    keywords: ["perfil", "usuario", "mis datos", "cuenta", "configuracion", "preferencias", "ajustes"],
    route: "/perfil",
    type: "Módulo" as const,
    title: "Mi Perfil",
    icon: "person"
  },
  {
    keywords: ["negocio", "mi negocio", "admin", "administrar", "panel"],
    route: "/mi-negocio",
    type: "Módulo" as const,
    title: "Mi Negocio",
    icon: "storefront"
  }
];

const MONTHS: Record<string, number> = {
  "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
  "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
};

const TYPE_CFG = {
  evento:      { label: 'Evento',       icon: 'event',         cls: 'text-emerald-600',   bg: 'bg-emerald-50' },
  comercio:    { label: 'Comercio',     icon: 'storefront',    cls: 'text-amber-600',     bg: 'bg-amber-50' },
  profesional: { label: 'Profesional',  icon: 'person_pin',    cls: 'text-blue-600',      bg: 'bg-blue-50' },
  municipio:   { label: 'Localidad',    icon: 'location_city', cls: 'text-purple-600',    bg: 'bg-purple-50' },
  producto:    { label: 'Producto',     icon: 'category',      cls: 'text-rose-600',      bg: 'bg-rose-50' },
  Módulo:      { label: 'Sección',      icon: 'widgets',       cls: 'text-stone-700',     bg: 'bg-stone-200' },
  Categoría:   { label: 'Categoría',    icon: 'category',      cls: 'text-indigo-600',    bg: 'bg-indigo-50' },
} as const;

export default function Buscador() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigatingRef = useRef(false);

  const [query,   setQuery]   = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [hist,    setHist]    = useState<string[]>(getHist);

  const [allItems,    setAllItems]    = useState<Item[]>([]);
  const [municipios,  setMunicipios]  = useState<{id:string,nombre:string}[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);
  
  // Filtro activo opcional
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => setDbQuery(query.trim()), 200);
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

  /* INTENT PARSER LOGIC */
  const parseIntent = (q: string): Item[] => {
    const words = norm(q).split(/\s+/);
    let bestIntents: Item[] = [];
    
    for(const intent of searchMap) {
      let score = 0;
      for(const word of words) {
        if(intent.keywords.some(k => norm(k).includes(word) || word.includes(norm(k)))) {
          score++;
        }
      }
      if(score > 0) {
        let cloned = { id: `intent_${intent.title}`, nombre: intent.title, tipo: intent.type, icon: intent.icon, route: intent.route };
        
        // Dynamic modifiers for Eventos
        if (cloned.route.startsWith('/eventos')) {
          let modified = false;
          // Month
          for(const [m, val] of Object.entries(MONTHS)) {
            if(words.some(w => w === m || w.startsWith(m.slice(0, 4)))) {
              cloned.route += (cloned.route.includes('?') ? '&' : '?') + 'mes=' + val;
              cloned.nombre += ' en ' + m.charAt(0).toUpperCase() + m.slice(1);
              modified = true;
              score += 2; // Extra score for exact modifier
              break;
            }
          }
          // Location
          for(const mun of municipios) {
            const n = norm(mun.nombre);
            if(words.some(w => n === w || w.includes(n))) {
               cloned.route += (cloned.route.includes('?') ? '&' : '?') + 'municipio=' + encodeURIComponent(mun.nombre);
               cloned.nombre += ' (' + mun.nombre + ')';
               modified = true;
               score += 2;
               break;
            }
          }
        }
        
        // Only keep highest scoring intents or add to list with score
        bestIntents.push({...cloned, _score: score} as Item & { _score: number });
      }
    }
    
    // Sort by score and take top 2
    bestIntents.sort((a: any, b: any) => b._score - a._score);
    return bestIntents.slice(0, 2);
  };

  /* SUGGESTIONS */
  let suggestions: Item[] = [];
  if (dbQuery.length >= 2) {
      // 1. Intents
      const intents = parseIntent(dbQuery);
      suggestions.push(...intents);

      // 2. DB Items
      const dbRes = allItems.filter(i =>
        hit(i.nombre, dbQuery) ||
        hit(i.subtipo, dbQuery) ||
        hit(i.municipio, dbQuery) ||
        hit(i.tipo, dbQuery)
      );

      // Mix them
      suggestions.push(...dbRes);
  }

  if (activeFilter && dbQuery.length >= 2) {
      suggestions = suggestions.filter(i => i.tipo === activeFilter);
  }

  // Grouper logic for UI display
  const grouped = {
    intents:     suggestions.filter(r => r.tipo === 'Módulo' || r.tipo === 'Categoría').slice(0, 3),
    evento:      suggestions.filter(r => r.tipo === 'evento').slice(0, 5),
    comercio:    suggestions.filter(r => r.tipo === 'comercio').slice(0, 5),
    profesional: suggestions.filter(r => r.tipo === 'profesional').slice(0, 5),
    municipio:   suggestions.filter(r => r.tipo === 'municipio').slice(0, 5),
  };
  
  const total = Object.values(grouped).reduce((a, b) => a + b.length, 0);

  /* actions */
  const select = (item: Item) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    pushHist(query);
    setHist(getHist());
    
    if (item.route) {
        navigate(item.route);
    } else if (item.tipo === 'evento') {
        item.slug ? navigate(`/eventos/${item.slug}`) : navigate('/eventos');
    } else if (item.tipo === 'municipio') {
        navigate(`/eventos?municipio=${encodeURIComponent(item.nombre)}`);
    } else {
        navigate('/promociones');
    }

    setTimeout(() => navigatingRef.current = false, 400);
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    pushHist(query);
    setHist(getHist());
    
    // Si hay sugerencias, tomamos la primera de la lista (el mejor intent o primer resultado)
    if (suggestions.length > 0) {
        const topItem = suggestions[0];
        if (topItem.route) {
            navigate(topItem.route);
        } else if (topItem.tipo === 'evento') {
            topItem.slug ? navigate(`/eventos/${topItem.slug}`) : navigate('/eventos');
        } else {
            navigate(`/eventos?q=${encodeURIComponent(query.trim())}`);
        }
    } else {
        navigate(`/eventos?q=${encodeURIComponent(query.trim())}`);
    }

    setTimeout(() => navigatingRef.current = false, 400);
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
        
        {/* Input con lupa dinámica */}
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
              placeholder="¿Qué estás buscando? (Ej: Cuotas)"
              className="flex-1 bg-transparent text-sm text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 outline-none min-w-0 font-medium"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={clear}
                className="shrink-0 size-7 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center active:scale-90 transition-transform mr-1"
              >
                <span className="material-symbols-outlined text-[16px] text-stone-500 dark:text-stone-300">close</span>
              </button>
            )}
            <button
                type="submit"
                className="shrink-0 size-8 rounded-full bg-emerald-600 flex items-center justify-center active:scale-90 transition-transform shadow-sm"
            >
                <span className="material-symbols-outlined text-[18px] text-white">search</span>
            </button>
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
              if (tipo === 'producto' || tipo === 'Módulo' || tipo === 'Categoría') return null; // No mostrar modulos en pastillas
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
                <p className="text-xs font-black uppercase tracking-widest text-stone-400 px-1 mb-3">Explorar Localidades</p>
                <div className="relative px-1">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        navigate(`/eventos?municipio=${encodeURIComponent(e.target.value)}`);
                      }
                    }}
                    defaultValue=""
                    className="w-full appearance-none bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-2xl px-4 py-3 text-[13px] text-stone-700 dark:text-stone-300 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm transition-all cursor-pointer"
                  >
                    <option value="" disabled>Seleccioná una localidad...</option>
                    {municipios.map(m => (
                      <option key={m.id} value={m.nombre}>{m.nombre}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600 dark:text-emerald-400 text-[20px]">
                    location_on
                  </span>
                </div>
              </div>
            )}

            {!loaded && !loading && (
              <div className="flex flex-col items-center justify-center pt-10 opacity-50">
                <span className="material-symbols-outlined text-4xl mb-2 text-stone-300">search</span>
                <p className="text-sm text-stone-400 font-medium">Escribí para buscar lugares, beneficios...</p>
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
              No encontramos nada para "{dbQuery}". Intentá con otras palabras como "combustible" o "eventos".
            </p>
            <button onClick={clear} className="px-6 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold active:scale-95 transition-transform">
              Limpiar búsqueda
            </button>
          </motion.div>
        )}

        {showResults && (
          <div className="space-y-5">
            {(Object.keys(grouped) as (keyof typeof grouped)[]).map(keyGroup => {
              const items = grouped[keyGroup];
              if (!items.length) return null;
              if (activeFilter && activeFilter !== keyGroup && keyGroup !== 'intents') return null; // intents shows always if matched
              
              const titleGroup = keyGroup === 'intents' ? 'Sugerencias' : TYPE_CFG[keyGroup as keyof typeof TYPE_CFG]?.label + 's';
              
              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={keyGroup}>
                  <p className={`text-xs font-black uppercase tracking-widest mb-2 px-1 ${keyGroup === 'intents' ? 'text-stone-500' : TYPE_CFG[keyGroup as keyof typeof TYPE_CFG]?.cls}`}>
                    {titleGroup}
                  </p>
                  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">
                    {items.map((item, i) => {
                      const cfg = TYPE_CFG[item.tipo];
                      return (
                        <div key={item.id}>
                          <button onClick={() => select(item)}
                            className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800 active:bg-stone-100 dark:active:bg-stone-800 transition-colors text-left">
                            <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                              <span className={`material-symbols-outlined text-[20px] ${cfg.cls}`}>
                                {item.icon || cfg.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-bold text-stone-800 dark:text-stone-100 truncate">{item.nombre}</p>
                              <p className="text-[12px] font-medium text-stone-400 dark:text-stone-500 truncate mt-0.5">
                                {cfg.label}{item.subtipo ? ` • ${item.subtipo}` : ''}{item.municipio ? ` • ${item.municipio}` : ''}
                              </p>
                            </div>
                            <span className="material-symbols-outlined text-[18px] text-stone-300 dark:text-stone-600 shrink-0">
                              {item.route ? 'arrow_forward' : 'chevron_right'}
                            </span>
                          </button>
                          {i < items.length - 1 && <div className="h-[1px] bg-stone-50 dark:bg-stone-800 mx-4" />}
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              );
            })}
            
            {!activeFilter && grouped.evento.length === 0 && grouped.comercio.length === 0 && grouped.profesional.length === 0 && (
              <button onClick={() => submit()}
                className="w-full py-4 mt-2 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 font-bold text-sm hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                Buscar "{query}" en todos lados
              </button>
            )}
          </div>
        )}
      </div>

      <BottomNav scrollContainerRef={scrollRef} />
    </div>
  );
}
