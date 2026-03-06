import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';

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
  const [filtroRubro, setFiltroRubro] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [ofRes, comRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ofertas/publicas`),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/comercios`),
        ]);
        setOfertas((await ofRes.json()).ofertas || []);
        setComercios((await comRes.json()).comercios || []);
      } catch { /* silencioso */ } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const ofertasFiltradas = ofertas.filter(o =>
    filtroRubro === 'todos' || o.comercio?.rubro === filtroRubro
  );
  const comerciosFiltrados = comercios.filter(c => {
    const matchRubro = filtroRubro === 'todos' || c.rubro === filtroRubro;
    const q = busqueda.toLowerCase();
    const matchQ = !busqueda || c.nombre_apellido.toLowerCase().includes(q) || (RUBRO_LABELS[c.rubro] || '').toLowerCase().includes(q);
    return matchRubro && matchQ;
  });

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center px-4 pt-4 pb-3 gap-3">
          <Link to="/home" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
          </Link>
          {showSearch ? (
            <input
              autoFocus
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onBlur={() => !busqueda && setShowSearch(false)}
              placeholder="Buscar comercio..."
              className="flex-1 h-10 rounded-full bg-slate-100 dark:bg-slate-800 px-4 text-sm outline-none"
            />
          ) : (
            <div className="flex-1">
              <h1 className="text-lg font-extrabold tracking-tight leading-none">Beneficios para Socios</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {tab === 'ofertas' ? `${ofertasFiltradas.length} ofertas activas` : `${comercios.length} comercios adheridos`}
              </p>
            </div>
          )}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <span className="material-symbols-outlined text-slate-500">{showSearch ? 'close' : 'search'}</span>
          </button>
        </div>

        {/* ── Tab switcher tipo "pill" ── */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setTab('ofertas')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${tab === 'ofertas'
                ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-300/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
          >
            <span className="material-symbols-outlined text-base" style={tab === 'ofertas' ? { fontVariationSettings: "'FILL' 1" } : {}}>sell</span>
            Ofertas & Promos
          </button>
          <button
            onClick={() => setTab('comercios')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${tab === 'comercios'
                ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg shadow-slate-400/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
          >
            <span className="material-symbols-outlined text-base" style={tab === 'comercios' ? { fontVariationSettings: "'FILL' 1" } : {}}>storefront</span>
            Comercios
            {comercios.length > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${tab === 'comercios' ? 'bg-white/20 text-white' : 'bg-primary text-slate-900'}`}>
                {comercios.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Filtro rubro ── */}
        <div className={`flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide border-t ${tab === 'ofertas' ? 'border-orange-100 dark:border-orange-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className="flex gap-2 pt-3">
            {RUBROS.map(r => (
              <button
                key={r}
                onClick={() => setFiltroRubro(r)}
                className={`shrink-0 h-7 px-3 rounded-full text-xs font-semibold transition-all ${filtroRubro === r
                    ? tab === 'ofertas'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
              >
                {r === 'todos' ? 'Todos' : RUBRO_LABELS[r] || r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ CONTENIDO ═══════════════════════════════════════════════════════ */}
      <main className="flex-1 pb-28">

        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : tab === 'ofertas' ? (

          /*** ══ SECCIÓN OFERTAS — fondo crema/cálido con cards coloridas ════ ***/
          <div className="bg-amber-50/40 dark:bg-amber-900/5 min-h-full">
            {ofertasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
                <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-orange-400">sell</span>
                </div>
                <p className="font-bold text-slate-600 dark:text-slate-300">Sin ofertas disponibles</p>
                <p className="text-sm text-center max-w-xs">Los comercios adheridos publicarán sus promos y beneficios aquí.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-4">
                {ofertasFiltradas.map(oferta => {
                  const cfg = TIPO_CFG[oferta.tipo];
                  return (
                    <div
                      key={oferta.id}
                      className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-md shadow-slate-200/60 dark:shadow-none border border-slate-100 dark:border-slate-700"
                    >
                      {/* Cabecera degradada con tipo e ícono */}
                      <div className={`bg-gradient-to-r ${cfg.gradFrom} ${cfg.gradTo} px-5 py-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                          </div>
                          <div>
                            <p className="text-white/80 text-[11px] uppercase tracking-widest font-semibold">{cfg.label}</p>
                            <p className="text-white font-extrabold text-lg leading-tight">{oferta.titulo}</p>
                          </div>
                        </div>
                        {oferta.descuento_porcentaje && (
                          <div className="flex flex-col items-center bg-white/20 rounded-xl px-3 py-1.5">
                            <span className="text-white font-extrabold text-2xl leading-none">-{oferta.descuento_porcentaje}</span>
                            <span className="text-white/80 text-xs font-bold">%</span>
                          </div>
                        )}
                      </div>

                      {/* Cuerpo */}
                      <div className="px-5 py-4">
                        {oferta.descripcion && (
                          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-4">{oferta.descripcion}</p>
                        )}

                        <div className="flex items-center justify-between">
                          {/* Comercio que publica */}
                          {oferta.comercio ? (
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl ${RUBRO_COLOR[oferta.comercio.rubro] || 'bg-slate-400'} flex items-center justify-center`}>
                                <span className="material-symbols-outlined text-white text-base">{RUBRO_ICON[oferta.comercio.rubro] || 'storefront'}</span>
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-none text-slate-800 dark:text-slate-100">{oferta.comercio.nombre_apellido}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{oferta.comercio.municipio}</p>
                              </div>
                            </div>
                          ) : <div />}

                          {/* Vigencia */}
                          {oferta.fecha_fin ? (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                              <span className="material-symbols-outlined text-xs">event</span>
                              Hasta {new Date(oferta.fecha_fin).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">Sin vencimiento</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        ) : (

          /*** ══ SECCIÓN COMERCIOS — fondo oscuro/slate con directorio limpio ══ ***/
          <div className="bg-slate-100 dark:bg-slate-950 min-h-full p-4">

            {/* Banner verde "red de socios" */}
            <div className="mb-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-slate-900 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
              <div>
                <p className="text-white font-extrabold text-base leading-tight">Red de Comercios Adheridos</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Negocios que ofrecen condiciones especiales a los socios de la Sociedad Rural.
                </p>
              </div>
            </div>

            {comerciosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl">store</span>
                </div>
                <p className="font-bold">Sin comercios registrados</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {comerciosFiltrados.map(comercio => {
                  const icon = RUBRO_ICON[comercio.rubro] || 'storefront';
                  const color = RUBRO_COLOR[comercio.rubro] || 'bg-slate-500';
                  const label = RUBRO_LABELS[comercio.rubro] || comercio.rubro;
                  return (
                    <div
                      key={comercio.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3.5 flex items-center gap-4 shadow-sm border border-slate-100 dark:border-slate-700 active:scale-[0.98] transition-transform"
                    >
                      {/* Avatar de color según rubro */}
                      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shrink-0 shadow-md`}>
                        <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-extrabold text-sm leading-tight truncate">{comercio.nombre_apellido}</h3>
                          <span className="material-symbols-outlined text-slate-300 shrink-0 text-lg">chevron_right</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color} bg-opacity-10 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700`}>
                            {label}
                          </span>
                          {comercio.municipio && (
                            <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                              <span className="material-symbols-outlined text-xs">location_on</span>
                              {comercio.municipio}
                            </span>
                          )}
                        </div>
                        {comercio.telefono && (
                          <a
                            href={`tel:${comercio.telefono}`}
                            className="flex items-center gap-1 text-xs text-primary font-semibold mt-1.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <span className="material-symbols-outlined text-sm">call</span>
                            {comercio.telefono}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        )}
      </main>

      <BottomNav />
    </div>
  );
}
