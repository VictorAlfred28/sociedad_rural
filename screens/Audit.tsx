
import React from 'react';

const Audit: React.FC = () => {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-primary text-4xl fill-1">shield_person</span>
        <div>
          <h1 className="text-3xl font-black dark:text-white">Auditoría del Sistema</h1>
          <p className="text-text-secondary">Registro histórico de acciones de seguridad y cambios.</p>
        </div>
      </div>
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-black/20 border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Fecha/Hora</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Usuario</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Acción</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {[
                { date: "24 Oct 14:30", user: "Maria G.", action: "Edición", detail: "Actualizó comercio 'El Roble'", color: "blue" },
                { date: "24 Oct 09:15", user: "Sistema", action: "Login", detail: "Inicio sesión Admin Juan", color: "green" },
                { date: "23 Oct 18:00", user: "Luis M.", action: "Creación", detail: "Nuevo evento creado", color: "purple" },
                { date: "22 Oct 10:20", user: "Juan P.", action: "Pago", detail: "Procesó cuota Mayo ID 123", color: "yellow" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono dark:text-gray-400">{row.date}</td>
                  <td className="px-6 py-4 font-bold dark:text-white">{row.user}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-tighter bg-gray-100 dark:bg-gray-800 dark:text-gray-300`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Audit;
