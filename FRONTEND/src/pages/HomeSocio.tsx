import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import SocioHomeContent from '../components/SocioHomeContent';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import paisaje from '../assets/paisaje.png';

export default function HomeSocio() {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative min-h-screen flex flex-col font-display max-w-md mx-auto shadow-2xl overflow-hidden bg-[#3d5228]">

      {/* ══════════════════════════════════════════════════════
          ZONA SUPERIOR: HERO — intacto, igual que antes
          240px fijos, imagen encuadrada arriba, header flotante
      ══════════════════════════════════════════════════════ */}
      <div className="relative shrink-0" style={{ height: '240px' }}>

        {/* Imagen del hero */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${paisaje})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Overlay oscuro arriba para legibilidad del header */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 60%, rgba(0,0,0,0.0) 100%)',
          }}
        />

        {/* Fade inferior hacia el panel de tarjetas */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[52px]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(61,82,40,0) 0%, rgba(61,82,40,0.90) 100%)',
          }}
        />

        {/* HEADER flotante sobre el hero */}
        <header className="absolute inset-x-0 top-0 px-5 pt-11 pb-3">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] z-20"
            style={{
              background: 'rgba(0,0,0,0.30)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <span className="text-[13px]">🌤️</span>
            <span className="text-[12px] font-semibold text-white leading-none">24°C | Ctes</span>
          </motion.div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/perfil" className="relative shrink-0">
                <div
                  className="size-14 rounded-[1.2rem] border-[3px] border-white/55 overflow-hidden flex items-center justify-center text-xl uppercase transition-transform active:scale-95 shadow-xl"
                  style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(6px)' }}
                >
                  {user?.foto_url
                    ? <img className="w-full h-full object-cover" src={user.foto_url} alt="Perfil" />
                    : <span className="font-black text-white">{user?.nombre_apellido?.charAt(0) || 'S'}</span>
                  }
                </div>
                <div className="absolute -bottom-1 -right-1 size-[14px] bg-emerald-400 border-2 border-white rounded-full" />
              </Link>

              <div>
                <motion.p
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className="text-[9px] font-black uppercase tracking-[0.32em] text-white/55 leading-none mb-0.5"
                >
                  Sociedad Rural
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.07 }}
                  className="text-[23px] font-black text-white drop-shadow-lg uppercase italic tracking-tight leading-none"
                >
                  Hola, {user?.nombre_apellido?.split(' ')[0] || 'Socio'}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 }}
                  className="text-[9px] font-bold text-amber-200/90 uppercase tracking-widest leading-none mt-1"
                >
                  {user?.rol || 'N/A'} •{' '}
                  <span className={user?.estado === 'PENDIENTE' ? 'text-amber-400' : 'text-emerald-300'}>
                    {user?.estado || 'DESCONOCIDO'}
                  </span>
                </motion.p>
              </div>
            </div>
            <NotificationBell />
          </div>
        </header>
      </div>

      {/* ══════════════════════════════════════════════════════
          ZONA INFERIOR: PANEL CON PAISAJE EXTENDIDO
          Usa la misma imagen pero posicionada en la parte baja
          del campo (como si fuera la continuación del encuadre),
          con un overlay semitransparente para legibilidad.
      ══════════════════════════════════════════════════════ */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto"
      >
        {/* Imagen extendida: misma foto, encuadre desplazado hacia la zona inferior del campo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${paisaje})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 72%',   // muestra la parte baja del campo
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'local',
          }}
        />

        {/* Overlay modo claro: velo beige luminoso — deja ver el campo difuso detrás */}
        <div
          className="absolute inset-0 pointer-events-none dark:hidden"
          style={{
            background:
              'linear-gradient(to bottom, ' +
              'rgba(235,224,190,0.70) 0%, ' +
              'rgba(235,224,190,0.78) 50%, ' +
              'rgba(235,224,190,0.84) 100%)',
          }}
        />

        {/* Overlay modo oscuro: velo verde profundo */}
        <div
          className="absolute inset-0 pointer-events-none hidden dark:block"
          style={{
            background:
              'linear-gradient(to bottom, ' +
              'rgba(25,42,18,0.72) 0%, ' +
              'rgba(25,42,18,0.82) 100%)',
          }}
        />

        {/* Contenido de tarjetas sobre el paisaje */}
        <div className="relative z-10 px-4 pt-4 pb-28">
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="text-[9.5px] font-black uppercase tracking-[0.38em] text-stone-600/65 dark:text-stone-300/50 mb-3 pl-1"
          >
            Accesos rápidos
          </motion.p>
          <SocioHomeContent />
        </div>
      </div>

      <BottomNav scrollContainerRef={scrollRef} />
    </div>
  );
}
