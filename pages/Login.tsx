import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { ApiService } from '../services/api';
import { Link } from 'react-router-dom';

export const Login = ({ onLogin }: { onLogin: () => void }) => {
  const [emailOrDni, setEmailOrDni] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await ApiService.auth.login({
        username: emailOrDni,
        password: password
      });

      if (response.access_token) {
        // Guardar Token
        localStorage.setItem('auth_token', response.access_token);

        // Guardar Rol y Datos
        if (response.role) {
          localStorage.setItem('user_role', response.role);
        }
        // Verificar si requiere cambio de contraseña
        if (response.user?.force_password_change) {
          localStorage.setItem('force_password_change', 'true');
        }

        // Notificar login exitoso
        onLogin();
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err: any) {
      console.error("Login error details:", err);
      let msg = err.message || 'Error desconocido al intentar ingresar.';
      if (msg.includes('Email not confirmed')) msg = 'Debes confirmar tu correo electrónico antes de ingresar.';
      if (msg.includes('Invalid login credentials')) msg = 'Usuario o contraseña incorrectos.';
      if (msg.includes('Network request failed')) msg = 'Error de conexión. Verifique que el servidor Backend esté activo.';

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-64 bg-rural-green"></div>
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 border-t-4 border-rural-gold">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-rural-green text-rural-gold mx-auto rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow-lg mb-4">
            SR
          </div>
          <h1 className="text-2xl font-serif font-bold text-gray-800">Sociedad Rural</h1>
          <p className="text-rural-brown font-medium">Norte de Corrientes</p>
          <p className="text-gray-400 text-xs mt-2 uppercase tracking-widest">Acceso de Socios</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start animate-fade-in">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario (DNI, CUIT o Email)</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none transition-all"
              value={emailOrDni}
              onChange={(e) => setEmailOrDni(e.target.value)}
              placeholder="Ej: 20123456789 o admin@rural.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 bg-rural-green text-white font-semibold rounded-lg hover:bg-[#143225] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rural-green/20 ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-gray-400">
            Sistema seguro protegido. Todas las acciones son monitoreadas.
          </p>
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">¿Desea asociarse?</p>
            <Link to="/registro" className="text-rural-green font-bold hover:underline text-sm">
              Solicitar Alta de Socio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};