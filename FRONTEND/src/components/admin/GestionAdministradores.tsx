import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface AdminUser {
    id: string;
    username: string;
    email: string;
    nombre_apellido: string;
    dni: string;
    user_roles: string[];
    estado: string;
}

interface Activity {
    id: string;
    accion: string;
    tabla_afectada: string;
    fecha: string;
    modulo: string;
}

export default function GestionAdministradores() {
    const { token, user } = useAuth();
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        username: '', email: '', password: '', nombre_apellido: '', dni: '', rol: 'ADMINISTRADOR'
    });

    // Reset Password States
    const [resetLoading, setResetLoading] = useState<string | null>(null);

    // Activity & Status States
    const [selectedAdminActivities, setSelectedAdminActivities] = useState<Activity[]>([]);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [viewingAdminName, setViewingAdminName] = useState('');
    const [activityLoading, setActivityLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/administradores`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error('Error al obtener administradores');
            const data = await resp.json();
            setAdmins(data.administradores || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchAdmins();
    }, [token]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/administradores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            if (!resp.ok) {
                const errorData = await resp.json();
                throw new Error(errorData.detail || 'Error al crear administrador');
            }
            setIsModalOpen(false);
            setFormData({ username: '', email: '', password: '', nombre_apellido: '', dni: '', rol: 'ADMINISTRADOR' });
            fetchAdmins();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRoleChange = async (id: string, newRole: string) => {
        if (!confirm(`¿Estás seguro de cambiar el rol a ${newRole}?`)) return;
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/administradores/${id}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ rol: newRole })
            });
            if (!resp.ok) {
                const d = await resp.json();
                throw new Error(d.detail || 'Error al cambiar rol');
            }
            fetchAdmins();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de ELIMINAR permanentemente a este administrador? Esta acción no se puede deshacer.')) return;
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/administradores/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) {
                const d = await resp.json();
                throw new Error(d.detail || 'Error al eliminar');
            }
            fetchAdmins();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleToggleStatus = async (admin: AdminUser) => {
        const newStatus = admin.estado === 'SUSPENDIDO' ? 'APROBADO' : 'SUSPENDIDO';
        const confirmMsg = newStatus === 'SUSPENDIDO'
            ? `¿Estás seguro de SUSPENDER a ${admin.nombre_apellido}? No podrá ingresar al sistema.`
            : `¿Deseas REACTIVAR el acceso de ${admin.nombre_apellido}?`;

        if (!confirm(confirmMsg)) return;

        setActionLoadingId(admin.id);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users/${admin.id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ estado: newStatus, motivo: 'Acción de Superadmin' })
            });
            if (!resp.ok) {
                const d = await resp.json();
                throw new Error(d.detail || 'Error al actualizar estado');
            }
            fetchAdmins();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleViewActivity = async (admin: AdminUser) => {
        setViewingAdminName(admin.nombre_apellido);
        setIsActivityModalOpen(true);
        setActivityLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/auditoria?usuario_id=${admin.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (resp.ok) {
                setSelectedAdminActivities(data.logs || []);
            }
        } catch (err) {
            console.error('Error fetching admin activity:', err);
        } finally {
            setActivityLoading(false);
        }
    };

    const handleResetPassword = async (admin: AdminUser) => {
        if (!confirm(`¿Estás seguro de restablecer la contraseña de ${admin.nombre_apellido}?\n\nSe le asignará la clave temporal: SRNC2026!`)) return;

        setResetLoading(admin.id);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users/${admin.id}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ new_password: 'SRNC2026!' })
            });
            const data = await resp.json();
            if (resp.ok) {
                alert(`¡Éxito! Nueva clave asignada para ${admin.nombre_apellido}.\n\nClave temporal: ${data.temporary_password || 'SRNC2026!'}\n\nEl usuario deberá cambiarla en su próximo ingreso.`);
            } else {
                throw new Error(data.detail || 'Error al restablecer contraseña');
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setResetLoading(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-admin-text">Cargando administradores...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-admin-text">Gestión de Administradores</h2>
                    <p className="text-sm text-slate-400 mt-1">Administra los accesos de nivel SUPERADMIN y ADMINISTRADOR.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-admin-accent hover:bg-admin-accent/90 text-white px-4 py-2 font-bold rounded-xl flex items-center gap-2 transition"
                >
                    <span className="material-symbols-outlined">add</span>
                    Crear Administrador
                </button>
            </div>

            {error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl">{error}</div>
            ) : (
                <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#1e293b] text-admin-text">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Usuario</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-l border-admin-border/50">Rol y Estado</th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 border-l border-admin-border/50 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-admin-border/50">
                                {admins.map(admin => {
                                    const isSuperadmin = admin.user_roles.includes('SUPERADMIN');
                                    const primaryRole = isSuperadmin ? 'SUPERADMIN' : 'ADMINISTRADOR';
                                    return (
                                        <tr key={admin.id} className="hover:bg-admin-card-hover transition-colors">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-10 rounded-full bg-admin-accent/10 border border-admin-accent/20 flex items-center justify-center font-bold text-admin-accent">
                                                        {admin.nombre_apellido.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-admin-text">{admin.nombre_apellido}</div>
                                                        <div className="text-xs font-mono text-slate-400 mt-0.5">{admin.username} | {admin.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 border-l border-admin-border/50">
                                                <div className="flex flex-col gap-2">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold w-fit ${isSuperadmin ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                                        {isSuperadmin ? <span className="material-symbols-outlined text-[14px]">stars</span> : <span className="material-symbols-outlined text-[14px]">shield_person</span>}
                                                        {primaryRole}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${admin.estado === 'APROBADO' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        <div className={`size-1.5 rounded-full ${admin.estado === 'APROBADO' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                                        {admin.estado}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 border-l border-admin-border/50 text-right space-x-2">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Rol Change - Only for others */}
                                                    {user?.id !== admin.id && (
                                                        <div className="inline-flex rounded-lg border border-admin-border bg-admin-card p-0.5">
                                                            <button
                                                                onClick={() => handleRoleChange(admin.id, isSuperadmin ? 'ADMINISTRADOR' : 'SUPERADMIN')}
                                                                className="px-2 py-1 text-[10px] font-bold bg-transparent hover:bg-admin-accent/10 text-slate-300 hover:text-admin-accent rounded transition"
                                                            >
                                                                Hacer {isSuperadmin ? 'ADMIN' : 'SUPER'}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Activity History */}
                                                    <button
                                                        onClick={() => handleViewActivity(admin)}
                                                        className="size-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                                                        title="Ver Actividad"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">history</span>
                                                    </button>

                                                    {/* Reset Password - Enabled for self if Superadmin access or others */}
                                                    <button
                                                        onClick={() => handleResetPassword(admin)}
                                                        disabled={resetLoading === admin.id}
                                                        className="size-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-admin-accent/10 hover:text-admin-accent transition-colors disabled:opacity-50"
                                                        title="Restablecer Contraseña"
                                                    >
                                                        <span className={`material-symbols-outlined text-[18px] ${resetLoading === admin.id ? 'animate-spin' : ''}`}>
                                                            {resetLoading === admin.id ? 'sync' : 'key'}
                                                        </span>
                                                    </button>

                                                    {/* Suspend/Reactivate - Only for others */}
                                                    {user?.id !== admin.id && (
                                                        <button
                                                            onClick={() => handleToggleStatus(admin)}
                                                            disabled={actionLoadingId === admin.id}
                                                            className={`size-8 inline-flex items-center justify-center rounded-lg transition-colors ${admin.estado === 'SUSPENDIDO' ? 'text-green-500 hover:bg-green-500/10' : 'text-amber-500 hover:bg-amber-500/10'}`}
                                                            title={admin.estado === 'SUSPENDIDO' ? 'Reactivar' : 'Suspender Acceso'}
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                {admin.estado === 'SUSPENDIDO' ? 'lock_open' : 'block'}
                                                            </span>
                                                        </button>
                                                    )}

                                                    {/* Delete - Only for others */}
                                                    {user?.id !== admin.id && (
                                                        <button
                                                            onClick={() => handleDelete(admin.id)}
                                                            className="size-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                            title="Eliminar Administrador"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {admins.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400">No hay administradores registrados o ocurrió un error.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Creacion Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-admin-card w-full max-w-md rounded-2xl border border-admin-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-admin-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-admin-text">Nuevo Administrador</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</label>
                                <input required value={formData.nombre_apellido} onChange={e => setFormData({ ...formData, nombre_apellido: e.target.value })} className="w-full bg-[#1e293b] border-admin-border text-white rounded-xl focus:ring-2 focus:ring-admin-accent" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Usuario</label>
                                    <input required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full bg-[#1e293b] border-admin-border text-white rounded-xl focus:ring-2 focus:ring-admin-accent" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">DNI</label>
                                    <input required value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} className="w-full bg-[#1e293b] border-admin-border text-white rounded-xl focus:ring-2 focus:ring-admin-accent" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email</label>
                                <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-[#1e293b] border-admin-border text-white rounded-xl focus:ring-2 focus:ring-admin-accent" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Contraseña Temporal</label>
                                <input required type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full bg-[#1e293b] border-admin-border text-white rounded-xl focus:ring-2 focus:ring-admin-accent" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nivel de Acceso</label>
                                <select value={formData.rol} onChange={e => setFormData({ ...formData, rol: e.target.value })} className="w-full bg-[#1e293b] border-admin-border text-white rounded-xl shadow-sm focus:ring-admin-accent focus:border-admin-accent">
                                    <option value="ADMINISTRADOR">Administrador Operativo</option>
                                    <option value="SUPERADMIN">SuperAdministrador (Raíz)</option>
                                </select>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold transition">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-admin-accent text-white font-bold rounded-xl hover:bg-admin-accent/90 transition shadow-lg shadow-admin-accent/20">Crear Acceso</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Actividad */}
            {isActivityModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-admin-card w-full max-w-2xl rounded-[32px] border border-admin-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-admin-border flex justify-between items-center bg-gradient-to-r from-admin-accent/10 to-transparent">
                            <div>
                                <h3 className="text-xl font-bold text-admin-text">Historial de Actividad</h3>
                                <p className="text-xs text-slate-400 mt-1 font-mono">{viewingAdminName}</p>
                            </div>
                            <button onClick={() => setIsActivityModalOpen(false)} className="size-10 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 admin-scroll">
                            {activityLoading ? (
                                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-accent"></div></div>
                            ) : selectedAdminActivities.length === 0 ? (
                                <div className="text-center py-20 text-slate-500">No se encontraron registros de este administrador.</div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedAdminActivities.map((log) => (
                                        <div key={log.id} className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition-all flex items-start gap-4">
                                            <div className={`mt-1 size-8 rounded-full flex items-center justify-center shrink-0 ${log.accion.includes('ELIMINAR') || log.accion.includes('DELETE') ? 'bg-red-500/10 text-red-500' :
                                                log.accion.includes('UPDATE') || log.accion.includes('EDIT') ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'
                                                }`}>
                                                <span className="material-symbols-outlined text-[16px]">
                                                    {log.accion.includes('ELIMINAR') ? 'delete' : log.accion.includes('UPDATE') ? 'edit' : 'bolt'}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-sm font-bold text-admin-text line-clamp-1">{log.accion}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">{new Date(log.fecha).toLocaleString()}</span>
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    En tabla: <span className="text-slate-300 font-mono">{log.tabla_afectada}</span>
                                                    {log.modulo && <span> | Módulo: <span className="text-slate-300">{log.modulo}</span></span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-admin-border bg-slate-900/50">
                            <button onClick={() => setIsActivityModalOpen(false)} className="w-full h-12 bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition-transform">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
