import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import SocioHomeContent from '../components/SocioHomeContent';
import { motion } from 'framer-motion';

export default function HomeSocio() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen flex flex-col font-display text-stone-900 dark:text-stone-100 max-w-md mx-auto shadow-2xl overflow-x-hidden">
      {/* Fondo Paisaje */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url('/src/assets/vaquita.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat"
        }}
      >
        {/* Overlay para legibilidad */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.4) 40%, rgba(255,255,255,0.85) 100%)"
        }}></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <header className="p-6 pt-12 pb-4 relative">
          {/* Widget Clima Compacto */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 right-4 flex items-center gap-1.5 h-[40px] px-[12px] py-[6px] rounded-[20px] transition-all hover:scale-105 cursor-default z-20"
            style={{
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                border: '1px solid rgba(0,0,0,0.05)'
            }}
          >
            <span className="text-[14px]">🌤️</span>
            <span className="text-[13px] font-medium text-[#2F3E2F] leading-none">24°C | Ctes</span>
          </motion.div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link to="/perfil" className="relative group">
                <div className="size-16 rounded-[1.5rem] border-4 border-white dark:border-stone-800 p-0.5 bg-stone-100 dark:bg-stone-700 shadow-xl overflow-hidden flex items-center justify-center font-black text-2xl text-stone-300 dark:text-stone-500 uppercase transition-transform active:scale-95">
                  {user?.foto_url ? (
                    <img className="w-full h-full object-cover rounded-[1.2rem]" src={user.foto_url} alt="Profile" />
                  ) : (
                    <span className="font-display">{user?.nombre_apellido?.charAt(0) || 'S'}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 size-5 bg-[#245b31] border-2 border-[#f4eedd] rounded-full"></div>
              </Link>
              <div>
                <motion.h1 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400"
                >
                  Sociedad Rural
                </motion.h1>
                <motion.h2 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl font-black text-stone-800 dark:text-white uppercase italic tracking-tighter leading-none font-display"
                >
                  HOLA, {user?.nombre_apellido?.split(' ')[0] || 'SOCIO'}
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] font-black text-[#a87f5d] uppercase tracking-widest mt-1"
                >
                  {user?.rol || 'N/A'} • <span className={user?.estado === 'PENDIENTE' ? 'text-amber-600' : 'text-[#245b31]'}>{user?.estado || 'DESCONOCIDO'}</span>
                </motion.p>
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
