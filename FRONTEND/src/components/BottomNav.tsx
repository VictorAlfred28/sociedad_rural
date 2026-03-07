import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();
  const isComercio = user?.rol === 'COMERCIO';
  const isAdmin = user?.rol === 'ADMIN';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-background-dark/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-6 pt-3 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto px-6">
        <Link to="/home" className={`flex flex-col items-center gap-1 ${path === '/home' ? 'text-primary' : 'text-slate-400'}`}>
          <span className="material-symbols-outlined" style={path === '/home' ? { fontVariationSettings: "'FILL' 1" } : {}}>home</span>
          <span className="text-[10px] font-bold">INICIO</span>
        </Link>


        {isComercio ? (
          <Link to="/mi-negocio" className={`flex flex-col items-center gap-1 ${path === '/mi-negocio' ? 'text-primary' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined" style={path === '/mi-negocio' ? { fontVariationSettings: "'FILL' 1" } : {}}>storefront</span>
            <span className="text-[10px] font-bold">MI NEGOCIO</span>
          </Link>
        ) : isAdmin ? (
          <Link to="/admin" className={`flex flex-col items-center gap-1 ${path === '/admin' ? 'text-primary' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined" style={path === '/admin' ? { fontVariationSettings: "'FILL' 1" } : {}}>admin_panel_settings</span>
            <span className="text-[10px] font-bold">ADMIN</span>
          </Link>
        ) : (
          <Link to="/carnet" className={`flex flex-col items-center gap-1 ${path === '/carnet' ? 'text-primary' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined" style={path === '/carnet' ? { fontVariationSettings: "'FILL' 1" } : {}}>badge</span>
            <span className="text-[10px] font-bold">CARNET</span>
          </Link>
        )}

        <Link to="/perfil" className={`flex flex-col items-center gap-1 ${path === '/perfil' ? 'text-primary' : 'text-slate-400'}`}>
          <span className="material-symbols-outlined" style={path === '/perfil' ? { fontVariationSettings: "'FILL' 1" } : {}}>person</span>
          <span className="text-[10px] font-bold">PERFIL</span>
        </Link>
      </div>
    </nav>
  );
}
