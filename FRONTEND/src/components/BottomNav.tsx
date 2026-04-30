import React, { useState, useEffect, useRef, RefObject, useCallback } from 'react';
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
  const isAdmin    = user?.rol === 'ADMIN';

  const [visible, setVisible] = useState(true);
  const lastScrollY   = useRef(0);
  const ticking       = useRef(false);
  const hideTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Lógica de show/hide ──────────────────────────────────────
  const show = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Reaparece si el usuario deja de scrollear por 1.5s
    hideTimer.current = setTimeout(() => setVisible(true), 1500);
  }, []);

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
        const delta   = current - lastScrollY.current;

        if (delta > 6 && current > 50) {
          // Scrolleando hacia abajo → ocultar
          setVisible(false);
          scheduleHide();
        } else if (delta < -4) {
          // Scrolleando hacia arriba → mostrar inmediatamente
          show();
        }

        lastScrollY.current = current;
        ticking.current     = false;
      });
    };

    // Reaparecer al tocar zona inferior
    const onTouch = (e: Event) => {
      const te = e as TouchEvent;
      const y = te.touches[0]?.clientY ?? 0;
      const threshold = window.innerHeight - 80;
      if (y > threshold) show();
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });

    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', onTouch);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [scrollContainerRef, show, scheduleHide]);

  // ── Tabs ────────────────────────────────────────────────────
  const centerTab = isComercio
    ? { to: '/mi-negocio', label: 'NEGOCIO',    icon: 'storefront'          }
    : isAdmin
    ? { to: '/admin',      label: 'ADMIN',       icon: 'admin_panel_settings'}
    : { to: '/carnet',     label: 'PASAPORTE',   icon: 'badge'               };

  const tabs = [
    { to: '/home',          label: 'INICIO',    icon: 'home'   },
    centerTab,
    { to: '/perfil',        label: 'PERFIL',    icon: 'person' },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="bottom-nav"
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{   y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.75 }}
          className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto px-3"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 10px)' }}
        >
          <nav
            className="rounded-[26px] overflow-hidden mb-2"
            style={{
              background: 'rgba(252, 246, 230, 0.80)',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              boxShadow:
                '0 -2px 0 rgba(255,255,255,0.6) inset, ' +
                '0 8px 32px rgba(0,0,0,0.20), ' +
                '0 2px 8px rgba(0,0,0,0.10)',
              border: '1px solid rgba(255,255,255,0.55)',
            }}
          >
            {/* Dark mode layer */}
            <div className="dark:bg-stone-900/88 rounded-[26px]">
              <div className="flex items-end justify-around px-4 pt-3 pb-3">
                {tabs.map((tab) => {
                  const active = path === tab.to;
                  return (
                    <Link
                      key={tab.to}
                      to={tab.to}
                      className="relative flex flex-col items-center gap-[3px] min-w-[60px] group"
                    >
                      {/* Burbuja activa detrás del ícono */}
                      {active && (
                        <motion.div
                          layoutId="nav-bubble"
                          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#3a6b35]/12 dark:bg-emerald-500/15"
                          transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                        />
                      )}

                      {/* Dot indicador superior */}
                      <AnimatePresence>
                        {active && (
                          <motion.div
                            key="dot"
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: 1, opacity: 1 }}
                            exit={{   scaleX: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full bg-[#3a6b35] dark:bg-emerald-400"
                          />
                        )}
                      </AnimatePresence>

                      {/* Ícono */}
                      <motion.span
                        animate={active ? { scale: 1.12 } : { scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`material-symbols-outlined text-[26px] transition-colors duration-200 ${
                          active
                            ? 'text-[#2d5a28] dark:text-emerald-400'
                            : 'text-stone-400 dark:text-stone-500 group-hover:text-[#3a6b35]'
                        }`}
                        style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
                      >
                        {tab.icon}
                      </motion.span>

                      {/* Label */}
                      <span
                        className={`text-[7.5px] font-black tracking-[0.16em] leading-none transition-colors duration-200 ${
                          active
                            ? 'text-[#2d5a28] dark:text-emerald-400'
                            : 'text-stone-400 dark:text-stone-500'
                        }`}
                      >
                        {tab.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
