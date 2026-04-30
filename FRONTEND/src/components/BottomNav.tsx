import React, { useState, useEffect, useRef, RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomNavProps {
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

export default function BottomNav({ scrollContainerRef }: BottomNavProps) {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();
  const isComercio = user?.rol === 'COMERCIO';
  const isAdmin = user?.rol === 'ADMIN';

  const [visible, setVisible] = useState(true);
  const lastScroll = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Escuchar el contenedor propio si se pasó ref, sino window
    const target = scrollContainerRef?.current ?? window;

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const current =
          scrollContainerRef?.current
            ? scrollContainerRef.current.scrollTop
            : window.scrollY;

        if (current > lastScroll.current && current > 40) {
          // Scroll hacia abajo → ocultar
          setVisible(false);
        } else {
          // Scroll hacia arriba o en el top → mostrar
          setVisible(true);
        }
        lastScroll.current = current;
        ticking.current = false;
      });
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          key="bottom-nav"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
          className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
        >
          <div
            className="mx-3 mb-3 rounded-[22px] shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
            style={{
              background: 'rgba(244, 238, 221, 0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}
          >
            {/* Dark mode overlay */}
            <div className="dark:bg-stone-900/90 dark:border-stone-800/60 rounded-[22px]">
              <div className="flex justify-between items-center px-6 pt-3 pb-4">

                {/* Inicio */}
                <NavItem to="/home" label="INICIO" icon="home" active={path === '/home'} />

                {/* Tab central condicionado al rol */}
                {isComercio ? (
                  <NavItem to="/mi-negocio" label="NEGOCIO" icon="storefront" active={path === '/mi-negocio'} />
                ) : isAdmin ? (
                  <NavItem to="/admin" label="ADMIN" icon="admin_panel_settings" active={path === '/admin'} />
                ) : (
                  <NavItem to="/carnet" label="PASAPORTE" icon="badge" active={path === '/carnet'} pulse={path === '/carnet'} />
                )}

                {/* Perfil */}
                <NavItem to="/perfil" label="PERFIL" icon="person" active={path === '/perfil'} />

              </div>
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

// ── Sub-componente tab ──────────────────────────────────────
interface NavItemProps {
  to: string;
  label: string;
  icon: string;
  active: boolean;
  pulse?: boolean;
}

function NavItem({ to, label, icon, active, pulse = false }: NavItemProps) {
  return (
    <Link to={to} className="flex flex-col items-center gap-0.5 group relative">
      {/* Indicador activo */}
      {active && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-[#3a6b35]"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}

      <span
        className={`material-symbols-outlined text-[26px] transition-all duration-200 ${
          active
            ? 'text-[#245b31] dark:text-emerald-400 scale-110'
            : 'text-stone-400 group-hover:text-[#3a6b35]'
        }`}
        style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
      >
        {icon}
      </span>

      <span
        className={`text-[8px] font-black transition-colors tracking-[0.18em] leading-none ${
          active
            ? 'text-[#245b31] dark:text-emerald-400'
            : 'text-stone-400 group-hover:text-[#3a6b35]'
        }`}
      >
        {label}
      </span>

      {pulse && (
        <span className="absolute top-0 right-0 size-2 rounded-full bg-emerald-400 animate-ping opacity-70" />
      )}
    </Link>
  );
}
