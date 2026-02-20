import React, { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import { AuditLog } from '../types';
import { Clock, Shield, Loader2 } from 'lucide-react';

export const Audit = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await ApiService.auditoria.getAll();
        setLogs(data);
      } catch (error) {
        console.error("Error fetching audit logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold text-rural-green">Auditoría de Seguridad</h2>
        <p className="text-gray-500">Registro inmutable de acciones en el sistema.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
          <Shield className="w-5 h-5 text-rural-green" />
          <h3 className="font-semibold text-gray-800">Últimos movimientos registrados</h3>
        </div>
        
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-rural-green" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
               <div className="p-6 text-center text-gray-500">No hay registros de auditoría.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-4">
                  <div className="flex items-start gap-3 w-full md:w-1/4">
                    <div className="mt-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">IP: {log.ip}</p>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                         {log.accion}
                       </span>
                       <span className="text-sm font-medium text-gray-700">por {log.usuario_nombre}</span>
                    </div>
                    <p className="text-sm text-gray-600">{log.detalle}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};