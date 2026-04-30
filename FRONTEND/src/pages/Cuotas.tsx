import { useState, useEffect, useRef, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import paisaje from '../assets/paisaje.png';

interface Pago {
  id: string;
  socio_id: string;
  monto: number;
  fecha_vencimiento: string;
  estado_pago: 'PENDIENTE' | 'PENDIENTE_VALIDACION' | 'PAGADO' | 'RECHAZADO';
  comprobante_url?: string;
  fecha_envio_comprobante?: string;
}

export default function Cuotas() {
  const { user, token } = useAuth();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fbMsg, setFbMsg] = useState({ type: '', text: '' });
  const [montoAPagar, setMontoAPagar] = useState<number | null>(null);
  const [calculoCuota, setCalculoCuota] = useState<any>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/cuota/calcular`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await resp.json();
        if (resp.ok) {
          setMontoAPagar(data.monto || data.monto_total);
          setCalculoCuota(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (user && token) {
      fetchConfig();
      window.addEventListener('focus', fetchConfig);
      return () => window.removeEventListener('focus', fetchConfig);
    }
  }, [user, token]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPagos = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/mis-pagos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        setPagos(data.pagos);
      }
    } catch (err) {
      console.error("Error fetching pagos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPagos();
  }, [token]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFbMsg({ type: 'error', text: 'Por favor selecciona un archivo' });
      return;
    }

    setIsUploading(true);
    setFbMsg({ type: '', text: '' });

    const formData = new FormData();
    formData.append('mes', selectedMes.toString());
    formData.append('anio', selectedAnio.toString());
    formData.append('file', file);

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/pagos/subir-comprobante`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await resp.json();
      if (resp.ok) {
        setFbMsg({ type: 'success', text: 'Comprobante enviado con éxito' });
        setTimeout(() => {
          setShowUploadModal(false);
          setFile(null);
          setFbMsg({ type: '', text: '' });
          fetchPagos();
        }, 2000);
      } else {
        throw new Error(data.detail || 'Error al subir');
      }
    } catch (err: any) {
      setFbMsg({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenWallet = async (appScheme: string, packageName: string, webUrl: string) => {
    try {
      setFbMsg({ type: 'success', text: 'Abriendo app...' });
      
      if (Capacitor.isNativePlatform()) {
        const { value: canOpen } = await AppLauncher.canOpenUrl({ url: packageName });
        
        if (canOpen) {
          // En Android, usar packageName en openUrl (no scheme)
          await AppLauncher.openUrl({ url: packageName });
          setTimeout(() => setFbMsg({ type: '', text: '' }), 500);
        } else {
          setFbMsg({ type: 'success', text: 'Redirigiendo a Play Store...' });
          const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
          await AppLauncher.openUrl({ url: playStoreUrl });
          setTimeout(() => setFbMsg({ type: '', text: '' }), 500);
        }
      } else {
        window.open(webUrl, '_blank');
        setTimeout(() => setFbMsg({ type: '', text: '' }), 2000);
      }
    } catch (error) {
      console.error("Error abriendo billetera:", error);
      setFbMsg({ type: 'error', text: 'No se pudo abrir la aplicación' });
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PAGADO': return { label: 'Pagado', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' };
      case 'PENDIENTE': return { label: 'Pendiente', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' };
      case 'PENDIENTE_VALIDACION': return { label: 'Validando', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' };
      case 'RECHAZADO': return { label: 'Rechazado', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' };
      default: return { label: status, color: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col font-display bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 max-w-md mx-auto shadow-2xl overflow-x-hidden border-x border-slate-200 dark:border-slate-800">
      {/* Fondo con imagen sutil de ganadería/campo */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url(${paisaje})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      ></div>
      <div className="relative z-10 flex-1 flex flex-col">
      <header className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-4 justify-between border-b border-stone-200/50 dark:border-stone-700/50">
        <Link to="/home" className="text-stone-800 dark:text-stone-100 flex size-10 items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="text-stone-800 dark:text-stone-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center font-display uppercase italic">Aportes / Cuotas</h1>
        <div className="flex w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 space-y-6">
        {/* Resumen del Estado */}
        <section className="relative overflow-hidden rounded-[2rem] bg-[#245b31] p-6 shadow-lg border border-[#1a4425]">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4">
            <span className="material-symbols-outlined text-9xl text-white">account_balance_wallet</span>
          </div>
          <div className="relative z-10 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Estado General</p>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black font-display italic tracking-tighter">
                {user?.estado === 'RESTRINGIDO' ? 'Deuda Pendiente' : 'Al Día'}
              </h2>
              {user?.estado === 'RESTRINGIDO' && (
                <div className="size-3 rounded-full bg-red-400 animate-pulse shadow-[0_0_10px_rgba(248,113,113,0.5)]"></div>
              )}
            </div>
            <div className="mt-6 flex gap-4">
              <div className="flex-1 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Socio</p>
                <p className="text-sm font-black mt-0.5">#{user?.numero_socio || '0000'}</p>
              </div>
              <div className="flex-1 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">DNI</p>
                <p className="text-sm font-black mt-0.5">{user?.dni}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Acciones Rápidas */}
        <section className="flex gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex-1 flex flex-col items-center justify-center p-4 rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 border border-[#e5dfce] dark:border-stone-700/50 shadow-sm active:scale-95 transition-transform"
          >
            <div className="size-12 rounded-full bg-[#784e32] text-white flex items-center justify-center mb-3 shadow-sm">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-300">Pagar Cuota</span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center p-4 rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 border border-[#e5dfce] dark:border-stone-700/50 shadow-sm active:scale-95 transition-transform opacity-50">
            <div className="size-12 rounded-full bg-blue-600 text-white flex items-center justify-center mb-3 shadow-sm">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-300">Libre Deuda</span>
          </button>
        </section>

        {/* Listado Histórico */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 px-2 italic">Historial de Pagos</h3>

          {loading ? (
            <div className="flex flex-col items-center py-12 text-stone-400 gap-4">
              <span className="material-symbols-outlined text-4xl animate-spin text-emerald-600">autorenew</span>
              <p className="text-[10px] font-black uppercase tracking-widest">Cargando pagos...</p>
            </div>
          ) : pagos.length === 0 ? (
            <div className="text-center py-12 bg-[#f4eedd]/50 rounded-[2rem] border border-dashed border-[#e5dfce] flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-stone-300 mb-2">payments</span>
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest">Sin movimientos aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagos.map((pago) => {
                const status = getStatusLabel(pago.estado_pago);
                const fechaVenci = new Date(pago.fecha_vencimiento);
                const mesNombre = fechaVenci.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

                return (
                  <div key={pago.id} className="relative overflow-hidden flex flex-col rounded-[2rem] bg-[#f4eedd] dark:bg-stone-800 border border-[#e5dfce] dark:border-stone-700/50 shadow-sm transition-transform active:scale-[0.99]">
                    <div className="absolute -bottom-2 -right-2 w-16 h-16 text-[#8b755e] opacity-10 pointer-events-none">
                      <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z"/><path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z"/></svg>
                    </div>

                    <div className="flex items-center gap-4 p-5 relative z-10">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-white/20 shadow-sm text-white ${
                        pago.estado_pago === 'PAGADO' ? 'bg-emerald-600' : 'bg-red-500'
                      }`}>
                        <span className="material-symbols-outlined">
                          {pago.estado_pago === 'PAGADO' ? 'check_circle' : 'pending_actions'}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col">
                        <p className="text-[11px] font-black text-stone-800 dark:text-white uppercase tracking-tight font-display italic">{mesNombre}</p>
                        <p className="text-xs font-black text-stone-900 dark:text-white mt-0.5">${pago.monto.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${
                          pago.estado_pago === 'PAGADO' ? 'text-emerald-700 bg-emerald-500/10' : 'text-red-700 bg-red-500/10'
                        }`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                    {pago.estado_pago === 'RECHAZADO' && (
                      <div className="px-5 pb-4 relative z-10">
                        <p className="text-[9px] text-red-600 font-bold bg-red-500/5 p-3 rounded-xl border border-red-500/10 italic leading-relaxed uppercase tracking-wider">
                          * Comprobante insuficiente o ilegible. Por favor vuelva a subirlo.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal de Subida */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleUpload}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-[#245b31] dark:text-white">Pagar Cuota / Transferir</h3>
                  <button type="button" onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800/30 mb-4">
                  <h4 className="text-sm font-bold text-[#245b31] dark:text-green-400 mb-2">Paso 1: Realizá la transferencia</h4>
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    {montoAPagar !== null && (
                      <div className="mb-3 p-3 bg-white/60 dark:bg-black/20 rounded-lg border border-green-200 dark:border-green-800/40">
                        <span className="font-bold text-[#245b31] dark:text-green-400 block text-[10px] uppercase tracking-widest mb-1">Monto a transferir</span>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-2xl font-black text-slate-800 dark:text-slate-100">${montoAPagar.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="pt-2 border-t border-green-200/50 dark:border-green-800/30">
                          <span className="font-bold text-[#245b31] dark:text-green-400 block text-[10px] uppercase tracking-widest mb-1">Referencia de Pago</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {calculoCuota?.detalle?.tipo_plan === 'Grupo Familiar' ? 'Cuota Grupo Familiar' :
                             calculoCuota?.detalle?.tipo_plan === 'Socio Profesional' ? 'Cuota Socio Profesional' :
                             calculoCuota?.detalle?.tipo_plan === 'Estudiante' ? 'Cuota Estudiante' :
                             'Cuota Socio'}
                          </span>
                        </div>
                      </div>
                    )}
                    <p><span className="font-semibold text-slate-700 dark:text-slate-200">Titular:</span> ASOCIACION CIVIL RURAL DEL NOR</p>
                    <p><span className="font-semibold text-slate-700 dark:text-slate-200">CUIL:</span> 30719265754</p>
                    <p><span className="font-semibold text-slate-700 dark:text-slate-200">Tipo:</span> Cuenta corriente en pesos</p>
                    <div className="bg-white/60 dark:bg-black/20 p-2 rounded-lg mt-2 font-mono text-[11px] font-bold text-[#245b31] dark:text-green-300 flex flex-col gap-2">
                      <div className="flex justify-between items-center bg-white/60 dark:bg-black/40 px-2 py-1.5 rounded border border-green-100 dark:border-green-900/40">
                        <span>CBU: <span className="text-[#357a38] dark:text-green-400 select-all">0940024530011053490013</span></span>
                        <button type="button" onClick={() => { navigator.clipboard.writeText('0940024530011053490013'); alert('CBU copiado al portapapeles'); }} className="text-slate-400 hover:text-green-600 active:scale-95 transition-all outline-none" title="Copiar CBU">
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                      </div>
                      <div className="flex justify-between items-center bg-white/60 dark:bg-black/40 px-2 py-1.5 rounded border border-green-100 dark:border-green-900/40">
                        <span>Alias: <span className="text-[#357a38] dark:text-green-400 select-all">LAPIZ.FLAUTA.INCA</span></span>
                        <button type="button" onClick={() => { navigator.clipboard.writeText('LAPIZ.FLAUTA.INCA'); alert('Alias copiado al portapapeles'); }} className="text-slate-400 hover:text-green-600 active:scale-95 transition-all outline-none" title="Copiar Alias">
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-green-200/50 dark:border-green-800/30">
                      <p className="text-[10px] font-bold text-[#245b31] dark:text-green-400 mb-2 uppercase tracking-wider">Abrir billetera rápida:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {/* Mercado Pago */}
                        <button type="button" onClick={() => handleOpenWallet(
                          'mercadopago://',
                          'com.mercadopago.wallet',
                          'https://www.mercadopago.com.ar/'
                        )} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-[#009EE3]/50 rounded-xl transition-all active:scale-95 group w-full">
                          <img src="https://www.google.com/s2/favicons?domain=mercadopago.com.ar&sz=128" alt="Mercado Pago" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform rounded" />
                          <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 mt-1">MP</span>
                        </button>

                        {/* MasBancoCo */}
                        <button type="button" onClick={() => handleOpenWallet(
                          'bancodecorrientes://',
                          'com.bancomobile.menu',
                          'https://www.bancodecorrientes.com.ar/'
                        )} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-[#008f39]/50 rounded-xl transition-all active:scale-95 group w-full">
                          <img src="https://www.google.com/s2/favicons?domain=bancodecorrientes.com.ar&sz=128" alt="Más Banco" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform rounded" />
                          <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 mt-1 text-center leading-none">Más<br/>Banco</span>
                        </button>

                        {/* BNA+ */}
                        <button type="button" onClick={() => handleOpenWallet(
                          'bnamas://',
                          'com.banconacion.bnamas',
                          'https://www.bna.com.ar/Personas/bnamas'
                        )} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-[#0A3D73]/50 rounded-xl transition-all active:scale-95 group w-full">
                          <img src="https://www.google.com/s2/favicons?domain=bna.com.ar&sz=128" alt="BNA+" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform rounded" />
                          <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 mt-1">BNA+</span>
                        </button>

                        {/* MODO */}
                        <button type="button" onClick={() => handleOpenWallet(
                          'modo://',
                          'com.playdigital.modo',
                          'https://www.modo.com.ar/'
                        )} className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-[#00C29A]/50 rounded-xl transition-all active:scale-95 group w-full">
                          <img src="https://www.google.com/s2/favicons?domain=modo.com.ar&sz=128" alt="MODO" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform rounded" />
                          <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 mt-1">MODO</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-[#245b31] dark:text-green-400 mb-3">Paso 2: Subí tu comprobante</h4>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500">Mes</label>
                      <select
                        value={selectedMes}
                        onChange={(e) => setSelectedMes(parseInt(e.target.value))}
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-1 focus:ring-[#357a38]"
                      >
                        {[...Array(12)].map((_, i) => (
                          <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('es-ES', { month: 'long' })}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-500">Año</label>
                      <select
                        value={selectedAnio}
                        onChange={(e) => setSelectedAnio(parseInt(e.target.value))}
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-1 focus:ring-[#357a38]"
                      >
                        {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500">Archivo de Pago (JPG, PNG, PDF)</label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${file ? 'border-[#357a38] bg-green-50/50' : 'border-slate-200 hover:border-[#357a38] hover:bg-slate-50'}`}
                    >
                      {file ? (
                        <>
                          <span className="material-symbols-outlined text-3xl text-[#357a38] mb-1">check_circle</span>
                          <span className="text-xs font-bold text-slate-600 max-w-[200px] truncate">{file.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">add_photo_alternate</span>
                          <span className="text-xs text-slate-400 font-medium">Click para seleccionar archivo</span>
                        </>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.pdf"
                      />
                    </div>
                  </div>

                  {fbMsg.text && (
                    <div className={`p-3 rounded-xl text-xs font-bold text-center ${fbMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {fbMsg.text}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 h-12 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !file}
                  className="flex-[2] h-12 bg-[#357a38] text-white rounded-xl text-sm font-bold shadow-lg shadow-green-900/20 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isUploading ? <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Enviando...</> : 'Enviar Comprobante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
      </div>
    </div>
  );
}
