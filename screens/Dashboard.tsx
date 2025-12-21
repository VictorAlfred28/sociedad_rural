
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { supabase } from '../services/supabaseClient';

const Dashboard: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(data || { email: user.email });
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const userName = profile?.full_name || profile?.email || 'Socio';

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <span className="material-symbols-outlined">wb_sunny</span>
            <span className="text-sm font-bold uppercase">Buenos días</span>
          </div>
          <h1 className="text-4xl font-black dark:text-white">
            {loading ? '...' : `Hola, ${userName}`}
          </h1>
        </div>
        <button className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark px-4 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">notifications</span> Novedades
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Digital ID Widget */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-[#1b3a24] p-8 text-white shadow-xl min-h-[300px] flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-primary">badge</span>
              <div>
                <h2 className="font-bold text-xl">Carnet Digital</h2>
                <p className="text-green-100 text-xs">Identificación Oficial</p>
              </div>
            </div>
            <span className="bg-primary px-3 py-1 rounded-full text-xs font-bold text-black">ACTIVO</span>
          </div>
          <div className="relative z-10 mt-8">
            <h3 className="text-4xl font-black">{loading ? '...' : userName}</h3>
            <p className="font-mono mt-2 text-green-100">
              ID: {profile?.id?.slice(0, 8) || '...'} • Vence: 12/2025
            </p>
          </div>
          <div className="relative z-10 mt-8 flex gap-4">
            <Link to="/digital-id" className="bg-white text-green-900 px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-100 transition">
              <span className="material-symbols-outlined">visibility</span> Ver Carnet
            </Link>
          </div>
        </div>

        {/* Status Widget */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 border border-border-light dark:border-border-dark flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg dark:text-white">Estado de Cuota</h3>
            <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
          </div>
          <div className="text-center py-6">
            <div className="text-4xl font-black text-text-main dark:text-white mb-2 flex items-center justify-center gap-2">
              <span className="size-3 rounded-full bg-primary animate-pulse"></span> Al día
            </div>
            <p className="text-sm text-gray-500">Febrero 2024</p>
          </div>
          <Link to="/payments" className="w-full bg-gray-100 dark:bg-gray-800 text-center text-text-main dark:text-white font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition">
            Ver Historial
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Eventos", val: "3", icon: "event" },
          { label: "Beneficios", val: "12", icon: "local_offer" },
          { label: "Consultas", val: "0", icon: "support_agent" },
          { label: "Documentos", val: "5", icon: "folder" }
        ].map((item, i) => (
          <div key={i} className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark flex items-center gap-3">
            <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">{item.icon}</span>
            </div>
            <div>
              <p className="font-bold text-xl dark:text-white">{item.val}</p>
              <p className="text-xs text-gray-500 uppercase font-bold">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
