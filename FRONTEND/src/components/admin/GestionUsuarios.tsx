import { useState, useEffect } from 'react';
import { useAuth, Socio } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function GestionUsuarios() {
    const { token } = useAuth();
    const [users, setUsers] = useState<Socio[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    // Filtros
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('TODOS');
    const [filterStatus, setFilterStatus] = useState('TODOS');

    // Modal States
    const [actionUser, setActionUser] = useState<{ id: string, name: string } | null>(null);
    const [actionType, setActionType] = useState<'NONE' | 'DELETE' | 'RESET_PASS' | 'SUCCESS_MSG'>('NONE');
    const [successMessage, setSuccessMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Activity Log States
    const [selectedUserActivity, setSelectedUserActivity] = useState<any[]>([]);
    const [viewingUser, setViewingUser] = useState<Socio | null>(null);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // Edit States
    const [editingUser, setEditingUser] = useState<Socio | null>(null);
    const [editFormData, setEditFormData] = useState({
        nombre_apellido: '',
        email: '',
        telefono: '',
        municipio: ''
    });
    const [municipiosDisponibles, setMunicipiosDisponibles] = useState<{ id: string, nombre: string }[]>([]);

    // Support Requests States
    const [supportNotifications, setSupportNotifications] = useState<any[]>([]);
    const [loadingSupport, setLoadingSupport] = useState(false);

    const fetchSupportNotifications = async () => {
        setLoadingSupport(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/notificaciones-soporte`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (resp.ok) setSupportNotifications(data.notificaciones || []);
        } catch (err) {
            console.error('Error fetching support notifications:', err);
        } finally {
            setLoadingSupport(false);
        }
    };

    const handleResolveSupport = async (notifId: string) => {
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/notificaciones-soporte/${notifId}/resolver`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                setSupportNotifications(prev => prev.filter(n => n.id !== notifId));
            }
        } catch (err) {
            console.error('Error resolving support notification:', err);
        }
    };

    const handleProcessRecovery = async (notif: any) => {
        setActionUser({ id: notif.usuario_id, name: notif.profiles?.nombre_apellido || 'Socio' });
        setActionType('RESET_PASS');
        (window as any)._pendingSupportId = notif.id;
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Error al cargar usuarios');
            setUsers(data.users || []);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchSupportNotifications();
    }, [token]);

    const isSimulationId = (id: string) => id.startsWith('simulacion-');

    // Cargar municipios para el modal de edición
    useEffect(() => {
        const fetchMunicipios = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`);
                const data = await res.json();
                if (data.municipios) setMunicipiosDisponibles(data.municipios);
            } catch (err) {
                console.error('Error cargando municipios:', err);
            }
        };
        fetchMunicipios();
    }, []);

    const handleStatusChange = async (userId: string, newStatus: string) => {
        if (isSimulationId(userId)) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, estado: newStatus } : u));
            return;
        }
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ estado: newStatus })
            });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.detail || 'Error al actualizar estado');
            }
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, estado: newStatus } : u));
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteUser = async () => {
        if (!actionUser) return;
        if (isSimulationId(actionUser.id)) {
            setUsers(prev => prev.filter(u => u.id !== actionUser.id));
            setSuccessMessage(`El usuario ${actionUser.name} (Simulado) ha sido eliminado de la vista.`);
            setActionType('SUCCESS_MSG');
            return;
        }
        setActionLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users/${actionUser.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.detail || 'Error al eliminar usuario');
            }
            setUsers(prev => prev.filter(u => u.id !== actionUser.id));
            setSuccessMessage(`El usuario ${actionUser.name} ha sido eliminado permanentemente del sistema.`);
            setActionType('SUCCESS_MSG');
        } catch (err: any) {
            alert(err.message);
            setActionType('NONE');
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!actionUser) return;
        if (isSimulationId(actionUser.id)) {
            setSuccessMessage(`Se ha restablecido la contraseña de ${actionUser.name} (SIMULADO).\n\nContraseña temporal: SRNC2026!\n\n(Nota: Esto es una simulación visual).`);
            setActionType('SUCCESS_MSG');
            return;
        }
        setActionLoading(true);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users/${actionUser.id}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ new_password: 'SRNC2026!' })
            });
            const data = await resp.json();
            if (resp.ok) {
                setSuccessMessage(`Se ha restablecido la contraseña de ${actionUser.name}.\n\nContraseña temporal: ${data.temporary_password}\n\nEl usuario deberá cambiarla en su primer ingreso.`);
                setActionType('SUCCESS_MSG');

                // Si venía de una solicitud de soporte, resolverla automáticamente
                const pendingId = (window as any)._pendingSupportId;
                if (pendingId) {
                    handleResolveSupport(pendingId);
                    (window as any)._pendingSupportId = null;
                }
            } else {
                throw new Error(data.detail || 'Error al restablecer contraseña');
            }
        } catch (err: any) {
            alert(err.message);
            setActionType('NONE');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditClick = (user: Socio) => {
        setEditingUser(user);
        setEditFormData({
            nombre_apellido: user.nombre_apellido || '',
            email: user.email || '',
            telefono: user.telefono || '',
            municipio: user.municipio || ''
        });
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        setActionLoading(true);
        try {
            if (isSimulationId(editingUser.id)) {
                setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...editFormData } : u));
                setEditingUser(null);
                return;
            }

            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users/${editingUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editFormData)
            });

            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.detail || 'Error al actualizar usuario');
            }

            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...editFormData } : u));
            setEditingUser(null);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const fetchActivity = async (targetUser: Socio) => {
        setViewingUser(targetUser);
        if (isSimulationId(targetUser.id)) {
            setSelectedUserActivity([
                { id: 1, tipo_evento: 'LOGIN', descripcion: 'Ingreso simulado', created_at: new Date().toISOString() },
                { id: 2, tipo_evento: 'MORA_DETECTADA', descripcion: 'Sistema detectó deuda', created_at: new Date().toISOString() }
            ]);
            setLoadingActivity(false);
            return;
        }
        setLoadingActivity(true);
        setSelectedUserActivity([]);
        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/users/${targetUser.id}/activity`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (resp.ok) setSelectedUserActivity(data.activity);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingActivity(false);
        }
    };

    const confirmDelete = (userId: string, userName: string) => {
        setActionUser({ id: userId, name: userName });
        setActionType('DELETE');
    };

    const confirmReset = (userId: string, userName: string) => {
        setActionUser({ id: userId, name: userName });
        setActionType('RESET_PASS');
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.nombre_apellido?.toLowerCase().includes(search.toLowerCase()) || u.dni?.includes(search) || u.email?.toLowerCase().includes(search.toLowerCase());
        const matchesRole = filterRole === 'TODOS' || u.rol === filterRole;
        const matchesStatus = filterStatus === 'TODOS' || u.estado === filterStatus;
        return matchesSearch && matchesRole && matchesStatus;
    });

    return (
        <div className="flex flex-col gap-4 relative">
            <div className="px-4">
                <h2 className="text-xl font-bold tracking-tight text-admin-text mt-2">Directorio Global</h2>
            </div>

            <div className="px-4 flex flex-col gap-3">
                <button
                    onClick={() => {
                        setUsers(prev => [
                            {
                                id: "simulacion-" + Date.now(),
                                nombre_apellido: "Carlos Méndez (Simulado)",
                                dni: "10123456",
                                email: "carlos@mock.com",
                                rol: "SOCIO",
                                estado: "RESTRINGIDO",
                                motivo: "Con Mora"
                            } as any,
                            ...prev
                        ]);
                    }}
                    className="w-full bg-[#E57373]/10 text-[#E57373] border border-[#E57373]/30 hover:bg-[#E57373] hover:text-white font-bold py-2 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-sm">science</span>
                    Simular Usuario Restringido (Mora)
                </button>

                <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-admin-accent admin-transition">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, DNI o email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-12 bg-admin-card border border-admin-border rounded-xl pl-10 pr-4 text-sm font-medium outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all text-admin-text placeholder:text-slate-500 shadow-sm"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 admin-scroll">
                    <select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                        className="h-10 px-3 bg-admin-card border border-admin-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-300 outline-none focus:border-admin-accent cursor-pointer shadow-sm">
                        <option value="TODOS">Rol: Todos</option>
                        <option value="SOCIO">Socios</option>
                        <option value="COMERCIO">Comercios</option>
                        {/* <option value="CAMARA">Cámaras</option> */}
                    </select>

                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="h-10 px-3 bg-admin-card border border-admin-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-300 outline-none focus:border-admin-accent cursor-pointer shadow-sm">
                        <option value="TODOS">Est: Todos</option>
                        <option value="APROBADO">Aprobados</option>
                        <option value="PENDIENTE">Pendientes</option>
                        <option value="RESTRINGIDO">Restringidos (Mora)</option>
                        <option value="SUSPENDIDO">Suspendidos</option>
                    </select>
                </div>
            </div>

            {/* SECCIÓN DE SOLICITUDES DE SOPORTE */}
            {supportNotifications.length > 0 && (
                <div className="px-4 mb-2">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-500">
                                <span className="material-symbols-outlined font-bold">priority_high</span>
                                <h3 className="text-sm font-black uppercase tracking-wider">Solicitudes de Recuperación ({supportNotifications.length})</h3>
                            </div>
                            <button onClick={fetchSupportNotifications} className="text-amber-500/50 hover:text-amber-500 transition-colors">
                                <span className="material-symbols-outlined text-sm">refresh</span>
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto admin-scroll">
                            {supportNotifications.map(notif => (
                                <div key={notif.id} className="bg-admin-bg/50 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <p className="text-xs font-bold text-admin-text">{notif.profiles?.nombre_apellido}</p>
                                            <p className="text-[10px] text-slate-500">DNI: {notif.profiles?.dni} • {new Date(notif.created_at).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleResolveSupport(notif.id)}
                                                className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded-md text-[10px] font-bold transition-colors"
                                            >
                                                Ignorar
                                            </button>
                                            <button
                                                onClick={() => handleProcessRecovery(notif)}
                                                className="px-3 py-1 bg-amber-500 text-white rounded-md text-[10px] font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                                            >
                                                Restablecer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3 px-4 pb-8">
                {loading ? (
                    <p className="text-center text-slate-500 py-8">Cargando directorio...</p>
                ) : errorMsg ? (
                    <p className="text-center text-red-500 py-8">{errorMsg}</p>
                ) : filteredUsers.length === 0 ? (
                    <div className="bg-admin-card border border-admin-border p-8 rounded-2xl flex flex-col items-center text-center shadow-inner">
                        <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">person_off</span>
                        <p className="text-slate-400 font-medium text-sm">No se encontraron usuarios con esos filtros.</p>
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <div key={user.id} className="bg-admin-card p-4 rounded-2xl border border-admin-border flex flex-col gap-3 shadow-sm hover:border-admin-accent/30 admin-transition">
                            <div className="flex items-start gap-3 justify-between">
                                <div className="flex items-center gap-3 truncate">
                                    <div className={`flex shrink-0 items-center justify-center rounded-xl size-10 border ${user?.rol === 'COMERCIO'
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                        : user?.rol === 'CAMARA'
                                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                            : 'bg-admin-accent/10 border-admin-accent/20 text-admin-accent'
                                        }`}>
                                        <span className="material-symbols-outlined text-xl">
                                            {user?.rol === 'COMERCIO' ? 'storefront' : user?.rol === 'CAMARA' ? 'domain' : 'person'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <p className="font-bold text-sm truncate text-admin-text">{user.nombre_apellido || user.email}</p>
                                        <p className="text-xs text-slate-400 truncate">{user.rol} • {user.dni}</p>
                                        {user.telefono && (
                                            <div className="flex items-center gap-1 text-[10px] text-admin-accent font-bold mt-0.5">
                                                <span className="material-symbols-outlined text-[12px]">call</span>
                                                {user.telefono}
                                            </div>
                                        )}
                                        {user.motivo && (
                                            <p className="text-[10px] font-bold text-[#E57373] mt-0.5 truncate uppercase">Motivo: {user.motivo}</p>
                                        )}
                                    </div>
                                </div>

                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shrink-0 ${user.estado === 'APROBADO' ? 'bg-[#10b981]/10 text-[#10b981]' :
                                    user.estado === 'PENDIENTE' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                                        user.estado === 'RESTRINGIDO' ? 'bg-[#E57373]/10 text-[#E57373]' :
                                            'bg-[#ef4444]/10 text-[#ef4444]'
                                    }`}>
                                    {user.estado}
                                </span>
                            </div>

                            <div className="flex gap-2 pt-3 mt-1 border-t border-admin-border relative">
                                {user.estado === 'PENDIENTE' && (
                                    <button onClick={() => handleStatusChange(user.id, 'APROBADO')} className="flex-1 bg-[#052e16] text-[#10b981] hover:bg-[#10b981] hover:text-white rounded-lg h-9 text-xs font-bold active:scale-95 admin-transition">
                                        Aprobar
                                    </button>
                                )}
                                {user.estado === 'APROBADO' && user.id !== token && (
                                    <button onClick={() => handleStatusChange(user.id, 'SUSPENDIDO')} className="flex-1 bg-[#451a03] text-[#f59e0b] hover:bg-[#f59e0b] hover:text-white rounded-lg h-9 text-xs font-bold active:scale-95 admin-transition">
                                        Suspender
                                    </button>
                                )}
                                {user.estado === 'SUSPENDIDO' && (
                                    <button onClick={() => handleStatusChange(user.id, 'APROBADO')} className="flex-1 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white rounded-lg h-9 text-xs font-bold active:scale-95 admin-transition">
                                        Reactivar
                                    </button>
                                )}
                                {user.estado === 'RESTRINGIDO' && (
                                    <button onClick={() => handleStatusChange(user.id, 'APROBADO')} className="flex-1 bg-[#10b981]/20 text-[#10b981] hover:bg-[#10b981] hover:text-white rounded-lg h-9 text-xs font-bold active:scale-95 admin-transition">
                                        Reactivar
                                    </button>
                                )}
                                <button
                                    onClick={() => confirmReset(user.id, user.nombre_apellido || user.email)}
                                    title="Restablecer Contraseña"
                                    className="flex items-center justify-center w-9 h-9 bg-[#1e293b] text-slate-400 border border-slate-700 hover:text-admin-accent hover:border-admin-accent rounded-lg active:scale-95 admin-transition">
                                    <span className="material-symbols-outlined text-[18px]">key</span>
                                </button>
                                {user.id !== token && (
                                    <button
                                        onClick={() => confirmDelete(user.id, user.nombre_apellido || user.email)}
                                        title="Eliminar Usuario"
                                        className="flex items-center justify-center w-9 h-9 bg-[#450a0a] text-[#ef4444] border border-[#7f1d1d] hover:bg-[#ef4444] hover:text-white rounded-lg active:scale-95 admin-transition">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEditClick(user)}
                                    title="Editar Usuario"
                                    className="flex items-center justify-center w-9 h-9 bg-slate-800 text-slate-300 border border-slate-700 hover:text-admin-accent hover:border-admin-accent rounded-lg active:scale-95 admin-transition">
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                    onClick={() => fetchActivity(user)}
                                    title="Ver Actividad"
                                    className="flex items-center justify-center w-9 h-9 bg-slate-800 text-slate-300 border border-slate-700 hover:text-admin-accent hover:border-admin-accent rounded-lg active:scale-95 admin-transition">
                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* MODAL EDICIÓN */}
            <AnimatePresence>
                {editingUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-admin-card border border-admin-border w-full max-w-md rounded-[24px] overflow-hidden shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-admin-border flex items-center justify-between">
                                <h3 className="text-lg font-bold text-admin-text">Editar Usuario</h3>
                                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh] admin-scroll">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre y Apellido</label>
                                    <input
                                        type="text"
                                        value={editFormData.nombre_apellido}
                                        onChange={e => setEditFormData({ ...editFormData, nombre_apellido: e.target.value })}
                                        className="w-full h-11 bg-slate-800 border border-slate-700 rounded-xl px-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
                                    <input
                                        type="email"
                                        value={editFormData.email}
                                        onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                                        className="w-full h-11 bg-slate-800 border border-slate-700 rounded-xl px-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                                    <input
                                        type="text"
                                        value={editFormData.telefono}
                                        onChange={e => setEditFormData({ ...editFormData, telefono: e.target.value })}
                                        className="w-full h-11 bg-slate-800 border border-slate-700 rounded-xl px-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Municipio / Localidad</label>
                                    <div className="relative">
                                        <select
                                            value={editFormData.municipio}
                                            onChange={e => setEditFormData({ ...editFormData, municipio: e.target.value })}
                                            className="w-full h-11 bg-slate-800 border border-slate-700 rounded-xl px-4 text-sm text-admin-text outline-none focus:border-admin-accent transition-all appearance-none"
                                        >
                                            <option value="">Seleccioná un municipio</option>
                                            {municipiosDisponibles.map(m => (
                                                <option key={m.id} value={m.nombre}>{m.nombre}</option>
                                            ))}
                                            <option value="No especificado">No especificado</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-admin-border flex gap-3">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 h-12 bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95 transition-transform"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={actionLoading}
                                    className="flex-1 h-12 bg-admin-accent text-white font-bold rounded-xl shadow-lg shadow-admin-accent/20 active:scale-95 transition-transform disabled:opacity-50"
                                >
                                    {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Custom Modals */}
            {actionType !== 'NONE' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="bg-admin-card border border-admin-border w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className={`h-24 flex items-center justify-center ${actionType === 'DELETE' ? 'bg-[#ef4444]/10' : actionType === 'RESET_PASS' ? 'bg-admin-accent/10' : 'bg-[#10b981]/10'}`}>
                            <span className={`material-symbols-outlined text-4xl ${actionType === 'DELETE' ? 'text-[#ef4444]' : actionType === 'RESET_PASS' ? 'text-admin-accent' : 'text-[#10b981]'}`}>
                                {actionType === 'DELETE' ? 'warning' : actionType === 'RESET_PASS' ? 'key' : 'check_circle'}
                            </span>
                        </div>
                        <div className="px-6 py-6 text-center">
                            <h3 className="text-lg font-bold text-admin-text mb-2">
                                {actionType === 'DELETE' && '¿Eliminar Usuario?'}
                                {actionType === 'RESET_PASS' && '¿Restablecer Contraseña?'}
                                {actionType === 'SUCCESS_MSG' && 'Operación Exitosa'}
                            </h3>
                            <p className="text-sm text-slate-400 mb-6 whitespace-pre-line">
                                {actionType === 'DELETE' && `Estás por eliminar permanentemente al usuario\n${actionUser?.name}.\n\nEsta acción no se puede deshacer.`}
                                {actionType === 'RESET_PASS' && `Se le asignará la contraseña temporal SRNC2026! al usuario\n${actionUser?.name}.\n\nPara su seguridad, se le pedirá cambiarla al ingresar.`}
                                {actionType === 'SUCCESS_MSG' && successMessage}
                            </p>
                            <div className="flex gap-3 w-full">
                                {actionType !== 'SUCCESS_MSG' ? (
                                    <>
                                        <button onClick={() => setActionType('NONE')} disabled={actionLoading} className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 text-sm">Cancelar</button>
                                        <button onClick={actionType === 'DELETE' ? handleDeleteUser : handleResetPassword} disabled={actionLoading} className={`flex-1 py-3 font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 text-sm ${actionType === 'DELETE' ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-admin-accent text-white hover:bg-[#6366f1]'}`}>
                                            {actionLoading ? 'Procesando...' : 'Confirmar'}
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => setActionType('NONE')} className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl active:scale-95 transition-transform text-sm">Entendido</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ACTIVIDAD */}
            <AnimatePresence>
                {viewingUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setViewingUser(null)}
                        className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm cursor-pointer"
                    >
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-admin-card border-l border-admin-border w-full max-w-lg h-full shadow-2xl flex flex-col cursor-auto relative"
                        >
                            <div className="p-6 border-b border-admin-border flex items-center justify-between bg-admin-bg/50">
                                <div>
                                    <h3 className="text-xl font-bold text-admin-text tracking-tight">Hoja de Ruta Institucional</h3>
                                    <p className="text-xs text-slate-500 font-medium">Socio: {viewingUser.nombre_apellido}</p>
                                </div>
                                <button
                                    onClick={() => setViewingUser(null)}
                                    className="size-10 rounded-full bg-slate-800 hover:bg-[#ef4444] text-slate-400 hover:text-white flex items-center justify-center transition-all shadow-md active:scale-90 border border-slate-700 hover:border-[#ef4444]"
                                    title="Cerrar modal"
                                >
                                    <span className="material-symbols-outlined font-bold">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 admin-scroll">
                                {loadingActivity ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3">
                                        <div className="size-8 border-2 border-admin-accent border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cronología...</p>
                                    </div>
                                ) : selectedUserActivity.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                                        <span className="material-symbols-outlined text-4xl mb-2">history_toggle_off</span>
                                        <p className="text-sm">Sin actividad registrada aún.</p>
                                    </div>
                                ) : (
                                    <div className="relative border-l-2 border-slate-800 ml-3 pl-8 space-y-8">
                                        {selectedUserActivity.map((log) => (
                                            <div key={log.id} className="relative">
                                                <div className="absolute -left-[39px] top-1 size-4 rounded-full border-2 border-slate-800 bg-admin-bg flex items-center justify-center">
                                                    <div className={`size-1.5 rounded-full ${log.tipo_evento.includes('RECHAZADO') ? 'bg-red-500' : log.tipo_evento.includes('APROBADO') ? 'bg-green-500' : 'bg-admin-accent'}`}></div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">{new Date(log.fecha).toLocaleString()}</span>
                                                    <h5 className={`font-bold text-sm ${log.tipo_evento.includes('RECHAZADO') ? 'text-red-400' : log.tipo_evento.includes('APROBADO') ? 'text-green-400' : 'text-admin-text'}`}>{log.tipo_evento.replace(/_/g, ' ')}</h5>
                                                    <p className="text-xs text-slate-500 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5">{log.descripcion}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
