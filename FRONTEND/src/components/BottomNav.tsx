import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();
  const isComercio = user?.rol === 'COMERCIO';
  const isAdmin = user?.rol === 'ADMIN';

  const [visible, setVisible] = useState(true);
  const lastScroll = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      // Show if scrolling up, hide if scrolling down
      if (current > lastScroll.current && current > 50) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      lastScroll.current = current;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed bottom-0 left-0 right-0 bg-[#f4eedd]/95 dark:bg-stone-900/95 backdrop-blur-lg border-t border-stone-200/50 dark:border-stone-800/50 pb-6 pt-3 z-50 transition-transform duration-300 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="flex justify-between items-center max-w-md mx-auto px-10">
        <Link to="/home" className="flex flex-col items-center gap-1 group">
          <span className={`material-symbols-outlined transition-colors ${path === '/home' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-400 group-hover:text-[#245b31]'}`} style={path === '/home' ? { fontVariationSettings: "'FILL' 1" } : {}}>home</span>
          <span className={`text-[9px] font-black transition-colors tracking-[0.2em] ${path === '/home' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-500 group-hover:text-[#245b31]'}`}>INICIO</span>
        </Link>

        {isComercio ? (
          <Link to="/mi-negocio" className="flex flex-col items-center gap-1 group">
            <span className={`material-symbols-outlined transition-colors ${path === '/mi-negocio' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-400 group-hover:text-[#245b31]'}`} style={path === '/mi-negocio' ? { fontVariationSettings: "'FILL' 1" } : {}}>storefront</span>
            <span className={`text-[9px] font-black transition-colors tracking-[0.2em] ${path === '/mi-negocio' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-500 group-hover:text-[#245b31]'}`}>NEGOCIO</span>
          </Link>
        ) : isAdmin ? (
          <Link to="/admin" className="flex flex-col items-center gap-1 group">
            <span className={`material-symbols-outlined transition-colors ${path === '/admin' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-400 group-hover:text-[#245b31]'}`} style={path === '/admin' ? { fontVariationSettings: "'FILL' 1" } : {}}>admin_panel_settings</span>
            <span className={`text-[9px] font-black transition-colors tracking-[0.2em] ${path === '/admin' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-500 group-hover:text-[#245b31]'}`}>ADMIN</span>
          </Link>
        ) : (
          <Link to="/carnet" className="flex flex-col items-center gap-1 group">
            <motion.div 
              animate={path === '/carnet' ? { scale: [1, 1.2, 1] } : {}}
              className="flex flex-col items-center gap-1"
            >
              <span className={`material-symbols-outlined transition-colors ${path === '/carnet' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-400 group-hover:text-[#245b31]'}`} style={path === '/carnet' ? { fontVariationSettings: "'FILL' 1" } : {}}>badge</span>
              <span className={`text-[9px] font-black transition-colors tracking-[0.2em] ${path === '/carnet' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-500 group-hover:text-[#245b31]'}`}>ÑANDE PASAPORTE</span>
            </motion.div>
          </Link>
        )}

        <Link to="/perfil" className="flex flex-col items-center gap-1 group">
          <span className={`material-symbols-outlined transition-colors ${path === '/perfil' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-400 group-hover:text-[#245b31]'}`} style={path === '/perfil' ? { fontVariationSettings: "'FILL' 1" } : {}}>person</span>
          <span className={`text-[9px] font-black transition-colors tracking-[0.2em] ${path === '/perfil' ? 'text-[#245b31] dark:text-emerald-500' : 'text-stone-500 group-hover:text-[#245b31]'}`}>PERFIL</span>
        </Link>
      </div>
    </nav>
  );
}
