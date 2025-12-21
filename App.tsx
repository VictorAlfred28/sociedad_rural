
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { supabase } from './services/supabaseClient';

// Lazy loading screens for better performance
const Dashboard = lazy(() => import('./screens/Dashboard'));
const AdminDashboard = lazy(() => import('./screens/AdminDashboard'));
const Login = lazy(() => import('./screens/Login'));
const Register = lazy(() => import('./screens/Register'));
const Payments = lazy(() => import('./screens/Payments'));
const Audit = lazy(() => import('./screens/Audit'));
const DigitalID = lazy(() => import('./screens/DigitalID'));
const Merchants = lazy(() => import('./screens/Merchants'));
const Forum = lazy(() => import('./screens/Forum'));
const Settings = lazy(() => import('./screens/Settings'));
const PartnerManagement = lazy(() => import('./screens/PartnerManagement'));

const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8">
    <h1 className="text-3xl font-black mb-4 dark:text-white">{title}</h1>
    <div className="bg-surface-light dark:bg-surface-dark p-12 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center text-center">
      <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">construction</span>
      <p className="text-gray-500 font-medium">Esta sección está en desarrollo.</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        setRole(data?.role || 'socio');
      }
      setLoading(false);
    };
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background-light dark:bg-background-dark">
          <div className="flex flex-col items-center gap-4">
            <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-primary font-bold animate-pulse">Cargando Sociedad Rural...</p>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><Layout><AdminDashboard /></Layout></ProtectedRoute>} />

          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><Layout><Payments /></Layout></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><Layout><Audit /></Layout></ProtectedRoute>} />
          <Route path="/digital-id" element={<ProtectedRoute><Layout><DigitalID /></Layout></ProtectedRoute>} />
          <Route path="/merchants" element={<ProtectedRoute><Layout><Merchants /></Layout></ProtectedRoute>} />
          <Route path="/forum" element={<ProtectedRoute><Layout><Forum /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />

          <Route path="/partners" element={<ProtectedRoute><Layout><PartnerManagement /></Layout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Layout><Placeholder title="Notificaciones" /></Layout></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Layout><Placeholder title="Documentos" /></Layout></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute><Layout><Placeholder title="Eventos" /></Layout></ProtectedRoute>} />
          <Route path="/faq" element={<ProtectedRoute><Layout><Placeholder title="Ayuda & FAQ" /></Layout></ProtectedRoute>} />

          {/* Default fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};

export default App;
