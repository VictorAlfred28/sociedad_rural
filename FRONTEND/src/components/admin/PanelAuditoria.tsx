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

interface AuditStats {
    total: number;
    mas_antigua: string | null;
    mas_nueva: string | null;
}

export default function PanelAuditoria() {
    const { token } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [stats, setStats] = useState<AuditStats | null>(null);

    // Filtros
    const [filterModulo, setFilterModulo] = useState('TODOS');
    const [filterAccion, setFilterAccion] = useState('TODOS');
    const [filterTabla, setFilterTabla] = useState('TODOS');

    // Modal detalle
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Modal purge
    const [showPurge, setShowPurge] = useState(false);
    const [purgeDias, setPurgeDias] = useState(90);
    const [purgeConfirm, setPurgeConfirm] = useState('');
    const [purging, setPurging] = useState(false);
    const [purgeMsg, setPurgeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const fetchLogs = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const resp = await fetch(`${API}/api/admin/auditoria`, {
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

    const fetchStats = async () => {
        try {
            const resp = await fetch(`${API}/api/admin/auditoria/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setStats(data);
            }
        } catch { /* silencioso */ }
    };

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [token]);

    const handlePurge = async () => {
        if (purgeConfirm !== 'PURGAR') return;
        setPurging(true);
        setPurgeMsg(null);
        try {
            const resp = await fetch(`${API}/api/admin/auditoria/purge?dias=${purgeDias}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Error al purgar');
            setPurgeMsg({ type: 'success', text: data.mensaje });
            setPurgeConfirm('');
            // Refrescar lista y stats
            await fetchLogs();
            await fetchStats();
        } catch (err: any) {
            setPurgeMsg({ type: 'error', text: err.message });
        } finally {
            setPurging(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesModulo = filterModulo === 'TODOS' || log.modulo === filterModulo;
        const matchesAccion = filterAccion === 'TODOS' || log.accion === filterAccion;
        const matchesTabla = filterTabla === 'TODOS' || log.tabla_afectada === filterTabla;
        return matchesModulo && matchesAccion && matchesTabla;
    });

    const uniqueModulos = Array.from(new Set(logs.map(l => l.modulo).filter(Boolean)));
    const uniqueAcciones = Array.from(new Set(logs.map(l => l.accion).filter(Boolean)));
    const uniqueTablas = Array.from(new Set(logs.map(l => l.tabla_afectada).filter(Boolean)));

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('es-AR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const accionColor = (accion: string) => {
        switch (accion) {
            case 'CREATE':   return 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20';
            case 'UPDATE':   return 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20';
            case 'DELETE':   return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20';
            case 'APPROVE':  return 'bg-[#14b8a6]/10 text-[#14b8a6] border-[#14b8a6]/20';
            case 'REJECT':   return 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20';
            case 'PURGE':    return 'bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/20';
            default:         return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20';
        }
    };

    return (
        <div className="flex flex-col gap-4">

            {/* Header */}
            <div className="px-4 flex justify-between items-center mt-2">
                <h2 className="text-xl font-bold tracking-tight text-admin-text">Registro de Auditoría</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setShowPurge(true); setPurgeMsg(null); setPurgeConfirm(''); }}
                        className="px-3 h-9 bg-red-900/20 border border-red-700/40 text-red-400 hover:bg-red-900/40 hover:border-red-500/60 rounded-lg text-xs font-bold uppercase tracking-wider admin-transition flex items-center gap-1.5"
                        title="Purgar registros antiguos"
                    >
                        <span className="material-symbols-outlined text-sm">delete_sweep</span>
                        Purgar
                    </button>
                    <button
                        onClick={() => { fetchLogs(); fetchStats(); }}
                        className="p-2 bg-admin-card border border-admin-border text-slate-300 hover:text-admin-text hover:border-admin-accent/50 rounded-full active:scale-95 admin-transition flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-sm outline-none">refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            {stats && (
                <div className="px-4">
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-admin-card border border-admin-border rounded-xl p-3 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Total Registros</p>
                            <p className="text-xl font-black text-admin-text font-mono">{stats.total.toLocaleString('es-AR')}</p>
                        </div>
                        <div className="bg-admin-card border border-admin-border rounded-xl p-3 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Más Antiguo</p>
                            <p className="text-[10px] font-bold text-slate-400 font-mono leading-tight">
                                {stats.mas_antigua ? new Date(stats.mas_antigua).toLocaleDateString('es-AR') : '—'}
                            </p>
                        </div>
                        <div className="bg-admin-card border border-admin-border rounded-xl p-3 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Más Reciente</p>
                            <p className="text-[10px] font-bold text-slate-400 font-mono leading-tight">
                                {stats.mas_nueva ? new Date(stats.mas_nueva).toLocaleDateString('es-AR') : '—'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

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
                                <span className={`px-2 py-0.5 rounded text-[10px] items-center justify-center font-bold uppercase tracking-wider border ${accionColor(log.accion)}`}>
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

            {/* ── Modal Detalle ─────────────────────────────────────────────── */}
            {selectedLog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md admin-transition">
                    <div className="bg-admin-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-admin-accent/30 shadow-[0_0_40px_-15px_rgba(59,130,246,0.3)]">
                        <div className="p-4 border-b border-admin-accent/20 flex justify-between items-center bg-admin-bg/50">
                            <div className="flex items-center gap-2 text-admin-accent">
                                <span className="material-symbols-outlined text-lg">terminal</span>
                                <h3 className="font-bold text-sm uppercase tracking-widest text-admin-text">Inspección de Nodo</h3>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-admin-text admin-transition flex items-center justify-center">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto admin-scroll flex-1 flex flex-col gap-6 text-sm">
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

            {/* ── Modal Purge ───────────────────────────────────────────────── */}
            {showPurge && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-admin-card rounded-2xl w-full max-w-md border border-red-700/40 shadow-[0_0_40px_-15px_rgba(239,68,68,0.4)] overflow-hidden">

                        {/* Header */}
                        <div className="p-4 border-b border-red-700/30 flex justify-between items-center bg-red-900/10">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-400 text-lg">delete_sweep</span>
                                <h3 className="font-bold text-sm uppercase tracking-widest text-red-300">Purgar Auditoría</h3>
                            </div>
                            <button onClick={() => setShowPurge(false)} className="text-slate-500 hover:text-admin-text admin-transition">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-5 flex flex-col gap-4">
                            {/* Stats actuales */}
                            {stats && (
                                <div className="bg-admin-bg border border-admin-border rounded-xl p-3 flex justify-between items-center">
                                    <span className="text-xs text-slate-400 font-mono uppercase tracking-widest">Registros actuales</span>
                                    <span className="text-lg font-black text-admin-text font-mono">{stats.total.toLocaleString('es-AR')}</span>
                                </div>
                            )}

                            {/* Selector de días */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                                    Eliminar registros anteriores a:
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[30, 60, 90, 180].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setPurgeDias(d)}
                                            className={`h-10 rounded-lg text-xs font-black uppercase tracking-wider border admin-transition ${
                                                purgeDias === d
                                                    ? 'bg-red-700/30 border-red-500/60 text-red-300'
                                                    : 'bg-admin-bg border-admin-border text-slate-400 hover:border-admin-accent/40'
                                            }`}
                                        >
                                            {d} días
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Advertencia */}
                            <div className="bg-red-900/10 border border-red-700/30 rounded-xl p-3 flex gap-2">
                                <span className="material-symbols-outlined text-red-400 text-base shrink-0 mt-0.5">warning</span>
                                <p className="text-xs text-red-300 leading-relaxed">
                                    Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos los registros de auditoría anteriores a <strong>{purgeDias} días</strong>. El purge quedará registrado con tu usuario.
                                </p>
                            </div>

                            {/* Confirmación */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                                    Escribí <span className="text-red-400 font-mono">PURGAR</span> para confirmar:
                                </label>
                                <input
                                    type="text"
                                    value={purgeConfirm}
                                    onChange={e => setPurgeConfirm(e.target.value.toUpperCase())}
                                    placeholder="PURGAR"
                                    className="w-full h-10 px-4 bg-admin-bg border border-admin-border rounded-lg text-sm font-mono font-bold text-red-300 placeholder-slate-600 outline-none focus:border-red-500/60 tracking-widest"
                                />
                            </div>

                            {/* Feedback */}
                            {purgeMsg && (
                                <div className={`p-3 rounded-xl text-xs font-bold text-center border ${
                                    purgeMsg.type === 'success'
                                        ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
                                        : 'bg-red-900/20 border-red-700/40 text-red-300'
                                }`}>
                                    {purgeMsg.text}
                                </div>
                            )}

                            {/* Botones */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => setShowPurge(false)}
                                    className="flex-1 h-11 rounded-xl text-sm font-bold text-slate-400 hover:bg-admin-bg border border-admin-border admin-transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handlePurge}
                                    disabled={purgeConfirm !== 'PURGAR' || purging}
                                    className="flex-[2] h-11 bg-red-700/80 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-lg shadow-red-900/30 active:scale-[0.98] admin-transition flex items-center justify-center gap-2"
                                >
                                    {purging ? (
                                        <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Purgando...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-base">delete_sweep</span> Purgar {purgeDias} días</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
