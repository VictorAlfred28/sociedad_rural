import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Store, ShieldCheck, LogOut, Wifi, Server } from 'lucide-react';
import { ApiService } from '../services/api';

export const Sidebar = ({ onLogout }: { onLogout: () => void }) => {
  const [systemStatus, setSystemStatus] = useState<{ mode: string, online: boolean }>({ mode: '...', online: false });

  useEffect(() => {
    const check = async () => {
      const status = await ApiService.system.checkStatus();
      setSystemStatus(status);
    };
    check();
  }, []);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Tablero" },
    { to: "/socios", icon: Users, label: "Socios" },
    { to: "/comercios", icon: Store, label: "Comercios" },
    { to: "/auditoria", icon: ShieldCheck, label: "Auditoría" },
  ];

  return (
    <>
      {/* Desktop Sidebar - Hidden on Mobile */}
      <aside className="hidden md:flex w-64 bg-rural-green text-white flex-col h-screen fixed left-0 top-0 shadow-xl z-20">
        <div className="p-6 border-b border-white/10 flex items-center justify-center flex-col">
          <div className="w-16 h-16 bg-rural-gold rounded-full flex items-center justify-center mb-3 text-rural-green font-bold text-2xl border-4 border-white/20">
            SR
          </div>
          <h1 className="text-lg font-serif font-bold text-center tracking-wide text-rural-gold">
            Sociedad Rural
          </h1>
          <p className="text-xs text-gray-300 uppercase tracking-widest mt-1">Norte de Corrientes</p>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? "bg-rural-gold text-rural-green font-semibold shadow-md"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-4">
          <div className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 ${
            systemStatus.mode.includes('Python') 
              ? 'bg-green-900/50 border-green-500/30 text-green-200' 
              : 'bg-yellow-900/30 border-yellow-500/30 text-yellow-200'
          }`}>
            {systemStatus.mode.includes('Python') ? (
              <Server className="w-3 h-3 text-green-400" />
            ) : (
              <Wifi className="w-3 h-3 text-yellow-400" />
            )}
            <div>
               <p className="opacity-70 text-[10px] uppercase">Sistema</p>
               <p className="truncate w-32">{systemStatus.mode}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-300 hover:text-red-100 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
};
