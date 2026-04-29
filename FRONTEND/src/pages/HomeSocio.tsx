import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import SocioHomeContent from '../components/SocioHomeContent';

export default function HomeSocio() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100">
      {/* Fondo con imagen sutil de ganadería/campo */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: "url('/src/assets/vaquita.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      ></div>

      <div className="relative z-10 flex-1 flex flex-col">
        <header className="p-6 pt-12 pb-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full border-2 border-emerald-600/30 p-1 bg-white/80 dark:bg-stone-800/80 backdrop-blur-sm shadow-sm overflow-hidden flex items-center justify-center font-bold text-xl text-emerald-700 dark:text-emerald-500 uppercase">
                {user?.foto_url ? (
                  <img className="w-full h-full object-cover rounded-full" src={user.foto_url} alt="Profile" />
                ) : (
                  user?.nombre_apellido?.charAt(0) || 'S'
                )}
              </div>
              <div>
                <h1 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Sociedad Rural</h1>
                <h2 className="text-xl font-bold leading-tight uppercase text-stone-800 dark:text-stone-100">HOLA, {user?.nombre_apellido || 'SOCIO'}</h2>
                <p className="text-emerald-700 dark:text-emerald-500 font-medium text-sm">ROL: {user?.rol || 'N/A'} • ESTADO: <span className={user?.estado === 'PENDIENTE' ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}>{user?.estado || 'DESCONOCIDO'}</span></p>
              </div>
            </div>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 px-6 pb-24">
          <SocioHomeContent />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
