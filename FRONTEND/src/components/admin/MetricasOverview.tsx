import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function MetricasOverview() {
    const { token } = useAuth();
    const [metrics, setMetrics] = useState({
        total_socios: 0,
        total_comercios: 0,
        total_pendientes: 0,
        ingresos_mes: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/metrics/overview`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    setMetrics(data.metrics);
                }
            } catch (err) {
                console.error("Error fetching metrics", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [token]);

    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold tracking-tight px-4 pt-2">Visión General</h2>

            {loading ? (
                <div className="px-4 animate-pulse grid grid-cols-2 gap-4">
                    <div className="h-32 bg-admin-card rounded-2xl border border-admin-border"></div>
                    <div className="h-32 bg-admin-card rounded-2xl border border-admin-border"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4">
                    {/* SOCIOS ACTIVOS */}
                    <div className="flex flex-col justify-between h-32 rounded-2xl p-5 border border-admin-border bg-admin-card shadow-sm hover:shadow-lg hover:-translate-y-1 admin-transition relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-admin-accent/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center justify-between z-10 w-full mb-2">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Socios Activos</p>
                            <span className="material-symbols-outlined text-admin-accent/80 text-xl">group</span>
                        </div>
                        <p className="text-admin-text tracking-tight text-3xl font-black z-10 mt-auto">{metrics.total_socios}</p>
                        <div className="absolute bottom-0 left-0 h-1 bg-admin-accent w-1/3 rounded-r-md"></div>
                    </div>

                    {/* COMERCIOS */}
                    <div className="flex flex-col justify-between h-32 rounded-2xl p-5 border border-admin-border bg-admin-card shadow-sm hover:shadow-lg hover:-translate-y-1 admin-transition relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-admin-accent/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center justify-between z-10 w-full mb-2">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Comercios</p>
                            <span className="material-symbols-outlined text-admin-accent/80 text-xl">storefront</span>
                        </div>
                        <p className="text-admin-text tracking-tight text-3xl font-black z-10 mt-auto">{metrics.total_comercios}</p>
                        <div className="absolute bottom-0 left-0 h-1 bg-admin-accent w-1/3 rounded-r-md"></div>
                    </div>

                    {/* INGRESOS */}
                    <div className="flex flex-col justify-between h-32 rounded-2xl p-5 border border-admin-border bg-admin-card shadow-sm hover:shadow-lg hover:-translate-y-1 admin-transition relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-admin-active/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center justify-between z-10 w-full mb-2">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Ingresos Mes</p>
                            <span className="material-symbols-outlined text-admin-active/80 text-xl">payments</span>
                        </div>
                        <p className="text-admin-active tracking-tight text-3xl font-black z-10 mt-auto">${metrics.ingresos_mes}</p>
                        <div className="absolute bottom-0 left-0 h-1 bg-admin-active w-1/3 rounded-r-md"></div>
                    </div>

                    {/* PENDIENTES */}
                    <div className="flex flex-col justify-between h-32 rounded-2xl p-5 border border-admin-border bg-admin-card shadow-sm hover:shadow-lg hover:-translate-y-1 admin-transition relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-admin-pending/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center justify-between z-10 w-full mb-2">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pendientes</p>
                            <span className="material-symbols-outlined text-admin-pending/80 text-xl">pending_actions</span>
                        </div>
                        <p className="text-admin-pending tracking-tight text-3xl font-black z-10 mt-auto">{metrics.total_pendientes}</p>
                        <div className="absolute bottom-0 left-0 h-1 bg-admin-pending w-1/3 rounded-r-md"></div>
                    </div>
                </div>
            )}
        </div>
    );
}
