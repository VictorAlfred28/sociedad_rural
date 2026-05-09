import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RefreshCw, Send, Bell, MessageSquare, Smartphone, CheckCircle, XCircle, Clock, AlertTriangle, Users, TrendingUp } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ReminderLog {
  id: string;
  user_id: string;
  canal: 'whatsapp' | 'push' | 'inapp';
  resultado: 'enviado' | 'fallido' | 'omitido';
  mensaje: string;
  motivo_omision: string;
  created_at: string;
  tipo_reminder?: string;
  profiles?: { nombre_apellido: string; email: string; telefono: string };
}

interface Metricas {
  periodo_dias: number;
  socios_pendientes_actuales: number;
  metricas_por_canal: Record<string, number>;
}

const CANAL_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare size={14} />,
  push: <Smartphone size={14} />,
  inapp: <Bell size={14} />,
};

const RESULTADO_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  enviado: { color: 'text-emerald-400', icon: <CheckCircle size={13} />, label: 'Enviado' },
  fallido: { color: 'text-red-400', icon: <XCircle size={13} />, label: 'Fallido' },
  omitido: { color: 'text-slate-400', icon: <Clock size={13} />, label: 'Omitido' },
};

const TIPO_CONFIG: Record<string, { color: string; label: string }> = {
  PRE_VENCIMIENTO_30: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Preventivo 30d' },
  MORA_40: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Mora 40d' },
};

function StatCard({ label, value, sub, color = 'text-admin-accent' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

export default function RecordatoriosPago() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReenvio, setLoadingReenvio] = useState<string | null>(null);
  const [filtroCanal, setFiltroCanal] = useState('');
  const [filtroResultado, setFiltroResultado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filtroCanal) params.set('canal', filtroCanal);
      if (filtroResultado) params.set('resultado', filtroResultado);
      if (filtroTipo) params.set('tipo_reminder', filtroTipo);

      const [logsRes, metRes] = await Promise.all([
        fetch(`${API}/api/admin/recordatorios?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/recordatorios/metricas`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (logsRes.ok) {
        const d = await logsRes.json();
        setLogs(d.recordatorios || []);
      }
      if (metRes.ok) {
        setMetricas(await metRes.json());
      }
    } catch (e) {
      console.error('[RecordatoriosPago] fetchData error', e);
    } finally {
      setLoading(false);
    }
  }, [token, filtroCanal, filtroResultado, filtroTipo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReenviar = async (userId: string, nombre: string, tipo: string = 'MORA_40') => {
    if (!window.confirm(`¿Forzar recordatorio a ${nombre}? Se enviará WhatsApp + notificación interna ignorando cooldown.`)) return;
    setLoadingReenvio(userId);
    try {
      const res = await fetch(`${API}/api/admin/recordatorios/reenviar/${userId}?tipo_reminder=${tipo}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Recordatorio reenviado a ${nombre}. WA: ${data.resultado?.whatsapp} / InApp: ${data.resultado?.inapp}`);
        fetchData();
      } else {
        showToast(data.detail || 'Error al reenviar', false);
      }
    } catch {
      showToast('Error de conexión', false);
    } finally {
      setLoadingReenvio(null);
    }
  };

  // Agrupar logs por user para mostrar el último estado de cada socio
  const uniqueUsers = Array.from(new Map(logs.map(l => [l.user_id, l])).values());

  const getMetricValue = (key: string) => metricas?.metricas_por_canal?.[key] || 0;

  return (
    <div className="flex flex-col gap-6 max-w-6xl">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200
          ${toast.ok ? 'bg-emerald-900 border border-emerald-700 text-emerald-200' : 'bg-red-900 border border-red-700 text-red-200'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-admin-text">Recordatorios de Pago</h2>
          <p className="text-xs text-slate-400 mt-0.5">Sistema multichannel automático — WhatsApp + Push + In-App</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-admin-card border border-admin-border text-sm font-semibold text-slate-300 hover:text-admin-accent hover:border-admin-accent/40 transition-all"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Métricas */}
      {metricas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Socios sin pago"
            value={metricas.socios_pendientes_actuales}
            sub="Actualmente"
            color="text-amber-400"
          />
          <StatCard
            label="WA enviados"
            value={getMetricValue('whatsapp.enviado')}
            sub={`últimos ${metricas.periodo_dias} días`}
            color="text-emerald-400"
          />
          <StatCard
            label="Push enviados"
            value={getMetricValue('push.enviado')}
            sub={`últimos ${metricas.periodo_dias} días`}
            color="text-blue-400"
          />
          <StatCard
            label="In-App enviados"
            value={getMetricValue('inapp.enviado')}
            sub={`últimos ${metricas.periodo_dias} días`}
            color="text-purple-400"
          />
        </div>
      )}

      {/* Info cron */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-4 flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-lg bg-amber-500/10">
          <TrendingUp size={16} className="text-amber-400" />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-bold text-admin-text">Cron automático</p>
          <p className="text-xs text-slate-400">
            El sistema evalúa diariamente socios con <strong className="text-slate-300">29 días (preventivo)</strong> y <strong className="text-slate-300">40+ días (mora)</strong> registrados sin pago aprobado ni comprobante en revisión.
            Cooldown de <strong className="text-slate-300">7 días</strong> por canal para evitar spam.
          </p>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            GET /api/v1/cron/recordatorios-pago — Header: X-Cron-Secret
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroCanal}
          onChange={e => setFiltroCanal(e.target.value)}
          className="h-9 rounded-xl bg-admin-card border border-admin-border text-sm text-admin-text px-3 focus:outline-none focus:border-admin-accent"
        >
          <option value="">Todos los canales</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="push">Push</option>
          <option value="inapp">In-App</option>
        </select>
        <select
          value={filtroResultado}
          onChange={e => setFiltroResultado(e.target.value)}
          className="h-9 rounded-xl bg-admin-card border border-admin-border text-sm text-admin-text px-3 focus:outline-none focus:border-admin-accent"
        >
          <option value="">Todos los resultados</option>
          <option value="enviado">Enviado</option>
          <option value="fallido">Fallido</option>
          <option value="omitido">Omitido</option>
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="h-9 rounded-xl bg-admin-card border border-admin-border text-sm text-admin-text px-3 focus:outline-none focus:border-admin-accent"
        >
          <option value="">Todos los tipos</option>
          <option value="PRE_VENCIMIENTO_30">Preventivo 30d</option>
          <option value="MORA_40">Mora 40d</option>
        </select>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <Users size={13} />
          {uniqueUsers.length} socios / {logs.length} registros
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-sm">Cargando historial...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
            <Bell size={32} className="opacity-30" />
            <p className="text-sm">Sin recordatorios registrados</p>
            <p className="text-xs text-slate-600">El cron aún no se ejecutó o no hay socios que cumplan los criterios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border">
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Socio</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Canal</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Resultado</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Detalle</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border/50">
                {logs.map(log => {
                  const res = RESULTADO_CONFIG[log.resultado] || RESULTADO_CONFIG.omitido;
                  const tipoCfg = TIPO_CONFIG[log.tipo_reminder || 'MORA_40'] || { color: 'bg-slate-800 text-slate-300', label: log.tipo_reminder || 'Desconocido' };
                  const nombre = log.profiles?.nombre_apellido || '—';
                  const email = log.profiles?.email || '';
                  const fecha = new Date(log.created_at).toLocaleString('es-AR', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-admin-card-hover transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-admin-text text-sm leading-tight">{nombre}</div>
                        <div className="text-[11px] text-slate-500">{email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${tipoCfg.color}`}>
                          {tipoCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                          {CANAL_ICON[log.canal]}
                          <span className="capitalize">{log.canal}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold ${res.color}`}>
                          {res.icon}
                          {res.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px]">
                        {log.motivo_omision ? (
                          <span className="text-[11px] text-slate-500 font-mono">{log.motivo_omision}</span>
                        ) : log.mensaje ? (
                          <span className="text-[11px] text-slate-400 truncate block">{log.mensaje.slice(0, 60)}{log.mensaje.length > 60 ? '…' : ''}</span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">{fecha}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {log.canal === 'whatsapp' && (
                          <button
                            onClick={() => handleReenviar(log.user_id, nombre, log.tipo_reminder || 'MORA_40')}
                            disabled={loadingReenvio === log.user_id}
                            title="Forzar reenvío (ignora cooldown)"
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-admin-accent/10 text-admin-accent text-[11px] font-semibold hover:bg-admin-accent/20 transition-all disabled:opacity-40"
                          >
                            {loadingReenvio === log.user_id
                              ? <RefreshCw size={11} className="animate-spin" />
                              : <Send size={11} />
                            }
                            Reenviar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
