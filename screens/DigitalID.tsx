
import React from 'react';

const DigitalID: React.FC = () => {
  return (
    <div className="p-4 sm:p-8 flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold dark:text-white">Carnet Digital</h1>
        <div className="flex gap-2">
          <button className="bg-white dark:bg-surface-dark border border-border-dark px-3 py-1.5 rounded-lg text-sm font-bold dark:text-white hover:bg-gray-50 transition">Imprimir</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="relative aspect-[1.586/1] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-between group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">eco</span>
              <div>
                <h3 className="font-bold uppercase tracking-widest text-sm dark:text-white">Sociedad Rural</h3>
                <p className="text-[10px] text-primary font-bold uppercase">Credencial Oficial</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">ACTIVO</span>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="size-24 rounded-lg bg-gray-200 bg-cover bg-center border-2 border-white shadow-md" style={{backgroundImage: 'url("https://picsum.photos/200/200?random=1")'}}></div>
            <div>
              <p className="text-xs uppercase text-gray-400 font-bold">Socio Titular</p>
              <h2 className="text-xl font-black dark:text-white">Juan Pérez</h2>
              <p className="font-mono text-gray-500">ID: 12345</p>
            </div>
          </div>
          <div className="flex justify-between items-end border-t border-dashed border-gray-300 pt-4 mt-2 relative z-10">
            <div className="text-xs text-gray-400">Vencimiento: 31/12/2024</div>
            <div className="size-12 bg-black rounded p-1">
               <div className="w-full h-full bg-white flex items-center justify-center">
                 <span className="material-symbols-outlined text-black scale-50">qr_code_2</span>
               </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark">
            <h3 className="font-bold mb-4 dark:text-white text-lg">Estado de Cuenta</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">check_circle</span>
                  <div>
                    <p className="text-sm font-bold dark:text-white">Cuota Mayo</p>
                    <p className="text-xs text-gray-500">Pagado el 05/05</p>
                  </div>
                </div>
                <span className="font-bold dark:text-white">$12.500</span>
              </div>
              <div className="p-4 border border-border-light dark:border-border-dark rounded-xl">
                 <p className="text-xs text-gray-500 mb-1">Tu próxima cuota vence en</p>
                 <p className="text-xl font-black dark:text-white">24 Días</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalID;
