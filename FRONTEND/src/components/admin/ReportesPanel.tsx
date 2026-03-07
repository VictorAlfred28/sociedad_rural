import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ReportesPanel() {
    const { token } = useAuth();
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

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
                                        alert('Sincronización completada. Se han procesado los socios morosos y enviado las notificaciones.');
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
        </div>
    );
}
