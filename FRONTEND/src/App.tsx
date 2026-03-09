import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Registro from './pages/Registro';
import RegistroPaso2 from './pages/RegistroPaso2';
import RegistroExitoso from './pages/RegistroExitoso';
import CamaraDashboard from './pages/CamaraDashboard';
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
import EnConstruccion from './pages/EnConstruccion';

// Rutas protegidas genéricas (Solo logueados)
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">Cargando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Rutas protegidas solo para ADMIN y CAMARA
const AdminRoute = ({ children, roles = ['ADMIN', 'CAMARA'] }: { children: React.ReactElement, roles?: string[] }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">Cargando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!user || !roles.includes(user.rol)) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

import { Chatbot } from './components/Chatbot';

export default function App() {
  const { isAuthenticated, user } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/registro-paso-2" element={<RegistroPaso2 />} />
        <Route path="/registro-exitoso" element={<RegistroExitoso />} />

        <Route path="/valida-socio/:id" element={<ValidaSocioPublico />} />

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

        {/* Rutas Protegidas solo para Administradores y Cámara */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/camara" element={<AdminRoute roles={['CAMARA']}><CamaraDashboard /></AdminRoute>} />
        <Route path="/admin/comercios/nuevo" element={<AdminRoute><NuevoComercio /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isAuthenticated && user?.rol !== 'ADMIN' && user?.rol !== 'CAMARA' && <Chatbot />}
    </Router>
  );
}
