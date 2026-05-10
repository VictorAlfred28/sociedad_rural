import { useState } from 'react';
import ValidacionPagos from './ValidacionPagos';
import RecordatoriosPago from './RecordatoriosPago';
import GestionAranceles from './GestionAranceles';

type TabId = 'pendientes' | 'aranceles' | 'recordatorios';

export default function GestionPagos({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [activeTab, setActiveTab] = useState<TabId>('pendientes');

  const tabs = [
    { id: 'pendientes', label: 'Comprobantes', icon: 'payments' },
    { id: 'aranceles', label: 'Cuotas', icon: 'account_balance_wallet' },
    ...(isSuperadmin ? [{ id: 'recordatorios', label: 'Recordatorios Automáticos', icon: 'notifications_active' }] : [])
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <div className="flex items-center justify-center size-12 rounded-xl bg-admin-accent/10 border border-admin-accent/20">
          <span className="material-symbols-outlined text-admin-accent text-2xl">account_balance</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-admin-text tracking-tight">Gestión de Pagos</h2>
          <p className="text-sm text-slate-400">Control unificado de ingresos, aranceles y recordatorios</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-admin-border pb-4 overflow-x-auto admin-scroll shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-admin-accent text-black shadow-lg shadow-admin-accent/20'
                : 'bg-admin-card border border-admin-border text-slate-400 hover:text-admin-text hover:border-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto admin-scroll pb-10">
        {activeTab === 'pendientes' && <ValidacionPagos />}
        {activeTab === 'aranceles' && <GestionAranceles />}
        {activeTab === 'recordatorios' && isSuperadmin && <RecordatoriosPago />}
      </div>
    </div>
  );
}
