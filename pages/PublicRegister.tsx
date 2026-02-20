import React, { useState } from 'react';
import { UserPlus, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { ApiService } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

export const PublicRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      await ApiService.auth.register({
        nombre: formData.nombre,
        apellido: formData.apellido,
        dni: formData.dni,
        email: formData.email,
        password: formData.password
      });
      
      setSuccess(true);
      // Opcional: Redirigir después de unos segundos
      setTimeout(() => navigate('/login'), 3000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al procesar el registro.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] relative">
         <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border-t-4 border-green-500">
             <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <UserPlus className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Solicitud Enviada!</h2>
             <p className="text-gray-600 mb-6">
                Tus datos han sido registrados correctamente. Tu cuenta quedará en estado 
                <span className="font-bold text-rural-brown"> Pendiente</span> hasta que un administrador verifique tu identidad.
             </p>
             <Link to="/login" className="text-rural-green font-medium hover:underline">
                Volver al inicio de sesión
             </Link>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] relative overflow-hidden py-10">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-48 bg-rural-brown"></div>
      
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 border-t-4 border-rural-gold">
        <div className="mb-6 flex items-center">
             <Link to="/login" className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-6 h-6" />
             </Link>
             <div className="flex-1 text-center pr-6">
                <h1 className="text-2xl font-serif font-bold text-gray-800">Solicitud de Socio</h1>
                <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">Sociedad Rural Norte</p>
             </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                type="text" 
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none"
                value={formData.nombre}
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input 
                type="text" 
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none"
                value={formData.apellido}
                onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none"
              value={formData.dni}
              onChange={(e) => setFormData({...formData, dni: e.target.value})}
              placeholder="Sin puntos ni guiones"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input 
                type="password" 
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar</label>
                <input 
                type="password" 
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rural-green focus:border-transparent outline-none"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-3 bg-rural-brown text-white font-semibold rounded-lg hover:bg-[#6d360f] transition-colors flex items-center justify-center gap-2 shadow-lg mt-6 ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'Procesando...' : 'Solicitar Alta'}
          </button>
        </form>
      </div>
    </div>
  );
};