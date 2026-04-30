import React from 'react';
import { Link } from 'react-router-dom';

const paperTexture = "url('https://www.transparenttextures.com/patterns/paper.png')";

const AgendaDecor = () => (
  <svg className="absolute bottom-0 right-0 w-full h-[100px] pointer-events-none" style={{ opacity: 0.65, mixBlendMode: 'multiply' }} viewBox="0 0 200 100" preserveAspectRatio="none">
    <defs>
      <filter id="blurAgenda">
        <feGaussianBlur stdDeviation="0.8" />
      </filter>
    </defs>
    <g filter="url(#blurAgenda)">
        <path d="M0 100 L200 100 L200 75 Q 150 65 100 75 T 0 75 Z" fill="#a4b886" opacity="0.5"/>
        <path d="M40 100 L200 100 L200 85 Q 150 75 100 85 T 0 85 Z" fill="#849e62" opacity="0.6"/>
        
        <g stroke="#7b6245" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
          <line x1="20" y1="65" x2="20" y2="90" />
          <line x1="60" y1="60" x2="60" y2="85" />
          <line x1="100" y1="55" x2="100" y2="80" />
          <line x1="10" y1="75" x2="110" y2="62" />
          <line x1="10" y1="83" x2="110" y2="70" />
        </g>
        
        <g transform="translate(130, 55)" fill="#688548" opacity="0.85">
           <path d="M30 40 Q 20 20 25 10 Q 35 20 30 40" />
           <path d="M30 40 Q 45 25 40 10 Q 30 20 30 40" />
           <path d="M30 40 Q 30 20 30 5" stroke="#4a6331" strokeWidth="1.5" />
        </g>
        <g transform="translate(160, 50) scale(1.1)" fill="#84a65c" opacity="0.8">
           <path d="M20 45 Q 5 25 10 10 Q 25 25 20 45" />
           <path d="M20 45 Q 35 25 30 10 Q 20 25 20 45" />
        </g>
    </g>
  </svg>
);

const BeneficiosDecor = () => (
  <svg className="absolute bottom-0 right-0 w-[120px] h-[120px] pointer-events-none" style={{ opacity: 0.65, mixBlendMode: 'multiply' }} viewBox="0 0 120 120">
    <defs>
      <filter id="blurBeneficios">
        <feGaussianBlur stdDeviation="0.8" />
      </filter>
    </defs>
    <g filter="url(#blurBeneficios)">
        <path d="M0 120 L120 120 L120 90 Q 60 80 0 110 Z" fill="#d1a977" opacity="0.4"/>
        
        <path d="M100 120 Q 105 60 90 20" stroke="#8a5a2b" strokeWidth="2" fill="none" opacity="0.8" />
        
        <g fill="#b57e38" opacity="0.9">
            <path d="M98 100 Q 70 90 80 70 Q 95 80 98 100" />
            <path d="M96 70 Q 65 60 75 40 Q 90 50 96 70" />
            <path d="M92 40 Q 60 30 70 10 Q 85 20 92 40" />
        </g>
        <g fill="#9c6423" opacity="0.9">
            <path d="M99 85 Q 125 75 115 55 Q 100 65 99 85" />
            <path d="M95 55 Q 120 45 110 25 Q 95 35 95 55" />
            <path d="M91 25 Q 115 15 105 -5 Q 90 5 91 25" />
        </g>
    </g>
  </svg>
);

const AportesDecor = () => (
  <svg className="absolute bottom-0 right-0 w-full h-[100px] pointer-events-none" style={{ opacity: 0.65, mixBlendMode: 'multiply' }} viewBox="0 0 200 100" preserveAspectRatio="none">
    <defs>
      <filter id="blurAportes">
        <feGaussianBlur stdDeviation="0.8" />
      </filter>
    </defs>
    <g filter="url(#blurAportes)">
        <path d="M0 100 L200 100 L200 80 Q 100 65 0 85 Z" fill="#c49e71" opacity="0.5"/>
        <path d="M0 100 L160 100 L160 85 Q 80 75 0 95 Z" fill="#a87d4d" opacity="0.5"/>
        
        <g stroke="#6e4d2a" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
          <line x1="15" y1="70" x2="15" y2="95" />
          <line x1="55" y1="65" x2="55" y2="90" />
          <line x1="95" y1="60" x2="95" y2="85" />
          <line x1="135" y1="55" x2="135" y2="80" />
          <line x1="175" y1="50" x2="175" y2="75" />
          
          <line x1="0" y1="78" x2="190" y2="58" />
          <line x1="0" y1="88" x2="190" y2="68" />
        </g>
    </g>
  </svg>
);

const PasaporteDecor = () => (
  <svg className="absolute bottom-0 right-0 w-[130px] h-[110px] pointer-events-none" style={{ opacity: 0.65, mixBlendMode: 'multiply' }} viewBox="0 0 130 110">
    <defs>
      <filter id="blurPasaporte">
        <feGaussianBlur stdDeviation="0.8" />
      </filter>
    </defs>
    <g filter="url(#blurPasaporte)">
        <path d="M0 110 L130 110 L130 80 Q 65 85 0 110 Z" fill="#90b880" opacity="0.5"/>
        
        <g transform="translate(90, 110)" fill="#4c823b" opacity="0.9">
           <path d="M0 0 Q -30 -30 -40 -15 Q -20 -5 0 0" />
           <path d="M0 0 Q -40 -50 -50 -30 Q -25 -10 0 0" fill="#609c4c" />
           
           <path d="M0 0 Q -10 -60 -25 -65 Q -5 -30 0 0" />
           <path d="M0 0 Q 0 -80 -10 -85 Q 10 -40 0 0" fill="#609c4c" />
           
           <path d="M0 0 Q 20 -60 35 -55 Q 15 -20 0 0" />
           <path d="M0 0 Q 40 -40 50 -25 Q 20 -10 0 0" fill="#609c4c" />
        </g>
    </g>
  </svg>
);

export default function SocioHomeContent() {
    const cardStyle = {
        background: `linear-gradient(145deg, #F8F3E6 0%, #EBE2CC 100%)`,
        backgroundImage: `${paperTexture}, linear-gradient(145deg, #F6F1E3 0%, #EBE0C8 100%)`,
        backgroundBlendMode: 'overlay, normal',
        minHeight: '170px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.75)',
        border: '1px solid rgba(255,255,255,0.55)'
    };

    return (
        <div className="pb-4">
            <div className="grid grid-cols-2 gap-3.5">
                {/* 1. Agenda Rural */}
                <Link 
                    to="/eventos" 
                    className="relative overflow-hidden flex flex-col items-start justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={cardStyle}
                >
                    <AgendaDecor />
                    
                    <div className="relative z-10 w-[42px] h-[42px] rounded-full flex items-center justify-center mb-2.5 bg-[#3B5B3B] shadow-[0px_4px_8px_rgba(59,91,59,0.3)] shrink-0 transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[22px] text-[#F8F3E6]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>calendar_month</span>
                    </div>
                    
                    <div className="relative z-10 w-full flex flex-col items-start pr-1">
                        <h3 className="text-[17px] font-bold text-[#1a261a] leading-tight" style={{ fontFamily: 'Georgia, serif' }}>Agenda Rural</h3>
                        <div className="w-5 h-[2px] bg-[#3B5B3B] my-2" />
                        <p className="text-[12px] text-[#555] leading-[1.3]">Conocé los próximos eventos y actividades.</p>
                    </div>
                </Link>

                {/* 2. Beneficios del Socio */}
                <Link 
                    to="/promociones" 
                    className="relative overflow-hidden flex flex-col items-start justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={cardStyle}
                >
                    <BeneficiosDecor />
                    
                    <div className="relative z-10 w-[42px] h-[42px] rounded-full flex items-center justify-center mb-2.5 bg-[#8B5E34] shadow-[0px_4px_8px_rgba(139,94,52,0.3)] shrink-0 transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[22px] text-[#F8F3E6]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>sell</span>
                    </div>
                    
                    <div className="relative z-10 w-full flex flex-col items-start pr-1">
                        <h3 className="text-[17px] font-bold text-[#1a261a] leading-tight" style={{ fontFamily: 'Georgia, serif' }}>Beneficios del Socio</h3>
                        <div className="w-5 h-[2px] bg-[#8B5E34] my-2" />
                        <p className="text-[12px] text-[#555] leading-[1.3]">Accedé a todos los beneficios y promociones.</p>
                    </div>
                </Link>

                {/* 3. Aportes / Cuotas */}
                <Link 
                    to="/cuotas" 
                    className="relative overflow-hidden flex flex-col items-start justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={cardStyle}
                >
                    <AportesDecor />
                    
                    <div className="relative z-10 w-[42px] h-[42px] rounded-full flex items-center justify-center mb-2.5 bg-[#8B5E34] shadow-[0px_4px_8px_rgba(139,94,52,0.3)] shrink-0 transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[22px] text-[#F8F3E6]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>account_balance_wallet</span>
                    </div>
                    
                    <div className="relative z-10 w-full flex flex-col items-start pr-1">
                        <h3 className="text-[17px] font-bold text-[#1a261a] leading-tight" style={{ fontFamily: 'Georgia, serif' }}>Aportes / Cuotas</h3>
                        <div className="w-5 h-[2px] bg-[#8B5E34] my-2" />
                        <p className="text-[12px] text-[#555] leading-[1.3]">Consultá y gestioná tus cuotas.</p>
                    </div>
                </Link>

                {/* 4. Ñande Pasaporte */}
                <Link 
                    to="/carnet" 
                    className="relative overflow-hidden flex flex-col items-start justify-start p-4 rounded-[18px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 active:scale-95 group"
                    style={cardStyle}
                >
                    <PasaporteDecor />
                    
                    <div className="relative z-10 w-[42px] h-[42px] rounded-full flex items-center justify-center mb-2.5 bg-[#3B5B3B] shadow-[0px_4px_8px_rgba(59,91,59,0.3)] shrink-0 transform transition-transform group-hover:scale-105">
                        <span className="material-symbols-outlined text-[22px] text-[#F8F3E6]" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>badge</span>
                    </div>
                    
                    <div className="relative z-10 w-full flex flex-col items-start pr-1">
                        <h3 className="text-[17px] font-bold text-[#1a261a] leading-tight" style={{ fontFamily: 'Georgia, serif' }}>Ñande Pasaporte</h3>
                        <div className="w-5 h-[2px] bg-[#3B5B3B] my-2" />
                        <p className="text-[12px] text-[#555] leading-[1.3]">Tu credencial digital siempre a mano.</p>
                    </div>
                </Link>
            </div>
        </div>
    );
}

