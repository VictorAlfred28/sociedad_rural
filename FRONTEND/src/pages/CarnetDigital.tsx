import { useState } from 'react';
import BottomNav from '../components/BottomNav';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';

export default function CarnetDigital() {
  const { user: authUser } = useAuth();
  const [isSimulatingDebt, setIsSimulatingDebt] = useState(false);

  if (!authUser) return null;

  // Si estamos simulando, sobreescribimos los datos del socio
  const user = isSimulatingDebt ? {
    ...authUser,
    nombre_apellido: "CARLOS MÉNDEZ (SIMULACIÓN)",
    dni: "10123456",
    estado: "RESTRINGIDO"
  } : authUser;

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

  // El QR codifica una URL para que pueda ser leída por cualquier lector y muestre algo con sentido,
  // pero nuestro escáner interno extraerá el ID para validarlo rápido.
  const qrData = encodeURIComponent(`https://sociedadruraldelnorte.agentech.ar/valida-socio/${user.id}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden mx-auto max-w-[430px] shadow-2xl pb-28">
      <div className="flex items-center p-6 pb-2 justify-between z-10">
        <Link to="/home" className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center justify-center rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700">
          <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
        </Link>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Membresía Digital</span>
          <h2 className="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight">SOCIEDAD RURAL</h2>
        </div>
        <button
          onClick={() => setIsSimulatingDebt(!isSimulatingDebt)}
          className={`size-10 flex items-center justify-center rounded-full border transition-all ${isSimulatingDebt ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
          title="Simular Deuda"
        >
          <span className="material-symbols-outlined text-xl">{isSimulatingDebt ? 'warning' : 'science'}</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
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
                  <p className="text-sm font-bold uppercase">2024</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENEDOR DEL CÓDIGO QR */}
        <div className="flex flex-col items-center mt-6 mb-8">
          <div className="relative group">
            {user.estado === 'APROBADO' && (
              <div className="absolute -inset-4 bg-emerald-500/20 rounded-3xl animate-pulse"></div>
            )}
            <div className={`bg-white p-4 rounded-2xl shadow-xl relative ring-2 ${user.estado === 'APROBADO' ? 'ring-emerald-500/50 shadow-emerald-500/20' : 'ring-slate-200 shadow-slate-200'}`}>
              <img
                alt="QR Code"
                className={`w-40 h-40 ${user.estado !== 'APROBADO' ? 'opacity-30 grayscale' : ''}`}
                src={qrUrl}
              />
              {user.estado !== 'APROBADO' && (
                <div className="absolute inset-0 flex items-center justify-center">
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
              ID único de socio
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
      <BottomNav />
    </div>
  );
}

