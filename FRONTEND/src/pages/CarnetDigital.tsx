import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';
import mapaCorrientes from '../assets/mapa_corrientes.png';

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
    <div className={`relative flex min-h-screen w-full flex-col overflow-hidden mx-auto max-w-[430px] shadow-2xl pb-28 transition-colors duration-500 ${pasaporteMode ? 'bg-[#f4f2ee] dark:bg-slate-900' : 'bg-background-light dark:bg-background-dark'}`}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Jost:wght@400;500;700&display=swap');
          .font-pasaporte-title { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.05em; transform: scaleY(1.1); transform-origin: left; }
          .font-pasaporte-poem { font-family: 'Merriweather', serif; font-size: 14px; line-height: 1.5; font-weight: 500; font-style: italic; }
          .font-pasaporte-quote { font-family: 'Jost', sans-serif; font-size: 11px; }
          .font-pasaporte-data { font-family: 'Jost', sans-serif; }
        `}
      </style>

      <div className="flex items-center p-6 pb-2 justify-between z-10 relative">
        <Link to="/home" className={`flex size-10 shrink-0 items-center justify-center rounded-full backdrop-blur-sm border transition-colors ${pasaporteMode ? 'bg-black/5 border-black/10 text-slate-800 dark:text-slate-200 dark:bg-white/10 dark:border-white/20' : 'text-slate-900 dark:text-slate-100 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
          <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
        </Link>

        {/* Toggle Switch */}
        <div className={`flex p-1 rounded-full relative overflow-hidden backdrop-blur-sm shadow-inner transition-colors ${pasaporteMode ? 'bg-black/10 dark:bg-white/10' : 'bg-slate-200/50 dark:bg-slate-800/50'}`}>
          <button onClick={() => setViewMode('pasaporte')} className={`relative z-10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${pasaporteMode ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            Pasaporte Correntino
          </button>
          <button onClick={() => setViewMode('carnet')} className={`relative z-10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${!pasaporteMode ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            MINIPASAPORTE
          </button>
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#245b31] dark:bg-emerald-600 rounded-full transition-transform duration-300 ease-in-out ${pasaporteMode ? 'translate-x-1' : 'translate-x-[calc(100%+4px)]'}`}></div>
        </div>

        <div className="size-10"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
        {/* --- MODO CARNET --- */}
        <div className={`w-full flex-col items-center justify-center transition-all duration-500 ${pasaporteMode ? 'opacity-0 hidden' : 'flex opacity-100 animate-in fade-in zoom-in-95 px-2'}`}>
          <div className="w-full relative py-8" style={{ perspective: '1000px' }}>
            <div className="relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl ring-1 ring-white/20 bg-slate-900">
              <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop")' }}></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/40 to-transparent"></div>

              <div className="relative h-full w-full p-6 flex flex-col justify-between text-white">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-widest opacity-80 uppercase">
                      Estado: {user.estado}
                    </span>
                    <div className={`w-8 h-1 mt-1 rounded-full ${getStatusColor()}`}></div>
                  </div>
                  <div className="bg-white p-0.5 rounded-xl border border-white/20 overflow-hidden size-11 flex items-center justify-center shadow-lg">
                    <img src={logo} alt="Logo SR" className="w-full h-full object-cover rounded-lg scale-110" />
                  </div>
                </div>

                <div className="flex flex-row items-center gap-4">
                  <div className="w-16 h-16 rounded-full border-2 border-white/30 overflow-hidden bg-white/10 shrink-0 flex items-center justify-center text-2xl font-bold">
                    {user.foto_url ? (
                      <img src={user.foto_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      user.nombre_apellido.charAt(0)
                    )}
                  </div>
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <p className="text-xs font-medium tracking-widest opacity-70 uppercase">
                      {user.titular_id ? `${user.tipo_vinculo || 'Adherente'} Vinculado` : 'Nombre del Miembro'}
                    </p>
                    <p className="text-xl font-bold tracking-tight uppercase truncate">{user.nombre_apellido}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end mt-2">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold opacity-60 uppercase">DNI / CUIT</p>
                    <p className="text-lg font-mono font-bold tracking-tighter">{user.dni}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold opacity-60 uppercase">Alta</p>
                    <p className="text-sm font-bold uppercase">{user.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CONTENEDOR DEL CÓDIGO QR - MODO CARNET */}
          <div className="flex flex-col items-center mt-6 mb-8">
            <div className="relative group">
              {user.estado === 'APROBADO' && (
                <div className="absolute -inset-4 bg-emerald-500/20 rounded-3xl animate-pulse"></div>
              )}
              <div className={`bg-white p-5 rounded-3xl shadow-xl relative ring-2 ${user.estado === 'APROBADO' ? 'ring-emerald-500/50 shadow-emerald-500/20' : 'ring-slate-200 shadow-slate-200'} w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center`}>

                {user.estado === 'APROBADO' ? (
                  <button
                    onClick={generarQR}
                    disabled={isLoadingQR}
                    className="flex flex-col items-center justify-center gap-2 p-4 w-full h-full rounded-2xl border-2 border-dashed border-emerald-500 hover:bg-emerald-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-5xl text-emerald-600">qr_code_scanner</span>
                    <span className="font-bold text-sm text-center text-emerald-700 leading-tight">
                      {isLoadingQR ? 'Generando...' : 'Generar QR de validación'}
                    </span>
                  </button>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 rounded-3xl p-4 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">qr_code</span>
                    {user.estado === 'RESTRINGIDO' ? (
                      <div className="bg-red-500 text-white text-[10px] text-center font-bold px-3 py-2 rounded-xl uppercase tracking-wider shadow-lg transform -rotate-6 max-w-[140px] leading-tight flex flex-col items-center justify-center">
                        <span>Acceso Restringido</span>
                        <span className="text-[8px] font-medium opacity-80 mt-1">Consulte en Administración</span>
                      </div>
                    ) : (
                      <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg transform -rotate-12">
                        Inhabilitado
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center">
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 tracking-[0.3em] uppercase mb-1">
                {user.numero_socio ? `Socio N° ${user.numero_socio}` : 'ID único de socio'}
              </span>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium text-center px-8">
                {user.estado === 'APROBADO' ? (
                  'El comercio escaneará este QR para aplicar tus beneficios.'
                ) : user.estado === 'RESTRINGIDO' ? (
                  'Su membresía se encuentra temporalmente restringida por mora.'
                ) : (
                  'QR deshabilitado temporalmente hasta regularizar estado.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* --- MODO PASAPORTE --- */}
        <div className={`w-full flex-col items-center transition-all duration-500 ${!pasaporteMode ? 'opacity-0 hidden' : 'flex opacity-100 animate-in fade-in zoom-in-95 mt-4'}`}>
          <div className="w-full bg-[#faf9f6] dark:bg-slate-800 rounded-sm shadow-xl relative border border-[#e0dacd] dark:border-slate-700 pb-5 px-4 pt-6 flex flex-col items-center text-[#1a1a1a] dark:text-slate-100 overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] before:opacity-60 dark:before:opacity-10 before:pointer-events-none">

            {/* Background Watermark Image Corrientes */}
            <div className="absolute inset-0 opacity-[0.05] dark:opacity-10 pointer-events-none flex items-center justify-center z-0 scale-[1.8] translate-y-4">
              <img src={mapaCorrientes} alt="Mapa Corrientes" className="w-full h-auto object-contain" />
            </div>

            <div className="relative z-10 w-full flex flex-col items-center">
              <h1 className="font-pasaporte-title text-4xl mb-4 text-center text-black dark:text-white pb-2 border-b border-black/10 dark:border-white/10 w-full leading-none">REPUBLICA DE CORRIENTES</h1>

              <div className="font-pasaporte-poem text-center space-y-0.5 mb-6 opacity-90">
                <p>Me marea el agua ardiente</p>
                <p>Pero ni nunca la plata</p>
                <p>Yo me crié de alpargatas</p>
                <p>Y así aprendí a ser consciente</p>
                <p>Mientras tenga uñas y dientes</p>
                <p>Puedo pelearle a la vida</p>
                <p>Yo no soy causa perdida</p>
                <p>Yo soy nacido en Corrientes.</p>
              </div>

              <div className="font-pasaporte-quote text-center opacity-80 mb-6 py-3 border-t border-b border-black/10 dark:border-white/10 px-2 leading-tight">
                "Juro que como correntino, sabré aguantar con entereza lo que venga, andaré a cielo abierto, sin vallas para mis sueños y pensamientos."
              </div>

              <h2 className="font-pasaporte-title text-[28px] mb-3 tracking-widest text-black dark:text-white w-full text-center">DATOS</h2>

              <div className="w-full flex flex-row items-end justify-between gap-3 relative z-10">
                <div className="flex flex-col gap-3 flex-1 pb-1">
                  <div className="flex flex-col">
                    <span className="font-pasaporte-data text-[9px] font-bold uppercase mb-0 text-black/80 dark:text-white/80">Nombre</span>
                    <span className="border-b border-black/80 dark:border-white/80 border-dashed pb-0.5 text-sm uppercase font-bold truncate leading-none">{user.nombre_apellido.split(' ')[0] || user.nombre_apellido}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-pasaporte-data text-[9px] font-bold uppercase mb-0 text-black/80 dark:text-white/80">Apellido</span>
                    <span className="border-b border-black/80 dark:border-white/80 border-dashed pb-0.5 text-sm uppercase font-bold truncate leading-none">{user.nombre_apellido.split(' ').slice(1).join(' ') || '-'}</span>
                  </div>
                  <div className="flex flex-row gap-2">
                    <div className="flex flex-col flex-1">
                      <span className="font-pasaporte-data text-[9px] font-bold uppercase mb-0 text-black/80 dark:text-white/80">DNI</span>
                      <span className="border-b border-black/80 dark:border-white/80 border-dashed pb-0.5 text-xs uppercase font-mono font-bold leading-none">{user.dni}</span>
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="font-pasaporte-data text-[9px] font-bold uppercase mb-0 text-black/80 dark:text-white/80">Nro. Socio</span>
                      <span className="border-b border-black/80 dark:border-white/80 border-dashed pb-0.5 text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase leading-none truncate">
                        {user.numero_socio ? `N° ${user.numero_socio}` : user.estado}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-[85px] flex flex-col gap-2 shrink-0 items-center justify-end">
                  <div className="w-20 h-[90px] bg-slate-200 dark:bg-slate-700 rounded overflow-hidden shrink-0 shadow-sm border-2 border-white dark:border-slate-600 flex items-center justify-center p-0.5 box-content ring-1 ring-black/10">
                    <div className="w-full h-full bg-slate-300 dark:bg-slate-600 overflow-hidden flex items-center justify-center rounded-[2px]">
                      {user.foto_url ? (
                        <img src={user.foto_url} alt="Foto Pasaporte" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                      )}
                    </div>
                  </div>
                  <div className="w-32 h-32 bg-slate-50 dark:bg-slate-800 p-2 rounded-md shadow-inner border-2 border-slate-200 dark:border-slate-700 relative z-20 flex flex-col items-center justify-center ring-1 ring-black/5">
                    {user.estado === 'APROBADO' ? (
                      <button
                        onClick={generarQR}
                        disabled={isLoadingQR}
                        className="w-full h-full flex flex-col items-center justify-center gap-1 bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-600 rounded transition text-emerald-700 dark:text-emerald-400"
                        title="Generar QR de validación"
                      >
                        <span className="material-symbols-outlined text-3xl">qr_code_2</span>
                        <span className="font-bold text-[8px] uppercase tracking-wider text-center leading-tight">
                          {isLoadingQR ? 'Espere' : 'Generar\nValidación'}
                        </span>
                      </button>
                    ) : (
                      <div className="flex flex-col items-center justify-center opacity-60">
                        <span className="material-symbols-outlined text-red-600 font-bold text-3xl mb-1">block</span>
                        <span className="font-bold text-[8px] uppercase tracking-wider text-center leading-tight text-red-600">Inhabilitado</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-end mt-1 pr-1 border-t-2 border-black dark:border-white pt-1 mt-2">
                <div className="flex flex-col items-end">
                  <span className="font-pasaporte-data text-[7px] uppercase tracking-widest font-bold">Pasaporte Número</span>
                  <span className="font-mono text-xs text-red-700 dark:text-red-400 tracking-wider font-bold">{(user.dni + user.id.substring(0, 4)).substring(0, 10).toUpperCase()}</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
      <BottomNav />

      {/* MODAL QR DINÁMICO */}
      {showQRModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-sm p-6 shadow-2xl flex flex-col items-center relative overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <button onClick={() => setShowQRModal(false)} className="absolute top-4 right-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full w-8 h-8 flex items-center justify-center hover:text-black dark:hover:text-white transition hover:bg-slate-200 dark:hover:bg-slate-700">
              <span className="material-symbols-outlined text-sm font-bold">close</span>
            </button>

            <h2 className="text-xl font-bold uppercase tracking-tight text-slate-800 dark:text-slate-100 mt-2 mb-1 text-center">QR de Validación</h2>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 text-center uppercase tracking-widest mb-6 px-4 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-full">Uso Único (1 escaneo)</p>

            <div className="relative group mb-8 mt-2">
              {/* Animación anti captura */}
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 rounded-[2rem] animate-spin-slow opacity-30 blur-md pointer-events-none"></div>
              <div className="bg-white p-4 rounded-2xl relative z-10 shadow-xl border-4 border-slate-50 dark:border-slate-800 min-w-[240px] min-h-[240px] flex items-center justify-center">
                {dynamicQR ? (
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://sociedadruraldelnorte.agentech.ar/qr-valida/${dynamicQR.token}`} className="w-56 h-56 mix-blend-normal object-contain" alt="QR" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 flex-col gap-3">
                    <span className="material-symbols-outlined text-5xl">timer_off</span>
                    <span className="font-bold text-sm uppercase tracking-wider text-slate-500">QR Expirado</span>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full flex flex-col items-center gap-1 mb-6 bg-slate-50 dark:bg-slate-800/50 py-3 rounded-2xl">
              <span className="text-slate-500 font-medium text-[10px] uppercase tracking-widest">Tiempo Restante</span>
              <div className={`text-4xl font-mono font-black tracking-tighter ${timeLeft < 15 ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-slate-100'}`}>
                00:{timeLeft.toString().padStart(2, '0')}
              </div>
            </div>

            {!dynamicQR && (
              <button onClick={generarQR} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl uppercase tracking-wider shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xl">refresh</span>
                Regenerar QR
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

