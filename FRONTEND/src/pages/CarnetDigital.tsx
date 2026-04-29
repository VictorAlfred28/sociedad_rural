import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';
import mapaCorrientes from '../assets/mapa_corrientes.png';
import { motion, AnimatePresence } from 'framer-motion';

export default function CarnetDigital() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'carnet' | 'pasaporte'>('pasaporte');

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
      setDynamicQR(null); // Expira visualmente
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

  const getStatusColor = () => {
    switch (user.estado) {
      case 'APROBADO': return 'bg-emerald-500';
      case 'PENDIENTE': return 'bg-orange-500';
      case 'RECHAZADO':
      case 'SUSPENDIDO':
      case 'RESTRINGIDO': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  // El QR estático ha sido removido por seguridad. Se utiliza el QR dinámico mediante generarQR().
  const pasaporteMode = viewMode === 'pasaporte';

  return (
    <div className={`relative flex min-h-screen w-full flex-col overflow-x-hidden mx-auto max-w-md shadow-2xl transition-colors duration-500 font-display ${pasaporteMode ? 'bg-[#f4eedd]' : 'bg-stone-50 dark:bg-stone-900'}`}>
      {/* Fondo con imagen sutil */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: "url('/src/assets/vaquita.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      ></div>

      <header className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-4 justify-between border-b border-stone-200/50 dark:border-stone-700/50">
        <Link to="/home" className="text-stone-800 dark:text-stone-100 flex size-10 items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-stone-800 dark:text-stone-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center font-display uppercase italic">Ñande Pasaporte</h1>
        <div className="flex w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 space-y-8 relative z-10">
        {/* Selector de Modo */}
        <div className="flex p-1 bg-stone-100 dark:bg-stone-800 rounded-[2rem] border border-stone-200/50">
          <button
            onClick={() => setViewMode('carnet')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all ${!pasaporteMode ? 'bg-[#245b31] text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <span className="material-symbols-outlined text-lg">badge</span>
            Carnet Digital
          </button>
          <button
            onClick={() => setViewMode('pasaporte')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all ${pasaporteMode ? 'bg-[#784e32] text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <span className="material-symbols-outlined text-lg">import_contacts</span>
            Pasaporte
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!pasaporteMode ? (
            <motion.div
              key="carnet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Tarjeta de Carnet */}
              <div className="relative aspect-[1.58/1] w-full rounded-[2.5rem] bg-[#f4eedd] shadow-2xl overflow-hidden border border-[#e5dfce] group">
                <div className="absolute top-0 right-0 p-8 text-[#245b31]/5 opacity-20 pointer-events-none translate-x-1/4 -translate-y-1/4">
                  <span className="material-symbols-outlined text-[180px]">eco</span>
                </div>

                <div className="absolute inset-0 p-8 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <h3 className="text-[#245b31] text-[10px] font-black uppercase tracking-[0.2em] mb-1">Sociedad Rural</h3>
                      <p className="text-stone-800 text-sm font-bold tracking-tight leading-none">Norte de Corrientes</p>
                    </div>
                    <div className="size-12 rounded-full bg-white/50 backdrop-blur-md p-1 border border-white/40 shadow-sm flex items-center justify-center">
                      <img src={logo} alt="Logo" className="w-8 h-8 object-contain grayscale opacity-60" />
                    </div>
                  </div>

                  <div className="flex items-end gap-6">
                    <div className="size-24 rounded-3xl bg-stone-200 border-4 border-white shadow-xl overflow-hidden shrink-0 relative">
                      {user?.foto_url ? (
                        <img src={user.foto_url} alt="Socio" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-300">
                          <span className="material-symbols-outlined text-stone-400 text-5xl">person</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 pb-1">
                      <h4 className="text-xl font-black text-stone-800 uppercase italic tracking-tighter leading-tight pr-2 font-display">{user?.nombre_apellido}</h4>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">DNI</span>
                          <span className="text-xs font-black text-[#245b31]">{user?.dni}</span>
                        </div>
                        <div className="w-px h-6 bg-stone-200" />
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Socio</span>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${user?.estado === 'APROBADO' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                            #{user?.numero_socio || '0000'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón QR */}
              <button
                onClick={generarQR}
                disabled={isLoadingQR}
                className="w-full py-8 rounded-[2rem] bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xl flex flex-col items-center justify-center gap-3 active:scale-95 transition-all group disabled:opacity-50"
              >
                <div className="size-20 rounded-[2.5rem] bg-[#245b31] text-white flex items-center justify-center shadow-lg shadow-[#245b31]/30 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-5xl">qr_code_2</span>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Credencial de Acceso</p>
                  <p className="text-xs font-black text-stone-700 dark:text-stone-300 mt-1 uppercase tracking-widest">
                    {isLoadingQR ? 'Generando...' : 'Tocar para validar'}
                  </p>
                </div>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="pasaporte"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pb-6"
            >
              {/* Tarjeta de Pasaporte */}
              <div className="relative aspect-[0.7/1] w-full max-w-[300px] mx-auto rounded-[3rem] bg-[#f4eedd] shadow-2xl overflow-hidden border border-[#e5dfce] group">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute top-0 right-0 p-10">
                    <span className="material-symbols-outlined text-[150px] text-[#784e32]">import_contacts</span>
                  </div>
                </div>

                <div className="absolute inset-0 p-8 flex flex-col items-center justify-between text-center">
                  <div className="w-full">
                    <div className="size-16 rounded-full bg-[#784e32] text-white flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#784e32]/30">
                      <span className="material-symbols-outlined text-4xl">verified_user</span>
                    </div>
                    <h3 className="text-2xl font-black text-[#784e32] uppercase italic tracking-tighter leading-none font-display">PASAPORTE</h3>
                    <p className="text-[#a87f5d] text-[10px] font-black uppercase tracking-[0.3em] mt-1">Correntino</p>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="size-36 rounded-[2.5rem] bg-stone-200 border-4 border-white shadow-xl overflow-hidden mx-auto">
                      {user?.foto_url ? (
                        <img src={user.foto_url} alt="Socio" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-300">
                          <span className="material-symbols-outlined text-stone-400 text-6xl">person</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-stone-800 uppercase italic tracking-tighter leading-tight font-display">{user?.nombre_apellido}</h4>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mt-1">Socio de la Sociedad Rural</p>
                    </div>
                  </div>

                  <div className="w-full pt-4 border-t border-stone-300/50 mt-4">
                    <div className="flex justify-between items-center px-2">
                      <div className="flex flex-col items-start">
                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Nº Pasaporte</span>
                        <span className="text-xs font-black text-[#784e32]">P-{user?.numero_socio || '0000'}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Emisión</span>
                        <span className="text-xs font-black text-stone-800">2024</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-stone-900 text-white shadow-xl relative overflow-hidden border border-stone-800">
                 <div className="absolute bottom-0 right-0 p-8 text-white/5 opacity-10 pointer-events-none translate-x-1/4 translate-y-1/4">
                  <span className="material-symbols-outlined text-9xl">info</span>
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a87f5d] mb-3">Identidad Rural</h4>
                <p className="text-xs text-stone-300 leading-relaxed font-medium italic">
                  Este documento digital te identifica como miembro de la Sociedad Rural y te otorga beneficios exclusivos en comercios adheridos y eventos regionales.
                </p>
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
              className="relative w-full max-w-sm bg-[#f4eedd] dark:bg-stone-900 rounded-[3rem] shadow-2xl overflow-hidden border border-[#e5dfce] dark:border-stone-800 p-8 flex flex-col items-center"
            >
              <div className="w-full text-center mb-8">
                <h3 className="text-xl font-black text-stone-800 dark:text-white uppercase italic tracking-tighter font-display">Token de Seguridad</h3>
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Este código expira en {timeLeft}s</p>
              </div>

              <div className="size-64 bg-white p-4 rounded-[2.5rem] shadow-inner border-4 border-stone-200/50 flex items-center justify-center overflow-hidden">
                {dynamicQR ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://sociedadruraldelnorte.agentech.ar/qr-valida/${dynamicQR.token}`} 
                    alt="QR Dynamic" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-30">
                    <span className="material-symbols-outlined text-6xl">timer_off</span>
                    <span className="text-[10px] font-black uppercase">Token Expirado</span>
                  </div>
                )}
              </div>

              <div className="mt-10 w-full flex flex-col gap-3">
                {dynamicQR && (
                  <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: 60, ease: "linear" }}
                      className="h-full bg-[#245b31]"
                    />
                  </div>
                )}
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="w-full py-4 rounded-2xl bg-stone-200 dark:bg-stone-800 text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-400 active:scale-95 transition-transform"
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

