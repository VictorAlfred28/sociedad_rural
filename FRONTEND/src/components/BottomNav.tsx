import React, {
  useState, useEffect, useRef, RefObject, useCallback
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

interface BottomNavProps {
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

// ── Umbral mínimo de px antes de reaccionar ──────────────────────
const SCROLL_HIDE_THRESHOLD  = 18;   // scroll down mínimo para esconder
const SCROLL_SHOW_THRESHOLD  = 10;   // scroll up mínimo para mostrar
const SCROLL_TOP_ALWAYS_SHOW = 30;   // si scrollTop < esto → siempre visible
const RESHOW_AFTER_STOP_MS   = 1200; // ms tras detener scroll → reaparece

export default function BottomNav({ scrollContainerRef }: BottomNavProps) {
  const location = useLocation();
  const path     = location.pathname;
  const { user } = useAuth();
  const isComercio = user?.rol === 'COMERCIO';
  const isAdmin    = user?.rol === 'ADMIN';

  // ── Estado: controlamos con CSS transform directo ────────────
  const navRef        = useRef<HTMLDivElement>(null);
  const lastScrollY   = useRef(0);
  const accDelta      = useRef(0);     // delta acumulado para anti-parpadeo
  const ticking       = useRef(false);
  const stopTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardOpen  = useRef(false);
  const isVisible     = useRef(true);

  const applyVisibility = useCallback((show: boolean, instant = false) => {
    if (!navRef.current) return;
    isVisible.current = show;
    const el = navRef.current;
    el.style.transition = instant
      ? 'none'
      : 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
    el.style.transform = show ? 'translateY(0)' : 'translateY(110%)';
    el.style.opacity   = show ? '1' : '0';
    el.style.pointerEvents = show ? 'auto' : 'none';
  }, []);

  const showNav = useCallback((instant = false) => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    applyVisibility(true, instant);
  }, [applyVisibility]);

  const hideNav = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    applyVisibility(false);
    // Reaparece automáticamente al detenerse
    stopTimer.current = setTimeout(() => {
      if (!keyboardOpen.current) applyVisibility(true);
    }, RESHOW_AFTER_STOP_MS);
  }, [applyVisibility]);

  // ── Mostrar siempre al cambiar de página ────────────────────
  useEffect(() => {
    showNav(true);
    accDelta.current = 0;
    lastScrollY.current = 0;
  }, [path, showNav]);

  // ── Listener de scroll ───────────────────────────────────────
  useEffect(() => {
    const getScrollY = () =>
      scrollContainerRef?.current
        ? scrollContainerRef.current.scrollTop
        : window.scrollY;

    const target = (scrollContainerRef?.current ?? window) as EventTarget;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const current = getScrollY();
        const raw     = current - lastScrollY.current;
        lastScrollY.current = current;
        ticking.current     = false;

        // Siempre visible en el top
        if (current < SCROLL_TOP_ALWAYS_SHOW) {
          showNav();
          accDelta.current = 0;
          return;
        }

        accDelta.current += raw;

        if (accDelta.current > SCROLL_HIDE_THRESHOLD) {
          // Suficiente scroll hacia abajo → ocultar
          accDelta.current = 0;
          if (isVisible.current) hideNav();
        } else if (accDelta.current < -SCROLL_SHOW_THRESHOLD) {
          // Suficiente scroll hacia arriba → mostrar
          accDelta.current = 0;
          if (!isVisible.current) showNav();
        }
      });
    };

    target.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      target.removeEventListener('scroll', onScroll);
      if (stopTimer.current) clearTimeout(stopTimer.current);
    };
  }, [scrollContainerRef, showNav, hideNav]);

  // ── Touch en zona inferior → mostrar ────────────────────────
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (keyboardOpen.current) return;
      const y = e.touches[0]?.clientY ?? 0;
      if (y > window.innerHeight - 90) showNav();
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => window.removeEventListener('touchstart', onTouchStart);
  }, [showNav]);

  // ── Teclado: ocultar nav si teclado abierto ─────────────────
  useEffect(() => {
    const INITIAL_H = window.innerHeight;
    const onResize = () => {
      const diff = INITIAL_H - window.innerHeight;
      if (diff > 150) {
        // Teclado abierto
        keyboardOpen.current = true;
        applyVisibility(false, true);
      } else {
        // Teclado cerrado
        keyboardOpen.current = false;
        applyVisibility(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyVisibility]);

  // ── Tabs ─────────────────────────────────────────────────────
  const centerTab = isComercio
    ? { to: '/mi-negocio', label: 'NEGOCIO',  icon: 'storefront'           }
    : isAdmin
    ? { to: '/admin',      label: 'ADMIN',     icon: 'admin_panel_settings' }
    : { to: '/eventos',    label: 'NOVEDADES', icon: 'event_note'           };

  const tabs = [
    { to: '/home',   label: 'INICIO',  icon: 'home'   },
    centerTab,
    { to: '/perfil', label: 'PERFIL',  icon: 'person' },
  ];

  // ── Render ───────────────────────────────────────────────────
  return (
    <div
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto px-3"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        // Estado inicial: visible, sin transición
        transform: 'translateY(0)',
        opacity: '1',
        willChange: 'transform, opacity',
      }}
    >
      <nav
        className="rounded-[26px] overflow-hidden mb-1.5"
        style={{
          background: 'rgba(250, 244, 228, 0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), ' +
            '0 -1px 0 rgba(255,255,255,0.35) inset, ' +
            '0 10px 40px rgba(0,0,0,0.22), ' +
            '0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid rgba(255,255,255,0.50)',
        }}
      >
        <div className="dark:bg-stone-900/90 rounded-[26px]">
          <div className="flex items-center justify-around px-5 pt-3 pb-3">
            {tabs.map((tab) => {
              const active = path === tab.to;
              return (
                <NavItem
                  key={tab.to}
                  to={tab.to}
                  label={tab.label}
                  icon={tab.icon}
                  active={active}
                />
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

// ── Sub-componente tab ────────────────────────────────────────────
interface NavItemProps {
  to: string; label: string; icon: string; active: boolean;
}

function NavItem({ to, label, icon, active }: NavItemProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      to={to}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setTimeout(() => setPressed(false), 180)}
      className="relative flex flex-col items-center gap-[3px] min-w-[64px] select-none"
    >
      {/* Dot activo */}
      <div
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-[#2d5a28] dark:bg-emerald-400 transition-all duration-200"
        style={{ width: active ? '18px' : '0px', opacity: active ? 1 : 0 }}
      />

      {/* Burbuja de fondo activa */}
      {active && (
        <motion.div
          layoutId="nav-bubble"
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full"
          style={{ background: 'rgba(61,107,53,0.10)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}

      {/* Ícono con feedback táctil */}
      <span
        className={`material-symbols-outlined transition-all duration-150 ${
          active
            ? 'text-[#2d5a28] dark:text-emerald-400 text-[27px]'
            : 'text-stone-400 dark:text-stone-500 text-[25px]'
        }`}
        style={{
          fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
          transform: pressed ? 'scale(0.88)' : active ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 0.15s ease, color 0.15s ease',
        }}
      >
        {icon}
      </span>

      {/* Label */}
      <span
        className={`text-[7px] font-black tracking-[0.18em] leading-none transition-colors duration-150 ${
          active
            ? 'text-[#2d5a28] dark:text-emerald-400'
            : 'text-stone-400 dark:text-stone-500'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
