import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Registro from './pages/Registro';
import RegistroPaso2 from './pages/RegistroPaso2';
import RegistroExitoso from './pages/RegistroExitoso';
import HomeSocio from './pages/HomeSocio';
import CarnetDigital from './pages/CarnetDigital';
import Cuotas from './pages/Cuotas';
import Eventos from './pages/Eventos';
import Promociones from './pages/Promociones';
import Perfil from './pages/Perfil';
import AdminDashboard from './pages/AdminDashboard';
import NuevoComercio from './pages/NuevoComercio';
import CambioPassword from './pages/CambioPassword';
import MiNegocio from './pages/MiNegocio';
import Preferencias from './pages/Preferencias';
import ValidaSocioPublico from './pages/ValidaSocioPublico';
import ValidaQRDinamico from './pages/ValidaQRDinamico';
import EnConstruccion from './pages/EnConstruccion';

// Rutas protegidas genéricas (Solo logueados)
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">Cargando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Rutas protegidas solo para ADMIN
const AdminRoute = ({ children, roles = ['ADMIN'] }: { children: React.ReactElement, roles?: string[] }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">Cargando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!user || !roles.includes(user.rol)) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

import { Chatbot } from './components/Chatbot';

const ConditionalChatbot = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const publicRoutes = ['/login', '/registro', '/registro-paso-2', '/registro-exitoso'];

  if (!isAuthenticated || publicRoutes.includes(location.pathname)) return null;
  if (user?.rol === 'ADMIN') return null;

  return <Chatbot />;
};

export default function App() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/registro-paso-2" element={<RegistroPaso2 />} />
        <Route path="/registro-exitoso" element={<RegistroExitoso />} />

        <Route path="/valida-socio/:id" element={<ValidaSocioPublico />} />
        <Route path="/qr-valida/:token" element={<ValidaQRDinamico />} />

        {/* Rutas Protegidas para cualquier Socio/Comercio Aprobado */}
        <Route path="/home" element={<ProtectedRoute><HomeSocio /></ProtectedRoute>} />
        <Route path="/carnet" element={<ProtectedRoute><CarnetDigital /></ProtectedRoute>} />
        <Route path="/cuotas" element={<ProtectedRoute><Cuotas /></ProtectedRoute>} />
        <Route path="/eventos" element={<ProtectedRoute><Eventos /></ProtectedRoute>} />
        <Route path="/promociones" element={<ProtectedRoute><Promociones /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
        <Route path="/preferencias" element={<ProtectedRoute><Preferencias /></ProtectedRoute>} />
        <Route path="/cambio-password" element={<ProtectedRoute><CambioPassword /></ProtectedRoute>} />
        <Route path="/mi-negocio" element={<ProtectedRoute><MiNegocio /></ProtectedRoute>} />
        <Route path="/pagar-cuota" element={<ProtectedRoute><EnConstruccion /></ProtectedRoute>} />

        {/* Rutas Protegidas solo para Administradores */}
        <Route path="/admin" element={<AdminRoute roles={['ADMIN']}><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/comercios/nuevo" element={<AdminRoute roles={['ADMIN']}><NuevoComercio /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ConditionalChatbot />
    </Router>
  );
}
