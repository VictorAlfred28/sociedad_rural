import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// SVG Decorators
const WoodFence = () => (
  <svg className="absolute bottom-0 left-0 w-full h-[32px] pointer-events-none drop-shadow-sm transition-all duration-300" style={{ opacity: 0.45, filter: 'blur(0.3px) saturate(0.9)' }} preserveAspectRatio="none" viewBox="0 0 200 40">
    {/* Tablas base */}
    <path d="M0 25 L200 25 M0 35 L200 35" stroke="#5C4326" strokeWidth="2.5" fill="none" />
    {/* Textura tablas */}
    <path d="M0 26 L200 26 M0 36 L200 36" stroke="#3A2814" strokeWidth="0.5" fill="none" />
    {/* Postes */}
    <path d="M20 15 L20 40 M60 10 L60 40 M100 18 L100 40 M140 12 L140 40 M180 20 L180 40" stroke="#5C4326" strokeWidth="4" fill="none" strokeLinecap="round"/>
    {/* Textura postes */}
    <path d="M22 17 L22 38 M62 12 L62 38 M102 20 L102 38 M142 14 L142 38 M182 22 L182 38" stroke="#3A2814" strokeWidth="1" fill="none" />
  </svg>
);

const PlantsCorner = () => (
  <svg className="absolute -bottom-2 -right-2 w-[75px] h-[75px] pointer-events-none drop-shadow-sm transition-all duration-300" style={{ opacity: 0.45, filter: 'blur(0.3px) saturate(0.9)' }} viewBox="0 0 100 100">
    {/* Sombras y hojas de fondo */}
    <path d="M100 100 C 80 40 40 50 30 70 C 50 75 80 85 100 100" fill="#244220" />
    <path d="M100 100 C 60 20 20 30 10 50 C 40 55 80 80 100 100" fill="#1C3818" />
    {/* Hojas principales */}
    <path d="M100 100 C 70 50 30 70 20 80 C 40 85 70 95 100 100" fill="#3A6B35" />
    <path d="M100 100 C 60 30 20 50 10 70 C 40 75 80 90 100 100" fill="#4B7E45" />
    <path d="M100 100 C 80 10 40 30 30 50 C 60 60 90 80 100 100" fill="#295424" />
    {/* Brotes iluminados */}
    <path d="M100 100 C 40 10 10 40 0 60 C 30 70 80 90 100 100" fill="#6B8E23" />
    <path d="M100 100 C 50 0 20 30 15 50 C 40 60 85 85 100 100" fill="#8FBC8F" />
  </svg>
);

const LeftPlants = () => (
    <svg className="absolute -bottom-1 -left-2 w-[60px] h-[60px] pointer-events-none drop-shadow-sm transition-all duration-300" style={{ opacity: 0.45, filter: 'blur(0.3px) saturate(0.9)', transform: 'scaleX(-1)' }} viewBox="0 0 100 100">
      <path d="M100 100 C 80 40 40 50 30 70 C 50 75 80 85 100 100" fill="#244220" />
      <path d="M100 100 C 70 50 30 70 20 80 C 40 85 70 95 100 100" fill="#3A6B35" />
      <path d="M100 100 C 60 30 20 50 10 70 C 40 75 80 90 100 100" fill="#4B7E45" />
    </svg>
);

const paperTexture = "url('https://www.transparenttextures.com/patterns/paper.png')";

export default function SocioHomeContent() {
    const { user } = useAuth();
    return (
        <div className="pb-4">
            {/* Grid de Accesos Rápidos */}
            <div className="grid grid-cols-2 gap-[14px]">
                {/* 1. Agenda Rural */}
                <Link 
                    to="/eventos" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group shadow-[0px_6px_18px_rgba(0,0,0,0.08)]"
                    style={{
                        backgroundColor: `rgba(255,255,255,0.7)`,
                        backgroundImage: paperTexture,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <PlantsCorner />
                    <LeftPlants />
                    
                    <div className="relative z-10 w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 text-white shrink-0 bg-[#3A6B35] transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>calendar_month</span>
                    </div>
                    
                    <div className="relative z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Agenda Rural</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Conocé los próximos eventos y actividades.</p>
                    </div>
                </Link>

                {/* 2. Beneficios del Socio */}
                <Link 
                    to="/promociones" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group shadow-[0px_6px_18px_rgba(0,0,0,0.08)]"
                    style={{
                        backgroundColor: `rgba(255,255,255,0.7)`,
                        backgroundImage: paperTexture,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <PlantsCorner />
                    
                    <div className="relative z-10 w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 text-white shrink-0 bg-[#8B5E3C] transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24", transform: 'scaleX(-1) rotate(45deg)'}}>sell</span>
                    </div>
                    
                    <div className="relative z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Beneficios del Socio</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Accedé a todos los beneficios y promociones.</p>
                    </div>
                </Link>

                {/* 3. Aportes / Cuotas */}
                <Link 
                    to="/cuotas" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group shadow-[0px_6px_18px_rgba(0,0,0,0.08)]"
                    style={{
                        backgroundColor: `rgba(255,255,255,0.7)`,
                        backgroundImage: paperTexture,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <LeftPlants />
                    
                    <div className="relative z-10 w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 text-white shrink-0 bg-[#8B5E3C] transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>account_balance_wallet</span>
                    </div>
                    
                    <div className="relative z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Aportes / Cuotas</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Consultá y gestioná tus cuotas.</p>
                    </div>
                </Link>

                {/* 4. Credencial Rural */}
                <Link 
                    to="/carnet" 
                    className="relative overflow-hidden flex flex-col items-center justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group shadow-[0px_6px_18px_rgba(0,0,0,0.08)]"
                    style={{
                        backgroundColor: `rgba(255,255,255,0.7)`,
                        backgroundImage: paperTexture,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        minHeight: '160px'
                    }}
                >
                    <WoodFence />
                    <PlantsCorner />
                    
                    <div className="relative z-10 w-[56px] h-[56px] rounded-full flex items-center justify-center mb-2 text-white shrink-0 bg-[#3A6B35] transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[28px]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>badge</span>
                    </div>
                    
                    <div className="relative z-10 w-full text-center flex flex-col items-center">
                        <h3 className="text-[18px] font-semibold text-[#2F3E2F] leading-tight font-display">Ñande Pasaporte</h3>
                        <div className="w-4 h-[2px] bg-[#2F3E2F]/20 my-1.5 rounded-full" />
                        <p className="text-[13px] text-[#6B6B6B] leading-tight">Tu credencial digital siempre a mano.</p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
