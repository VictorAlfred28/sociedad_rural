import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StatCard } from '../components/StatCard';

const Payments: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'approved') {
      setShowSuccess(true);
      // Optional: Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {showSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">¡Pago Exitoso! </strong>
          <span className="block sm:inline">Muchas gracias por tu pago. Se ha registrado correctamente.</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setShowSuccess(false)}>
            <svg className="fill-current h-6 w-6 text-green-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" /></svg>
          </span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-text-main dark:text-white">Reporte de Pagos</h1>
          <p className="text-text-secondary">Historial detallado de tus transacciones y cuotas.</p>
        </div>
        <button className="bg-primary px-4 py-2 rounded-xl font-bold text-black flex items-center gap-2 shadow-lg shadow-primary/20 transition hover:scale-105">
          <span className="material-symbols-outlined">download</span> Exportar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Pagado" value="$ 125.000" icon="payments" trend="+5%" colorClass="text-primary" />
        <StatCard title="Pendientes" value="$ 15.000" icon="pending" trend="Vence pronto" colorClass="text-yellow-500" />
        <StatCard title="Último Pago" value="$ 12.500" icon="check_circle" trend="OK" colorClass="text-primary" />
      </div>

      {/* Payment Action Card */}
      <div className="bg-[#009ee3] rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="size-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <img src="https://logotipoz.com/wp-content/uploads/2021/10/versiones-logo-mercado-pago.jpg" alt="MP" className="size-12 object-contain" />
            </div>
            <div>
              <p className="text-white/80 font-medium mb-1">Cuota Mensual - Marzo 2024</p>
              <h2 className="text-4xl font-black">$ 15.000</h2>
              <p className="text-sm text-white/70 mt-1">Vence el 10/03/2024</p>
            </div>
          </div>
          <button
            onClick={() => {
              const paymentLink = import.meta.env.VITE_MP_PAYMENT_LINK;
              if (paymentLink) {
                window.open(paymentLink, '_blank');
              } else {
                alert('Link de pago no configurado en .env');
              }
            }}
            className="bg-white text-[#009ee3] px-8 py-4 rounded-xl font-black text-lg shadow-lg hover:bg-gray-50 transition-transform active:scale-95 flex items-center gap-2"
          >
            Pagar ahora
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h3 className="font-bold dark:text-white">Historial de Transacciones</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-black/20 border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider">Método</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-right">Monto</th>
                <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {[
                { date: "12/05/2024", name: "Cuota Socios Mayo", method: "Mercado Pago", amount: "$ 12.500", status: "Pagado", color: "green" },
                { date: "10/04/2024", name: "Cuota Socios Abril", method: "Transferencia", amount: "$ 12.500", status: "Pagado", color: "green" },
                { date: "08/03/2024", name: "Inscripción Evento Expo", method: "Efectivo", amount: "$ 5.000", status: "Pagado", color: "green" },
                { date: "15/02/2024", name: "Cuota Socios Febrero", method: "Mercado Pago", amount: "$ 10.000", status: "Pagado", color: "green" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium dark:text-gray-300">{row.date}</td>
                  <td className="px-6 py-4 font-bold dark:text-white">{row.name}</td>
                  <td className="px-6 py-4 text-gray-500">{row.method}</td>
                  <td className="px-6 py-4 text-right font-black dark:text-white">{row.amount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Payments;
