import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Store, ShieldCheck, CreditCard, QrCode, Home } from 'lucide-react';

interface MobileNavProps {
  role: string;
}

export const MobileNav = ({ role }: MobileNavProps) => {
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'admin_camara';

  const adminLinks = [
    { to: "/", icon: LayoutDashboard, label: "Inicio" },
    { to: "/socios", icon: Users, label: "Socios" },
    { to: "/comercios", icon: Store, label: "Comercios" },
  ];

  const userLinks = [
    { to: "/portal", icon: Home, label: "Inicio" },
    { to: "/carnet", icon: QrCode, label: "Carnet" }, // Virtual route for modal logic
    { to: "/pagos", icon: CreditCard, label: "Pagos" }, // Virtual route
  ];

  const links = isAdmin ? adminLinks : userLinks;

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16">
        {links.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive 
                  ? "text-rural-green font-bold" 
                  : "text-gray-400 hover:text-gray-600"
              }`
            }
          >
            <item.icon className={`w-6 h-6 ${role === 'admin' ? '' : ''}`} />
            <span className="text-[10px] uppercase tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};
