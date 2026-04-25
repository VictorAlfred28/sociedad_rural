import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

interface CuotaConfig {
  id?: string;
  rol: string;
  monto: number;
  ultima_actualizacion?: string;
}

export default function GestionAranceles() {
  const { token } = useAuth();
  const [cuotas, setCuotas] = useState<CuotaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCuotas();
  }, []);

  const fetchCuotas = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/cuotas/valores`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok && data.cuotas) {
        setCuotas(data.cuotas);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar los aranceles');
    } finally {
      setLoading(false);
    }
  };

  const handleMontoChange = (rol: string, nuevoMonto: string) => {
    setCuotas(prev => prev.map(c => 
      c.rol === rol ? { ...c, monto: parseFloat(nuevoMonto) || 0 } : c
    ));
  };

  const guardarCambios = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/cuotas/valores`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cuotas: cuotas.map(c => ({ rol: c.rol, monto: c.monto })) })
      });
      if (resp.ok) {
        toast.success('Aranceles actualizados correctamente');
        fetchCuotas(); // Refrescar para ver la fecha de actualización
      } else {
        toast.error('Error al actualizar aranceles');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión al guardar');
    } finally {
      setSaving(false);
    }
  };

  const getIconForRol = (rol: string) => {
    switch(rol.toUpperCase()) {
      case 'SOCIO': return 'person';
      case 'COMERCIO': return 'storefront';
      case 'ESTUDIANTE': return 'local_library';
      case 'CAMARA': return 'domain';
      default: return 'payments';
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-admin-text">Cargando aranceles...</div>;
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center size-12 rounded-xl bg-admin-accent/10 border border-admin-accent/20">
          <span className="material-symbols-outlined text-admin-accent text-2xl">account_balance_wallet</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight">Gestión de Aranceles</h2>
          <p className="text-sm text-slate-400">Configura los valores de las cuotas para cada tipo de perfil</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4">
        {cuotas.map((cuota) => (
          <div key={cuota.rol} className="bg-admin-card border border-admin-border rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-admin-accent/50 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-admin-accent/5 rounded-full blur-[40px] pointer-events-none -translate-y-1/2 translate-x-1/3 group-hover:bg-admin-accent/10 transition-colors" />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-admin-bg border border-admin-border flex items-center justify-center text-admin-text">
                  <span className="material-symbols-outlined">{getIconForRol(cuota.rol)}</span>
                </div>
                <div>
                  <h3 className="font-bold text-admin-text tracking-widest text-sm">{cuota.rol}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Cuota Mensual</p>
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Monto Vigente ($)</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-admin-text font-bold">$</span>
                <input
                  type="number"
                  value={cuota.monto}
                  onChange={(e) => handleMontoChange(cuota.rol, e.target.value)}
                  className="w-full bg-admin-bg border border-admin-border text-admin-text rounded-xl py-3 pl-8 pr-4 font-mono font-bold text-lg focus:outline-none focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-all"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-admin-border/50 relative z-10 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-slate-500">update</span>
              <span className="text-[10px] text-slate-500 font-medium">
                Últ. act: {cuota.ultima_actualizacion ? new Date(cuota.ultima_actualizacion).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={guardarCambios}
          disabled={saving}
          className="flex items-center gap-2 bg-admin-accent hover:bg-admin-accent/80 text-black font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-admin-accent/20"
        >
          <span className="material-symbols-outlined">save</span>
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}
