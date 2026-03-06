import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

import SocioHomeContent from '../components/SocioHomeContent';

export default function HomeSocio() {
  const { user } = useAuth();

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-display">
      <header className="p-6 pt-12 pb-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full border-2 border-primary/20 p-1 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
              <img className="w-full h-full object-cover rounded-full" src="https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=200&auto=format&fit=crop" alt="Logo" />
            </div>
            <div>
              <h1 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sociedad Rural</h1>
              <h2 className="text-xl font-bold leading-tight uppercase">HOLA, {user?.nombre_apellido || 'SOCIO'}</h2>
              <p className="text-primary font-medium text-sm">ROL: {user?.rol || 'N/A'} • ESTADO: <span className={user?.estado === 'PENDIENTE' ? 'text-orange-500' : 'text-emerald-500'}>{user?.estado || 'DESCONOCIDO'}</span></p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>
      <main className="flex-1 px-6 pb-24">
        <SocioHomeContent />
      </main>
      <BottomNav />
    </div >
  );
}
