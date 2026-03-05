import React from 'react';
import { Link } from 'react-router-dom';

export default function SocioHomeContent() {
    return (
        <>
            <div className="grid grid-cols-2 gap-4">
                <Link to="/eventos" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl bg-emerald-900 text-white shadow-lg active:scale-95 transition-transform">
                    <div className="bg-white/10 p-3 rounded-full">
                        <span className="material-symbols-outlined text-3xl">calendar_month</span>
                    </div>
                    <span className="font-bold text-sm tracking-wide">EVENTOS</span>
                </Link>
                <Link to="/promociones" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl bg-orange-500 text-white shadow-lg active:scale-95 transition-transform">
                    <div className="bg-white/10 p-3 rounded-full">
                        <span className="material-symbols-outlined text-3xl">sell</span>
                    </div>
                    <span className="font-bold text-sm tracking-wide">PROMOCIONES</span>
                </Link>
                <Link to="/cuotas" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl bg-amber-800 text-white shadow-lg active:scale-95 transition-transform">
                    <div className="bg-white/10 p-3 rounded-full">
                        <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                    </div>
                    <span className="font-bold text-sm tracking-wide">CUOTAS</span>
                </Link>
                <Link to="/carnet" className="aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary text-slate-900 shadow-lg active:scale-95 transition-transform">
                    <div className="bg-black/10 p-3 rounded-full">
                        <span className="material-symbols-outlined text-3xl text-slate-900">badge</span>
                    </div>
                    <span className="font-bold text-sm tracking-wide">CARNET DIGITAL</span>
                </Link>
            </div>
            <div className="mt-8">
                <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex items-start gap-4 shadow-sm">
                    <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-0.5">warning</span>
                    <div className="flex-1">
                        <p className="text-slate-900 dark:text-slate-100 font-bold text-sm mb-1">
                            Último aviso de pago: 15/10/2023
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed mb-3">
                            Por favor, regularice su situación para mantener todos sus beneficios como socio activo.
                        </p>
                        <Link to="/cuotas" className="block text-center w-full py-2.5 rounded-full bg-primary text-slate-900 font-bold text-sm shadow-sm active:opacity-80">
                            Pagar ahora
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
