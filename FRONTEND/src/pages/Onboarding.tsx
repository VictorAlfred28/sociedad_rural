import { Link, useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-900 text-white font-display">
      {/* Fondo superior oscuro e inferior con imagen de campo */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a202c] via-[#2d3748] to-transparent z-0"></div>
      <div
        className="absolute bottom-0 left-0 right-0 h-[50vh] bg-cover bg-center z-0 opacity-80"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop")' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
      </div>

      <div className="relative flex flex-col flex-1 z-10 px-6 pt-16 pb-12">
        {/* Logo superior */}
        <div className="flex justify-center mb-8">
          <div className="relative w-36 h-36 rounded-full bg-[#1e293b] flex items-center justify-center p-1 overflow-hidden" style={{ boxShadow: '0 0 0 4px #a7f3d0' }}>
            {/* Si tienes el logo original subirlo o usar este placeholder con los colores del UI */}
            <div className="w-full h-full rounded-full bg-[#b48641] flex flex-col items-center justify-center text-[#ffedd5]">
              {/* Simulación del logo para que se parezca al mockup */}
              <span className="text-[10px] font-bold tracking-widest mt-2 uppercase">Sociedad</span>
              <img src="https://rural-corrientes.org.ar/wp-content/uploads/2021/08/logo-s-rural-2.png" alt="Logo" className="w-16 h-16 object-contain opacity-80 mix-blend-screen" onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }} />
              <span className="material-symbols-outlined text-4xl my-1 hidden">pest_control</span>
              <span className="text-[10px] font-bold tracking-widest uppercase mb-2">Rural</span>
            </div>
          </div>
        </div>

        {/* Textos centrales */}
        <div className="flex flex-col items-center text-center gap-4 mb-auto">
          <h1 className="text-white text-[2rem] font-extrabold leading-tight tracking-tight font-display">
            Bienvenido a la <br />Sociedad Rural
          </h1>
          <p className="text-slate-200 text-lg max-w-xs font-medium">
            Potenciamos el campo correntino
          </p>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col gap-4 w-full mt-12">
          {/* Botón Socio */}
          <button
            onClick={() => navigate('/registro')}
            className="group relative overflow-hidden flex items-center bg-white rounded-2xl p-4 w-full shadow-lg active:scale-95 transition-all text-left"
          >
            {/* Decoración lateral verde */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-500 rounded-l-2xl"></div>

            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 ml-4 shrink-0 transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-2xl">agriculture</span>
            </div>

            <div className="flex flex-col ml-4 flex-1">
              <span className="text-slate-900 font-bold text-lg leading-tight">Soy Productor / <br />Socio</span>
              <span className="text-slate-500 text-xs mt-1">Acceder a beneficios y gestión</span>
            </div>

            <span className="material-symbols-outlined text-slate-300 pr-2">chevron_right</span>
          </button>

          {/* Botón Comercio */}
          <button
            onClick={() => navigate('/registro?tipo=comercio')}
            className="group relative overflow-hidden flex items-center bg-white rounded-2xl p-4 w-full shadow-lg active:scale-95 transition-all text-left"
          >
            {/* Decoración lateral amarilla */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-400 rounded-l-2xl"></div>

            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-500 ml-4 shrink-0 transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>

            <div className="flex flex-col ml-4 flex-1">
              <span className="text-slate-900 font-bold text-lg leading-tight">Soy Comercio Local</span>
              <span className="text-slate-500 text-xs mt-1">Sumar mi negocio a la red</span>
            </div>

            <span className="material-symbols-outlined text-slate-300 pr-2">chevron_right</span>
          </button>

          {/* Botón Cámara de Comercio */}
          <button
            onClick={() => navigate('/registro?tipo=camara')}
            className="group relative overflow-hidden flex items-center bg-white rounded-2xl p-4 w-full shadow-lg active:scale-95 transition-all text-left"
          >
            {/* Decoración lateral azul */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-indigo-500 rounded-l-2xl"></div>

            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 text-indigo-500 ml-4 shrink-0 transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-2xl">domain</span>
            </div>

            <div className="flex flex-col ml-4 flex-1">
              <span className="text-slate-900 font-bold text-lg leading-tight">Cámara de Comercio</span>
              <span className="text-slate-500 text-xs mt-1">Alta como cámara municipal</span>
            </div>

            <span className="material-symbols-outlined text-slate-300 pr-2">chevron_right</span>
          </button>
        </div>

        {/* Link Login */}
        <div className="mt-10 mb-4 flex justify-center">
          <Link to="/login" className="inline-block relative">
            <span className="text-white font-bold text-base">Ya tengo cuenta, Iniciar Sesión</span>
            {/* Línea verde inferior */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 mt-1" style={{ bottom: '-4px' }}></div>
          </Link>
        </div>

      </div>
    </div>
  );
}
