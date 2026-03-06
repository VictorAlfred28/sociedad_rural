import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/ui/PasswordInput';
import logo from '../assets/logo.jpg';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleForgotPassword = async () => {
    if (!identificador) {
      setErrorMsg('Por favor, ingresa tu Correo o CUIT para solicitar el restablecimiento.');
      return;
    }

    setResetLoading(true);
    setErrorMsg('');
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/notificar-olvido-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Error al enviar solicitud');

      setSuccessMsg(data.message);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, password })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.detail || 'Error al iniciar sesión');
      }

      setSuccessMsg(`¡Bienvenido! Rol asignado: ${data.socio?.rol || 'USUARIO'}`);

      // Guardado de sesión básica con Global Context
      login(data.token, data.socio);

      // Pequeño delay para que se vea el successMsg
      setTimeout(() => {
        // LÓGICA CRÍTICA DEL NEGOCIO
        if (data.necesita_cambio_password) {
          navigate('/cambio-password');
        } else {
          if (data.socio.rol === 'ADMIN') {
            navigate('/admin');
          } else if (data.socio.rol === 'CAMARA') {
            navigate('/camara');
          } else {
            navigate('/home');
          }
        }
      }, 1000);

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      if (!successMsg) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden p-6 font-display bg-slate-50">

      {/* Background Image con overlay simulando la foto del campo con sol */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop")' }}
      >
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#f8f9ea]/90 via-[#f8f9ea]/60 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center mt-4 mb-12">

        {/* Logo superior circular con la imagen oficial - Ajustado el tamaño para reducir el fondo blanco */}
        <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl border border-white overflow-hidden relative">
          <img
            src={logo}
            alt="Sociedad Rural Logo"
            className="w-full h-full object-cover scale-110"
          />
        </div>

        {/* Títulos */}
        <div className="flex flex-col items-center mb-8 text-center drop-shadow-sm">
          <h1 className="text-[2.2rem] font-extrabold text-[#245b31] tracking-tight mb-2">Portal Digital</h1>
          <p className="text-[#644236] font-medium text-base">Sociedad Rural Norte de Corrientes</p>
        </div>

        {/* Formulario / Tarjeta blanca */}
        <div className="w-full bg-white px-8 py-10 rounded-[1.5rem] shadow-xl border border-slate-100">

          {/* Mensajes de feedback */}
          {successMsg && (
            <div className="mb-6 p-4 bg-[#e6fcf0] border border-[#a1e8c1] rounded-lg text-[#1c6e3b] text-sm font-medium">
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#1e5028]">
                Correo Electrónico <span className="text-slate-500 font-normal text-xs ml-1">(o CUIT / DNI)</span>
              </label>
              <input
                className="w-full px-4 h-12 rounded-lg border border-[#a1e8c1] bg-white focus:bg-white focus:ring-1 focus:ring-[#245b31] focus:border-[#245b31] transition-all outline-none text-slate-800 placeholder:text-slate-400 text-base"
                placeholder="juan@email.com"
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#1e5028]">
                Contraseña
              </label>
              <PasswordInput
                className="w-full px-4 h-12 rounded-lg border border-[#a1e8c1] bg-white focus:bg-white focus:ring-1 focus:ring-[#245b31] focus:border-[#245b31] transition-all outline-none text-slate-800 text-2xl tracking-[0.2em]"
                placeholder="•••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-xs font-semibold text-[#357a38] hover:underline"
                >
                  {resetLoading ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
                </button>
              </div>
            </div>

            <button
              className="w-full bg-[#357a38] hover:bg-[#2e6831] text-white font-bold h-12 rounded-lg shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-4 text-[15px]"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Validando...' : 'Ingresar al Portal'}
            </button>
          </form>

          {/* Link a Registro inferior */}
          <div className="mt-8 text-center pt-2">
            <Link to="/registro" className="inline-block group">
              <span className="text-[#357a38] font-semibold text-[15px] group-hover:underline decoration-[#357a38] underline-offset-4 transition-all">
                ¿No eres socio? Solicita tu adhesión
              </span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
