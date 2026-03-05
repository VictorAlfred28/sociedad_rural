import { Link } from 'react-router-dom';

export default function RegistroExitoso() {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center">
      <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden shadow-2xl">
        <div className="flex items-center bg-background-light dark:bg-background-dark p-4 pt-12 pb-2 justify-between">
          <Link to="/" className="w-10 h-10 flex items-center justify-center text-slate-900 dark:text-slate-100">
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </Link>
          <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Registro</h2>
          <div className="w-10"></div>
        </div>
        <div className="flex flex-col px-6 py-10 flex-grow">
          <div className="flex flex-col items-center gap-8">
            <div className="relative w-full aspect-square max-w-[280px] flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-primary/20 rounded-full"></div>
              <div className="relative w-32 h-32 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="material-symbols-outlined text-slate-900 text-6xl font-bold">check</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <h1 className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-[-0.015em] text-center">¡Solicitud Enviada!</h1>
              <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-relaxed text-center">
                Tu solicitud de socio está siendo revisada por la administración. Te notificaremos por email una vez sea aprobada.
              </p>
            </div>
            <div className="w-full mt-4 p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">schedule</span>
                </div>
                <div>
                  <p className="text-slate-900 dark:text-slate-100 text-base font-bold">¿Qué sigue?</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Próximos pasos</p>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-normal">
                Nuestro equipo revisará tu perfil en un plazo de <span className="text-primary font-semibold">24 a 48 horas</span> hábiles. Asegúrate de revisar tu bandeja de entrada.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 pb-12 flex flex-col gap-3">
          <Link to="/home" className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 bg-primary text-slate-900 text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-primary/20 active:scale-95 transition-transform">
            <span className="truncate">Ir al Inicio</span>
          </Link>
        </div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10"></div>
      </div>
    </div>
  );
}
