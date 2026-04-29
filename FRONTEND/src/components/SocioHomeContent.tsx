import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

// SVG Decorators
const WoodFence = () => (
  <svg className="absolute bottom-0 left-0 w-full h-[28px] opacity-[0.25] mix-blend-multiply pointer-events-none" preserveAspectRatio="none" viewBox="0 0 200 40">
    <path d="M0 25 L200 25 M0 35 L200 35" stroke="#5C4326" strokeWidth="2.5" fill="none" opacity="0.8"/>
    <path d="M20 15 L20 40 M60 10 L60 40 M100 18 L100 40 M140 12 L140 40 M180 20 L180 40" stroke="#5C4326" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </svg>
);

const PlantsCorner = () => (
  <svg className="absolute -bottom-2 -right-2 w-[70px] h-[70px] opacity-[0.35] mix-blend-multiply pointer-events-none" viewBox="0 0 100 100">
    <path d="M100 100 C 70 50 30 70 20 80 C 40 85 70 95 100 100" fill="#3A6B35" />
    <path d="M100 100 C 60 30 20 50 10 70 C 40 75 80 90 100 100" fill="#4B7E45" />
    <path d="M100 100 C 80 10 40 30 30 50 C 60 60 90 80 100 100" fill="#295424" />
    <path d="M100 100 C 40 10 10 40 0 60 C 30 70 80 90 100 100" fill="#6B8E23" opacity="0.7" />
  </svg>
);

const LeftPlants = () => (
    <svg className="absolute -bottom-1 -left-2 w-[55px] h-[55px] opacity-[0.3] mix-blend-multiply pointer-events-none" viewBox="0 0 100 100" style={{ transform: 'scaleX(-1)' }}>
      <path d="M100 100 C 70 50 30 70 20 80 C 40 85 70 95 100 100" fill="#3A6B35" />
      <path d="M100 100 C 60 30 20 50 10 70 C 40 75 80 90 100 100" fill="#4B7E45" />
    </svg>
);

const paperTexture = "url('https://www.transparenttextures.com/patterns/paper.png')";

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
                {/* 1. Agenda Rural */}
                <Link 
                    to="/eventos" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[16px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={{
                        background: `linear-gradient(180deg, #F3F6E8 0%, #E4E8D3 100%), ${paperTexture}`,
                        backgroundBlendMode: 'multiply',
                        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <PlantsCorner />
                    <LeftPlants />
                    
                    <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 z-10 text-white shrink-0 bg-[#3A6B35]">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>calendar_month</span>
                    </div>
                    
                    <div className="z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Agenda Rural</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Conocé los próximos eventos y actividades.</p>
                    </div>
                </Link>

                {/* 2. Beneficios del Socio */}
                <Link 
                    to="/promociones" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[16px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={{
                        background: `linear-gradient(180deg, #FDF7EC 0%, #EFE5D3 100%), ${paperTexture}`,
                        backgroundBlendMode: 'multiply',
                        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <PlantsCorner />
                    
                    <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 z-10 text-white shrink-0 bg-[#8B5E3C]">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24", transform: 'scaleX(-1) rotate(45deg)'}}>sell</span>
                    </div>
                    
                    <div className="z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Beneficios del Socio</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Accedé a todos los beneficios y promociones.</p>
                    </div>
                </Link>

                {/* 3. Aportes / Cuotas */}
                <Link 
                    to="/cuotas" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[16px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={{
                        background: `linear-gradient(180deg, #F4EBE0 0%, #E6D8C8 100%), ${paperTexture}`,
                        backgroundBlendMode: 'multiply',
                        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <LeftPlants />
                    
                    <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 z-10 text-white shrink-0 bg-[#8B5E3C]">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>account_balance_wallet</span>
                    </div>
                    
                    <div className="z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Aportes / Cuotas</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Consultá y gestioná tus cuotas.</p>
                    </div>
                </Link>

                {/* 4. Credencial Rural */}
                <Link 
                    to="/carnet" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[16px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={{
                        background: `linear-gradient(180deg, #EDF1E5 0%, #D8E0CA 100%), ${paperTexture}`,
                        backgroundBlendMode: 'multiply',
                        boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <PlantsCorner />
                    
                    <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 z-10 text-white shrink-0 bg-[#3A6B35]">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>badge</span>
                    </div>
                    
                    <div className="z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Credencial Rural</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Tu credencial digital siempre a mano.</p>
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
