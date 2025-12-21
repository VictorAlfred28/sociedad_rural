
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export default function PartnerManagement() {
    const [activeTab, setActiveTab] = useState<'users' | 'merchants'>('users');
    const [users, setUsers] = useState<any[]>([]);
    const [merchants, setMerchants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showAddMerchant, setShowAddMerchant] = useState(false);
    const [newMerchant, setNewMerchant] = useState({
        name: '',
        description: '',
        category: 'Insumos',
        discount_details: '',
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        if (activeTab === 'users') {
            const { data } = await supabase.from('profiles').select('*');
            setUsers(data || []);
        } else {
            const { data } = await supabase.from('merchants').select('*');
            setMerchants(data || []);
        }
        setLoading(false);
    };

    const handleAddMerchant = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('merchants').insert([{
                ...newMerchant,
                image_url: 'https://picsum.photos/400/300' // Placeholder for now
            }]);

            if (error) throw error;

            setShowAddMerchant(false);
            setNewMerchant({ name: '', description: '', category: 'Insumos', discount_details: '' });
            fetchData(); // Refresh list
            alert('Comercio agregado exitosamente');
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const handleToggleStatus = async (userId: string, newStatus: string) => {
        if (!confirm(`¿Estás seguro de cambiar el estado a ${newStatus === 'active' ? 'ACTIVO' : 'SUSPENDIDO'}?`)) return;

        try {
            const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            alert('Error actualizando estado: ' + error.message);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-black text-text-main dark:text-white">Gestión de Socios</h1>
                <p className="text-text-secondary">Administra los usuarios y beneficios de la plataforma.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-3 font-bold text-sm ${activeTab === 'users' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Usuarios Registrados
                </button>
                <button
                    onClick={() => setActiveTab('merchants')}
                    className={`px-6 py-3 font-bold text-sm ${activeTab === 'merchants' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Comercios Adheridos
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div>
                    {activeTab === 'users' ? (
                        <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-black/20 text-gray-500 font-bold uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Nombre</th>
                                        <th className="px-6 py-3">DNI</th>
                                        <th className="px-6 py-3">Email</th>
                                        <th className="px-6 py-3">Rol</th>
                                        <th className="px-6 py-3">Estado</th>
                                        <th className="px-6 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="px-6 py-4 font-medium dark:text-white">{user.full_name || 'Sin nombre'}</td>
                                            <td className="px-6 py-4 dark:text-gray-300">{user.dni || '-'}</td>
                                            <td className="px-6 py-4 dark:text-gray-300">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${user.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {user.status === 'suspended' ? 'Suspendido' : 'Activo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {user.status === 'suspended' ? (
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, 'active')}
                                                        className="text-green-600 hover:text-green-800 font-bold text-xs bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg transition"
                                                    >
                                                        Activar
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, 'suspended')}
                                                        className="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition"
                                                    >
                                                        Suspender
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay usuarios registrados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setShowAddMerchant(true)}
                                    className="bg-primary text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-green-400 transition"
                                >
                                    <span className="material-symbols-outlined">add_business</span>
                                    Agregar Comercio
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {merchants.map((merchant) => (
                                    <div key={merchant.id} className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex gap-4">
                                        <div className="size-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-2xl">
                                            🏪
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg dark:text-white">{merchant.name}</h3>
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300 font-medium">{merchant.category}</span>
                                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{merchant.description}</p>
                                            <p className="text-primary font-bold mt-2">{merchant.discount_details}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Add Merchant */}
            {showAddMerchant && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl p-8 shadow-2xl">
                        <h2 className="text-2xl font-black mb-6 dark:text-white">Nuevo Comercio</h2>
                        <form onSubmit={handleAddMerchant} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 dark:text-white">Nombre Comercio</label>
                                <input
                                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
                                    value={newMerchant.name}
                                    onChange={e => setNewMerchant({ ...newMerchant, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 dark:text-white">Categoría</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
                                    value={newMerchant.category}
                                    onChange={e => setNewMerchant({ ...newMerchant, category: e.target.value })}
                                >
                                    <option>Insumos</option>
                                    <option>Maquinaria</option>
                                    <option>Servicios</option>
                                    <option>Veterinaria</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 dark:text-white">Descripción</label>
                                <textarea
                                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
                                    value={newMerchant.description}
                                    onChange={e => setNewMerchant({ ...newMerchant, description: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 dark:text-white">Detalle Descuento</label>
                                <input
                                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
                                    placeholder="Ej: 10% OFF en efectivo"
                                    value={newMerchant.discount_details}
                                    onChange={e => setNewMerchant({ ...newMerchant, discount_details: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddMerchant(false)}
                                    className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-primary text-black font-bold rounded-xl hover:bg-green-400 shadow-lg shadow-green-500/20"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
