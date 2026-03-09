import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegistroPaso2() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [municipiosDisponibles, setMunicipiosDisponibles] = useState<{ id: string; nombre: string }[]>([]);

  // Recupera los datos del Paso 1
  const paso1Data = location.state?.registroData || {};
  const userRole: 'SOCIO' | 'COMERCIO' = paso1Data.rol || 'SOCIO';

  const [formData, setFormData] = useState({
    municipio: '',
    direccion: '',
  });

  // Cargar lista de municipios al montar (solo necesaria para SOCIO)
  useEffect(() => {
    const fetchMunicipios = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`);
        const data = await res.json();
        if (data.municipios) setMunicipiosDisponibles(data.municipios);
      } catch (err) {
        console.error('Error cargando municipios:', err);
      }
    };
    fetchMunicipios();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Construye el payload según el rol
    const payload: Record<string, any> = {
      nombre_apellido: paso1Data.nombre_apellido,
      dni_cuit: paso1Data.dni_cuit,
      email: paso1Data.email,
      telefono: paso1Data.telefono,
      rol: userRole,
      password: paso1Data.password,
    };

    if (userRole === 'SOCIO') {
      payload.municipio = formData.municipio;
      payload.direccion = formData.direccion;
      payload.es_profesional = paso1Data.es_profesional ?? false;
    }
    // rubro ya viene de paso1Data cuando es COMERCIO
    if (userRole === 'COMERCIO' && paso1Data.rubro) {
      payload.rubro = paso1Data.rubro;
    }

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) throw new Error(data.detail || 'Error al completar el registro');

      // Limpiar cualquier sesión previa (ej: Admin registrando socio) para evitar confusión de roles
      logout();
      navigate('/registro-exitoso');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    'w-full h-14 pl-12 pr-10 rounded-xl border border-primary/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none';

  const inputClass =
    'w-full h-14 pl-12 pr-4 rounded-xl border border-primary/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-slate-400';

  return (
    <div className="relative flex h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      {/* Header */}
      <header className="flex items-center px-4 pt-6 pb-2 justify-between">
        <Link
          to="/registro"
          className="flex items-center justify-center size-10 rounded-full hover:bg-primary/10 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-slate-100">arrow_back_ios_new</span>
        </Link>
        <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Registro</h1>
      </header>

      {/* Progress */}
      <div className="flex flex-col gap-2 px-6 py-4">
        <div className="flex justify-between items-end">
          <p className="text-slate-900 dark:text-slate-100 text-sm font-semibold">
            {userRole === 'SOCIO' ? 'Ubicación y Tipo' : 'Confirmación'}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Paso 2 de 3</p>
        </div>
        <div className="h-2 w-full rounded-full bg-primary/20">
          <div className="h-2 rounded-full bg-primary" style={{ width: '66%' }} />
        </div>
      </div>

      <main className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="pt-4 pb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {userRole === 'SOCIO' ? 'Detalles de Socio' : 'Confirmación de Comercio'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {userRole === 'SOCIO'
              ? 'Completá tu información geográfica y categoría de membresía.'
              : 'Revisá los datos antes de enviar tu solicitud de registro.'}
          </p>
        </div>

        {/* Resumen de datos Paso 1 (badge visual) */}
        <div className="mb-5 p-4 rounded-xl bg-primary/5 border border-primary/15 flex gap-3 items-start">
          <span className="material-symbols-outlined text-primary mt-0.5">
            {userRole === 'SOCIO' ? 'person' : 'storefront'}
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{paso1Data.nombre_apellido}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {userRole === 'SOCIO' ? 'DNI' : 'CUIT'}: {paso1Data.dni_cuit} · {paso1Data.email}
            </p>
            {userRole === 'COMERCIO' && paso1Data.rubro && (
              <p className="text-xs text-primary font-medium capitalize mt-0.5">
                Rubro: {paso1Data.rubro.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm font-medium">
            {errorMsg}
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>

          {/* ---- CAMPOS EXCLUSIVOS DE SOCIO ---- */}
          {userRole === 'SOCIO' && (
            <>
              {/* Municipio */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                  Localidad / Municipio
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">location_on</span>
                  <select
                    name="municipio"
                    value={formData.municipio}
                    onChange={handleChange}
                    className={selectClass}
                    required
                  >
                    <option disabled value="">Seleccioná una localidad</option>
                    {municipiosDisponibles.map((muni) => (
                      <option key={muni.id} value={muni.nombre}>{muni.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dirección */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                  Dirección Exacta
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">home_pin</span>
                  <input
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Ej: Av. Principal 123"
                    type="text"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* ---- CAMPOS EXCLUSIVOS DE COMERCIO ---- */}
          {userRole === 'COMERCIO' && (
            <div className="rounded-xl border border-primary/15 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-xl">info</span>
                <span className="text-sm font-semibold">¿Qué pasa luego del registro?</span>
              </div>
              <ul className="text-sm text-slate-600 dark:text-slate-400 flex flex-col gap-2 pl-1">
                <li className="flex gap-2 items-start">
                  <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">check_circle</span>
                  Tu solicitud quedará en estado <strong>Pendiente</strong>.
                </li>
                <li className="flex gap-2 items-start">
                  <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">check_circle</span>
                  Un administrador revisará y aprobará tu cuenta.
                </li>
                <li className="flex gap-2 items-start">
                  <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">check_circle</span>
                  Recibirás un email de confirmación al aprobar.
                </li>
              </ul>
            </div>
          )}

          {/* Botón final */}
          <div className="pt-4 pb-8">
            <button
              disabled={loading}
              className="w-full h-14 bg-primary text-slate-900 font-bold text-lg rounded-xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              type="submit"
            >
              {loading ? 'Procesando...' : 'Finalizar Registro'}
              {!loading && <span className="material-symbols-outlined">check_circle</span>}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
