import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';
import mapaCorrientes from '../assets/mapa_corrientes.png';
import { motion, AnimatePresence } from 'framer-motion';

export default function CarnetDigital() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'carnet' | 'pasaporte'>('carnet');

  // Dynamic QR States
  const [showQRModal, setShowQRModal] = useState(false);
  const [dynamicQR, setDynamicQR] = useState<{ token: string, expires_at: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoadingQR, setIsLoadingQR] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showQRModal && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && showQRModal) {
      setDynamicQR(null);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [showQRModal, timeLeft]);

  const generarQR = async () => {
    setIsLoadingQR(true);
    try {
      const tokenStr = localStorage.getItem('token') || sessionStorage.getItem('token');
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/qr/generar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenStr}` }
      });
      if (!resp.ok) throw new Error("No se pudo generar el QR");
      const data = await resp.json();
      setDynamicQR(data);
      setShowQRModal(true);
      setTimeLeft(60);
    } catch (e) {
      alert("Surgió un error obteniendo el QR");
    } finally {
      setIsLoadingQR(false);
    }
  };

  if (!user) return null;

  const pasaporteMode = viewMode === 'pasaporte';

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#f8f9fa] mx-auto max-w-md font-sans">
      <header className="sticky top-0 z-50 flex items-center bg-[#f8f9fa] px-4 py-3 justify-between">
        <Link to="/home" className="flex size-10 items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-800">
          <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
        </Link>
        <div className="flex bg-[#eef0f2] rounded-full p-1 mx-2 w-56">
          <button
            onClick={() => setViewMode('pasaporte')}
            className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-colors ${pasaporteMode ? 'bg-[#1e4c27] text-white shadow-sm' : 'bg-transparent text-gray-500'}`}
          >
            PASAPORTE
          </button>
          <button
            onClick={() => setViewMode('carnet')}
            className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-colors ${!pasaporteMode ? 'bg-[#1e4c27] text-white shadow-sm' : 'bg-transparent text-gray-500'}`}
          >
            CARNET
          </button>
        </div>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 pt-4 relative">
        <AnimatePresence mode="wait">
          {!pasaporteMode ? (
            <motion.div
              key="carnet"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center px-4"
            >
              {/* Tarjeta de Carnet */}
              <div 
                className="relative w-full aspect-[1.58/1] rounded-[1.5rem] overflow-hidden shadow-[0_15px_30px_-10px_rgba(0,0,0,0.3)] flex flex-col justify-between p-5 text-white bg-gray-900"
              >
                {/* Simulated Rural Background with Gradient Overlay */}
                <div 
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to bottom, #112a38 0%, #2b3935 40%, #524736 100%)',
                  }}
                />
                
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <p className="text-[9px] font-bold tracking-[0.1em] text-gray-200">ESTADO: {user?.estado || 'APROBADO'}</p>
                      <div className={`h-1 w-8 mt-1 rounded-full ${user?.estado === 'APROBADO' ? 'bg-[#2ecc71]' : 'bg-red-500'}`} />
                    </div>
                    <div className="bg-white rounded-[0.8rem] p-1.5 size-11 shadow-sm flex items-center justify-center">
                      <img src={logo} alt="Logo" className="w-full h-full object-contain rounded-md" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <div className="size-14 rounded-full border border-gray-400 bg-black/30 backdrop-blur-sm flex items-center justify-center shrink-0">
                      <span className="text-2xl font-bold">{user?.nombre_apellido?.charAt(0) || 'O'}</span>
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[10px] text-gray-300 font-bold tracking-widest mb-0.5">NOMBRE DEL MIEMBRO</p>
                      <p className="text-xl font-bold leading-none">{user?.nombre_apellido || 'OSCAR PERALTA'}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-2">
                    <div className="flex flex-col">
                      <p className="text-[10px] text-gray-300 font-bold tracking-widest mb-0.5">DNI / CUIT</p>
                      <p className="text-base font-bold leading-none">{user?.dni || '20456789'}</p>
                    </div>
                    <div className="flex flex-col text-right">
                      <p className="text-[10px] text-gray-300 font-bold tracking-widest mb-0.5">ALTA</p>
                      <p className="text-base font-bold leading-none">2024</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección QR */}
              <div className="mt-8 flex flex-col items-center w-full">
                <div className="bg-[#e2f3e8] p-5 rounded-[2rem] w-full max-w-[280px] relative shadow-sm">
                  <button 
                    onClick={generarQR}
                    disabled={isLoadingQR}
                    className="w-full bg-white rounded-3xl border-2 border-dashed border-[#1e4c27] py-10 flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-[#1e4c27] text-4xl">qr_code_scanner</span>
                    <p className="text-[#1e4c27] font-bold text-sm text-center leading-tight">
                      {isLoadingQR ? 'Generando...' : 'Generar QR de\nvalidación'}
                    </p>
                  </button>
                </div>
                
                <div className="mt-6 text-center">
                  <h3 className="text-sm font-bold tracking-[0.2em] text-gray-800">ID ÚNICO DE SOCIO</h3>
                  <p className="text-[13px] text-gray-500 mt-2 px-8 leading-relaxed">El comercio escaneará este QR para aplicar tus beneficios.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pasaporte"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white px-6 pt-8 pb-12 w-full min-h-[80vh] flex flex-col items-center font-sans relative"
            >
              <h1 className="text-center font-black text-4xl tracking-tighter leading-none mb-6 mt-2" style={{fontFamily: 'Impact, Arial Black, sans-serif'}}>REPUBLICA DE CORRIENTES</h1>
              
              <div className="relative mb-10 text-center w-full flex flex-col items-center">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] z-0">
                  <img src={mapaCorrientes} alt="Mapa Corrientes" className="w-[18rem] object-contain" />
                </div>
                
                <div className="relative z-10 text-[17px] font-medium leading-[1.3] text-black w-full max-w-[320px]">
                  <p>Me marea el agua ardiente</p>
                  <p>Pero ni nunca la plata</p>
                  <p>Yo me crié de alpargatas</p>
                  <p>Y así aprendí a ser consciente</p>
                  <p>Mientras tenga uñas y dientes</p>
                  <p>Puedo pelearle a la vida</p>
                  <p>Yo no soy causa perdida</p>
                  <p>Yo soy nacido en Corrientes.</p>
                  
                  <p className="mt-6 text-[14px] leading-snug px-2">
                    Juro que como correntino, sabré aguantar con entereza lo que venga, andaré a cielo abierto, sin vallas para mis sueños y pensamientos.
                  </p>
                </div>
              </div>

              <h2 className="text-center font-black text-5xl mb-8" style={{fontFamily: 'Impact, Arial Black, sans-serif'}}>DATOS</h2>

              <div className="w-full flex gap-5 px-1 max-w-[340px]">
                {/* Columna Izquierda: Formulario */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="flex flex-col">
                    <span className="text-[15px] font-bold text-black mb-1">Nombre</span>
                    <div className="border-b-[1.5px] border-black w-full h-5 text-sm flex items-end pb-0.5">{user?.nombre_apellido.split(' ')[0]}</div>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-[15px] font-bold text-black mb-1">Apellido</span>
                    <div className="border-b-[1.5px] border-black w-full h-5 text-sm flex items-end pb-0.5">{user?.nombre_apellido.split(' ').slice(1).join(' ')}</div>
                  </div>

                  <div className="flex gap-4 w-full">
                    <div className="flex flex-col w-[40%]">
                      <span className="text-[15px] font-bold text-black mb-1">DNI</span>
                      <div className="border-b-[1.5px] border-black w-full h-5 text-sm flex items-end pb-0.5">{user?.dni}</div>
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-[13px] font-bold text-black mb-1 whitespace-nowrap">Localidad/Domicilio</span>
                      <div className="border-b-[1.5px] border-black w-full h-5 text-sm flex items-end pb-0.5"></div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[15px] font-bold text-black mb-1 mt-2">SOCIO</span>
                    <div className="border-b-[1.5px] border-black w-full h-5 text-sm flex items-end pb-0.5">#{user?.numero_socio}</div>
                  </div>
                </div>

                {/* Columna Derecha: Foto y QR */}
                <div className="w-[110px] flex flex-col items-center shrink-0">
                  <div className="w-full aspect-[4/5] bg-gray-200 rounded-[0.5rem] overflow-hidden border border-gray-300 mb-4 flex items-center justify-center">
                    {user?.foto_url ? (
                      <img src={user.foto_url} alt="Socio" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-5xl text-gray-400">person</span>
                    )}
                  </div>
                  
                  <div className="w-[100px] aspect-square bg-white border-[3px] border-black p-1.5 mb-1">
                     <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${user?.dni || '000000'}`} 
                      alt="QR Static" 
                      className="w-full h-full"
                    />
                  </div>
                  
                  <div className="text-center w-full flex flex-col">
                    <span className="text-[12px] font-medium leading-none mb-0.5">Pasaporte numero</span>
                    <span className="text-[14px] text-[#cc0000] font-bold tracking-wider">{user?.numero_socio ? String(user.numero_socio).padStart(10, '0') : '0000000000'}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />

      {/* Modal QR dinámico */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQRModal(false)}
              className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center"
            >
              <div className="w-full text-center mb-6">
                <h3 className="text-xl font-black text-gray-800 tracking-tight">Código QR de Validación</h3>
                <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-widest">Expira en {timeLeft}s</p>
              </div>

              <div className="size-64 bg-white p-4 rounded-3xl shadow-sm border border-gray-200 flex items-center justify-center">
                {dynamicQR ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://sociedadruraldelnorte.agentech.ar/qr-valida/${dynamicQR.token}`} 
                    alt="QR Dynamic" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 opacity-40">
                    <span className="material-symbols-outlined text-5xl">timer_off</span>
                    <span className="text-sm font-bold uppercase tracking-widest">Expirado</span>
                  </div>
                )}
              </div>

              <div className="mt-8 w-full flex flex-col gap-4">
                {dynamicQR && (
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: 60, ease: "linear" }}
                      className="h-full bg-[#1e4c27]"
                    />
                  </div>
                )}
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="w-full py-4 rounded-xl bg-gray-100 text-sm font-black uppercase tracking-widest text-gray-700 active:scale-95 transition-transform"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

