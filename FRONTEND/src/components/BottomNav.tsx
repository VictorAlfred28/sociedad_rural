import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <nav className={`fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-background-dark/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-6 pt-3 z-50 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="flex justify-between items-center max-w-md mx-auto px-10">
        <Link to="/home" className="flex flex-col items-center gap-1 group">
          <span className={`material-symbols-outlined transition-colors ${path === '/home' ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} style={path === '/home' ? { fontVariationSettings: "'FILL' 1" } : {}}>home</span>
          <span className={`text-[11px] font-bold transition-colors ${path === '/home' ? 'text-primary' : 'text-slate-500 group-hover:text-primary'}`}>INICIO</span>
        </Link>

        {isComercio ? (
          <Link to="/mi-negocio" className="flex flex-col items-center gap-1 group">
            <span className={`material-symbols-outlined transition-colors ${path === '/mi-negocio' ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} style={path === '/mi-negocio' ? { fontVariationSettings: "'FILL' 1" } : {}}>storefront</span>
            <span className={`text-[11px] font-bold transition-colors ${path === '/mi-negocio' ? 'text-primary' : 'text-slate-500 group-hover:text-primary'}`}>MI NEGOCIO</span>
          </Link>
        ) : isAdmin ? (
          <Link to="/admin" className="flex flex-col items-center gap-1 group">
            <span className={`material-symbols-outlined transition-colors ${path === '/admin' ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} style={path === '/admin' ? { fontVariationSettings: "'FILL' 1" } : {}}>admin_panel_settings</span>
            <span className={`text-[11px] font-bold transition-colors ${path === '/admin' ? 'text-primary' : 'text-slate-500 group-hover:text-primary'}`}>ADMIN</span>
          </Link>
        ) : (
          <Link to="/carnet" className="flex flex-col items-center gap-1 group">
            <span className={`material-symbols-outlined transition-colors ${path === '/carnet' ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} style={path === '/carnet' ? { fontVariationSettings: "'FILL' 1" } : {}}>badge</span>
            <span className={`text-[11px] font-bold transition-colors ${path === '/carnet' ? 'text-primary' : 'text-slate-500 group-hover:text-primary'}`}>CARNET</span>
          </Link>
        )}

        <Link to="/perfil" className="flex flex-col items-center gap-1 group">
          <span className={`material-symbols-outlined transition-colors ${path === '/perfil' ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`} style={path === '/perfil' ? { fontVariationSettings: "'FILL' 1" } : {}}>person</span>
          <span className={`text-[11px] font-bold transition-colors ${path === '/perfil' ? 'text-primary' : 'text-slate-500 group-hover:text-primary'}`}>PERFIL</span>
        </Link>
      </div>
    </nav>
  );
}
