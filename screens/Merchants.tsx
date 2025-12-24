
import React, { useState, useEffect } from 'react';
import { getNearbyAgroServices } from '../services/geminiService';
import { MapsGroundingResponse } from '../types';
import { supabase } from '../services/supabaseClient';

const Merchants: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapsResult, setMapsResult] = useState<MapsGroundingResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .order('name');

      if (error) throw error;
      setMerchants(data || []);
    } catch (err) {
      console.error('Error fetching merchants:', err);
    } finally {
      setLoading(false);
    }
  };

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

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {merchants.map((store, i) => (
            <div key={store.id || i} className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl overflow-hidden shadow-sm group hover:shadow-lg transition-all border-b-4 border-b-transparent hover:border-b-primary">
              <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url('${store.image_url || 'https://picsum.photos/400/300?random=' + i}')` }}></div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg dark:text-white">{store.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800`}>Activo</span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{store.category || 'Varios'}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {store.address}, {store.city}, {store.province}
                  </div>

                  {store.discount_details && (
                    <div className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 w-fit px-3 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-lg">local_offer</span>
                      {store.discount_details}
                    </div>
                  )}
                </div>

                {store.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 border-t border-border-light dark:border-border-dark pt-3 mt-auto">{store.description}</p>
                )}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.name} ${store.address} ${store.city} ${store.province}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary rounded-xl text-xs font-bold transition-colors group/btn"
                >
                  <span className="material-symbols-outlined text-sm group-hover/btn:fill-1">map</span>
                  Ver en Mapa
                </a>
              </div>
            </div>
          ))}
          {merchants.length === 0 && (
            <div className="col-span-full text-center py-12 bg-surface-light dark:bg-surface-dark rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <span className="material-symbols-outlined text-5xl text-gray-300 mb-2">storefront</span>
              <p className="text-gray-500 font-medium">Aún no hay comercios adheridos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Merchants;
