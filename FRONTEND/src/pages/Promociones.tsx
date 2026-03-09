import { useState, useEffect, useRef } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import FeaturedCarousel from '../components/FeaturedCarousel';
import { motion, AnimatePresence } from 'motion/react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Oferta {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: 'promocion' | 'descuento' | 'beneficio';
  descuento_porcentaje: number | null;
  fecha_fin: string | null;
  comercio?: { nombre_apellido: string; rubro: string; municipio: string };
}
interface Comercio {
  id: string;
  nombre_apellido: string;
  rubro: string;
  municipio: string;
  telefono: string;
}
interface Municipio {
  id: string;
  nombre: string;
}

// ─── Datos de configuración ───────────────────────────────────────────────────
const RUBRO_LABELS: Record<string, string> = {
  agropecuario: 'Agropecuario', veterinaria: 'Veterinaria',
  maquinaria_agricola: 'Maquinaria', insumos_agricolas: 'Insumos Agríc.',
  alimentacion: 'Alimentación', construccion: 'Construcción',
  transporte: 'Transporte', servicios_profesionales: 'Serv. Prof.',
  comercio_general: 'Comercio Gral.', otro: 'Otro',
};
const RUBRO_ICON: Record<string, string> = {
  agropecuario: 'agriculture', veterinaria: 'vaccines',
  maquinaria_agricola: 'precision_manufacturing', insumos_agricolas: 'science',
  alimentacion: 'restaurant', construccion: 'construction',
  transporte: 'local_shipping', servicios_profesionales: 'work',
  comercio_general: 'storefront', otro: 'category',
};
const RUBRO_COLOR: Record<string, string> = {
  agropecuario: 'bg-lime-500', veterinaria: 'bg-cyan-500',
  maquinaria_agricola: 'bg-orange-500', insumos_agricolas: 'bg-emerald-500',
  alimentacion: 'bg-amber-500', construccion: 'bg-stone-500',
  transporte: 'bg-blue-500', servicios_profesionales: 'bg-violet-500',
  comercio_general: 'bg-rose-500', otro: 'bg-slate-500',
};

const TIPO_CFG = {
  promocion: {
    label: 'Promoción', icon: 'local_offer',
    gradFrom: 'from-orange-500', gradTo: 'to-amber-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  },
  descuento: {
    label: 'Descuento', icon: 'percent',
    gradFrom: 'from-emerald-600', gradTo: 'to-teal-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  beneficio: {
    label: 'Beneficio', icon: 'star',
    gradFrom: 'from-violet-600', gradTo: 'to-indigo-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
};

const RUBROS = ['todos', 'agropecuario', 'veterinaria', 'maquinaria_agricola', 'insumos_agricolas', 'alimentacion', 'construccion', 'transporte', 'servicios_profesionales'];

type Tab = 'ofertas' | 'comercios';

// ─── Componente ──────────────────────────────────────────────────────────────
export default function Promociones() {
  const [tab, setTab] = useState<Tab>('ofertas');
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [filtroRubro, setFiltroRubro] = useState('todos');
  const [filtroMunicipio, setFiltroMunicipio] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMunDropdown, setShowMunDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [ofRes, comRes, munRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ofertas/publicas`),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/comercios`),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`),
        ]);
        setOfertas((await ofRes.json()).ofertas || []);
        setComercios((await comRes.json()).comercios || []);
        setMunicipios((await munRes.json()).municipios || []);
      } catch { /* silencioso */ } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Click outside detector para el dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMunDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenMap = (comercio?: Comercio | any) => {
    const term = comercio
      ? `${comercio.nombre_apellido || comercio.nombre_comercio} ${comercio.municipio || ''}`
      : (filtroMunicipio !== 'todos' ? `Sociedad Rural ${filtroMunicipio} Corrientes` : 'Corrientes Argentina');

    const query = encodeURIComponent(term);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const ofertasFiltradas = ofertas.filter(o => {
    const matchRubro = filtroRubro === 'todos' || o.comercio?.rubro === filtroRubro;
    const matchMun = filtroMunicipio === 'todos' || o.comercio?.municipio === filtroMunicipio;
    return matchRubro && matchMun;
  });

  const comerciosFiltrados = comercios.filter(c => {
    const matchRubro = filtroRubro === 'todos' || c.rubro === filtroRubro;
    const matchMun = filtroMunicipio === 'todos' || c.municipio === filtroMunicipio;
    const q = busqueda.toLowerCase();
    const matchQ = !busqueda ||
      c.nombre_apellido.toLowerCase().includes(q) ||
      (RUBRO_LABELS[c.rubro] || '').toLowerCase().includes(q) ||
      (c.municipio || '').toLowerCase().includes(q);
    return matchRubro && matchQ && matchMun;
  });

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-display">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 transition-all duration-300 shadow-sm">
        <div className="flex items-center px-4 pt-4 pb-3 gap-3">
          <Link to="/home" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
          </Link>

          {showSearch ? (
            <motion.input
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              autoFocus
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onBlur={() => !busqueda && setShowSearch(false)}
              placeholder="Buscar beneficios..."
              className="flex-1 h-11 rounded-2xl bg-white dark:bg-slate-800 px-4 text-sm outline-none border-2 border-primary/20 focus:border-primary transition-all shadow-inner"
            />
          ) : (
            <div className="flex-1">
              <h1 className="text-xl font-black italic tracking-tighter text-slate-800 dark:text-white uppercase leading-none">Beneficios</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="size-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(255,200,0,0.5)]"></div>
                <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
                  {tab === 'ofertas' ? `${ofertasFiltradas.length} ofertas activas` : `${comerciosFiltrados.length} comercios`}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl transition-all ${showSearch ? 'bg-primary text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
          >
            <span className="material-symbols-outlined">{showSearch ? 'close' : 'search'}</span>
          </button>
        </div>

        {/* ── Tab switcher tipo "segmento" ── */}
        <div className="flex gap-2 px-4 pb-4">
          <div className="flex-1 flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl relative">
            <motion.div
              layoutId="tab-bg"
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl shadow-lg border border-white/10 ${tab === 'ofertas' ? 'left-1 bg-gradient-to-r from-orange-500 to-amber-500' : 'left-[calc(50%+2px)] bg-slate-700 dark:bg-slate-600'}`}
            />
            <button
              onClick={() => setTab('ofertas')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${tab === 'ofertas' ? 'text-white' : 'text-slate-400'}`}
            >
              <span className="material-symbols-outlined text-lg">sell</span>
              Ofertas
            </button>
            <button
              onClick={() => setTab('comercios')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${tab === 'comercios' ? 'text-white' : 'text-slate-400'}`}
            >
              <span className="material-symbols-outlined text-lg">storefront</span>
              Comercios
            </button>
          </div>
        </div>

        {/* ── Nuevo Selector de Municipio Dropdown XL ── */}
        <div className="px-4 pb-4 flex gap-2">
          <div className="relative flex-1" ref={dropdownRef}>
            <button
              onClick={() => setShowMunDropdown(!showMunDropdown)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:border-primary/50 transition-all text-sm font-bold active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                <span className="truncate max-w-[150px]">{filtroMunicipio === 'todos' ? 'Todas las Localidades' : filtroMunicipio}</span>
              </div>
              <span className={`material-symbols-outlined text-slate-400 transition-transform duration-300 ${showMunDropdown ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            <AnimatePresence>
              {showMunDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-[calc(100%+8px)] left-0 right-0 max-h-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-y-auto admin-scroll z-50 p-2"
                >
                  <button
                    onClick={() => { setFiltroMunicipio('todos'); setShowMunDropdown(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left text-sm font-bold transition-all ${filtroMunicipio === 'todos' ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    <span className="material-symbols-outlined text-lg">public</span>
                    Toda la Provincia
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
                  {municipios.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setFiltroMunicipio(m.nombre); setShowMunDropdown(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left text-sm font-bold transition-all ${filtroMunicipio === m.nombre ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                    >
                      <span className="material-symbols-outlined text-lg opacity-40">apartment</span>
                      {m.nombre}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => handleOpenMap()}
            className="size-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 active:scale-95 transition-all shrink-0"
            title="Ver zona en mapa"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
          </button>
        </div>
      </header>

      {/* ══ CONTENIDO ═══════════════════════════════════════════════════════ */}
      <main className="flex-1 pb-28">

        {/* Banner Carousel */}
        <div className="p-4">
          <FeaturedCarousel />
        </div>

        {/* ── Filtro rubro (Pills estilizadas) ── */}
        <div className="px-4 pb-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3">
            {RUBROS.map(r => (
              <button
                key={r}
                onClick={() => setFiltroRubro(r)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${filtroRubro === r
                  ? 'bg-slate-900 border-slate-900 text-primary dark:bg-white dark:border-white dark:text-slate-950 shadow-lg'
                  : 'bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-primary/30'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {r === 'todos' ? 'category' : RUBRO_ICON[r] || 'category'}
                </span>
                {r === 'todos' ? 'Todos' : RUBRO_LABELS[r] || r}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-4 p-4"
            >
              {[1, 1, 1].map((_, i) => (
                <div key={i} className="h-44 rounded-[32px] bg-white dark:bg-slate-900 animate-pulse border border-slate-100 dark:border-slate-800" />
              ))}
            </motion.div>
          ) : tab === 'ofertas' ? (

            /*** ══ SECCIÓN OFERTAS ════ ***/
            <motion.div
              key="ofertas"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-5 px-4"
            >
              {ofertasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-24 rounded-[40px] bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-6xl text-slate-300">sentiment_dissatisfied</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white">Sin promociones</h3>
                  <p className="text-slate-400 text-sm mt-2 max-w-[250px]">No encontramos ofertas para los filtros seleccionados.</p>
                </div>
              ) : (
                ofertasFiltradas.map((oferta, idx) => {
                  const cfg = TIPO_CFG[oferta.tipo];
                  return (
                    <motion.div
                      key={oferta.id}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative rounded-[32px] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none active:scale-[0.98] transition-transform"
                    >
                      {/* Badge lateral tipo */}
                      <div className={`absolute top-0 right-0 px-5 py-2 rounded-bl-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-sm z-10 ${cfg.badge}`}>
                        {cfg.label}
                      </div>

                      <div className="p-6">
                        <div className="flex items-start gap-5">
                          <div className={`size-16 shrink-0 rounded-[22px] bg-gradient-to-br ${cfg.gradFrom} ${cfg.gradTo} p-0.5 shadow-lg shadow-primary/10`}>
                            <div className="w-full h-full rounded-[20px] bg-white/10 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                              {oferta.descuento_porcentaje ? (
                                <>
                                  <span className="text-2xl font-black">-{oferta.descuento_porcentaje}</span>
                                  <span className="text-[10px] font-bold opacity-80 mt-[-4px]">%</span>
                                </>
                              ) : (
                                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-black leading-tight text-slate-800 dark:text-white mb-2 group-hover:text-primary transition-colors pr-16 uppercase italic tracking-tighter">
                              {oferta.titulo}
                            </h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 leading-relaxed mb-4">
                              {oferta.descripcion || 'Sin descripción adicional.'}
                            </p>
                          </div>
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`size-9 rounded-xl ${RUBRO_COLOR[oferta.comercio?.rubro || 'otro']} flex items-center justify-center text-white shrink-0`}>
                              <span className="material-symbols-outlined text-lg">{RUBRO_ICON[oferta.comercio?.rubro || 'otro']}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black truncate text-slate-800 dark:text-white uppercase tracking-tight">{oferta.comercio?.nombre_apellido}</p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">location_on</span>
                                {oferta.comercio?.municipio}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenMap(oferta.comercio)}
                            className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-slate-100 dark:border-slate-700 shrink-0"
                          >
                            <span className="material-symbols-outlined text-xl">explore</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>

          ) : (

            /*** ══ SECCIÓN COMERCIOS ════ ***/
            <motion.div
              key="comercios"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4 px-4"
            >
              {/* Banner info */}
              <div className="bg-slate-900 p-6 rounded-[32px] flex items-center gap-5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none translate-x-1/2 -translate-y-1/2">
                  <span className="material-symbols-outlined text-9xl text-white">store</span>
                </div>
                <div className="size-14 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(255,200,0,0.4)]">
                  <span className="material-symbols-outlined text-slate-900 text-3xl font-black">verified</span>
                </div>
                <div className="relative z-10 text-white">
                  <h3 className="font-black text-lg uppercase tracking-tight italic">Red de Alianzas</h3>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mt-1">Beneficios exclusivos para nuestros socios</p>
                </div>
              </div>

              {comerciosFiltrados.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl text-slate-200">store</span>
                  <p className="text-slate-400 font-bold mt-4 italic">No se encontraron comercios</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {comerciosFiltrados.map((comercio, idx) => {
                    const icon = RUBRO_ICON[comercio.rubro] || 'storefront';
                    const color = RUBRO_COLOR[comercio.rubro] || 'bg-slate-500';
                    const label = RUBRO_LABELS[comercio.rubro] || comercio.rubro;
                    return (
                      <motion.div
                        key={comercio.id}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm border border-slate-200/50 dark:border-slate-800 group active:scale-[0.98] transition-all"
                      >
                        <div className={`size-14 rounded-2xl ${color} flex items-center justify-center shrink-0 shadow-lg shadow-slate-200 dark:shadow-none group-hover:rotate-6 transition-transform`}>
                          <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-black text-sm uppercase italic tracking-tight text-slate-800 dark:text-white truncate">{comercio.nombre_apellido}</h4>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenMap(comercio); }}
                              className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors flex items-center justify-center border border-slate-100 dark:border-slate-700"
                            >
                              <span className="material-symbols-outlined text-lg">explore</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${color} bg-opacity-10 text-slate-700 dark:text-slate-200`}>
                              {label}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                              <span className="material-symbols-outlined text-[10px]">location_on</span>
                              {comercio.municipio}
                            </span>
                          </div>

                          {comercio.telefono && (
                            <a
                              href={`tel:${comercio.telefono}`}
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-[10px] text-primary font-black mt-3 uppercase tracking-wider bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/20"
                            >
                              <span className="material-symbols-outlined text-sm">call</span>
                              {comercio.telefono}
                            </a>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
