
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState({ users: 0, merchants: 0, payments: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const { count: merchantsCount } = await supabase.from('merchants').select('*', { count: 'exact', head: true });
            // Mock payments for now
            setStats({
                users: usersCount || 0,
                merchants: merchantsCount || 0,
                payments: 1250000
            });
            setLoading(false);
        };
        fetchStats();
    }, []);

    return (
        <div className="p-8 bg-gray-50 dark:bg-black min-h-screen">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white">Panel de Administración</h1>
                    <p className="text-gray-500">Gestión integral de la Sociedad Rural</p>
                </div>
                <div className="flex gap-4">
                    <button className="bg-white border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-xl shadow-sm hover:bg-gray-50">
                        Configuración
                    </button>
                    <button className="bg-black text-white font-bold py-2 px-4 rounded-xl shadow-lg hover:bg-gray-800">
                        + Nuevo Usuario
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-start mb-4">
                        <div className="size-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">group</span>
                        </div>
                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">+12%</span>
                    </div>
                    <h3 className="text-3xl font-black dark:text-white">{stats.users}</h3>
                    <p className="text-gray-500 font-medium">Socios Registrados</p>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-start mb-4">
                        <div className="size-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">storefront</span>
                        </div>
                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">+5%</span>
                    </div>
                    <h3 className="text-3xl font-black dark:text-white">{stats.merchants}</h3>
                    <p className="text-gray-500 font-medium">Comercios Adheridos</p>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-start mb-4">
                        <div className="size-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                            <span className="material-symbols-outlined">payments</span>
                        </div>
                    </div>
                    <h3 className="text-3xl font-black dark:text-white">${(stats.payments).toLocaleString()}</h3>
                    <p className="text-gray-500 font-medium">Recaudación Mensual</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 className="text-xl font-bold mb-6 dark:text-white">Solicitudes Recientes</h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition">
                                <div className="flex items-center gap-4">
                                    <div className="size-10 rounded-full bg-gray-200 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-bold dark:text-white">Nombre Usuario</p>
                                        <p className="text-xs text-gray-500">Solicitud de Socio</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="size-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"><span className="material-symbols-outlined text-sm">check</span></button>
                                    <button className="size-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200"><span className="material-symbols-outlined text-sm">close</span></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 className="text-xl font-bold mb-6 dark:text-white">Acciones Rápidas</h3>
                    <div className="grid grid-cols-2 gap-4">

                        <button className="p-4 rounded-xl border border-gray-200 hover:border-black hover:bg-gray-50 transition text-left">
                            <span className="material-symbols-outlined text-2xl mb-2 text-blue-500">campaign</span>
                            <p className="font-bold dark:text-white">Publicar Novedad</p>
                        </button>
                        <button className="p-4 rounded-xl border border-gray-200 hover:border-black hover:bg-gray-50 transition text-left">
                            <span className="material-symbols-outlined text-2xl mb-2 text-purple-500">manage_accounts</span>
                            <p className="font-bold dark:text-white">Gestionar Roles</p>
                        </button>
                        <button className="p-4 rounded-xl border border-gray-200 hover:border-black hover:bg-gray-50 transition text-left">
                            <span className="material-symbols-outlined text-2xl mb-2 text-orange-500">settings</span>
                            <p className="font-bold dark:text-white">Ajustes Sistema</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
