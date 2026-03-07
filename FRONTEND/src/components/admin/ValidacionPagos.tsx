import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface PagoPendiente {
    id: string;
    socio_id: string;
    monto: number;
    fecha_vencimiento: string;
    estado_pago: string;
    comprobante_url: string;
    fecha_envio_comprobante: string;
    profiles: {
        nombre_apellido: string;
        dni: string;
        email: string;
    };
}

export default function ValidacionPagos() {
    const { token } = useAuth();
    const [pendientes, setPendientes] = useState<PagoPendiente[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPago, setSelectedPago] = useState<PagoPendiente | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchPendientes = async () => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/pagos/pendientes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (resp.ok) setPendientes(data.pendientes);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendientes();
    }, []);

    const handleAprobar = async (id: string) => {
        if (!confirm('¿Estás seguro de aprobar este pago? El socio será reactivado automáticamente.')) return;
        setIsProcessing(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/pagos/aprobar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pago_id: id })
            });
            if (resp.ok) {
                setPendientes(prev => prev.filter(p => p.id !== id));
                setSelectedPago(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRechazar = async () => {
        if (!selectedPago || !rejectReason) return;
        setIsProcessing(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/pagos/rechazar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pago_id: selectedPago.id, motivo: rejectReason })
            });
            if (resp.ok) {
                setPendientes(prev => prev.filter(p => p.id !== selectedPago.id));
                setShowRejectModal(false);
                setSelectedPago(null);
                setRejectReason('');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-admin-text tracking-tight">Validación de Comprobantes</h2>
                    <p className="text-slate-400 text-sm">Revisa y aprueba los pagos enviados por los socios.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-admin-accent/10 text-admin-accent rounded-full text-xs font-bold border border-admin-accent/20">
                        {pendientes.length} Pendientes
                    </span>
                    <button
                        onClick={fetchPendientes}
                        className="flex items-center justify-center size-10 rounded-xl bg-admin-card border border-admin-border text-slate-400 hover:text-admin-text transition-colors"
                    >
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-accent"></div>
                </div>
            ) : pendientes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-admin-card rounded-2xl border border-admin-border p-8 text-center">
                    <span className="material-symbols-outlined text-6xl text-slate-600 mb-4 opacity-20">verified_user</span>
                    <h3 className="text-admin-text font-bold text-lg">Bandeja Vacía</h3>
                    <p className="text-slate-500 text-sm">No hay comprobantes pendientes de validación en este momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LISTA DE PENDIENTES */}
                    <div className="space-y-4">
                        {pendientes.map(pago => (
                            <div
                                key={pago.id}
                                onClick={() => setSelectedPago(pago)}
                                className={`group p-4 bg-admin-card border rounded-2xl cursor-pointer transition-all hover:shadow-xl hover:shadow-admin-accent/5 ${selectedPago?.id === pago.id ? 'border-admin-accent bg-admin-accent/5' : 'border-admin-border hover:border-slate-500'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-admin-accent transition-colors">
                                        <span className="material-symbols-outlined text-white">person</span>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-admin-text truncate">{pago.profiles.nombre_apellido}</p>
                                        <p className="text-xs text-slate-500 truncate">DNI: {pago.profiles.dni} • Vence: {new Date(pago.fecha_vencimiento).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-admin-accent font-bold">${pago.monto.toLocaleString('es-AR')}</p>
                                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">
                                            {new Date(pago.fecha_envio_comprobante).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* VISOR / DETALLE */}
                    <div className="sticky top-0">
                        {selectedPago ? (
                            <div className="bg-admin-card border border-admin-border rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-14rem)] animate-in slide-in-from-right-4 duration-300">
                                <div className="p-6 border-b border-admin-border bg-admin-bg/50">
                                    <h4 className="font-bold text-admin-text mb-1">Detalle del Envío</h4>
                                    <p className="text-xs text-slate-500">Recibido el {new Date(selectedPago.fecha_envio_comprobante).toLocaleString()}</p>
                                </div>

                                <div className="flex-1 overflow-auto bg-black/20 flex items-center justify-center p-4">
                                    {selectedPago.comprobante_url.endsWith('.pdf') ? (
                                        <div className="flex flex-col items-center gap-4">
                                            <span className="material-symbols-outlined text-red-500 text-6xl">picture_as_pdf</span>
                                            <a
                                                href={selectedPago.comprobante_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-4 py-2 bg-admin-accent text-white font-bold rounded-xl text-sm"
                                            >
                                                Abrir PDF en pestaña nueva
                                            </a>
                                        </div>
                                    ) : (
                                        <img
                                            src={selectedPago.comprobante_url}
                                            alt="Comprobante"
                                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                        />
                                    )}
                                </div>

                                <div className="p-6 bg-admin-card border-t border-admin-border flex flex-col gap-4">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowRejectModal(true)}
                                            className="flex-1 h-12 rounded-xl border border-admin-rejected/30 text-admin-rejected font-bold hover:bg-admin-rejected/10 transition-colors"
                                        >
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleAprobar(selectedPago.id)}
                                            disabled={isProcessing}
                                            className="flex-[2] h-12 bg-admin-accent text-white font-bold rounded-xl shadow-lg shadow-admin-accent/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isProcessing ? 'Procesando...' : 'Aprobar Pago'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 bg-admin-card/30 border border-admin-border border-dashed rounded-3xl">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">visibility</span>
                                <p className="text-sm font-medium">Selecciona un pago para previsualizar</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL RECHAZO */}
            {showRejectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="w-full max-w-md bg-admin-card border border-admin-border rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-admin-text mb-4">Rechazar Comprobante</h3>
                            <p className="text-sm text-slate-400 mb-6">Indica el motivo por el cual rechazas este pago. El socio recibirá una notificación.</p>

                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Ej: El archivo no es legible, monto incorrecto..."
                                className="w-full h-32 bg-admin-bg border border-admin-border rounded-2xl p-4 text-sm text-admin-text focus:border-admin-accent outline-none transition-colors resize-none"
                            ></textarea>
                        </div>
                        <div className="p-6 bg-admin-bg/50 border-t border-admin-border flex gap-3">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 h-12 rounded-xl text-slate-400 font-bold hover:bg-admin-card transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRechazar}
                                disabled={!rejectReason || isProcessing}
                                className="flex-[2] h-12 bg-admin-rejected text-white font-bold rounded-xl active:scale-95 disabled:opacity-50 transition-all font-display"
                            >
                                Confirmar Rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
