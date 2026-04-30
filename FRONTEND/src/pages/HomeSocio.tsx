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
    <div className="relative min-h-screen flex flex-col font-display max-w-md mx-auto shadow-2xl overflow-hidden">

      {/* ════════════════════════════════════════════════════════
          FONDO ÚNICO: paisaje cubre TODA la pantalla (fixed)
          La zona del header y la zona de tarjetas son el mismo
          fondo continuo — sólo los overlays difieren por zona.
      ════════════════════════════════════════════════════════ */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${paisaje})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* ── Overlay global: película oscura muy suave para tono unificado */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'rgba(10, 18, 8, 0.22)' }}
      />

      {/* ── Overlay zona inferior: velo blanco semitransparente desde el 40%
             Esto hace que las tarjetas se lean mejor sin cortar el paisaje */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, ' +
            'rgba(232,224,200,0.00) 0%, ' +
            'rgba(232,224,200,0.00) 35%, ' +
            'rgba(232,224,200,0.55) 55%, ' +
            'rgba(232,224,200,0.82) 100%)',
        }}
      />

      {/* ════════════════════════════════════════════════════════
          LAYOUT: scroll en el contenedor principal
      ════════════════════════════════════════════════════════ */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto flex flex-col"
      >

        {/* ── HEADER sobre el paisaje (zona superior) ─────── */}
        <header className="shrink-0 px-5 pt-11 pb-4 relative">

          {/* Widget clima */}
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
              {/* Avatar */}
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

              {/* Texto */}
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

        {/* ── Espacio visual: zona de paisaje protagonista visible ── */}
        {/* El usuario ve el campo / horizonte en esta franja libre   */}
        <div className="shrink-0 h-[105px]" />

        {/* ── SECCIÓN DE MÓDULOS: tarjetas sobre el paisaje ──────── */}
        <main className="flex-1 px-4 pt-3 pb-28">
          {/* Etiqueta de sección */}
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="text-[9.5px] font-black uppercase tracking-[0.38em] text-stone-600/70 mb-3 pl-1 drop-shadow-sm"
          >
            Accesos rápidos
          </motion.p>

          <SocioHomeContent />
        </main>
      </div>

      {/* BottomNav fuera del scroll para que no se desplace */}
      <BottomNav scrollContainerRef={scrollRef} />
    </div>
  );
}
