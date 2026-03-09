import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import logo from '../assets/logo.jpg'; // Asegurando que exista el logo

interface SocioValidado {
  valido: boolean;
  mensaje: string;
  socio?: {
    id: string;
    nombre_apellido: string;
    dni: string;
    estado: string;
    municipio: string;
  };
}

export default function ValidaSocioPublico() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SocioValidado | null>(null);

  useEffect(() => {
    const validar = async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/valida-socio/${id}`);
        const data = await resp.json();
        
        if (!resp.ok) {
          setResult({
            valido: false,
            mensaje: data.detail || 'Código QR inválido o no encontrado.'
          });
          return;
        }

        setResult(data as SocioValidado);

      } catch (err: any) {
        setResult({
          valido: false,
          mensaje: 'Error de conexión al validar.'
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      validar();
    } else {
      setResult({ valido: false, mensaje: 'ID de socio no proporcionado.' });
      setLoading(false);
    }
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <div className="absolute top-0 w-full h-1/3 bg-gradient-to-b from-primary/20 to-transparent"></div>

      <div className="z-10 bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden text-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="font-bold text-slate-500 uppercase tracking-widest text-sm text-center">Validando Socio...</p>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center w-full">
            <div className={`absolute top-0 left-0 right-0 h-3 ${result.valido ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            
            <img src={logo} alt="Sociedad Rural" className="w-20 h-20 rounded-2xl shadow-md mb-6 object-cover" />

            <span className={`material-symbols-outlined text-7xl mb-4 ${result.valido ? 'text-emerald-500' : 'text-red-500'}`}>
              {result.valido ? 'verified' : 'cancel'}
            </span>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase">
              {result.valido ? 'SOCIO VALIDADO' : 'CARNET INVÁLIDO'}
            </h2>

            <p className={`text-sm font-bold w-full m-4 p-3 rounded-xl border ${result.valido ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {result.mensaje}
            </p>

            {result.socio && (
              <div className="bg-slate-50 dark:bg-slate-900 w-full p-5 rounded-2xl mt-2 mb-6 text-left border border-slate-100 dark:border-slate-700 shadow-inner">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 font-bold">Datos del Socio</p>
                <p className="font-bold text-slate-900 dark:text-white text-lg uppercase leading-tight">{result.socio.nombre_apellido}</p>
                <p className="text-slate-600 dark:text-slate-300 font-mono mt-2 text-sm">DNI/CUIT: {result.socio.dni || 'No provisto'}</p>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md uppercase">
                    {result.socio.municipio || 'Sin Municipio'}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1.5 rounded-md uppercase ${result.socio.estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                    ESTADO: {result.socio.estado}
                  </span>
                </div>
              </div>
            )}
            
            <Link to="/" className="mt-4 w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 text-center uppercase tracking-wider text-sm">
              Ir a la App
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
