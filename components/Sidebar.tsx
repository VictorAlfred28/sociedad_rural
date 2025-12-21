
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavLink = ({ to, icon, label, isActive }: { to: string, icon: string, label: string, isActive: boolean }) => (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive
            ? 'bg-primary/20 text-green-900 dark:text-primary dark:bg-primary/10'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
        }`}>
        <span className={`material-symbols-outlined ${isActive ? 'text-green-700 dark:text-primary fill-1' : 'text-gray-500 dark:text-gray-400 group-hover:text-primary'}`}>
            {icon}
        </span>
        <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </Link>
);

export const Sidebar: React.FC = () => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;
    const [role, setRole] = React.useState<string | null>(null);

    React.useEffect(() => {
        import('../services/supabaseClient').then(({ supabase }) => {
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    supabase.from('profiles').select('role').eq('id', user.id).single()
                        .then(({ data }) => setRole(data?.role || 'socio'));
                }
            });
        });
    }, []);

    const isAdmin = role === 'admin';

    return (
        <aside className="w-64 flex-shrink-0 border-r border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark flex flex-col h-screen fixed left-0 top-0 overflow-y-auto z-40 hidden lg:flex">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="size-9 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">agriculture</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold leading-tight">Sociedad Rural</h1>
                        <p className="text-xs text-text-secondary">Portal {isAdmin ? 'Administrativo' : 'del Socio'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    {isAdmin ? (
                        <>
                            <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Administración</p>
                            <NavLink to="/admin" icon="dashboard" label="Dashboard Admin" isActive={isActive('/admin')} />
                            <NavLink to="/partners" icon="group" label="Gestión Socios" isActive={isActive('/partners')} />
                            <NavLink to="/audit" icon="fact_check" label="Auditoría" isActive={isActive('/audit')} />
                            <NavLink to="/settings" icon="settings" label="Configuración" isActive={isActive('/settings')} />

                            <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6">Vista Socio</p>
                            <NavLink to="/" icon="visibility" label="Ver como Socio" isActive={isActive('/')} />
                        </>
                    ) : (
                        <>
                            <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">Principal</p>
                            <NavLink to="/" icon="dashboard" label="Dashboard" isActive={isActive('/')} />
                            <NavLink to="/digital-id" icon="badge" label="Mi Carnet" isActive={isActive('/digital-id')} />
                            <NavLink to="/payments" icon="payments" label="Mis Pagos" isActive={isActive('/payments')} />
                            <NavLink to="/merchants" icon="storefront" label="Beneficios" isActive={isActive('/merchants')} />

                            <p className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6">Comunidad</p>
                            <NavLink to="/events" icon="event" label="Eventos" isActive={isActive('/events')} />
                            <NavLink to="/forum" icon="forum" label="Foro" isActive={isActive('/forum')} />
                            <NavLink to="/faq" icon="help" label="Ayuda" isActive={isActive('/faq')} />
                        </>
                    )}
                </div>
            </div>
            <div className="mt-auto p-4 border-t border-border-light dark:border-border-dark">
                <Link to="/login" className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    <span className="material-symbols-outlined">logout</span>
                    <span className="text-sm font-medium">Cerrar Sesión</span>
                </Link>
            </div>
        </aside>
    );
};
