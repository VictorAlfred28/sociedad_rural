import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Commerce } from './pages/Commerce';
import { Audit } from './pages/Audit';
import { Login } from './pages/Login';
import { PublicRegister } from './pages/PublicRegister';
import { Portal } from './pages/Portal';
import { Bell, Menu, Shield } from 'lucide-react';
import { ApiService } from './services/api';
import { Chatbot } from './components/Chatbot';
import { ThemeToggle } from './components/ThemeToggle';
import { ChangePasswordModal } from './components/ChangePasswordModal';

// Layout del Administrador
const AdminLayout = ({ children, onLogout, role }: { children?: React.ReactNode, onLogout: () => void, role: string }) => {
  const [showPassModal, setShowPassModal] = useState(false);
  return (
    <div className="flex min-h-screen bg-[#F8F9FA] dark:bg-slate-900 pb-16 md:pb-0 transition-colors duration-300">
      <Sidebar onLogout={onLogout} />
      <div className="flex-1 md:ml-64 transition-all duration-300">

        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-4">
            {/* Mobile Logo */}
            <div className="md:hidden w-8 h-8 bg-rural-green rounded-full flex items-center justify-center text-rural-gold font-bold text-xs">SR</div>
            <h2 className="text-lg md:text-xl font-serif text-gray-800 dark:text-gray-100 truncate">Panel Administración</h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => setShowPassModal(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700 rounded-full transition-colors"
              title="Cambiar Contraseña"
            >
              <Shield className="w-5 h-5" />
            </button>
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Administrador</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sesión Segura</p>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-rural-green text-white flex items-center justify-center font-bold text-sm">
                A
              </div>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
      <MobileNav role={role} />
      <ChangePasswordModal isOpen={showPassModal} onClose={() => setShowPassModal(false)} />
    </div>
  );
};

// Layout del Socio (Portal)
const UserLayout = ({ children, onLogout, role }: { children?: React.ReactNode, onLogout: () => void, role: string }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 transition-colors duration-300">
      {children}
      <Chatbot />
      <MobileNav role={role} />
    </div>
  )
}

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>('comun');
  const [isLoading, setIsLoading] = useState(true);

  // Verificar sesión al cargar
  useEffect(() => {
    const checkSession = () => {
      const token = localStorage.getItem('auth_token');
      const role = localStorage.getItem('user_role') || 'comun';

      if (token) {
        setIsAuthenticated(true);
        setUserRole(role);
      }
      setIsLoading(false);
    };
    checkSession();
  }, []);

  const handleLoginSuccess = () => {
    const role = localStorage.getItem('user_role') || 'comun';
    setUserRole(role);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await ApiService.auth.logout();
    setIsAuthenticated(false);
    setUserRole('comun');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rural-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rural-green"></div>
      </div>
    );
  }

  // --- LÓGICA DE RUTAS ---

  if (!isAuthenticated) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/registro" element={<PublicRegister />} />
          <Route path="/login" element={<Login onLogin={handleLoginSuccess} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    );
  }

  const isAdmin = userRole === 'admin' || userRole === 'superadmin' || userRole === 'admin_camara';

  // Si es SOCIO
  if (!isAdmin) {
    return (
      <HashRouter>
        <UserLayout onLogout={handleLogout} role={userRole}>
          <div className="absolute top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Routes>
            <Route path="/portal" element={<Portal onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </UserLayout>
      </HashRouter>
    );
  }

  // Si es ADMIN
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AdminLayout onLogout={handleLogout} role={userRole}><Dashboard /></AdminLayout>} />
        <Route path="/socios" element={<AdminLayout onLogout={handleLogout} role={userRole}><Members /></AdminLayout>} />
        <Route path="/comercios" element={<AdminLayout onLogout={handleLogout} role={userRole}><Commerce /></AdminLayout>} />
        <Route path="/auditoria" element={<AdminLayout onLogout={handleLogout} role={userRole}><Audit /></AdminLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;