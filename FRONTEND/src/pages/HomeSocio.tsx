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
    <div className="relative min-h-screen flex flex-col font-display text-stone-900 max-w-md mx-auto shadow-2xl overflow-hidden">

      {/* ── ZONA SUPERIOR: PAISAJE ─────────────────────────── */}
      <div
        className="relative w-full shrink-0"
        style={{ height: '240px' }}
      >
        {/* Imagen */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${paisaje})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
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
        {/* Fade hacia el panel verde */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[56px]"
          style={{
            background:
              'linear-gradient(to bottom, rgba(75,100,55,0) 0%, rgba(75,100,55,1) 100%)',
          }}
        />

        {/* HEADER flotante sobre el paisaje */}
        <header className="absolute inset-x-0 top-0 px-5 pt-11 pb-3">
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
                <div
                  className="size-14 rounded-[1.2rem] border-[3px] border-white/60 overflow-hidden flex items-center justify-center font-black text-xl uppercase transition-transform active:scale-95 shadow-lg"
                  style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
                >
                  {user?.foto_url ? (
                    <img className="w-full h-full object-cover" src={user.foto_url} alt="Profile" />
                  ) : (
                    <span className="text-white">{user?.nombre_apellido?.charAt(0) || 'S'}</span>
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

      {/* ── ZONA INFERIOR: PANEL VERDE + TARJETAS ─────────── */}
      {/*
        Modo claro : verde hierba suave con textura en degradado
        Modo oscuro: verde profundo sobrio
      */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          /* Light mode */
          background: `
            radial-gradient(ellipse at 60% 0%, rgba(255,255,255,0.18) 0%, transparent 60%),
            linear-gradient(160deg, #5a7a3a 0%, #4b6430 40%, #3d5228 100%)
          `,
        }}
      >
        {/* Textura vegetal sutil (puntos/fibras como cesped) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Borde redondeado superior que se integra con el fade del paisaje */}
        <div
          className="sticky top-0 h-0 pointer-events-none"
          style={{ zIndex: 0 }}
        />

        <main className="relative z-10 px-5 pt-4 pb-28">
          {/* Título de sección */}
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[10px] font-black uppercase tracking-[0.35em] text-white/50 mb-3 pl-1"
          >
            Accesos rápidos
          </motion.p>
          <SocioHomeContent />
        </main>

        <BottomNav scrollContainerRef={scrollRef} />
      </div>
    </div>
  );
}
