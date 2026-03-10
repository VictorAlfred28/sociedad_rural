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
    const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});
    const [selfPassData, setSelfPassData] = useState({ current: '', new: '', confirm: '' });
    const [changingSelfPass, setChangingSelfPass] = useState(false);
    const [showSelfPassForm, setShowSelfPassForm] = useState(false);

    const fetchNotificaciones = async () => {
        try {
            setLoading(true);
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/notificaciones-soporte`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (resp.ok) {
                setNotificaciones(data.notificaciones || []);
                // Inicializar notas locales
                const notes: any = {};
                (data.notificaciones || []).forEach((n: any) => {
                    notes[n.id] = n.metadata?.nota || '';
                });
                setEditingNotes(notes);
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

    const handleSaveNote = async (id: string) => {
        setProcessingId(id);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/notificaciones-soporte/${id}/nota`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ nota: editingNotes[id] || '' })
            });
            if (resp.ok) {
                setSuccess('Nota guardada correctamente.');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                const d = await resp.json();
                throw new Error(d.detail || 'Error al guardar nota');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessingId(null);
        }
    };

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

    const handleSelfChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selfPassData.new !== selfPassData.confirm) return alert('Las contraseñas no coinciden.');
        if (selfPassData.new.length < 6) return alert('La nueva contraseña debe tener al menos 6 caracteres.');

        setChangingSelfPass(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/change-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ new_password: selfPassData.new })
            });
            if (resp.ok) {
                setSuccess('¡Tu contraseña ha sido actualizada correctamente!');
                setSelfPassData({ current: '', new: '', confirm: '' });
                setShowSelfPassForm(false);
            } else {
                const d = await resp.json();
                throw new Error(d.detail || 'Error al cambiar contraseña');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setChangingSelfPass(false);
        }
    };

    const openWhatsApp = (telefono: string, nombre: string) => {
        if (!telefono) return alert('El usuario no tiene un teléfono registrado.');
        // Limpiar número (solo dígitos y +)
        const cleanPhone = telefono.replace(/[^\d+]/g, '');
        const message = encodeURIComponent(`Hola ${nombre}! 👋 Soy de la Sociedad Rural. Te contacto con respecto a tu solicitud de soporte.`);
        window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    };

    if (loading) return (
        <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-admin-accent"></div>
        </div>
    );

    return (
        <div className="space-y-6 pb-20">
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

                            <div className="flex flex-col gap-6">
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
                                            <button
                                                onClick={() => openWhatsApp(notif.metadata?.telefono || '', notif.profiles?.nombre_apellido || '')}
                                                className="flex items-center gap-1.5 text-xs text-green-500 font-bold hover:underline cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">chat</span>
                                                WhatsApp: {notif.metadata?.telefono || 'Disponible'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                                        {notif.tipo === 'OLVIDO_PASSWORD' && (
                                            <button
                                                onClick={() => handleResetPassword(notif.id)}
                                                disabled={processingId === notif.id}
                                                className="flex items-center justify-center gap-2 px-5 py-2 bg-admin-accent text-white rounded-xl font-bold text-xs shadow-lg shadow-admin-accent/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">key</span>
                                                Asignar Clave
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openWhatsApp(notif.metadata?.telefono || '', notif.profiles?.nombre_apellido || '')}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl font-bold text-xs hover:bg-green-500 hover:text-white transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">send_to_mobile</span>
                                            WhatsApp
                                        </button>
                                        <button
                                            onClick={() => handleResolverManual(notif.id)}
                                            disabled={processingId === notif.id}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-slate-400 border border-white/10 rounded-xl font-bold text-xs hover:bg-white/10 transition-all disabled:opacity-50"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                            Resolver
                                        </button>
                                    </div>
                                </div>

                                {/* NOTA INTERNA */}
                                <div className="bg-admin-bg/30 border border-admin-border/50 rounded-xl p-4 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                        Notas Internas (Solo Administradores)
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Escribe una nota interna para esta solicitud..."
                                            value={editingNotes[notif.id] || ''}
                                            onChange={e => setEditingNotes({ ...editingNotes, [notif.id]: e.target.value })}
                                            className="flex-1 bg-admin-card border border-admin-border rounded-lg px-3 py-2 text-xs text-admin-text outline-none focus:border-admin-accent transition-all"
                                        />
                                        <button
                                            onClick={() => handleSaveNote(notif.id)}
                                            disabled={processingId === notif.id}
                                            className="px-4 py-2 bg-admin-accent/10 text-admin-accent border border-admin-accent/20 rounded-lg text-[10px] font-bold hover:bg-admin-accent hover:text-white transition-all disabled:opacity-50"
                                        >
                                            {processingId === notif.id ? '...' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SECCIÓN CLAVES - Autogestión */}
            <div className="mt-12 pt-8 border-t border-admin-border">
                <div className="bg-gradient-to-br from-admin-card to-admin-bg border border-admin-border rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <span className="material-symbols-outlined text-8xl">lock_reset</span>
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-2">
                            <h4 className="text-xl font-bold text-admin-text">🔑 Mi Seguridad y Claves</h4>
                            <p className="text-slate-400 text-sm max-w-md">Administra tu acceso personal al sistema. Recomendamos cambiar tu contraseña periódicamente.</p>
                        </div>
                        <button
                            onClick={() => setShowSelfPassForm(!showSelfPassForm)}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-sm transition-all flex items-center gap-2 border border-white/10"
                        >
                            <span className="material-symbols-outlined text-[20px]">{showSelfPassForm ? 'expand_less' : 'password'}</span>
                            {showSelfPassForm ? 'Ocultar Formulario' : 'Cambiar Mi Contraseña'}
                        </button>
                    </div>

                    {showSelfPassForm && (
                        <form onSubmit={handleSelfChangePassword} className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-300">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    value={selfPassData.new}
                                    onChange={e => setSelfPassData({ ...selfPassData, new: e.target.value })}
                                    className="w-full h-12 bg-slate-900/50 border border-slate-700 rounded-xl px-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    value={selfPassData.confirm}
                                    onChange={e => setSelfPassData({ ...selfPassData, confirm: e.target.value })}
                                    className="w-full h-12 bg-slate-900/50 border border-slate-700 rounded-xl px-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all"
                                    placeholder="Repite la contraseña"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    disabled={changingSelfPass}
                                    className="w-full h-12 bg-admin-accent text-white font-bold rounded-xl shadow-lg shadow-admin-accent/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {changingSelfPass ? 'Actualizando...' : 'Actualizar Mi Clave'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
