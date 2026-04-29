import { useState, useEffect, useRef, useMemo } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import FeaturedCarousel from '../components/FeaturedCarousel';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Oferta {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: 'promocion' | 'descuento' | 'beneficio';
  descuento_porcentaje: number | null;
  fecha_fin: string | null;
  imagen_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  created_at?: string;
  comercio?: { nombre_apellido: string; rubro: string; municipio: string };
}
interface Comercio {
  id: string;
  nombre_apellido: string;
  rubro: string;
  municipio: string;
  telefono: string;
}
interface Profesional {
  id: string;
  nombre_apellido: string;
  rubro: string;       // profesion almacenada en campo rubro
  municipio: string;
  provincia: string;
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
  transporte: 'Transporte', socios_profesionales: 'Profesionales',
  comercio_general: 'Comercio Gral.', otro: 'Otro',
};
const RUBRO_ICON: Record<string, string> = {
  agropecuario: 'agriculture', veterinaria: 'vaccines',
  maquinaria_agricola: 'precision_manufacturing', insumos_agricolas: 'science',
  alimentacion: 'restaurant', construccion: 'construction',
  transporte: 'local_shipping', socios_profesionales: 'work',
  comercio_general: 'storefront', otro: 'category',
};
const RUBRO_COLOR: Record<string, string> = {
  agropecuario: 'bg-lime-500', veterinaria: 'bg-cyan-500',
  maquinaria_agricola: 'bg-orange-500', insumos_agricolas: 'bg-emerald-500',
  alimentacion: 'bg-amber-500', construccion: 'bg-stone-500',
  transporte: 'bg-blue-500', socios_profesionales: 'bg-violet-500',
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

const RUBROS = ['todos', 'socios_profesionales', 'veterinaria', 'maquinaria_agricola', 'insumos_agricolas', 'alimentacion', 'construccion', 'transporte', 'agropecuario'];

type Tab = 'ofertas' | 'comercios' | 'profesionales';

// ─── Componente ──────────────────────────────────────────────────────────────
export default function Promociones() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profesionales');
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [loadingProf, setLoadingProf] = useState(false);
  const [profCargados, setProfCargados] = useState(false);
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
        const [ofData, comData, munData] = await Promise.all([
          ofRes.json(), comRes.json(), munRes.json()
        ]);

        setOfertas(ofData.ofertas || []);
        setComercios(comData.comercios || []);

        const list = munData.municipios || [];
        const ordenManual = [
          'Capital', 'Itatí', 'Ramada Paso', 'San Cosme',
          'Santa Ana', 'Riachuelo', 'El Sombrero', 'Paso de la Patria'
        ];

        const sorted = [...list].sort((a: any, b: any) => {
          const idxA = ordenManual.indexOf(a.nombre);
          const idxB = ordenManual.indexOf(b.nombre);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.nombre.localeCompare(b.nombre);
        });
        setMunicipios(sorted);
      } catch (err) {
        console.error("Error cargando datos de promociones:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Carga lazy de profesionales al activar el tab (se cachea en profCargados)
  useEffect(() => {
    if (tab === 'profesionales' && !profCargados) {
      setLoadingProf(true);
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/profesionales`)
        .then(res => res.json())
        .then(data => {
          setProfesionales(data.profesionales || []);
          setProfCargados(true);
        })
        .catch(err => console.error('Error cargando profesionales:', err))
        .finally(() => setLoadingProf(false));
    }
  }, [tab, profCargados]);

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

  // Lógica de Priorización para Banners
  const ofertasDestacadas = useMemo(() => {
    let filtradas = ofertas;

    // 1. Prioridad: Municipio del socio
    const delMunicipio = ofertas.filter(o => o.comercio?.municipio === user?.municipio);

    if (delMunicipio.length > 0) {
      filtradas = delMunicipio;
    }

    // 2. Ordenar por fecha y luego descuento
    return [...filtradas].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b.descuento_porcentaje || 0) - (a.descuento_porcentaje || 0);
    }).slice(0, 5); // Tomar las mejores 5
  }, [ofertas, user?.municipio]);

  const handleOpenMap = (comercio?: Comercio | any) => {
    const term = comercio
      ? `${comercio.nombre_apellido || comercio.nombre_comercio} ${comercio.municipio || ''}`
      : (filtroMunicipio !== 'todos' ? `Sociedad Rural ${filtroMunicipio} Corrientes` : 'Corrientes Argentina');

    const query = encodeURIComponent(term);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const ofertasFiltradas = ofertas.filter(o => {
    const matchRubro = filtroRubro === 'todos' || o.comercio?.rubro === filtroRubro;

    let matchMun = false;
    const ofMunicipio = o.comercio?.municipio;
    if (filtroMunicipio === 'todos') {
      // Mostrar todas las que NO son del municipio del socio (incluyendo "No especificado" y null)
      matchMun = ofMunicipio !== user?.municipio;
    } else {
      matchMun = ofMunicipio === filtroMunicipio;
    }

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

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-xl border-b border-stone-200/60 dark:border-stone-800/60 transition-all duration-300 shadow-sm">
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
                  {tab === 'ofertas' ? `${ofertasFiltradas.length} ofertas activas` : tab === 'comercios' ? `${comerciosFiltrados.length} comercios` : `${profesionales.length} profesionales`}
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

        {/* ── Tab switcher tipo "segmento" — 3 pestañas ── */}
        <div className="flex gap-2 px-4 pb-4">
          <div className="flex-1 flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            {([
              { id: 'profesionales' as Tab, label: 'Profesionales', icon: 'assignment_ind', activeClass: 'bg-indigo-500' },
              { id: 'ofertas' as Tab, label: 'Ofertas', icon: 'sell', activeClass: 'bg-gradient-to-r from-orange-500 to-amber-500' },
              { id: 'comercios' as Tab, label: 'Comercios', icon: 'storefront', activeClass: 'bg-slate-700 dark:bg-slate-600' },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${tab === t.id ? 'text-white' : 'text-slate-400'}`}
              >
                {tab === t.id && (
                  <motion.div
                    layoutId="tab-bg"
                    className={`absolute inset-0.5 rounded-xl shadow-lg ${t.activeClass}`}
                  />
                )}
                <span className="relative z-10 material-symbols-outlined text-base">{t.icon}</span>
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Selector de Municipio ── */}
        <div className="px-4 pb-4 flex gap-2">
          <div className="relative flex-1" ref={dropdownRef}>
            <button
              onClick={() => setShowMunDropdown(!showMunDropdown)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:border-primary/50 transition-all text-sm font-bold active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                <span className="truncate max-w-[150px]">
                  {filtroMunicipio === 'todos' ? 'Otros Municipios' : filtroMunicipio}
                </span>
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
                    Todos los municipios
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
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
                  <button
                    onClick={() => { setFiltroMunicipio('No especificado'); setShowMunDropdown(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left text-sm font-bold transition-all ${filtroMunicipio === 'No especificado' ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    <span className="material-symbols-outlined text-lg opacity-40">help_outline</span>
                    Sin municipio asignado
                  </button>
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

        {/* Banner Carousel dinámico */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary animate-ping"></span>
              Promociones Locales
            </h2>
            {user?.municipio && (
              <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-lg border border-primary/20">
                {user.municipio}
              </span>
            )}
          </div>
          <FeaturedCarousel promociones={ofertasDestacadas} onViewPromotion={handleOpenMap} />
        </div>

        {/* ── Filtro rubro ── */}
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
          ) : tab === 'profesionales' ? (

            /*** ══ SECCIÓN PROFESIONALES ════ ***/
            <motion.div
              key="profesionales"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-4 px-4"
            >
              {/* Banner */}
              <div className="bg-indigo-600 p-6 rounded-[32px] flex items-center gap-5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none translate-x-1/2 -translate-y-1/2">
                  <span className="material-symbols-outlined text-9xl text-white">assignment_ind</span>
                </div>
                <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white text-3xl">verified</span>
                </div>
                <div className="relative z-10 text-white">
                  <h3 className="font-black text-lg uppercase tracking-tight italic">Socios Profesionales</h3>
                  <p className="text-indigo-200 text-[11px] font-bold uppercase tracking-wider mt-1">Profesionales de la Sociedad Rural</p>
                </div>
              </div>

              {loadingProf ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-3xl bg-white dark:bg-slate-900 animate-pulse border border-slate-100 dark:border-slate-800" />
                  ))}
                </div>
              ) : profesionales.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl text-slate-200">person_off</span>
                  <p className="text-slate-400 font-bold mt-4 italic">No hay profesionales registrados aún</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {profesionales
                    .filter(p => filtroMunicipio === 'todos' || p.municipio === filtroMunicipio)
                    .map((prof, idx) => (
                      <motion.div
                        key={prof.id}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl px-5 py-4 flex items-center gap-4 shadow-sm border border-indigo-200/50 dark:border-indigo-900/40 group active:scale-[0.98] transition-all"
                      >
                        <div className="size-14 rounded-2xl bg-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-transform">
                          <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>assignment_ind</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-black text-sm uppercase italic tracking-tight text-slate-800 dark:text-white truncate">{prof.nombre_apellido}</h4>
                            <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">Profesional</span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {prof.rubro && (
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">{prof.rubro}</span>
                            )}
                            {prof.municipio && (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                <span className="material-symbols-outlined text-[10px]">location_on</span>
                                {prof.municipio}
                              </span>
                            )}
                          </div>

                          {prof.telefono && (
                            <a
                              href={`tel:${prof.telefono}`}
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-[10px] text-primary font-black mt-3 uppercase tracking-wider bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/20"
                            >
                              <span className="material-symbols-outlined text-sm">call</span>
                              {prof.telefono}
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))
                  }
                </div>
              )}
            </motion.div>

          ) : tab === 'ofertas' ? (

            /*** ══ SECCIÓN OFERTAS ════ ***/
            <motion.div
              key="ofertas"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-5 px-4"
            >
              <div className="px-1">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Otras Promociones
                </h2>
              </div>

              {ofertasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-24 rounded-[40px] bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-6xl text-slate-300">sentiment_dissatisfied</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white">Sin ofertas</h3>
                  <p className="text-slate-400 text-sm mt-2 max-w-[250px]">No hay ofertas adicionales en esta ubicación.</p>
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
                      className="group relative rounded-[32px] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none active:scale-[0.98] transition-all"
                    >
                      {/* Badge lateral tipo */}
                      <div className={`absolute top-0 right-0 px-5 py-2 rounded-bl-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-sm z-10 ${cfg.badge}`}>
                        {cfg.label}
                      </div>

                      <div className="p-6">
                        <div className="flex items-start gap-5">
                          {/* Contenedor de Imagen o Icono */}
                          <div className={`size-16 shrink-0 rounded-[22px] bg-gradient-to-br ${cfg.gradFrom} ${cfg.gradTo} p-0.5 shadow-lg shadow-primary/10 overflow-hidden`}>
                            {oferta.imagen_url ? (
                              <img
                                src={oferta.imagen_url}
                                alt={oferta.titulo}
                                className="w-full h-full object-cover rounded-[20px]"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '';
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
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
                            )}
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

                        {/* Social Buttons (If exist) */}
                        {(oferta.instagram_url || oferta.facebook_url) && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {oferta.instagram_url && (
                              <button
                                onClick={() => window.open(oferta.instagram_url!, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
                              >
                                <i className="fa-brands fa-instagram text-base"></i>
                                Instagram
                              </button>
                            )}
                            {oferta.facebook_url && (
                              <button
                                onClick={() => window.open(oferta.facebook_url!, '_blank')}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#1877F2] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
                              >
                                <i className="fa-brands fa-facebook text-base"></i>
                                Facebook
                              </button>
                            )}
                          </div>
                        )}

                        <div className="h-px bg-slate-100 dark:bg-slate-800 mb-4" />

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 overflow-hidden flex-1">
                            {/* Interactive Category Icon */}
                            <button
                              onClick={() => {
                                setFiltroRubro(oferta.comercio?.rubro || 'otro');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`size-10 rounded-xl ${RUBRO_COLOR[oferta.comercio?.rubro || 'otro']} flex items-center justify-center text-white shrink-0 shadow-lg shadow-current/20 hover:scale-110 active:scale-95 transition-all group/rubro relative`}
                              title={`Filtrar por ${RUBRO_LABELS[oferta.comercio?.rubro || 'otro']}`}
                            >
                              <span className="material-symbols-outlined text-xl">{RUBRO_ICON[oferta.comercio?.rubro || 'otro']}</span>
                              {/* Tooltip simple */}
                              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/rubro:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 font-bold">
                                {RUBRO_LABELS[oferta.comercio?.rubro || 'otro']}
                              </span>
                            </button>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black truncate text-slate-800 dark:text-white uppercase tracking-tight">{oferta.comercio?.nombre_apellido}</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setFiltroMunicipio(oferta.comercio?.municipio || 'todos');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-primary flex items-center gap-0.5 transition-colors group/muni"
                                >
                                  <span className="material-symbols-outlined text-[12px] group-hover/muni:animate-bounce">location_on</span>
                                  <span className="border-b border-transparent group-hover/muni:border-primary/50">{oferta.comercio?.municipio}</span>
                                </button>
                                {oferta.comercio?.municipio === user?.municipio && (
                                  <span className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded shadow-sm border border-emerald-500/20">Cerca</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenMap(oferta.comercio)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-primary hover:bg-slate-800 dark:hover:bg-slate-700 transition-all border border-slate-800 dark:border-slate-700 shrink-0 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/10"
                          >
                            <span className="material-symbols-outlined text-lg">explore</span>
                            Ver
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
                  <h3 className="font-black text-lg uppercase tracking-tight italic">Socios Comerciales</h3>
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
    </div>
  );
}
