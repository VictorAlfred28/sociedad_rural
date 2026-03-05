import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';

export default function Cuotas() {
  return (
    <div className="relative mx-auto min-h-screen max-w-md bg-background-light dark:bg-background-dark flex flex-col shadow-2xl overflow-hidden border-x border-slate-200 dark:border-slate-800">
      <header className="sticky top-0 z-20 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center px-4 py-3 justify-between">
          <Link to="/home" className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-slate-900 dark:text-slate-100">arrow_back_ios_new</span>
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex-1 text-center">Mis Cuotas</h1>
          <button className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-slate-900 dark:text-slate-100">info</span>
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-24">
        <section className="p-4">
          <div className="relative overflow-hidden rounded-2xl bg-primary p-6 shadow-lg shadow-primary/20">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"></div>
            <div className="relative z-10 flex flex-col gap-1">
              <span className="text-slate-900/80 text-sm font-medium">Estado de Cuenta</span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">Al día</span>
                <span className="material-symbols-outlined text-slate-900 text-2xl">check_circle</span>
              </div>
              <p className="text-slate-900/70 text-xs mt-2 uppercase tracking-widest font-bold">Socio #1234</p>
            </div>
            <div className="mt-6 flex gap-3">
              <button className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-colors">
                Descargar Libre Deuda
              </button>
            </div>
          </div>
        </section>
        <section className="px-4 mt-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Historial de Pagos</h3>
            <button className="text-primary text-sm font-semibold flex items-center gap-1">
              Filtrar <span className="material-symbols-outlined text-sm">filter_list</span>
            </button>
          </div>
          
          <div className="mb-4 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600">
                <span className="material-symbols-outlined">event_busy</span>
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">Noviembre 2023</p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">$12.500,00</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-wider">Pendiente</span>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 px-4 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">Vence en 3 días</span>
              <button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-slate-900 shadow-sm hover:bg-primary/90">
                Ir a Pagar
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/30 text-green-600">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">Octubre 2023</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">$12.500,00</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400 uppercase tracking-wider">Pagado</span>
              <button className="text-primary text-xs font-medium">Recibo</button>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/30 text-green-600">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">Septiembre 2023</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">$10.000,00</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400 uppercase tracking-wider">Pagado</span>
              <button className="text-primary text-xs font-medium">Recibo</button>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
