import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import logo from '../assets/logo.jpg';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type Estado = 'cargando' | 'exito' | 'ya_verificado' | 'token_invalido' | 'token_expirado' | 'error';

export default function VerificarEmail() {
  const [params]  = useSearchParams();
  const [estado,  setEstado]  = useState<Estado>('cargando');
  const [nombre,  setNombre]  = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setEstado('token_invalido'); return; }

    // Limpiar el token de la URL inmediatamente (seguridad: no queda en historial)
    window.history.replaceState({}, document.title, '/verificar-email');

    fetch(`${API}/api/verificar-email?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json();
        if (r.ok) {
          if (data.message?.includes('ya fue verificado')) setEstado('ya_verificado');
          else { setEstado('exito'); setNombre(data.nombre || ''); }
        } else {
          if (data.detail === 'TOKEN_INVALIDO') setEstado('token_invalido');
          else if (data.detail === 'TOKEN_EXPIRADO') setEstado('token_expirado');
          else setEstado('error');
        }
      })
      .catch(() => setEstado('error'));
  }, [params]);

  const cfg: Record<Estado, { icon: string; color: string; titulo: string; cuerpo: string }> = {
    cargando:       { icon: 'autorenew',       color: 'text-stone-400',   titulo: 'Verificando…',          cuerpo: 'Estamos validando tu enlace.' },
    exito:          { icon: 'check_circle',    color: 'text-emerald-600', titulo: '¡Correo verificado!',   cuerpo: `Gracias${nombre ? `, ${nombre}` : ''}. Tu cuenta está en revisión por el administrador. Te avisaremos cuando esté aprobada.` },
    ya_verificado:  { icon: 'verified',        color: 'text-emerald-600', titulo: 'Ya verificado',         cuerpo: 'Tu correo ya fue verificado anteriormente. Podés iniciar sesión.' },
    token_invalido: { icon: 'link_off',        color: 'text-red-500',     titulo: 'Enlace inválido',       cuerpo: 'El enlace de verificación no es válido. Asegurate de usar el enlace completo del email.' },
    token_expirado: { icon: 'timer_off',       color: 'text-amber-500',   titulo: 'Enlace expirado',       cuerpo: 'El enlace de verificación expiró (48 hs). Solicitá uno nuevo desde la pantalla de ingreso.' },
    error:          { icon: 'error_outline',   color: 'text-red-500',     titulo: 'Error inesperado',      cuerpo: 'No pudimos completar la verificación. Intentá nuevamente o contactá al administrador.' },
  };

  const { icon, color, titulo, cuerpo } = cfg[estado];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f8f9ea] to-white p-6">

      {/* Logo */}
      <div className="w-20 h-20 bg-white rounded-full shadow-xl border border-white overflow-hidden mb-8">
        <img src={logo} alt="Logo" className="w-full h-full object-cover scale-110" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 px-8 py-10 flex flex-col items-center gap-5 text-center">

        {/* Ícono de estado */}
        <span className={`material-symbols-outlined text-6xl ${color} ${estado === 'cargando' ? 'animate-spin' : ''}`}>
          {icon}
        </span>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-[#245b31]">{titulo}</h1>
          <p className="text-sm text-stone-500 leading-relaxed">{cuerpo}</p>
        </div>

        {/* CTA según estado */}
        {(estado === 'exito' || estado === 'ya_verificado') && (
          <Link
            to="/login"
            className="mt-2 w-full bg-[#357a38] hover:bg-[#2e6831] text-white font-bold h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 text-sm"
          >
            Ir al inicio de sesión
          </Link>
        )}

        {(estado === 'token_expirado' || estado === 'token_invalido') && (
          <Link
            to="/login"
            className="mt-2 text-sm text-[#357a38] font-semibold hover:underline"
          >
            Volver al inicio de sesión
          </Link>
        )}

        {estado === 'error' && (
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-[#357a38] font-semibold hover:underline"
          >
            Reintentar
          </button>
        )}
      </div>

      <p className="mt-8 text-xs text-stone-400">
        Sociedad Rural Norte de Corrientes
      </p>
    </div>
  );
}
