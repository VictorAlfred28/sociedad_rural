import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Users, DollarSign, Store, Activity, Loader2 } from 'lucide-react';
import { mockRevenueData } from '../services/mockData'; // Mantenemos revenue mock hasta tener tabla de cuotas llena
import { ApiService } from '../services/api';
import { DashboardStats } from '../types';

const StatCard = ({ icon: Icon, title, value, color }: { icon: any, title: string, value: string, color: string }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800 font-serif">{value}</h3>
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await ApiService.dashboard.getStats();
        setStats(data);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-rural-green" /></div>;
  }

  const safeStats = stats || { sociosActivos: 0, sociosPendientes: 0, recaudacionMensual: 0, comerciosAdheridos: 0 };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-serif font-bold text-rural-green mb-2">Tablero General</h2>
        <p className="text-gray-500">Resumen de actividad de la Sociedad Rural</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Users} 
          title="Socios Activos" 
          value={safeStats.sociosActivos.toLocaleString()} 
          color="bg-rural-green" 
        />
        <StatCard 
          icon={Activity} 
          title="Solicitudes Pendientes" 
          value={safeStats.sociosPendientes.toString()} 
          color="bg-rural-gold" 
        />
        <StatCard 
          icon={DollarSign} 
          title="Recaudación Mes" 
          value={`$${(safeStats.recaudacionMensual / 1000000).toFixed(1)}M`} 
          color="bg-rural-brown" 
        />
        <StatCard 
          icon={Store} 
          title="Comercios Adheridos" 
          value={safeStats.comerciosAdheridos.toString()} 
          color="bg-blue-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6 font-serif">Evolución de Recaudación</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockRevenueData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B4332" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1B4332" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} tickFormatter={(value) => `$${value/1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Recaudación']}
                />
                <Area type="monotone" dataKey="value" stroke="#1B4332" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6 font-serif">Actividad Reciente</h3>
          <div className="space-y-6">
            <div className="text-sm text-gray-500 text-center py-8">
              Conectando con registros en tiempo real...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};