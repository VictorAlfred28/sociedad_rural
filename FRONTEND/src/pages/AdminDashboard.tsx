import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MetricasOverview from '../components/admin/MetricasOverview';
import GestionUsuarios from '../components/admin/GestionUsuarios';
import NuevoComercio from './NuevoComercio';
import PanelAuditoria from '../components/admin/PanelAuditoria';
import GestionEventos from '../components/admin/GestionEventos';
import NotificationBell from '../components/NotificationBell';
import ValidacionPagos from '../components/admin/ValidacionPagos';

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();

  // Tabs: 'panel' | 'usuarios' | 'nuevo-comercio' | 'pagos' | 'auditoria' | 'eventos'
  const [activeTab, setActiveTab] = useState<'panel' | 'usuarios' | 'nuevo-comercio' | 'pagos' | 'auditoria' | 'eventos'>('panel');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'classic' | 'cyber'>(() => {
    return (localStorage.getItem('adminTheme') as 'classic' | 'cyber') || 'cyber';
  });

  useEffect(() => {
    localStorage.setItem('adminTheme', themeMode);
  }, [themeMode]);

  // Cierra sidebar al cambiar de tab en mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  const navItems = [
    { id: 'panel', icon: 'dashboard', label: 'Dashboard' },
    { id: 'usuarios', icon: 'group', label: 'Gestión Socios' },
    { id: 'nuevo-comercio', icon: 'add_business', label: 'Gestión Comercios' },
    { id: 'eventos', icon: 'event_available', label: 'Gestión Eventos' },
    { id: 'pagos', icon: 'payments', label: 'Módulo de Pagos' },
    { id: 'auditoria', icon: 'policy', label: 'Auditoría Institucional' },
  ] as const;

  return (
    <div className={`flex h-screen w-full bg-admin-bg text-admin-text font-display overflow-hidden selection:bg-admin-accent/30 selection:text-white theme-${themeMode}`}>

      {/* OVERLAY MOBILE */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-admin-card border-r border-admin-border transform admin-transition flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Branch / Logo Header */}
        <div className="h-20 flex items-center px-6 border-b border-admin-border shrink-0">
          <div className="flex items-center gap-3 text-admin-text">
            <div className="flex items-center justify-center size-10 rounded-xl bg-admin-accent/10 border border-admin-accent/20">
              <span className="material-symbols-outlined text-admin-accent">security</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-sm tracking-widest uppercase text-admin-text leading-tight">Mando Central</h1>
              <p className="text-[10px] text-admin-accent translate-y-[-2px] tracking-widest font-mono">SOCIEDAD RURAL</p>
            </div>
          </div>

          <button
            className="ml-auto md:hidden text-slate-400 hover:text-admin-text"
            onClick={() => setIsSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigator */}
        <nav className="flex-1 overflow-y-auto admin-scroll py-6 px-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all w-full text-left relative group ${activeTab === item.id
                ? 'bg-admin-accent/10 text-admin-text'
                : 'text-slate-400 hover:bg-admin-card-hover hover:text-admin-text'
                }`}
            >
              {activeTab === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-admin-accent rounded-r-full" />
              )}
              <span className={`material-symbols-outlined text-[20px] ${activeTab === item.id ? 'text-admin-accent' : 'group-hover:text-admin-accent/70'}`}>
                {item.icon}
              </span>
              <span className={`font-semibold text-sm tracking-wide ${activeTab === item.id ? 'text-admin-text' : ''}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Footer Sidebar (Removed to move logic to top right profile dropdown) */}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-admin-bg relative">

        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-admin-accent/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3" />

        {/* Top Navbar */}
        <header className="h-20 flex items-center justify-between px-6 bg-admin-bg/80 backdrop-blur-md border-b border-admin-border shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden flex items-center justify-center size-10 rounded-lg hover:bg-admin-card admin-transition text-slate-400"
              onClick={() => setIsSidebarOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="text-xl font-bold text-admin-text tracking-tight hidden sm:block">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-4">

            <button
              onClick={async () => {
                try {
                  await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificaciones/test`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  alert('Notificación de prueba enviada a tu dispositivo.');
                } catch (e) { console.error(e) }
              }}
              className="flex items-center justify-center h-10 px-3 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-xs"
              title="Probar Notificaciones Push"
            >
              TEST PUSH
            </button>
            <NotificationBell />

            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-admin-text">{user?.nombre_apellido || 'Administrador'}</span>
              <span className="text-[10px] uppercase tracking-widest text-[#10b981] font-mono flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                Online
              </span>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center justify-center size-10 rounded-full bg-admin-card border border-admin-border text-admin-accent font-bold hover:bg-admin-accent/10 transition-colors"
              >
                {user?.nombre_apellido?.charAt(0) || 'A'}
              </button>

              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-admin-card border border-admin-border shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                    <div className="p-2 flex flex-col gap-1">

                      {/* THEME TOGGLE */}
                      <button
                        onClick={() => {
                          setThemeMode(prev => prev === 'cyber' ? 'classic' : 'cyber');
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:text-admin-accent hover:bg-admin-accent/10 rounded-lg admin-transition text-left"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {themeMode === 'cyber' ? 'light_mode' : 'terminal'}
                        </span>
                        <span className="font-semibold text-sm">
                          {themeMode === 'cyber' ? 'Modo Institucional' : 'Modo Ciberseguridad'}
                        </span>
                      </button>

                      <div className="h-px bg-admin-border my-1"></div>

                      {/* LOGOUT */}
                      <button
                        onClick={logout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-admin-rejected/80 hover:text-admin-rejected hover:bg-admin-rejected/10 rounded-lg admin-transition text-left"
                      >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        <span className="font-semibold text-sm">Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto admin-scroll p-4 md:p-8 relative z-0">
          {activeTab === 'panel' && <MetricasOverview />}
          {activeTab === 'usuarios' && <GestionUsuarios />}
          {activeTab === 'nuevo-comercio' && <NuevoComercio inlineMode={true} onSuccess={() => setActiveTab('usuarios')} />}
          {activeTab === 'eventos' && <GestionEventos />}
          {activeTab === 'auditoria' && <PanelAuditoria />}

          {activeTab === 'pagos' && <ValidacionPagos />}
        </div>
      </main>
    </div>
  );
}
