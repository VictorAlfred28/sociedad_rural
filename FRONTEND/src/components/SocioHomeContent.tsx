import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SocioHomeContent() {
    const { user } = useAuth();
    return (
        <>
            {/* Clima Meteorológico */}
            <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-md rounded-3xl p-5 mb-6 shadow-sm border border-stone-200/50 dark:border-stone-700/50 flex items-center justify-between">
                <div>
                    <h3 className="text-stone-500 dark:text-stone-400 text-sm font-medium mb-1">Corrientes, AR</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-stone-800 dark:text-stone-100">24°C</span>
                        <span className="text-stone-500 dark:text-stone-400 text-sm">Mayormente soleado</span>
                    </div>
                </div>
                <span className="material-symbols-outlined text-amber-500 text-5xl">light_mode</span>
            </div>

            {/* Grid de Accesos Rápidos */}
            <div className="grid grid-cols-2 gap-4">
                <Link to="/eventos" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-3xl bg-emerald-800 text-stone-50 shadow-md active:scale-95 transition-transform relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm z-10">
                        <span className="material-symbols-outlined text-3xl">calendar_month</span>
                    </div>
                    <span className="font-semibold text-sm tracking-wide z-10">EVENTOS</span>
                </Link>
                <Link to="/promociones" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-3xl bg-amber-600 text-stone-50 shadow-md active:scale-95 transition-transform relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm z-10">
                        <span className="material-symbols-outlined text-3xl">sell</span>
                    </div>
                    <span className="font-semibold text-sm tracking-wide text-center leading-tight z-10">BENEFICIOS &<br/>PROMOCIONES</span>
                </Link>
                <Link to="/cuotas" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-3xl bg-stone-700 text-stone-50 shadow-md active:scale-95 transition-transform relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm z-10">
                        <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                    </div>
                    <span className="font-semibold text-sm tracking-wide z-10">CUOTAS</span>
                </Link>
                <Link to="/carnet" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-3xl bg-primary text-stone-900 shadow-md active:scale-95 transition-transform relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                    <div className="bg-black/10 p-4 rounded-2xl backdrop-blur-sm z-10">
                        <span className="material-symbols-outlined text-3xl text-stone-900">badge</span>
                    </div>
                    <span className="font-semibold text-sm tracking-wide text-center z-10">Ñande Pasaporte</span>
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
