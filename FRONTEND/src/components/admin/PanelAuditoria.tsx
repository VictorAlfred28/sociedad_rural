import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface AuditLog {
    id: string;
    fecha: string;
    usuario_id: string;
    email_usuario: string;
    rol_usuario: string;
    accion: string;
    tabla_afectada: string;
    registro_id: string;
    modulo: string;
    ip_address: string;
    user_agent: string;
    datos_anteriores: any;
    datos_nuevos: any;
}

export default function PanelAuditoria() {
    const { token } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Filtros
    const [filterModulo, setFilterModulo] = useState('TODOS');
    const [filterAccion, setFilterAccion] = useState('TODOS');
    const [filterTabla, setFilterTabla] = useState('TODOS');

    // Modal
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/auditoria`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Error al cargar logs');
            setLogs(data.logs || []);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [token]);

    const filteredLogs = logs.filter(log => {
        const matchesModulo = filterModulo === 'TODOS' || log.modulo === filterModulo;
        const matchesAccion = filterAccion === 'TODOS' || log.accion === filterAccion;
        const matchesTabla = filterTabla === 'TODOS' || log.tabla_afectada === filterTabla;
        return matchesModulo && matchesAccion && matchesTabla;
    });

    // Extract unique filter options
    const uniqueModulos = Array.from(new Set(logs.map(l => l.modulo).filter(Boolean)));
    const uniqueAcciones = Array.from(new Set(logs.map(l => l.accion).filter(Boolean)));
    const uniqueTablas = Array.from(new Set(logs.map(l => l.tabla_afectada).filter(Boolean)));

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('es-AR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="px-4 flex justify-between items-center mt-2">
                <h2 className="text-xl font-bold tracking-tight text-admin-text">Registro de Auditoría</h2>
                <button onClick={fetchLogs} className="p-2 bg-admin-card border border-admin-border text-slate-300 hover:text-admin-text hover:border-admin-accent/50 rounded-full active:scale-95 admin-transition flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm outline-none">refresh</span>
                </button>
            </div>

            {/* Filtros */}
            <div className="px-4 flex gap-2 overflow-x-auto pb-2 admin-scroll items-center">
                <select
                    value={filterModulo}
                    onChange={e => setFilterModulo(e.target.value)}
                    className="h-10 px-3 bg-admin-card border border-admin-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-300 outline-none flex-shrink-0 focus:border-admin-accent shadow-sm"
                >
                    <option value="TODOS">Módulo: Todos</option>
                    {uniqueModulos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <select
                    value={filterAccion}
                    onChange={e => setFilterAccion(e.target.value)}
                    className="h-10 px-3 bg-admin-card border border-admin-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-300 outline-none flex-shrink-0 focus:border-admin-accent shadow-sm"
                >
                    <option value="TODOS">Acción: Todas</option>
                    {uniqueAcciones.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <select
                    value={filterTabla}
                    onChange={e => setFilterTabla(e.target.value)}
                    className="h-10 px-3 bg-admin-card border border-admin-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-300 outline-none flex-shrink-0 focus:border-admin-accent shadow-sm"
                >
                    <option value="TODOS">Tabla: Todas</option>
                    {uniqueTablas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {/* Lista de Logs */}
            <div className="flex flex-col gap-3 px-4 pb-8">
                {loading ? (
                    <p className="text-center text-slate-500 py-8 font-mono text-xs uppercase tracking-widest animate-pulse">Analizando trazas...</p>
                ) : errorMsg ? (
                    <p className="text-center text-admin-rejected py-8">{errorMsg}</p>
                ) : filteredLogs.length === 0 ? (
                    <div className="bg-admin-card border border-admin-border p-8 rounded-2xl flex flex-col items-center text-center shadow-inner">
                        <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">policy</span>
                        <p className="text-slate-400 font-medium text-sm">No hay registros que coincidan con los filtros.</p>
                    </div>
                ) : (
                    filteredLogs.map(log => (
                        <div key={log.id} className="bg-admin-card p-4 rounded-2xl border border-admin-border flex flex-col gap-2 shadow-sm hover:border-admin-accent/30 admin-transition text-sm group">
                            <div className="flex justify-between items-start mb-1 border-b border-admin-border/50 pb-2">
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-admin-active animate-pulse"></div>
                                    <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest">{formatDate(log.fecha)}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] items-center justify-center font-bold uppercase tracking-wider border ${log.accion === 'CREATE' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' :
                                    log.accion === 'UPDATE' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' :
                                        log.accion === 'DELETE' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20' :
                                            log.accion === 'APPROVE' ? 'bg-[#14b8a6]/10 text-[#14b8a6] border-[#14b8a6]/20' :
                                                log.accion === 'REJECT' ? 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20' :
                                                    'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'
                                    }`}>
                                    {log.accion}
                                </span>
                            </div>

                            <div className="font-medium text-admin-text break-all leading-tight">
                                <span className="text-admin-accent font-mono text-xs mr-2">›</span>
                                {log.email_usuario || 'Sistema'} <span className="font-normal text-slate-500 font-mono text-xs ml-1">[{log.rol_usuario || 'SYSTEM'}]</span>
                            </div>

                            <div className="text-xs text-slate-400 mt-1 grid grid-cols-2 gap-x-2 font-mono bg-admin-bg p-2 rounded-lg border border-admin-border/50">
                                <div><span className="text-slate-500 opacity-70">MÓDULO:</span> <span className="text-[#3b82f6]">{log.modulo}</span></div>
                                <div><span className="text-slate-500 opacity-70">TABLA:</span> <span className="text-admin-text">{log.tabla_afectada}</span></div>
                            </div>

                            <div className="mt-2 text-right">
                                <button
                                    onClick={() => setSelectedLog(log)}
                                    className="text-xs font-bold text-admin-accent opacity-70 group-hover:opacity-100 hover:text-admin-text admin-transition flex items-center justify-end gap-1 w-full"
                                >
                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                    Inspeccionar Traza
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Detalle (Estilo Consola Ciberseguridad) */}
            {selectedLog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md admin-transition">
                    <div className="bg-admin-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-admin-accent/30 shadow-[0_0_40px_-15px_rgba(59,130,246,0.3)]">
                        {/* Cabecera del Modal */}
                        <div className="p-4 border-b border-admin-accent/20 flex justify-between items-center bg-admin-bg/50">
                            <div className="flex items-center gap-2 text-admin-accent">
                                <span className="material-symbols-outlined text-lg">terminal</span>
                                <h3 className="font-bold text-sm uppercase tracking-widest text-admin-text">Inspección de Nodo</h3>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-admin-text admin-transition flex items-center justify-center">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Cuerpo del Modal */}
                        <div className="p-5 overflow-y-auto admin-scroll flex-1 flex flex-col gap-6 text-sm">

                            {/* Info Bloques */}
                            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                <div className="bg-admin-bg p-3 rounded-lg border border-admin-border/50">
                                    <span className="block text-slate-500 mb-1 text-[10px] uppercase tracking-widest">ID Log</span>
                                    <span className="break-all text-admin-text font-bold">{selectedLog.id}</span>
                                </div>
                                <div className="bg-admin-bg p-3 rounded-lg border border-admin-border/50">
                                    <span className="block text-slate-500 mb-1 text-[10px] uppercase tracking-widest">Registro Trazado</span>
                                    <span className="break-all text-[#10b981]">{selectedLog.registro_id}</span>
                                </div>
                                <div className="bg-admin-bg p-3 rounded-lg border border-admin-border/50">
                                    <span className="block text-slate-500 mb-1 text-[10px] uppercase tracking-widest">Address IP</span>
                                    <span className="break-all text-[#3b82f6] text-[11px]">{selectedLog.ip_address}</span>
                                </div>
                                <div className="bg-admin-bg p-3 rounded-lg border border-admin-border/50">
                                    <span className="block text-slate-500 mb-1 text-[10px] uppercase tracking-widest">Agente (Browser)</span>
                                    <span className="break-all line-clamp-3 text-slate-400 text-[10px] leading-tight" title={selectedLog.user_agent}>{selectedLog.user_agent}</span>
                                </div>
                            </div>

                            {/* Consolas Interactivas de estado */}
                            <div className="flex flex-col gap-4">
                                {selectedLog.datos_anteriores && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="size-1.5 bg-[#ef4444] rounded-sm"></span>
                                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest font-mono">Estado Previo (Borrado/Mutado)</h4>
                                        </div>
                                        <pre className="p-4 bg-[#0a0a0f] text-[#ef4444] rounded-xl text-[11px] overflow-x-auto border border-[#ef4444]/20 whitespace-pre-wrap word-break font-mono leading-relaxed shadow-inner">
                                            {JSON.stringify(selectedLog.datos_anteriores, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {selectedLog.datos_nuevos && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 pt-2">
                                            <span className="size-1.5 bg-[#10b981] rounded-sm"></span>
                                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest font-mono">Estado Posterior (Actualizado/Creado)</h4>
                                        </div>
                                        <pre className="p-4 bg-[#0a0a0f] text-[#10b981] rounded-xl text-[11px] overflow-x-auto border border-[#10b981]/20 whitespace-pre-wrap word-break font-mono leading-relaxed shadow-inner">
                                            {JSON.stringify(selectedLog.datos_nuevos, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
