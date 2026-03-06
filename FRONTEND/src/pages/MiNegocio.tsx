import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import GestionDependientes from '../components/GestionDependientes';
import NotificationBell from '../components/NotificationBell';

type TipoOferta = 'promocion' | 'descuento' | 'beneficio';

interface Oferta {
    id: string;
    titulo: string;
    descripcion: string;
    tipo: TipoOferta;
    descuento_porcentaje: number | null;
    imagen_url: string | null;
    fecha_fin: string | null;
    activo: boolean;
    created_at: string;
}

interface OfertaForm {
    titulo: string;
    descripcion: string;
    tipo: TipoOferta;
    descuento_porcentaje: string;
    fecha_fin: string;
}

interface SocioValidado {
    valido: boolean;
    mensaje: string;
    socio?: {
        id: string;
        nombre_apellido: string;
        dni: string;
        estado: string;
        municipio: string;
        rol?: string;
        tipo_vinculo?: string;
        titular_id?: string | null;
    };
}

const TIPO_CONFIG = {
    promocion: {
        label: 'Promoción',
        icon: 'local_offer',
        color: 'bg-orange-500',
        light: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
        text: 'text-orange-600 dark:text-orange-400',
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    },
    descuento: {
        label: 'Descuento',
        icon: 'percent',
        color: 'bg-emerald-500',
        light: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
        text: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    beneficio: {
        label: 'Beneficio',
        icon: 'star',
        color: 'bg-violet-500',
        light: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700',
        text: 'text-violet-600 dark:text-violet-400',
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    },
};

export default function MiNegocio() {
    const { user } = useAuth();
    const [ofertas, setOfertas] = useState<Oferta[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [filtro, setFiltro] = useState<TipoOferta | 'todas'>('todas');
    const [form, setForm] = useState<OfertaForm>({
        titulo: '',
        descripcion: '',
        tipo: 'promocion',
        descuento_porcentaje: '',
        fecha_fin: '',
    });

    // Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [scanResult, setScanResult] = useState<SocioValidado | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    const token = localStorage.getItem('sb_access_token') || '';

    const fetchOfertas = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ofertas`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await resp.json();
            setOfertas(data.ofertas || []);
        } catch {
            setError('Error al cargar ofertas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOfertas();
        return () => {
            if (scannerRef.current && isScanning) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, []);

    const handleCreateOferta = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ofertas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    titulo: form.titulo,
                    descripcion: form.descripcion,
                    tipo: form.tipo,
                    descuento_porcentaje: form.descuento_porcentaje ? parseInt(form.descuento_porcentaje) : null,
                    fecha_fin: form.fecha_fin || null,
                }),
            });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.detail || 'Error al crear oferta');
            }
            setShowForm(false);
            setForm({ titulo: '', descripcion: '', tipo: 'promocion', descuento_porcentaje: '', fecha_fin: '' });
            await fetchOfertas();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleOferta = async (id: string, activo: boolean) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ofertas/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ activo: !activo }),
            });
            setOfertas(prev => prev.map(o => o.id === id ? { ...o, activo: !activo } : o));
        } catch {
            setError('Error al actualizar oferta');
        }
    };

    const deleteOferta = async (id: string) => {
        if (!confirm('¿Eliminás esta oferta?')) return;
        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/ofertas/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            setOfertas(prev => prev.filter(o => o.id !== id));
        } catch {
            setError('Error al eliminar oferta');
        }
    };

    // --- QR Scanner Implementation ---
    const startScanner = async () => {
        setShowScanner(true);
        setScanResult(null);
        setError('');

        // Give UI time to render the reader div
        setTimeout(async () => {
            try {
                const scanner = new Html5Qrcode("qr-reader");
                scannerRef.current = scanner;
                setIsScanning(true);

                await scanner.start(
                    { facingMode: "environment" }, // Prefer back camera
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    async (decodedText) => {
                        // Success callback
                        await scanner.stop();
                        setIsScanning(false);
                        const urlMatch = decodedText.match(/\/valida-socio\/([a-f0-9-]+)$/i);
                        const socioIdToValidate = urlMatch ? urlMatch[1] : decodedText;
                        validarSocio(socioIdToValidate);
                    },
                    (errorMessage) => {
                        // Ignore standard read failures
                    }
                );
            } catch (err) {
                console.error("Camera access error:", err);
                setError("No se pudo acceder a la cámara. Revisa los permisos.");
                setIsScanning(false);
            }
        }, 100);
    };

    const stopScanner = async () => {
        if (scannerRef.current && isScanning) {
            try {
                await scannerRef.current.stop();
            } catch (err) {
                console.error("Error stopping scanner", err);
            }
        }
        setIsScanning(false);
        setShowScanner(false);
    };

    const validarSocio = async (socioId: string) => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/valida-socio/${socioId}`);

            if (!resp.ok && resp.status !== 400 && resp.status !== 404) {
                throw new Error('Error de conexión al validar.');
            }

            const data = await resp.json();

            if (!resp.ok) {
                // Return structured error as a falsy validation result
                setScanResult({
                    valido: false,
                    mensaje: data.detail || 'Código QR inválido.'
                });
                return;
            }

            setScanResult(data as SocioValidado);

        } catch (err: any) {
            setScanResult({
                valido: false,
                mensaje: err.message || 'Ocurrió un error inesperado al leer el QR.'
            });
        }
    };

    const ofertasFiltradas = filtro === 'todas' ? ofertas : ofertas.filter(o => o.tipo === filtro);

    const inputClass =
        'w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-12 px-4 text-sm';

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-display relative">
            {/* Header */}
            <header className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-12 pb-6 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Panel de Comercio</p>
                        <h1 className="text-2xl font-extrabold mt-1">Mi Negocio</h1>
                        <p className="text-slate-300 text-sm mt-0.5">{user?.nombre_apellido}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-white">storefront</span>
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                    {(['promocion', 'descuento', 'beneficio'] as TipoOferta[]).map(tipo => {
                        const count = ofertas.filter(o => o.tipo === tipo && o.activo).length;
                        const cfg = TIPO_CONFIG[tipo];
                        return (
                            <div key={tipo} className="bg-white/10 rounded-xl p-3 text-center">
                                <span className="material-symbols-outlined text-xl block mb-1">{cfg.icon}</span>
                                <span className="text-xl font-bold block">{count}</span>
                                <span className="text-[10px] text-slate-300 uppercase tracking-wide">{cfg.label}s</span>
                            </div>
                        );
                    })}
                </div>
            </header>

            <main className="flex-1 px-4 pb-28 pt-4">
                {/* BOTÓN SCANNER */}
                <button
                    onClick={startScanner}
                    className="w-full mb-4 flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold py-4 rounded-2xl transition-all shadow-xl active:scale-95"
                >
                    <span className="material-symbols-outlined text-2xl">qr_code_scanner</span>
                    VALIDAR CARNET SOCIO
                </button>

                <div className="flex items-center gap-3 my-6">
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mis Publicaciones</span>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                </div>

                {/* Botón nueva oferta */}
                <button
                    onClick={() => setShowForm(true)}
                    className="w-full mb-4 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-slate-900 font-bold py-3.5 rounded-2xl transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    Nueva Oferta / Beneficio
                </button>

                {error && !showScanner && (
                    <div className="mb-3 p-3 bg-red-100 border border-red-300 text-red-700 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {/* Modal de nueva oferta */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
                        <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold">Nueva Oferta</h2>
                                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleCreateOferta} className="flex flex-col gap-4">
                                {/* Tipo */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Tipo</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['promocion', 'descuento', 'beneficio'] as TipoOferta[]).map(t => {
                                            const cfg = TIPO_CONFIG[t];
                                            return (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, tipo: t })}
                                                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${form.tipo === t
                                                        ? `border-current ${cfg.text} ${cfg.light}`
                                                        : 'border-slate-200 dark:border-slate-700'
                                                        }`}
                                                >
                                                    <span className={`material-symbols-outlined text-xl ${form.tipo === t ? cfg.text : 'text-slate-400'}`}>{cfg.icon}</span>
                                                    <span className="text-xs font-semibold">{cfg.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Título */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Título *</label>
                                    <input
                                        className={inputClass}
                                        placeholder="Ej: 20% en productos de campo"
                                        value={form.titulo}
                                        onChange={e => setForm({ ...form, titulo: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Descripción */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Descripción</label>
                                    <textarea
                                        className="w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm resize-none"
                                        rows={3}
                                        placeholder="Describí tu oferta o beneficio..."
                                        value={form.descripcion}
                                        onChange={e => setForm({ ...form, descripcion: e.target.value })}
                                    />
                                </div>

                                {/* Descuento % — solo para descuento */}
                                {form.tipo === 'descuento' && (
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Porcentaje de descuento</label>
                                        <div className="relative">
                                            <input
                                                className={inputClass + ' pr-10'}
                                                type="number"
                                                min="1"
                                                max="100"
                                                placeholder="Ej: 20"
                                                value={form.descuento_porcentaje}
                                                onChange={e => setForm({ ...form, descuento_porcentaje: e.target.value })}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                        </div>
                                    </div>
                                )}

                                {/* Fecha de fin */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Válido hasta (opcional)</label>
                                    <input
                                        className={inputClass}
                                        type="date"
                                        value={form.fecha_fin}
                                        onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                                    />
                                </div>

                                {error && <p className="text-red-500 text-sm">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-primary hover:bg-primary/90 text-slate-900 font-bold py-4 rounded-xl transition-all disabled:opacity-50 mt-2"
                                >
                                    {submitting ? 'Publicando...' : 'Publicar Oferta'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                <div className="mb-8">
                    <GestionDependientes />
                </div>

                {/* Filtros */}
                <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
                    {(['todas', 'promocion', 'descuento', 'beneficio'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFiltro(f)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filtro === f
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                        >
                            {f === 'todas' ? 'Todas' : TIPO_CONFIG[f].label + 's'}
                        </button>
                    ))}
                </div>

                {/* Lista de ofertas */}
                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                        ))}
                    </div>
                ) : ofertasFiltradas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                        <span className="material-symbols-outlined text-5xl mb-3 opacity-50">inventory_2</span>
                        <p className="font-semibold text-slate-600 dark:text-slate-300">Aún no publicaste ofertas</p>
                        <p className="text-xs mt-1">Beneficiá a los socios publicando acá.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {ofertasFiltradas.map(oferta => {
                            const cfg = TIPO_CONFIG[oferta.tipo];
                            return (
                                <div
                                    key={oferta.id}
                                    className={`rounded-2xl border p-4 transition-all ${oferta.activo ? cfg.light : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl ${cfg.color} flex items-center justify-center shrink-0`}>
                                                <span className="material-symbols-outlined text-white text-xl">{cfg.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                                        {cfg.label}
                                                    </span>
                                                    {oferta.descuento_porcentaje && (
                                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                            -{oferta.descuento_porcentaje}%
                                                        </span>
                                                    )}
                                                    {!oferta.activo && (
                                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-300 text-slate-600">
                                                            Pausada
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-sm truncate">{oferta.titulo}</h3>
                                                {oferta.descripcion && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{oferta.descripcion}</p>
                                                )}
                                                {oferta.fecha_fin && (
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        <span className="material-symbols-outlined text-xs">schedule</span>{' '}
                                                        Hasta {new Date(oferta.fecha_fin).toLocaleDateString('es-AR')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex flex-col gap-1.5 shrink-0">
                                            <button
                                                onClick={() => toggleOferta(oferta.id, oferta.activo)}
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${oferta.activo
                                                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                                                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                                    }`}
                                                title={oferta.activo ? 'Pausar' : 'Activar'}
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {oferta.activo ? 'pause_circle' : 'play_circle'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => deleteOferta(oferta.id)}
                                                className="w-9 h-9 rounded-xl bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center transition-all"
                                                title="Eliminar"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* FULL SCREEN SCANNER MODAL */}
            {showScanner && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">

                    {/* Header Scanner */}
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="text-white">
                            <h2 className="font-bold text-lg">Escanear Carnet</h2>
                            <p className="text-xs opacity-70">Enfoque el QR del socio</p>
                        </div>
                        <button
                            onClick={stopScanner}
                            className="size-12 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Camera Viewport or Error */}
                    {error ? (
                        <div className="text-white text-center p-8">
                            <span className="material-symbols-outlined text-6xl text-red-500 mb-4 block">no_photography</span>
                            <p className="font-bold">{error}</p>
                            <button onClick={stopScanner} className="mt-8 bg-white/20 px-6 py-2 rounded-full text-sm font-bold">Volver</button>
                        </div>
                    ) : (
                        <div className="w-full max-w-md w-full relative">
                            {/* The HTML5 QR Code div */}
                            <div id="qr-reader" className="w-full !border-0 overflow-hidden rounded-3xl overflow-hidden [&>video]:object-cover [&>video]:h-[60vh] shadow-2xl"></div>

                            {/* Overlay mask for scanning area guide */}
                            <div className="absolute inset-0 border-[60px] border-black/50 pointer-events-none rounded-3xl"></div>
                            <div className="absolute inset-0 ring-2 ring-primary/50 pointer-events-none m-[60px] rounded-2xl">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl -translate-x-1 -translate-y-1"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl translate-x-1 -translate-y-1"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl -translate-x-1 translate-y-1"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl translate-x-1 translate-y-1"></div>
                            </div>
                        </div>
                    )}

                    {/* Result Overlay */}
                    {scanResult && (
                        <div className={`absolute inset-0 flex flex-col justify-end p-4 pb-12 z-20 ${scanResult.valido ? 'bg-emerald-600/90' : 'bg-red-600/95'} backdrop-blur-md animate-in fade-in slide-in-from-bottom-10`}>

                            <div className="bg-white rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
                                <div className={`absolute top-0 left-0 right-0 h-4 ${scanResult.valido ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                                <span className={`material-symbols-outlined text-7xl mb-4 mt-2 ${scanResult.valido ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {scanResult.valido ? 'verified' : 'cancel'}
                                </span>

                                <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase">
                                    {scanResult.valido ? 'SOCIO VALIDADO' : 'CARNET INVÁLIDO'}
                                </h2>

                                <p className={`text-sm font-bold m-4 p-3 rounded-xl border ${scanResult.valido ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {scanResult.mensaje}
                                </p>

                                {scanResult.socio && (
                                    <div className="bg-slate-50 p-4 rounded-2xl mt-4 mb-8 text-left border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Datos del Socio</p>
                                        <p className="font-bold text-slate-900 text-lg uppercase leading-tight">{scanResult.socio.nombre_apellido}</p>
                                        <p className="text-slate-600 font-mono mt-1">DNI/CUIT: {scanResult.socio.dni || 'No provisto'}</p>

                                        <div className="mt-3 p-2 bg-slate-100/50 rounded-xl border border-slate-200">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tipo de Miembro</p>
                                            <p className="text-sm font-bold text-primary dark:text-primary-light uppercase">
                                                {scanResult.socio.rol === 'SOCIO'
                                                    ? scanResult.socio.titular_id
                                                        ? `Grupo Familiar - ${scanResult.socio.tipo_vinculo || 'Adherente'}`
                                                        : 'Socio Común'
                                                    : scanResult.socio.titular_id
                                                        ? 'Empleado de Comercio'
                                                        : 'Comercio Titular'
                                                }
                                            </p>
                                        </div>

                                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                                            <span className="text-[10px] font-bold px-2 py-1 bg-slate-200 text-slate-700 rounded uppercase">
                                                {scanResult.socio.municipio || 'Sin Municipio'}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${scanResult.socio.estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                ESTADO: {scanResult.socio.estado}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    {scanResult.valido && (
                                        <button
                                            onClick={() => stopScanner()}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
                                        >
                                            Aplicar Beneficio
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setScanResult(null)} // Resetear para escanear de nuevo
                                        className={`flex-1 font-bold py-4 rounded-xl transition-transform active:scale-95 ${scanResult.valido ? 'bg-slate-100 text-slate-700' : 'bg-slate-900 text-white shadow-xl'}`}
                                    >
                                        Escanear otro
                                    </button>
                                </div>
                                {!scanResult.valido && (
                                    <button onClick={stopScanner} className="w-full text-slate-500 text-sm font-bold mt-4 py-2 uppercase tracking-widest">
                                        Cerrar Lector
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <BottomNav />
        </div>
    );
}

