import { useState, useEffect, useRef, useMemo } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import FeaturedCarousel from '../components/FeaturedCarousel';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import paisaje from '../assets/paisaje.png';

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
const normalizeText = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const SYNONYMS: Record<string, string[]> = {
  "nafta": ["estacion de servicio", "combustible", "ypf", "shell"],
  "ropa": ["vestimentas", "indumentaria", "ropa", "calzado", "accesorio"],
  "ropas": ["vestimentas", "indumentaria"],
  "ninos": ["gurises", "infantil", "juguetes", "niños"]
};

const normalizeRubro = (original: string) => {
  if (!original) return 'otro';
  const text = normalizeText(original);
  if (text.includes('nin') || text.includes('infantil') || text.includes('juguete') || text.includes('gurises')) return 'gurises';
  if (text.includes('ropa') || text.includes('indumentaria') || text.includes('vestimenta') || text.includes('calzado') || text.includes('accesorio')) return 'vestimentas';
  return original;
};

const RUBRO_LABELS: Record<string, string> = {
  agropecuario: 'Agropecuario', veterinaria: 'Veterinaria',
  maquinaria_agricola: 'Maquinaria', insumos_agricolas: 'Insumos Agríc.',
  alimentacion: 'Alimentación', construccion: 'Construcción',
  transporte: 'Transporte', socios_profesionales: 'Profesionales',
  vestimentas: 'Vestimentas e Indumentarias', gurises: 'Gurises',
  comercio_general: 'Comercio Gral.', otro: 'Otro',
};
const RUBRO_ICON: Record<string, string> = {
  agropecuario: 'agriculture', veterinaria: 'vaccines',
  maquinaria_agricola: 'precision_manufacturing', insumos_agricolas: 'science',
  alimentacion: 'restaurant', construccion: 'construction',
  transporte: 'local_shipping', socios_profesionales: 'work',
  vestimentas: 'checkroom', gurises: 'child_care',
  comercio_general: 'storefront', otro: 'category',
};
const RUBRO_COLOR: Record<string, string> = {
  agropecuario: 'bg-lime-500', veterinaria: 'bg-cyan-500',
  maquinaria_agricola: 'bg-orange-500', insumos_agricolas: 'bg-emerald-500',
  alimentacion: 'bg-amber-500', construccion: 'bg-stone-500',
  transporte: 'bg-blue-500', socios_profesionales: 'bg-violet-500',
  vestimentas: 'bg-pink-500', gurises: 'bg-yellow-500',
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

const RUBROS = ['todos', 'vestimentas', 'gurises', 'socios_profesionales', 'veterinaria', 'maquinaria_agricola', 'insumos_agricolas', 'alimentacion', 'construccion', 'transporte', 'agropecuario'];

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
        
        const rawComercios = comData.comercios || [];
        setComercios(rawComercios.map((c: any) => ({
          ...c,
          rubro: normalizeRubro(c.rubro)
        })));

        const list = munData.municipios || [];
        const sorted = [...list].sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
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

  const matchSearch = (textArray: (string | undefined | null)[]) => {
    if (!busqueda) return true;
    const q = normalizeText(busqueda);
    const searchTerms = [q];
    Object.entries(SYNONYMS).forEach(([key, values]) => {
      if (normalizeText(key).includes(q) || values.some(v => normalizeText(v).includes(q))) {
        searchTerms.push(normalizeText(key), ...values.map(normalizeText));
      }
    });
    
    const combined = textArray.filter(Boolean).map(t => normalizeText(t!)).join(' ');
    return searchTerms.some(term => combined.includes(term));
  };

  const ofertasFiltradas = ofertas.filter(o => {
    const matchRubro = filtroRubro === 'todos' || o.comercio?.rubro === filtroRubro;

    let matchMun = false;
    const ofMunicipio = o.comercio?.municipio;
    if (filtroMunicipio === 'todos') {
      matchMun = ofMunicipio !== user?.municipio;
    } else {
      matchMun = ofMunicipio === filtroMunicipio;
    }

    const matchQ = matchSearch([o.titulo, o.descripcion, o.comercio?.nombre_apellido, o.comercio?.rubro ? RUBRO_LABELS[o.comercio.rubro] : '', ofMunicipio]);

    return matchRubro && matchMun && matchQ;
  });

  const comerciosFiltrados = comercios.filter(c => {
    const matchRubro = filtroRubro === 'todos' || c.rubro === filtroRubro;
    const matchMun = filtroMunicipio === 'todos' || c.municipio === filtroMunicipio;
    const matchQ = matchSearch([c.nombre_apellido, c.rubro ? RUBRO_LABELS[c.rubro] : '', c.municipio]);
    
    return matchRubro && matchMun && matchQ;
  });

  const profesionalesFiltrados = profesionales.filter(p => {
    const matchMun = filtroMunicipio === 'todos' || p.municipio === filtroMunicipio;
    const matchQ = matchSearch([p.nombre_apellido, p.rubro, p.municipio]);
    return matchMun && matchQ;
  });

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 max-w-md mx-auto shadow-2xl overflow-x-hidden">
      {/* Fondo con imagen sutil de ganadería/campo */}
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

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-b border-stone-200/50 dark:border-stone-800 transition-all duration-300 shadow-sm">
        <div className="flex items-center px-4 pt-4 pb-3 gap-3">
          <Link to="/home" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4eedd] dark:bg-stone-800 hover:bg-[#e5dfce] transition-colors border border-[#e5dfce] dark:border-stone-700/50 shadow-sm">
            <span className="material-symbols-outlined text-stone-700 dark:text-stone-300">arrow_back</span>
          </Link>

          {showSearch ? (
            <div className="flex-1 relative flex items-center">
              <motion.input
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                autoFocus
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && busqueda.trim()) setShowSearch(false);
                  if (e.key === 'Escape') { setBusqueda(''); setShowSearch(false); }
                }}
                placeholder="Buscar beneficios, comercios, socios..."
                className="w-full h-11 rounded-2xl bg-white dark:bg-stone-800 pl-4 pr-10 text-sm outline-none border-2 border-[#245b31]/20 focus:border-[#245b31] transition-all shadow-inner text-stone-800 dark:text-stone-100 font-medium"
              />

              {busqueda && (
                <button 
                  onClick={() => setBusqueda('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-6 rounded-full bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1">
              <h1 className="text-xl font-black italic tracking-tighter text-stone-800 dark:text-white uppercase leading-none font-display">Beneficios</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="size-1.5 rounded-full bg-[#245b31] animate-pulse"></div>
                <p className="text-[10px] uppercase tracking-widest font-black text-stone-400">
                  {tab === 'ofertas' ? `${ofertasFiltradas.length} ofertas activas` : tab === 'comercios' ? `${comerciosFiltrados.length} comercios` : `${profesionalesFiltrados.length} profesionales`}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (showSearch && busqueda.trim()) {
                // Hay texto → confirmar búsqueda: cerrar panel y dejar filtro activo
                setShowSearch(false);
              } else if (showSearch && !busqueda.trim()) {
                // Panel abierto sin texto → cerrar sin búsqueda
                setShowSearch(false);
              } else {
                // Panel cerrado → abrir
                setShowSearch(true);
              }
            }}
            aria-label="Buscar"
            className={`
              flex shrink-0 items-center justify-center gap-1.5 rounded-2xl
              transition-all shadow-sm active:scale-95
              ${showSearch
                ? 'bg-[#245b31] text-white h-10 px-2 md:px-3'
                : 'bg-[#f4eedd] dark:bg-stone-800 text-stone-500 size-10'}
              ${showSearch && busqueda.trim() ? 'ring-2 ring-[#245b31]/30' : ''}
            `}
          >
            {/* Texto "IR" — solo visible en md+ (tablet/desktop) */}
            {showSearch && (
              <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">
                Ir
              </span>
            )}
            <span className="material-symbols-outlined text-lg">
              {showSearch ? 'arrow_forward' : 'search'}
            </span>
          </button>

        </div>

        {/* ── Tab switcher tipo "segmento" — 3 pestañas ── */}
        <div className="flex gap-2 px-4 pb-4">
          <div className="flex-1 flex p-1 bg-stone-100 dark:bg-stone-800 rounded-[2rem]">
            {([
              { id: 'profesionales' as Tab, label: 'Profesionales', icon: 'assignment_ind', activeClass: 'bg-[#4b5e4a]' },
              { id: 'ofertas' as Tab, label: 'Ofertas', icon: 'sell', activeClass: 'bg-[#995c27]' },
              { id: 'comercios' as Tab, label: 'Comercios', icon: 'storefront', activeClass: 'bg-[#784e32]' },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 flex items-center justify-center gap-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors ${tab === t.id ? 'text-white' : 'text-stone-400'}`}
              >
                {tab === t.id && (
                  <motion.div
                    layoutId="tab-bg"
                    className={`absolute inset-0.5 rounded-[1.5rem] shadow-sm ${t.activeClass}`}
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
              className="w-full flex items-center justify-between px-4 py-3 bg-[#f4eedd]/50 dark:bg-stone-800 border border-[#e5dfce] dark:border-stone-700 rounded-2xl shadow-sm hover:border-[#245b31]/50 transition-all text-sm font-bold active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#245b31] text-xl">location_on</span>
                <span className="truncate max-w-[150px] uppercase tracking-wider text-xs">
                  {filtroMunicipio === 'todos' ? 'Otros Municipios' : filtroMunicipio}
                </span>
              </div>
              <span className={`material-symbols-outlined text-stone-400 transition-transform duration-300 ${showMunDropdown ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            <AnimatePresence>
              {showMunDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-[calc(100%+8px)] left-0 right-0 max-h-80 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl shadow-2xl overflow-y-auto z-50 p-2"
                >
                  <button
                    onClick={() => { setFiltroMunicipio('todos'); setShowMunDropdown(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all ${filtroMunicipio === 'todos' ? 'bg-[#245b31]/10 text-[#245b31]' : 'hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'}`}
                  >
                    <span className="material-symbols-outlined text-lg">public</span>
                    Todos
                  </button>
                  <div className="h-px bg-stone-100 dark:bg-stone-700 my-1 mx-2" />
                  {municipios.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setFiltroMunicipio(m.nombre); setShowMunDropdown(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all ${filtroMunicipio === m.nombre ? 'bg-[#245b31]/10 text-[#245b31]' : 'hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'}`}
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
            className="size-12 rounded-2xl bg-[#4b5e4a] text-white flex items-center justify-center shadow-md hover:bg-[#3a4a3a] active:scale-95 transition-all shrink-0"
            title="Ver zona en mapa"
          >
            <span className="material-symbols-outlined">map</span>
          </button>
        </div>
      </header>

      {/* ══ CONTENIDO ═══════════════════════════════════════════════════════ */}
      <main className="flex-1 pb-28">

        {/* Banner Carousel dinámico */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2 italic">
              <span className="size-1.5 rounded-full bg-[#245b31]"></span>
              Promociones Locales
            </h2>
            {user?.municipio && (
              <span className="text-[9px] font-black uppercase bg-[#245b31]/10 text-[#245b31] px-2 py-0.5 rounded-lg border border-[#245b31]/20">
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
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all border-2 ${filtroRubro === r
                  ? 'bg-stone-900 border-stone-900 text-white dark:bg-white dark:border-white dark:text-stone-950 shadow-md'
                  : 'bg-[#f4eedd]/50 dark:bg-stone-800/50 border-[#e5dfce] dark:border-stone-800 text-stone-500 hover:border-[#245b31]/30'
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
                <div key={i} className="h-44 rounded-[2rem] bg-stone-100 dark:bg-stone-800 animate-pulse border border-stone-200 dark:border-stone-700" />
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
              <div className="bg-[#4b5e4a] p-6 rounded-[2rem] flex items-center gap-5 relative overflow-hidden shadow-lg border border-[#3a4a3a]">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none translate-x-1/2 -translate-y-1/2">
                  <span className="material-symbols-outlined text-9xl text-white">assignment_ind</span>
                </div>
                <div className="size-14 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
                  <span className="material-symbols-outlined text-white text-3xl">verified</span>
                </div>
                <div className="relative z-10 text-white">
                  <h3 className="font-black text-lg uppercase tracking-tight italic font-display">Socios Profesionales</h3>
                  <p className="text-stone-200 text-[10px] font-bold uppercase tracking-widest mt-1">Directorio Institucional</p>
                </div>
              </div>

              {loadingProf ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-[2rem] bg-[#f4eedd] animate-pulse border border-[#e5dfce]" />
                  ))}
                </div>
              ) : profesionales.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl text-stone-200">person_off</span>
                  <p className="text-stone-400 font-bold mt-4 italic uppercase text-xs tracking-widest">Sin registros</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {profesionalesFiltrados
                    .map((prof, idx) => (
                      <motion.div
                        key={prof.id}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-[#f4eedd] dark:bg-stone-800 rounded-[2rem] px-5 py-4 flex items-center gap-4 shadow-sm border border-[#e5dfce] dark:border-stone-700/50 group active:scale-[0.98] transition-all relative overflow-hidden"
                      >
                        <div className="absolute -bottom-4 -right-4 w-20 h-20 text-[#8b9172] opacity-20 pointer-events-none">
                          <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                        </div>

                        <div className="size-14 rounded-full bg-[#4b5e4a] flex items-center justify-center shrink-0 shadow-sm border border-white/10 z-10">
                          <span className="material-symbols-outlined text-white text-2xl">assignment_ind</span>
                        </div>

                        <div className="flex-1 min-w-0 z-10">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm uppercase italic tracking-tighter text-stone-800 dark:text-white truncate font-display">{prof.nombre_apellido}</h4>
                            <span className="text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest bg-[#4b5e4a]/10 text-[#4b5e4a] border border-[#4b5e4a]/20 shrink-0">Socio</span>
                          </div>

                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {prof.rubro && (
                              <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider italic">{prof.rubro}</span>
                            )}
                            {prof.municipio && (
                              <span className="flex items-center gap-0.5 text-[9px] text-stone-400 font-bold uppercase tracking-tight">
                                <span className="material-symbols-outlined text-[10px]">location_on</span>
                                {prof.municipio}
                              </span>
                            )}
                          </div>

                          {prof.telefono && (
                            <a
                              href={`tel:${prof.telefono}`}
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-[9px] text-emerald-700 dark:text-emerald-400 font-black mt-3 uppercase tracking-wider bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[14px]">call</span>
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
                <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 italic">
                  Otras Promociones
                </h2>
              </div>

              {ofertasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-24 rounded-[40px] bg-stone-100 dark:bg-stone-900 flex items-center justify-center mb-6 border border-stone-200">
                    <span className="material-symbols-outlined text-6xl text-stone-300">sell</span>
                  </div>
                  <h3 className="text-xl font-black text-stone-800 dark:text-white font-display uppercase italic tracking-tighter">Sin ofertas</h3>
                  <p className="text-stone-400 text-[10px] uppercase tracking-widest font-bold mt-2">No hay beneficios adicionales en esta zona.</p>
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
                      className="group relative rounded-[2rem] overflow-hidden bg-[#f4eedd] dark:bg-stone-800 border border-[#e5dfce] dark:border-stone-700/50 shadow-sm active:scale-[0.98] transition-all"
                    >
                      {/* Adorno Rural */}
                      <div className="absolute -bottom-4 -right-4 w-24 h-24 text-[#a87f5d] opacity-10 group-hover:opacity-20 pointer-events-none z-0">
                        <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                      </div>

                      {/* Badge lateral tipo */}
                      <div className={`absolute top-0 right-0 px-5 py-2 rounded-bl-[1.5rem] font-black text-[9px] uppercase tracking-widest shadow-sm z-10 bg-white/40 backdrop-blur-md text-stone-800 border-l border-b border-[#e5dfce]`}>
                        {cfg.label}
                      </div>

                      <div className="p-6 relative z-10">
                        <div className="flex items-start gap-5">
                          {/* Contenedor de Imagen o Icono */}
                          <div className={`size-16 shrink-0 rounded-2xl bg-white p-1 shadow-sm border border-[#e5dfce] overflow-hidden flex items-center justify-center`}>
                            {oferta.imagen_url ? (
                              <img src={oferta.imagen_url} alt={oferta.titulo} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <div className={`w-full h-full rounded-xl flex flex-col items-center justify-center text-white ${tab === 'ofertas' ? 'bg-[#995c27]' : 'bg-[#245b31]'}`}>
                                {oferta.descuento_porcentaje ? (
                                  <span className="text-xl font-black">-{oferta.descuento_porcentaje}%</span>
                                ) : (
                                  <span className="material-symbols-outlined text-3xl">{cfg.icon}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-bold leading-tight text-stone-800 dark:text-white mb-2 pr-16 uppercase italic tracking-tighter font-display">
                              {oferta.titulo}
                            </h4>
                            <p className="text-stone-600 dark:text-stone-400 text-xs line-clamp-2 leading-relaxed mb-4">
                              {oferta.descripcion || 'Beneficio exclusivo para socios de la Sociedad Rural.'}
                            </p>
                          </div>
                        </div>

                        <div className="h-px bg-[#e5dfce] dark:bg-stone-700/50 mb-4" />

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 overflow-hidden flex-1">
                            {/* Icono de Rubro Circular */}
                            <div className={`size-10 rounded-full ${RUBRO_COLOR[oferta.comercio?.rubro || 'otro']} flex items-center justify-center text-white shrink-0 shadow-sm border-2 border-white/20`}>
                              <span className="material-symbols-outlined text-lg">{RUBRO_ICON[oferta.comercio?.rubro || 'otro']}</span>
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-black truncate text-stone-800 dark:text-white uppercase tracking-tight">{oferta.comercio?.nombre_apellido}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-stone-500 dark:text-stone-400 flex items-center gap-0.5 font-bold uppercase tracking-wider">
                                  <span className="material-symbols-outlined text-[12px]">location_on</span>
                                  {oferta.comercio?.municipio}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenMap(oferta.comercio)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-800 text-white hover:bg-stone-800 transition-all shrink-0 text-[10px] font-black uppercase tracking-widest shadow-sm"
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
              <div className="bg-[#784e32] p-6 rounded-[2rem] flex items-center gap-5 relative overflow-hidden shadow-lg border border-[#633e28]">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none translate-x-1/2 -translate-y-1/2">
                  <span className="material-symbols-outlined text-9xl text-white">store</span>
                </div>
                <div className="size-14 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
                  <span className="material-symbols-outlined text-white text-3xl">verified</span>
                </div>
                <div className="relative z-10 text-white">
                  <h3 className="font-black text-lg uppercase tracking-tight italic font-display">Socios Comerciales</h3>
                  <p className="text-stone-200 text-[10px] font-bold uppercase tracking-widest mt-1">Guía de Beneficios</p>
                </div>
              </div>

              {comerciosFiltrados.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl text-stone-200">store</span>
                  <p className="text-stone-400 font-bold mt-4 italic uppercase text-[10px] tracking-widest">Sin comercios adheridos</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {comerciosFiltrados.map((comercio, idx) => {
                    const icon = RUBRO_ICON[comercio.rubro] || 'storefront';
                    const color = RUBRO_COLOR[comercio.rubro] || 'bg-stone-500';
                    const label = RUBRO_LABELS[comercio.rubro] || comercio.rubro;
                    return (
                      <motion.div
                        key={comercio.id}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-[#f4eedd] dark:bg-stone-800 rounded-[2rem] px-5 py-4 flex items-center gap-4 shadow-sm border border-[#e5dfce] dark:border-stone-700/50 active:scale-[0.98] transition-all relative overflow-hidden group"
                      >
                         <div className="absolute -bottom-4 -right-4 w-20 h-20 text-[#8b755e] opacity-10 pointer-events-none">
                          <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                        </div>

                        <div className={`size-14 rounded-full ${color} flex items-center justify-center shrink-0 shadow-sm border-2 border-white/20 z-10 group-hover:scale-110 transition-transform`}>
                          <span className="material-symbols-outlined text-white text-2xl">{icon}</span>
                        </div>

                        <div className="flex-1 min-w-0 z-10">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm uppercase italic tracking-tighter text-stone-800 dark:text-white truncate font-display">{comercio.nombre_apellido}</h4>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenMap(comercio); }}
                              className="size-8 rounded-full bg-white/50 dark:bg-stone-700 text-stone-500 hover:text-emerald-700 transition-colors flex items-center justify-center border border-[#e5dfce] dark:border-stone-600"
                            >
                              <span className="material-symbols-outlined text-lg">explore</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${color} bg-opacity-10 text-stone-700 dark:text-white border border-black/10`}>
                              {label}
                            </span>
                            <span className="flex items-center gap-0.5 text-[9px] text-stone-400 font-bold uppercase tracking-tight">
                              <span className="material-symbols-outlined text-[10px]">location_on</span>
                              {comercio.municipio}
                            </span>
                          </div>

                          {comercio.telefono && (
                            <a
                              href={`tel:${comercio.telefono}`}
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-[9px] text-emerald-700 dark:text-emerald-400 font-black mt-3 uppercase tracking-wider bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[14px]">call</span>
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
