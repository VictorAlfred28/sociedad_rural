import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// ── Login estático (punto de entrada más frecuente) ──────────────────────
import Login from './pages/Login';

// ── Code Splitting: cargar páginas bajo demanda ──────────────────────────
const Registro = React.lazy(() => import('./pages/Registro'));
const RegistroPaso2 = React.lazy(() => import('./pages/RegistroPaso2'));
const RegistroExitoso = React.lazy(() => import('./pages/RegistroExitoso'));
const HomeSocio = React.lazy(() => import('./pages/HomeSocio'));
const CarnetDigital = React.lazy(() => import('./pages/CarnetDigital'));
const Cuotas = React.lazy(() => import('./pages/Cuotas'));
const Eventos = React.lazy(() => import('./pages/Eventos'));
const EventoDetail = React.lazy(() => import('./pages/EventoDetail'));
const Promociones = React.lazy(() => import('./pages/Promociones'));
const Perfil = React.lazy(() => import('./pages/Perfil'));
const Buscador = React.lazy(() => import('./pages/Buscador'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const NuevoComercio = React.lazy(() => import('./pages/NuevoComercio'));
const CambioPassword = React.lazy(() => import('./pages/CambioPassword'));
const MiNegocio = React.lazy(() => import('./pages/MiNegocio'));
const Preferencias = React.lazy(() => import('./pages/Preferencias'));
const ValidaSocioPublico = React.lazy(() => import('./pages/ValidaSocioPublico'));
const ValidaQRDinamico = React.lazy(() => import('./pages/ValidaQRDinamico'));
const EnConstruccion = React.lazy(() => import('./pages/EnConstruccion'));
const VerificarEmail = React.lazy(() => import('./pages/VerificarEmail'));

// ── Spinner de carga para Suspense ───────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-[#357a38] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-slate-500 font-medium">Cargando...</span>
    </div>
  </div>
);

// Rutas protegidas genéricas (Solo logueados)
const ProtectedRoute = ({ children, skipPasswordCheck = false }: { children: React.ReactElement; skipPasswordCheck?: boolean }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Si el usuario tiene contraseña temporal, forzar cambio antes de cualquier otra acción
  // EXCEPTO si ya está en la página de cambio de contraseña
  if (!skipPasswordCheck && user?.must_change_password === true) {
    return <Navigate to="/cambio-password" replace />;
  }

  return children;
};

// Rutas protegidas solo para ADMIN
const AdminRoute = ({ children, roles = ['ADMIN'] }: { children: React.ReactElement, roles?: string[] }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!user || !roles.includes(user.rol)) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

import { Chatbot } from './components/Chatbot';
import { CapacitorUI } from './components/CapacitorUI';
import { Toaster } from 'react-hot-toast';

const ConditionalChatbot = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const publicRoutes = ['/login', '/registro', '/registro-paso-2', '/registro-exitoso'];

  if (!isAuthenticated || publicRoutes.includes(location.pathname)) return null;
  if (user?.rol === 'ADMIN') return null;

  return <Chatbot />;
};

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Toaster position="top-center" toastOptions={{ className: 'font-display text-sm font-bold', duration: 4000 }} />
      <CapacitorUI />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/registro-paso-2" element={<RegistroPaso2 />} />
          <Route path="/registro-exitoso" element={<RegistroExitoso />} />

          <Route path="/valida-socio/:id" element={<ValidaSocioPublico />} />
          <Route path="/qr-valida/:token" element={<ValidaQRDinamico />} />
          <Route path="/verificar-email" element={<VerificarEmail />} />

          {/* Rutas Protegidas para cualquier Socio/Comercio Aprobado */}
          <Route path="/home" element={<ProtectedRoute><HomeSocio /></ProtectedRoute>} />
          <Route path="/carnet" element={<ProtectedRoute><CarnetDigital /></ProtectedRoute>} />
          <Route path="/cuotas" element={<ProtectedRoute><Cuotas /></ProtectedRoute>} />
          <Route path="/eventos" element={<ProtectedRoute><Eventos /></ProtectedRoute>} />
          <Route path="/eventos/:slug" element={<ProtectedRoute><EventoDetail /></ProtectedRoute>} />
          <Route path="/promociones" element={<ProtectedRoute><Promociones /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
          <Route path="/buscar" element={<ProtectedRoute><Buscador /></ProtectedRoute>} />
          <Route path="/preferencias" element={<ProtectedRoute><Preferencias /></ProtectedRoute>} />
          <Route path="/cambio-password" element={<ProtectedRoute skipPasswordCheck={true}><CambioPassword /></ProtectedRoute>} />
          <Route path="/mi-negocio" element={<ProtectedRoute><MiNegocio /></ProtectedRoute>} />
          <Route path="/pagar-cuota" element={<ProtectedRoute><EnConstruccion /></ProtectedRoute>} />

          {/* Rutas Protegidas solo para Administradores */}
          <Route path="/admin" element={<AdminRoute roles={['ADMIN']}><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/comercios/nuevo" element={<AdminRoute roles={['ADMIN']}><NuevoComercio /></AdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ConditionalChatbot />
    </Router>
  );
}
