
import React, { useState } from 'react';
import { getNearbyAgroServices } from '../services/geminiService';
import { MapsGroundingResponse } from '../types';

const Merchants: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapsResult, setMapsResult] = useState<MapsGroundingResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleAISearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setMapsResult(null);

    try {
      // Get user location
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const result = await getNearbyAgroServices(latitude, longitude, searchQuery);
        setMapsResult(result);
        setIsSearching(false);
      }, (err) => {
        console.error(err);
        setIsSearching(false);
      });
    } catch (e) {
      console.error(e);
      setIsSearching(false);
    }
  };

  const localMerchants = [
    { name: "Ferretería El Campo", type: "Herramientas", promo: "15% Desc.", status: "Activo", img: "https://picsum.photos/400/300?random=10" },
    { name: "Veterinaria Rural", type: "Salud Animal", promo: "2x1 Vacunas", status: "Activo", img: "https://picsum.photos/400/300?random=11" },
    { name: "Mercado Don Pepe", type: "Alimentos", promo: "Sin Promo", status: "Pendiente", img: "https://picsum.photos/400/300?random=12" }
  ];

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black dark:text-white">Comercios Adheridos</h1>
          <p className="text-text-secondary">Encuentra beneficios exclusivos para socios.</p>
        </div>
      </div>

      {/* AI Search Bar */}
      <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border-2 border-primary/20 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined fill-1">smart_toy</span>
          <h3 className="font-bold">Buscador Inteligente de Servicios Rurales</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ej: 'Insumos agropecuarios', 'Talleres mecánicos'..."
            className="flex-1 rounded-xl border-border-light dark:border-border-dark dark:bg-black/20 focus:ring-primary focus:border-primary"
          />
          <button
            onClick={handleAISearch}
            disabled={isSearching}
            className="bg-primary text-black font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? <span className="animate-spin material-symbols-outlined">progress_activity</span> : <span className="material-symbols-outlined">map</span>}
            Buscar con Maps
          </button>
        </div>

        {mapsResult && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-black/20 rounded-xl border border-border-light dark:border-border-dark animate-in fade-in slide-in-from-top-2">
            <p className="text-sm dark:text-gray-200 mb-3 leading-relaxed">{mapsResult.text}</p>
            {mapsResult.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mapsResult.links.map((link, idx) => (
                  <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-white dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark hover:text-primary transition flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    {link.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {localMerchants.map((store, i) => (
          <div key={i} className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl overflow-hidden shadow-sm group hover:shadow-lg transition-all border-b-4 border-b-transparent hover:border-b-primary">
            <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url('${store.img}')` }}></div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg dark:text-white">{store.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${store.status === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{store.status}</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{store.type}</p>
              <div className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 w-fit px-3 py-1 rounded-lg">
                <span className="material-symbols-outlined text-lg">local_offer</span>
                {store.promo}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Merchants;
