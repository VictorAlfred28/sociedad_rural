
import React from 'react';

const Forum: React.FC = () => {
  const topics = [
    { title: "Reunión anual de socios: Agenda", author: "Administración", type: "Oficial", replies: 42, views: "3.5k", time: "Hace 2 horas" },
    { title: "¿Recomendaciones para trigo tardío?", author: "María González", type: "Agricultura", replies: 15, views: "234", time: "Hace 5 horas" },
    { title: "Vendo Sembradora Directa 12 surcos", author: "Carlos Ruiz", type: "Compra/Venta", replies: 8, views: "890", time: "Ayer" },
    { title: "Problemas con el riego en zona norte", author: "Jorge Blanco", type: "Clasificados", replies: 3, views: "112", time: "Ayer" },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-surface-light dark:bg-surface-dark">
        <h1 className="text-2xl font-bold dark:text-white">Foro de Socios</h1>
        <button className="bg-primary text-black px-4 py-2 rounded-xl font-bold text-sm flex gap-2 items-center">
          <span className="material-symbols-outlined">add</span> Nuevo Tema
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-border-light dark:border-border-dark bg-gray-50 dark:bg-black/20 p-4 hidden md:block">
          <h3 className="text-xs font-bold uppercase text-gray-500 mb-4">Categorías</h3>
          <div className="space-y-1">
            {["General", "Clasificados", "Maquinaria", "Eventos", "Consultas"].map(cat => (
              <div key={cat} className="px-3 py-2 rounded-lg hover:bg-primary/10 hover:text-primary cursor-pointer text-sm font-medium dark:text-gray-300 transition-colors">
                {cat}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
          {topics.map((topic, i) => (
            <div key={i} className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-border-light dark:border-border-dark hover:border-primary transition cursor-pointer shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wider ${topic.type === 'Oficial' ? 'bg-primary text-black' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{topic.type}</span>
                <span className="text-xs text-gray-400 font-medium">{topic.time}</span>
              </div>
              <h3 className="font-bold text-xl dark:text-white mb-2 leading-tight">{topic.title}</h3>
              <p className="text-sm text-gray-500 mb-4">Iniciado por <span className="font-bold text-text-secondary">{topic.author}</span></p>
              <div className="flex gap-6 text-xs text-gray-400 font-bold border-t border-border-light dark:border-border-dark pt-4">
                <span className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-sm">chat_bubble</span> {topic.replies} respuestas</span>
                <span className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-sm">visibility</span> {topic.views} vistas</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Forum;
