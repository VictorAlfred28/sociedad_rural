import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import logo from '../assets/logo.jpg';

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

export default function ValidaQRDinamico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SocioValidado | null>(null);

  useEffect(() => {
    const validar = async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/qr/validar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await resp.json();
        
        if (!resp.ok) {
          setResult({
            valido: false,
            mensaje: data.detail || 'El código QR es inválido, ha expirado o ya fue utilizado.'
          });
          return;
        }

        setResult(data as SocioValidado);

      } catch (err: any) {
        setResult({
          valido: false,
          mensaje: 'Error de conexión al validar el código QR.'
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      validar();
    } else {
      setResult({ valido: false, mensaje: 'Token de validación no proporcionado.' });
      setLoading(false);
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <div className="absolute top-0 w-full h-1/3 bg-gradient-to-b from-primary/20 to-transparent"></div>

      <div className="z-10 bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden text-center border border-slate-100 dark:border-slate-700">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4"></div>
            <p className="font-bold text-slate-500 uppercase tracking-widest text-sm text-center">Validando Código QR...</p>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center w-full">
            <div className={`absolute top-0 left-0 right-0 h-3 ${result.valido ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            
            <div className="mb-6">
                <img src={logo} alt="Sociedad Rural" className="w-20 h-20 rounded-2xl shadow-md object-cover mx-auto" />
            </div>

            <span className={`material-symbols-outlined text-7xl mb-4 ${result.valido ? 'text-emerald-500' : 'text-red-500'}`}>
              {result.valido ? 'verified' : 'cancel'}
            </span>

            <h2 className={`text-2xl font-black mb-2 uppercase ${result.valido ? 'text-emerald-600' : 'text-red-600'}`}>
              {result.valido ? 'Socio Validado' : 'Validación Fallida'}
            </h2>

            <div className={`text-sm font-bold w-full my-4 p-4 rounded-xl border leading-relaxed ${result.valido ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {result.mensaje}
            </div>

            {result.socio && (
              <div className="bg-slate-50 dark:bg-slate-900 w-full p-5 rounded-2xl mt-2 mb-6 text-left border border-slate-100 dark:border-slate-700 shadow-inner">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 font-bold">Datos del Socio</p>
                <p className="font-black text-slate-900 dark:text-white text-xl uppercase leading-tight">{result.socio.nombre_apellido}</p>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">DNI</span>
                    <p className="text-slate-700 dark:text-slate-200 font-mono font-bold">{result.socio.dni || 'No provisto'}</p>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col flex-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Localidad</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">
                        {result.socio.municipio || 'N/A'}
                      </span>
                  </div>
                  <div className="flex flex-col flex-1 text-right">
                      <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Estado</span>
                      <span className={`text-xs font-bold uppercase ${result.socio.estado === 'APROBADO' ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {result.socio.estado}
                      </span>
                  </div>
                </div>
              </div>
            )}
            
            <p className="text-[10px] text-slate-400 uppercase font-medium mb-8">
                Este código QR es temporal y de un solo uso por seguridad.
            </p>

            <Link to="/" className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 text-center uppercase tracking-wider text-sm">
              Volver al Inicio
            </Link>
          </div>
        ) : null}
      </div>

      <p className="mt-8 text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Sociedad Rural de Corrientes
      </p>
    </div>
  );
}
