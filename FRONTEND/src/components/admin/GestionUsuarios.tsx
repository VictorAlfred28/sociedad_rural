import { useState, useEffect } from 'react';
import { useAuth, Socio } from '../../context/AuthContext';

export default function GestionUsuarios() {
    const { token } = useAuth();
    const [users, setUsers] = useState<Socio[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    // Filtros
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('TODOS'); // TODOS, SOCIO, COMERCIO, CAMARA
    const [filterStatus, setFilterStatus] = useState('TODOS'); // TODOS, PENDIENTE, APROBADO, SUSPENDIDO

    // Modal States
    const [actionUser, setActionUser] = useState<{ id: string, name: string } | null>(null);
    const [actionType, setActionType] = useState<'NONE' | 'DELETE' | 'RESET_PASS' | 'SUCCESS_MSG'>('NONE');
    const [successMessage, setSuccessMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

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
    }, [token]);

    const handleStatusChange = async (userId: string, newStatus: string) => {
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

            if (!resp.ok) {
                throw new Error(data.detail || 'Error al restablecer contraseña');
            }

            setSuccessMessage(`Se ha restablecido la contraseña de ${actionUser.name}.\n\nContraseña temporal: ${data.temporary_password}\n\nEl usuario deberá cambiarla en su primer ingreso.`);
            setActionType('SUCCESS_MSG');
        } catch (err: any) {
            alert(err.message);
            setActionType('NONE');
        } finally {
            setActionLoading(false);
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

            {/* Buscador y Filtros */}
            <div className="px-4 flex flex-col gap-3">
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
                        <option value="CAMARA">Cámaras</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="h-10 px-3 bg-admin-card border border-admin-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-300 outline-none focus:border-admin-accent cursor-pointer shadow-sm">
                        <option value="TODOS">Est: Todos</option>
                        <option value="APROBADO">Aprobados</option>
                        <option value="PENDIENTE">Pendientes</option>
                        <option value="SUSPENDIDO">Suspendidos</option>
                    </select>
                </div>
            </div>

            {/* Lista de Usuarios */}
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
                                        {user.motivo && (
                                            <p className="text-[10px] font-bold text-[#E57373] mt-0.5 truncate uppercase">Motivo: {user.motivo}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shrink-0 ${user.estado === 'APROBADO' ? 'bg-[#10b981]/10 text-[#10b981]' :
                                    user.estado === 'PENDIENTE' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                                        user.estado === 'RESTRINGIDO' ? 'bg-[#E57373]/10 text-[#E57373]' :
                                            'bg-[#ef4444]/10 text-[#ef4444]'
                                    }`}>
                                    {user.estado}
                                </span>
                            </div>

                            {/* Acciones */}
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
                                    <>
                                        <button onClick={() => alert('La pasarela de pagos se encuentra en desarrollo. Por favor contáctese con Administración para regularizar su deuda.')} className="flex-1 bg-[#10b981] text-white hover:bg-[#059669] rounded-lg h-9 text-xs font-bold active:scale-95 admin-transition">
                                            Regularizar
                                        </button>
                                        <button onClick={() => alert('La pasarela de pagos se encuentra en desarrollo. Por favor contáctese con Administración para regularizar su deuda.')} className="flex-1 bg-[#E57373] text-white hover:bg-[#ef5350] rounded-lg h-9 text-xs font-bold active:scale-95 admin-transition">
                                            Pagar Mora
                                        </button>
                                    </>
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
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Custom Modals */}
            {actionType !== 'NONE' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="bg-admin-card border border-admin-border w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header Image/Icon depending on action */}
                        <div className={`h-24 flex items-center justify-center ${actionType === 'DELETE' ? 'bg-[#ef4444]/10' :
                            actionType === 'RESET_PASS' ? 'bg-admin-accent/10' :
                                'bg-[#10b981]/10'
                            }`}>
                            <span className={`material-symbols-outlined text-4xl ${actionType === 'DELETE' ? 'text-[#ef4444]' :
                                actionType === 'RESET_PASS' ? 'text-admin-accent' :
                                    'text-[#10b981]'
                                }`}>
                                {actionType === 'DELETE' ? 'warning' : actionType === 'RESET_PASS' ? 'key' : 'check_circle'}
                            </span>
                        </div>

                        {/* Body */}
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

                            {/* Actions */}
                            <div className="flex gap-3 w-full">
                                {actionType !== 'SUCCESS_MSG' ? (
                                    <>
                                        <button
                                            onClick={() => setActionType('NONE')}
                                            disabled={actionLoading}
                                            className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 text-sm">
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={actionType === 'DELETE' ? handleDeleteUser : handleResetPassword}
                                            disabled={actionLoading}
                                            className={`flex-1 py-3 font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 text-sm ${actionType === 'DELETE' ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]' : 'bg-admin-accent text-white hover:bg-[#6366f1]'
                                                }`}>
                                            {actionLoading ? 'Procesando...' : 'Confirmar'}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setActionType('NONE')}
                                        className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl active:scale-95 transition-transform text-sm">
                                        Entendido
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
