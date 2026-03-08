import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReportesPanel() {
    const { token } = useAuth();
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleDownload = async (type: 'excel' | 'pdf') => {
        setIsDownloading(type);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/reports/socios/${type}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error al generar el reporte');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = type === 'excel' ? 'informe_socios.csv' : 'informe_socios.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(error);
            alert('Error al descargar el archivo.');
        } finally {
            setIsDownloading(null);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="bg-admin-card border border-admin-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <span className="material-symbols-outlined text-9xl">analytics</span>
                </div>

                <h2 className="text-3xl font-bold text-admin-text tracking-tight mb-2">Central de Inteligencia Contable</h2>
                <p className="text-slate-400 max-w-2xl mb-8">
                    Genera informes estructurados sobre la situación de los socios, estados de cuenta y demografía de la institución.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* EXCEL CARD */}
                    <div className="bg-admin-bg/50 border border-admin-border rounded-2xl p-6 hover:border-admin-accent/50 transition-all group">
                        <div className="size-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">table_view</span>
                        </div>
                        <h3 className="text-xl font-bold text-admin-text mb-2">Informe para Contabilidad (Excel)</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Exportación en formato CSV estructurado (punto y coma) con codificación especial para Microsoft Excel. Ideal para procesamiento de datos.
                        </p>
                        <button
                            onClick={() => handleDownload('excel')}
                            disabled={!!isDownloading}
                            className="w-full py-4 bg-[#10b981] text-white font-bold rounded-xl shadow-lg shadow-green-900/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {isDownloading === 'excel' ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">download</span>
                                    Descargar Excel
                                </>
                            )}
                        </button>
                    </div>

                    {/* PDF CARD */}
                    <div className="bg-admin-bg/50 border border-admin-border rounded-2xl p-6 hover:border-admin-accent/50 transition-all group">
                        <div className="size-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">picture_as_pdf</span>
                        </div>
                        <h3 className="text-xl font-bold text-admin-text mb-2">Informe Institucional (PDF)</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            Genera un documento PDF con diseño institucional de la Sociedad Rural, encabezados oficiales y formato de impresión.
                        </p>
                        <button
                            onClick={() => handleDownload('pdf')}
                            disabled={!!isDownloading}
                            className="w-full py-4 bg-[#e11d48] text-white font-bold rounded-xl shadow-lg shadow-red-900/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {isDownloading === 'pdf' ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">print</span>
                                    Descargar PDF
                                </>
                            )}
                        </button>
                    </div>

                    {/* SYNC MORA CARD */}
                    <div className="bg-admin-bg/50 border border-admin-border rounded-2xl p-6 hover:border-admin-accent/50 transition-all group md:col-span-2">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="size-12 rounded-xl bg-admin-accent/10 text-admin-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined">sync_lock</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-admin-text">Sincronizador de Morosidad</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">Motor de Automatización</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">
                            Ejecuta el escaneo de deudas en toda la base de socios. Detecta cuotas impagas, actualiza el estado a <span className="text-admin-rejected font-bold">RESTRINGIDO</span> y dispara automáticamente las notificaciones de WhatsApp con links de pago.
                        </p>
                        <button
                            onClick={async () => {
                                setIsDownloading('sync');
                                try {
                                    const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/cron/detectar-mora`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    if (resp.ok) {
                                        setShowSuccessModal(true);
                                    } else {
                                        throw new Error('Error en la sincronización');
                                    }
                                } catch (e) {
                                    alert('Error al ejecutar la sincronización.');
                                } finally {
                                    setIsDownloading(null);
                                }
                            }}
                            disabled={!!isDownloading}
                            className="w-full py-4 bg-admin-accent text-white font-bold rounded-xl shadow-lg shadow-indigo-900/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {isDownloading === 'sync' ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                    Ejecutar Sincronización de Morosos
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-admin-card border border-admin-border p-6 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Información Diario</h4>
                    <p className="text-xl font-bold text-admin-text">Consolidado Hoy</p>
                    <p className="text-xs text-slate-400 mt-1">Incluye ingresos y variaciones de estado del día.</p>
                </div>
                <div className="bg-admin-card border border-admin-border p-6 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Información Mensual</h4>
                    <p className="text-xl font-bold text-admin-text">Cierre de Mes</p>
                    <p className="text-xs text-slate-400 mt-1">Reporte comparativo de cobrabilidad vs mora.</p>
                </div>
                <div className="bg-admin-card border border-admin-border p-6 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Información Anual</h4>
                    <p className="text-xl font-bold text-admin-text">Ejercicio en Curso</p>
                    <p className="text-xs text-slate-400 mt-1">Historial completo para asamblea institucional.</p>
                </div>
            </div>

            {/* MODAL DE ÉXITO ANIMADO */}
            <AnimatePresence>
                {showSuccessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSuccessModal(false)}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
                    >
                        <motion.div
                            initial={{ y: 50, opacity: 0, scale: 0.9 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-admin-card border border-[#10b981]/30 w-full max-w-md rounded-[24px] overflow-hidden shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] relative"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#10b981] to-transparent opacity-50"></div>

                            <div className="p-8 text-center flex flex-col items-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                                    className="size-20 rounded-full bg-[#10b981]/10 text-[#10b981] flex items-center justify-center mb-6 ring-4 ring-[#10b981]/20"
                                >
                                    <span className="material-symbols-outlined text-5xl">check_circle</span>
                                </motion.div>

                                <h3 className="text-2xl font-bold text-white mb-3">
                                    ¡Sincronización Exitosa!
                                </h3>

                                <p className="text-slate-400 text-sm leading-relaxed mb-8">
                                    El motor de inteligencia ha escaneado la base de datos, actualizado el estado de los morosos a <span className="text-admin-rejected font-bold">RESTRINGIDO</span> y despachado las notificaciones vía WhatsApp automáticamente.
                                </p>

                                <button
                                    onClick={() => setShowSuccessModal(false)}
                                    className="w-full py-3.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl active:scale-95 transition-all text-sm shadow-lg shadow-[#10b981]/20 flex items-center justify-center gap-2"
                                >
                                    <span>Entendido, volver al panel</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
