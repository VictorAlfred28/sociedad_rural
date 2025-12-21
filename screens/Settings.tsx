
import React, { useState } from 'react';

const Settings: React.FC = () => {
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setDarkMode(isDark);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-black mb-2 dark:text-white">Configuración</h1>
        <p className="text-text-secondary">Personaliza tu experiencia en la plataforma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-8 shadow-sm">
          <h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">visibility</span>
            Preferencias de Apariencia
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-xl">
              <div>
                <p className="font-bold dark:text-white">Modo Oscuro</p>
                <p className="text-xs text-gray-500">Activar para entornos de poca luz</p>
              </div>
              <button 
                onClick={toggleDarkMode}
                className={`w-14 h-7 rounded-full relative transition-colors duration-300 ${darkMode ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 bg-white rounded-full size-5 shadow-lg transition-all duration-300 ${darkMode ? 'left-8' : 'left-1'}`}></span>
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-xl">
              <div>
                <p className="font-bold dark:text-white">Idioma</p>
                <p className="text-xs text-gray-500">Español (Latinoamérica)</p>
              </div>
              <span className="material-symbols-outlined text-gray-400">translate</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-8 shadow-sm">
          <h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">notifications_active</span>
            Notificaciones
          </h3>
          <div className="space-y-4">
             {[
               { label: "Alertas de Cuota", desc: "Recibir recordatorios de vencimiento", checked: true },
               { label: "Nuevos Eventos", desc: "Avisar sobre próximas ferias y exposiciones", checked: true },
               { label: "Resumen Semanal", desc: "Recibir novedades por email", checked: false },
             ].map((item, i) => (
               <div key={i} className="flex items-center justify-between p-4">
                 <div>
                   <p className="font-bold text-sm dark:text-white">{item.label}</p>
                   <p className="text-xs text-gray-500">{item.desc}</p>
                 </div>
                 <input type="checkbox" defaultChecked={item.checked} className="rounded-md text-primary focus:ring-primary h-5 w-5" />
               </div>
             ))}
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-4">
         <button className="px-6 py-2 font-bold text-gray-500 hover:text-text-main transition">Cancelar</button>
         <button className="bg-primary text-black font-bold px-8 py-2 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform">Guardar Cambios</button>
      </div>
    </div>
  );
};

export default Settings;
