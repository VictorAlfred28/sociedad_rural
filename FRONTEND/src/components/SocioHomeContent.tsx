import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function SocioHomeContent() {
    const { user } = useAuth();
    return (
        <>
            {/* Clima Meteorológico */}
            <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-md rounded-[2rem] p-6 mb-6 shadow-xl border border-stone-200/50 dark:border-stone-700/50 flex items-center justify-between overflow-hidden relative">
                {/* Ornamento */}
                <div className="absolute top-0 left-0 p-4 text-[#245b31]/5 opacity-10 pointer-events-none">
                    <span className="material-symbols-outlined text-6xl">cloud</span>
                </div>
                <div className="relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-1">Corrientes, AR</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-4xl font-black text-stone-800 dark:text-stone-100 font-display italic">24°C</span>
                        <div className="flex flex-col">
                            <span className="text-stone-500 dark:text-stone-400 text-[10px] font-black uppercase tracking-widest leading-none">Mayormente</span>
                            <span className="text-stone-500 dark:text-stone-400 text-[10px] font-black uppercase tracking-widest">soleado</span>
                        </div>
                    </div>
                </div>
                <motion.span 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="material-symbols-outlined text-amber-500 text-6xl drop-shadow-lg relative z-10"
                >
                    light_mode
                </motion.span>
            </div>

            {/* Grid de Accesos Rápidos */}
            <div className="grid grid-cols-2 gap-4">
                <Link to="/eventos" className="aspect-square flex flex-col items-start justify-between p-4 rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 shadow-sm active:scale-95 transition-transform relative overflow-hidden border border-[#e5dfce] dark:border-stone-700/50 group">
                    <div className="absolute -bottom-2 -right-2 w-20 h-20 text-[#8b9172] dark:text-stone-600 opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none">
                        <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                    </div>
                    <div className="bg-[#4b5e4a] text-white p-2.5 rounded-full flex items-center justify-center z-10 mb-2 shadow-sm">
                        <span className="material-symbols-outlined text-[28px] leading-none">calendar_month</span>
                    </div>
                    <div className="z-10 w-full">
                        <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg leading-tight mb-1 font-display">Agenda Rural</h3>
                        <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-snug">Conocé los próximos eventos y actividades.</p>
                    </div>
                </Link>
                <Link to="/promociones" className="aspect-square flex flex-col items-start justify-between p-4 rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 shadow-sm active:scale-95 transition-transform relative overflow-hidden border border-[#e5dfce] dark:border-stone-700/50 group">
                    <div className="absolute -bottom-2 -right-2 w-20 h-20 text-[#a87f5d] dark:text-stone-600 opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none">
                        <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                    </div>
                    <div className="bg-[#995c27] text-white p-2.5 rounded-full flex items-center justify-center z-10 mb-2 shadow-sm">
                        <span className="material-symbols-outlined text-[28px] leading-none">sell</span>
                    </div>
                    <div className="z-10 w-full">
                        <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg leading-tight mb-1 font-display">Beneficios del Socio</h3>
                        <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-snug">Accedé a todos los beneficios y promociones.</p>
                    </div>
                </Link>
                <Link to="/cuotas" className="aspect-square flex flex-col items-start justify-between p-4 rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 shadow-sm active:scale-95 transition-transform relative overflow-hidden border border-[#e5dfce] dark:border-stone-700/50 group">
                    <div className="absolute -bottom-2 -right-2 w-20 h-20 text-[#8b755e] dark:text-stone-600 opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none">
                        <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                    </div>
                    <div className="bg-[#784e32] text-white p-2.5 rounded-full flex items-center justify-center z-10 mb-2 shadow-sm">
                        <span className="material-symbols-outlined text-[28px] leading-none">account_balance_wallet</span>
                    </div>
                    <div className="z-10 w-full">
                        <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg leading-tight mb-1 font-display">Aportes / Cuotas</h3>
                        <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-snug">Consultá y gestioná tus cuotas.</p>
                    </div>
                </Link>
                <Link to="/carnet" className="aspect-square flex flex-col items-start justify-between p-4 rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 shadow-sm active:scale-95 transition-transform relative overflow-hidden border border-[#e5dfce] dark:border-stone-700/50 group">
                    <div className="absolute -bottom-2 -right-2 w-20 h-20 text-[#8b9172] dark:text-stone-600 opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none">
                        <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                    </div>
                    <div className="bg-[#4b5e4a] text-white p-2.5 rounded-full flex items-center justify-center z-10 mb-2 shadow-sm">
                        <span className="material-symbols-outlined text-[28px] leading-none">badge</span>
                    </div>
                    <div className="z-10 w-full">
                        <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg leading-tight mb-1 font-display">Ñande Pasaporte</h3>
                        <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-snug">Tu credencial digital siempre a mano.</p>
                    </div>
                </Link>
            </div>

            {/* Alertas y Avisos */}
            <div className="mt-8">
                {user?.estado === 'RESTRINGIDO' ? (
                    <div className="p-5 rounded-3xl bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/50 dark:border-red-900/30 flex items-start gap-4 shadow-sm">
                        <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-0.5">warning</span>
                        <div className="flex-1">
                            <p className="text-red-900 dark:text-red-100 font-bold text-sm mb-1">
                                Último aviso de pago
                            </p>
                            <p className="text-red-700 dark:text-red-300 text-xs leading-relaxed mb-4">
                                Por favor, regularice su situación para mantener todos sus beneficios como socio activo.
                            </p>
                            <Link to="/cuotas" className="block text-center w-full py-3 rounded-2xl bg-red-600 text-white font-bold text-sm shadow-sm active:opacity-80 transition-opacity">
                                Pagar ahora
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 rounded-3xl bg-emerald-50/80 dark:bg-emerald-900/20 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-900/30 flex items-start gap-4 shadow-sm">
                        <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 mt-0.5">eco</span>
                        <div className="flex-1">
                            <p className="text-emerald-900 dark:text-emerald-100 font-bold text-sm mb-1">
                                ¡Bienvenidos a la Sociedad Rural!
                            </p>
                            <p className="text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed mb-4">
                                Si desea abonar la cuota por primera vez o adelantar cuotas, puede hacerlo cómodamente desde el botón inferior.
                            </p>
                            <Link to="/cuotas" className="block text-center w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-sm active:opacity-80 transition-opacity">
                                Pagar ahora
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
