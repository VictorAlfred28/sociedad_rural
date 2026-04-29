import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import SocioHomeContent from '../components/SocioHomeContent';
import { motion } from 'framer-motion';
import paisaje from '../assets/paisaje.png';

export default function HomeSocio() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen flex flex-col font-display text-stone-900 max-w-md mx-auto shadow-2xl overflow-x-hidden bg-[#F2ECD8]">

      {/* ── ZONA SUPERIOR: PAISAJE ─────────────────────────────── */}
      {/* Franja fija donde vive el paisaje. El header flota encima. */}
      <div
        className="relative w-full shrink-0"
        style={{ height: '240px' }}
      >
        {/* Imagen de fondo */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${paisaje})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Overlay: oscurece arriba para contraste del texto, se disuelve hacia abajo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.0) 100%)',
          }}
        />

        {/* Transición suave hacia la zona de tarjetas */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[48px]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(242,236,216,0) 0%, rgba(242,236,216,1) 100%)',
          }}
        />

        {/* ── HEADER flotando sobre el paisaje ── */}
        <header className="absolute inset-x-0 top-0 px-5 pt-11 pb-3">
          {/* Widget clima */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] z-20"
            style={{
              background: 'rgba(0,0,0,0.28)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <span className="text-[13px]">🌤️</span>
            <span className="text-[12px] font-semibold text-white leading-none">24°C | Ctes</span>
          </motion.div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/perfil" className="relative group shrink-0">
                <div className="size-14 rounded-[1.2rem] border-[3px] border-white/60 overflow-hidden flex items-center justify-center font-black text-xl text-white/40 uppercase transition-transform active:scale-95 shadow-lg"
                  style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
                >
                  {user?.foto_url ? (
                    <img className="w-full h-full object-cover" src={user.foto_url} alt="Profile" />
                  ) : (
                    <span className="font-display text-white">{user?.nombre_apellido?.charAt(0) || 'S'}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 size-4 bg-[#4caf50] border-2 border-white rounded-full" />
              </Link>

              <div>
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60 leading-none"
                >
                  Sociedad Rural
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 }}
                  className="text-[22px] font-black text-white drop-shadow-md uppercase italic tracking-tight leading-tight"
                >
                  Hola, {user?.nombre_apellido?.split(' ')[0] || 'Socio'}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.16 }}
                  className="text-[9px] font-bold text-[#f0d7b0] uppercase tracking-widest leading-none mt-0.5"
                >
                  {user?.rol || 'N/A'} •{' '}
                  <span className={user?.estado === 'PENDIENTE' ? 'text-amber-400' : 'text-[#7dd98a]'}>
                    {user?.estado || 'DESCONOCIDO'}
                  </span>
                </motion.p>
              </div>
            </div>
            <NotificationBell />
          </div>
        </header>
      </div>

      {/* ── ZONA INFERIOR: TARJETAS ────────────────────────────── */}
      {/* Comienza donde termina la franja del paisaje */}
      <div className="flex-1 flex flex-col" style={{ background: '#F2ECD8' }}>
        <main className="flex-1 px-5 pt-3 pb-24">
          <SocioHomeContent />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
