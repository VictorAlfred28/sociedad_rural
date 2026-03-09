import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface NotificacionSoporte {
    id: string;
    usuario_id: string;
    tipo: string;
    descripcion: string;
    estado: string;
    metadata: any;
    created_at: string;
    profiles?: {
        nombre_apellido: string;
        dni: string;
        email: string;
        rol: string;
    };
}

export default function GestionSoporte() {
    const { token } = useAuth();
    const [notificaciones, setNotificaciones] = useState<NotificacionSoporte[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchNotificaciones = async () => {
        try {
            setLoading(true);
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/notificaciones-soporte`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (resp.ok) {
                setNotificaciones(data.notificaciones || []);
            }
        } catch (err) {
            console.error('Error fetching support notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotificaciones();
    }, [token]);

    const handleResolverManual = async (id: string) => {
        if (!confirm('¿Marcar esta solicitud como resuelta manualmente?')) return;

        setProcessingId(id);
        setError(null);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/notificaciones-soporte/${id}/resolver`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                setSuccess('Solicitud resuelta.');
                fetchNotificaciones();
            } else {
                const d = await resp.json();
                throw new Error(d.detail || 'Error al resolver');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleResetPassword = async (id: string) => {
        const newPass = prompt('Ingresa la nueva contraseña provisoria para el usuario:');
        if (!newPass || newPass.length < 6) {
            if (newPass) alert('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setProcessingId(id);
        setError(null);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/notificaciones-soporte/${id}/reset-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ new_password: newPass })
            });
            const data = await resp.json();
            if (resp.ok) {
                setSuccess(`¡Éxito! Nueva clave asignada. Avisa al usuario que su clave ahora es: ${newPass}`);
                fetchNotificaciones();
            } else {
                throw new Error(data.detail || 'Error al resetear clave');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-accent"></div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-bold text-admin-text drop-shadow-sm">Centro de Soporte</h3>
                <p className="text-slate-400 text-sm">Gestiona solicitudes de recuperación de acceso y soporte técnico.</p>
            </div>

            {error && (
                <div className="p-4 bg-admin-rejected/10 border border-admin-rejected/20 rounded-xl text-admin-rejected text-sm font-medium animate-in fade-in slide-in-from-top-2">
                    {error}
                </div>
            )}

            {success && (
                <div className="p-4 bg-admin-approved/10 border border-admin-approved/20 rounded-xl text-admin-approved text-sm font-medium animate-in fade-in slide-in-from-top-2">
                    {success}
                    <button onClick={() => setSuccess(null)} className="ml-4 underline">Cerrar</button>
                </div>
            )}

            {notificaciones.length === 0 ? (
                <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-admin-accent/20 text-6xl mb-4">task_alt</span>
                    <p className="text-slate-400 text-lg font-medium">No hay solicitudes pendientes.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {notificaciones.map((notif) => (
                        <div key={notif.id} className="bg-admin-card border border-admin-border rounded-2xl p-6 hover:border-admin-accent/30 transition-all group relative overflow-hidden">
                            {/* Accent line for OLVIDO_PASSWORD */}
                            {notif.tipo === 'OLVIDO_PASSWORD' && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                            )}

                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 tracking-widest uppercase">
                                            {notif.tipo === 'OLVIDO_PASSWORD' ? '🔐 Recuperación Clave' : notif.tipo}
                                        </span>
                                        <span className="text-slate-500 text-xs font-mono">
                                            {new Date(notif.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <h4 className="text-lg font-bold text-admin-text group-hover:text-admin-accent transition-colors">
                                        {notif.profiles?.nombre_apellido || 'Usuario Desconocido'}
                                    </h4>
                                    <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                                        {notif.descripcion}
                                    </p>
                                    <div className="flex flex-wrap gap-4 pt-2">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <span className="material-symbols-outlined text-[16px]">id_card</span>
                                            {notif.profiles?.dni || 'N/A'}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <span className="material-symbols-outlined text-[16px]">mail</span>
                                            {notif.profiles?.email || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                                    {notif.tipo === 'OLVIDO_PASSWORD' && (
                                        <button
                                            onClick={() => handleResetPassword(notif.id)}
                                            disabled={processingId === notif.id}
                                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-admin-accent text-white rounded-xl font-bold text-sm shadow-lg shadow-admin-accent/20 hover:shadow-admin-accent/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">key</span>
                                            Asignar Clave Provisoria
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleResolverManual(notif.id)}
                                        disabled={processingId === notif.id}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                        Solo Resolver
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
