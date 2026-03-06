import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordInput } from '../components/ui/PasswordInput';

type Rol = 'SOCIO' | 'COMERCIO' | 'CAMARA';

// Campos comunes a ambos formularios (tabla profiles)
interface FormDataBase {
  email: string;
  telefono: string;
}

interface SocioFormData extends FormDataBase {
  nombre_apellido: string;
  dni_cuit: string; // mapea a 'dni' en profiles
}

interface ComercioFormData extends FormDataBase {
  nombre_comercio: string; // mapea a 'nombre_apellido' en profiles
  cuit: string;            // mapea a 'dni' en profiles
  rubro: string;
}

interface CamaraFormData {
  denominacion: string;       // Ej: "Cámara de Comercio de Santo Tomé"
  cuit: string;               // CUIT de la cámara
  municipio: string;
  provincia: string;
  responsable_nombre: string; // Nombre del responsable que solicita
  email: string;
  telefono: string;
}

export default function Registro() {
  const navigate = useNavigate();
  const [rol, setRol] = useState<Rol | null>(null);

  const [socioData, setSocioData] = useState<SocioFormData>({
    nombre_apellido: '',
    dni_cuit: '',
    email: '',
    telefono: '',
  });
  const [esProfesional, setEsProfesional] = useState(false);
  const [socioPassword, setSocioPassword] = useState('');
  const [socioConfirmPassword, setSocioConfirmPassword] = useState('');
  const [socioPasswordError, setSocioPasswordError] = useState('');

  const [comercioData, setComercioData] = useState<ComercioFormData>({
    nombre_comercio: '',
    cuit: '',
    email: '',
    telefono: '',
    rubro: '',
    direccion: '',
  });
  const [comercioPassword, setComercioPassword] = useState('');
  const [comercioConfirmPassword, setComercioConfirmPassword] = useState('');
  const [comercioPasswordError, setComercioPasswordError] = useState('');

  const [camaraData, setCamaraData] = useState<CamaraFormData>({
    denominacion: '',
    cuit: '',
    municipio: '',
    provincia: 'Corrientes',
    responsable_nombre: '',
    email: '',
    telefono: '',
  });
  const [camaraLoading, setCamaraLoading] = useState(false);
  const [camaraError, setCamaraError] = useState('');
  const [camaraEnviada, setCamaraEnviada] = useState(false);

  const handleSocioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSocioData({ ...socioData, [e.target.name]: e.target.value });
  };

  const handleComercioChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setComercioData({ ...comercioData, [e.target.name]: e.target.value });
  };

  const handleCamaraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCamaraData({ ...camaraData, [e.target.name]: e.target.value });
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();

    if (rol === 'SOCIO') {
      if (socioPassword.length < 8) {
        setSocioPasswordError('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (socioPassword !== socioConfirmPassword) {
        setSocioPasswordError('Las contraseñas no coinciden.');
        return;
      }
      setSocioPasswordError('');
      navigate('/registro-paso-2', {
        state: {
          registroData: {
            nombre_apellido: socioData.nombre_apellido,
            dni_cuit: socioData.dni_cuit,
            email: socioData.email,
            telefono: socioData.telefono,
            password: socioPassword,
            rol: 'SOCIO',
            es_profesional: esProfesional,
          },
        },
      });
    } else if (rol === 'COMERCIO') {
      setComercioPasswordError('');
      navigate('/registro-paso-2', {
        state: {
          registroData: {
            nombre_apellido: comercioData.nombre_comercio,
            dni_cuit: comercioData.cuit,
            email: comercioData.email,
            telefono: comercioData.telefono,
            rubro: comercioData.rubro,
            direccion: comercioData.direccion,
            password: 'comercio1234',
            rol: 'COMERCIO',
          },
        },
      });
    }
  };

  const handleCamaraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCamaraLoading(true);
    setCamaraError('');
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_apellido: camaraData.responsable_nombre,
          dni_cuit: camaraData.cuit,
          email: camaraData.email,
          telefono: camaraData.telefono,
          rol: 'CAMARA',
          municipio: camaraData.municipio,
          camara_denominacion: camaraData.denominacion,
          camara_provincia: camaraData.provincia,
          password: 'camara1234'
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Error al enviar la solicitud');
      setCamaraEnviada(true);
    } catch (err: any) {
      setCamaraError(err.message);
    } finally {
      setCamaraLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 p-[15px] text-base font-normal leading-normal';

  const renderField = (
    label: string,
    name: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void,
    opts?: { type?: string; placeholder?: string; hint?: string }
  ) => (
    <div className="flex flex-col gap-1 py-2">
      <label className="flex flex-col w-full">
        <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">{label}</span>
        <input
          name={name}
          value={value}
          onChange={onChange as (e: React.ChangeEvent<HTMLInputElement>) => void}
          className={inputClass}
          placeholder={opts?.placeholder}
          type={opts?.type ?? 'text'}
          required
        />
      </label>
      {opts?.hint && <p className="text-slate-500 dark:text-slate-400 text-xs px-1">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      {/* Header */}
      <div className="flex items-center p-4 pb-2 justify-between">
        {rol ? (
          <button
            type="button"
            onClick={() => setRol(null)}
            className="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
          </button>
        ) : (
          <Link to="/" className="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center cursor-pointer">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
          </Link>
        )}
        <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-12">
          Registro
        </h2>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-6 justify-between">
          <p className="text-slate-900 dark:text-slate-100 text-base font-medium leading-normal">
            {!rol ? 'Tipo de Registro' : rol === 'SOCIO' ? 'Datos del Socio' : 'Datos del Comercio'}
          </p>
          <p className="text-slate-900 dark:text-slate-100 text-sm font-normal leading-normal">1/3</p>
        </div>
        <div className="rounded-full bg-primary/20 h-2 overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: '33%' }} />
        </div>
        <p className="text-primary text-sm font-medium leading-normal">Paso 1 de 3</p>
      </div>

      {/* --- SELECTOR DE TIPO (pantalla inicial) --- */}
      {!rol && (
        <div className="flex flex-col gap-5 p-6 mt-2">
          <div>
            <h3 className="text-slate-900 dark:text-slate-100 tracking-tight text-2xl font-bold leading-tight">
              ¿Cómo querés registrarte?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Seleccioná el tipo de cuenta que querés crear.
            </p>
          </div>

          {/* Card Socio */}
          <button
            onClick={() => setRol('SOCIO')}
            className="group flex items-center gap-5 p-5 rounded-2xl border-2 border-primary/30 bg-white dark:bg-slate-900 hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all text-left"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>person</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Socio</span>
              <span className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                Persona física miembro de la Sociedad Rural.
              </span>
            </div>
            <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">chevron_right</span>
          </button>

          {/* Card Comercio */}
          <button
            onClick={() => setRol('COMERCIO')}
            className="group flex items-center gap-5 p-5 rounded-2xl border-2 border-primary/30 bg-white dark:bg-slate-900 hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all text-left"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>storefront</span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Comercio</span>
              <span className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                Empresa o negocio adherido a la institución.
              </span>
            </div>
            <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">chevron_right</span>
          </button>

          {/* ---- BANNER ESPECIAL CÁMARA ---- */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 border border-sky-200 dark:border-sky-700 p-5 shadow-sm">
            {/* Decoración de fondo */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-200/30 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-cyan-200/30 rounded-full translate-y-6 -translate-x-6" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-sky-500 text-2xl">campaign</span>
                <span className="text-sky-600 dark:text-sky-400 font-bold text-sm uppercase tracking-wider">¡Atención Cámaras!</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 font-semibold text-base leading-snug mb-1">
                ¿Representás la Cámara de Comercio de tu municipio?
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-4">
                Por ejemplo: <em>"Cámara de Santo Tomé"</em>, <em>"Cámara de Paso de los Libres"</em>...
                Deberás solicitar autorización al Administrador para ser activada.
              </p>
              <button
                type="button"
                onClick={() => setRol('CAMARA')}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-xl active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-xl">domain</span>
                Solicitar autorización aquí
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULARIO SOCIO --- */}
      {rol === 'SOCIO' && (
        <>
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-slate-900 dark:text-slate-100 tracking-tight text-2xl font-bold leading-tight">
              Completá tus datos
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Ingresá la información tal como figura en tu documento.
            </p>
          </div>
          <form className="flex flex-col gap-0 p-4" onSubmit={handleNext}>
            {renderField('Nombre y Apellido', 'nombre_apellido', socioData.nombre_apellido, handleSocioChange, { placeholder: 'Ej: Juan Pérez' })}
            {renderField('DNI', 'dni_cuit', socioData.dni_cuit, handleSocioChange, { type: 'number', placeholder: 'Solo números, sin puntos' })}
            {renderField('Email', 'email', socioData.email, handleSocioChange, { type: 'email', placeholder: 'nombre@ejemplo.com', hint: 'Te enviaremos notificaciones importantes.' })}

            {/* Teléfono con prefijo */}
            <div className="flex flex-col gap-1 py-2">
              <label className="flex flex-col w-full">
                <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">Teléfono</span>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center w-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shrink-0">
                    +54
                  </div>
                  <input
                    name="telefono"
                    value={socioData.telefono}
                    onChange={handleSocioChange}
                    className={inputClass}
                    placeholder="Cód. de área + número"
                    type="tel"
                    required
                  />
                </div>
              </label>
            </div>

            {/* Contraseña Socio */}
            <div className="flex flex-col gap-1 py-2">
              <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-1">Contraseña</span>
              <div className="relative">
                <PasswordInput
                  value={socioPassword}
                  onChange={e => setSocioPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
              <div className="relative mt-2">
                <PasswordInput
                  value={socioConfirmPassword}
                  onChange={e => setSocioConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Repetí la contraseña"
                  required
                />
              </div>
              {socioPasswordError && (
                <p className="text-red-500 text-xs mt-1 px-1">{socioPasswordError}</p>
              )}
              <p className="text-slate-400 text-xs px-1 mt-1">La usarás para ingresar una vez que el Administrador apruebe tu cuenta.</p>
            </div>

            {/* Toggle ¿Sos profesional? */}
            <div className="flex flex-col gap-3 py-3">
              <button
                type="button"
                onClick={() => setEsProfesional(!esProfesional)}
                className={`flex items-center justify-between w-full p-4 rounded-xl border-2 transition-all ${esProfesional
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-2xl ${esProfesional ? 'text-primary' : 'text-slate-400'}`}>
                    school
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">¿Sos profesional?</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Médico, abogado, ingeniero, etc.</span>
                  </div>
                </div>
                {/* Toggle switch visual */}
                <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${esProfesional ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                  }`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${esProfesional ? 'left-6' : 'left-1'
                    }`} />
                </div>
              </button>

              {/* Alerta si es profesional */}
              {esProfesional && (
                <div className="flex gap-3 items-start bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                  <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 p-2 rounded-full shrink-0">
                    <span className="material-symbols-outlined text-xl block">info</span>
                  </div>
                  <div>
                    <h4 className="text-amber-800 dark:text-amber-300 text-sm font-bold">Validación Profesional Requerida</h4>
                    <p className="text-amber-700/80 dark:text-amber-400/80 text-xs mt-1 leading-relaxed">
                      Una vez aprobado por el Administrador, se te solicitará documentación adicional
                      para verificar tu profesión (matrícula, título, certificados, etc.).
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 mb-10">
              <button className="w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors" type="submit">
                Siguiente
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
              </button>
            </div>
          </form>
        </>
      )}

      {/* --- FORMULARIO COMERCIO --- */}
      {rol === 'COMERCIO' && (
        <>
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-slate-900 dark:text-slate-100 tracking-tight text-2xl font-bold leading-tight">
              Datos del Comercio
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Ingresá la información de tu empresa o negocio.
            </p>
          </div>
          <form className="flex flex-col gap-0 p-4" onSubmit={handleNext}>
            {renderField('Nombre del Comercio', 'nombre_comercio', comercioData.nombre_comercio, handleComercioChange, { placeholder: 'Ej: Agro Norte S.A.' })}
            {renderField('CUIT', 'cuit', comercioData.cuit, handleComercioChange, { type: 'number', placeholder: 'Solo números, sin guiones' })}
            {renderField('Email', 'email', comercioData.email, handleComercioChange, { type: 'email', placeholder: 'contacto@micomercio.com', hint: 'Te enviaremos notificaciones importantes.' })}

            {/* Teléfono con prefijo */}
            <div className="flex flex-col gap-1 py-2">
              <label className="flex flex-col w-full">
                <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">Teléfono</span>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center w-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shrink-0">
                    +54
                  </div>
                  <input
                    name="telefono"
                    value={comercioData.telefono}
                    onChange={handleComercioChange}
                    className={inputClass}
                    placeholder="Cód. de área + número"
                    type="tel"
                    required
                  />
                </div>
              </label>
            </div>

            {/* Rubro */}
            <div className="flex flex-col gap-1 py-2">
              <label className="flex flex-col w-full">
                <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">Rubro</span>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">category</span>
                  <select
                    name="rubro"
                    value={comercioData.rubro}
                    onChange={handleComercioChange}
                    className="w-full h-14 pl-12 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all appearance-none"
                    required
                  >
                    <option disabled value="">Seleccioná un rubro</option>
                    <option value="agropecuario">Agropecuario</option>
                    <option value="veterinaria">Veterinaria</option>
                    <option value="maquinaria_agricola">Maquinaria Agrícola</option>
                    <option value="insumos_agricolas">Insumos Agrícolas</option>
                    <option value="alimentacion">Alimentación</option>
                    <option value="construccion">Construcción</option>
                    <option value="transporte">Transporte</option>
                    <option value="servicios_profesionales">Servicios Profesionales</option>
                    <option value="comercio_general">Comercio General</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </label>
            </div>
            {/* Dirección */}
            <div className="flex flex-col gap-1 py-2">
              <label className="flex flex-col w-full">
                <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">Dirección</span>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary">location_on</span>
                  <input
                    name="direccion"
                    value={comercioData.direccion}
                    onChange={handleComercioChange}
                    className={inputClass + " pl-12"}
                    placeholder="Calle y número"
                    required
                  />
                </div>
              </label>
            </div>

            {/* Información importante para el Comercio */}
            <div className="flex gap-3 items-start bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-5 mb-2">
              <div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-2 rounded-full shrink-0">
                <span className="material-symbols-outlined text-xl block">info</span>
              </div>
              <div>
                <h4 className="text-indigo-800 dark:text-indigo-300 text-sm font-bold">Información de Registro</h4>
                <p className="text-indigo-700/80 dark:text-indigo-400/80 text-xs mt-1 leading-relaxed">
                  Tu solicitud será enviada para aprobación administrativa. Una vez aprobada, recibirás una notificación y podrás reestablecer tu contraseña antes de realizar tu primer ingreso.
                </p>
                <p className="text-indigo-700/80 dark:text-indigo-400/80 text-xs mt-2 font-semibold">
                  Contraseña temporal: <span className="text-indigo-900 dark:text-indigo-200">comercio1234</span>
                </p>
              </div>
            </div>

            <div className="mt-8 mb-10">
              <button className="w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors" type="submit">
                Siguiente
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
              </button>
            </div>
          </form>
        </>
      )}

      {/* --- FORMULARIO CÁMARA --- */}
      {rol === 'CAMARA' && (
        <>
          {/* Banner superior suave */}
          <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 border border-sky-200 dark:border-sky-700 p-4 flex gap-3 items-start">
            <span className="material-symbols-outlined text-sky-500 text-3xl shrink-0">domain</span>
            <div>
              <p className="text-slate-800 dark:text-slate-200 font-bold text-base leading-snug">Solicitud de Cámara Municipal</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                Completá el formulario. El Administrador revisará tu solicitud y te contactará para activar la cuenta de tu Cámara.
              </p>
            </div>
          </div>

          {camaraEnviada ? (
            /* Pantalla de éxito */
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 gap-6 text-center">
              <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400" style={{ fontSize: '44px' }}>task_alt</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">¡Solicitud enviada!</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed max-w-xs">
                  Tu solicitud para <strong>{camaraData.denominacion}</strong> fue recibida correctamente.
                  El Administrador revisará los datos y te contactará al correo <strong>{camaraData.email}</strong> para activar la cuenta.
                </p>
              </div>
              <div className="w-full p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 text-sm text-indigo-700 dark:text-indigo-300">
                📋 Guardá este mensaje como referencia mientras aguardás la aprobación.
              </div>
            </div>
          ) : (
            <form className="flex flex-col gap-3 p-4 mt-2" onSubmit={handleCamaraSubmit}>
              {camaraError && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-xl text-sm font-medium">
                  {camaraError}
                </div>
              )}

              {/* Denominación */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-1">
                  Denominación de la Cámara
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">business</span>
                  <input
                    name="denominacion"
                    value={camaraData.denominacion}
                    onChange={handleCamaraChange}
                    className={`${inputClass} pl-12`}
                    placeholder='Ej: Cámara de Comercio de Santo Tomé'
                    required
                  />
                </div>
              </div>

              {/* CUIT */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-1">
                  CUIT de la Cámara
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">fingerprint</span>
                  <input
                    name="cuit"
                    value={camaraData.cuit}
                    onChange={handleCamaraChange}
                    className={`${inputClass} pl-12`}
                    placeholder='Solo números, sin guiones'
                    type="number"
                    required
                  />
                </div>
              </div>

              {/* Municipio */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-1">
                  Municipio
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">location_city</span>
                  <input
                    name="municipio"
                    value={camaraData.municipio}
                    onChange={handleCamaraChange}
                    className={`${inputClass} pl-12`}
                    placeholder='Ej: Santo Tomé'
                    required
                  />
                </div>
              </div>

              {/* Provincia */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-1">
                  Provincia
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">map</span>
                  <input
                    name="provincia"
                    value={camaraData.provincia}
                    onChange={handleCamaraChange}
                    className={`${inputClass} pl-12`}
                    placeholder='Ej: Corrientes'
                    required
                  />
                </div>
              </div>

              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Datos del Responsable</p>

              {/* Nombre responsable */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-1">
                  Nombre del Responsable
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">person</span>
                  <input
                    name="responsable_nombre"
                    value={camaraData.responsable_nombre}
                    onChange={handleCamaraChange}
                    className={`${inputClass} pl-12`}
                    placeholder='Nombre y apellido del titular'
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-1">
                  Email de contacto
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">mail</span>
                  <input
                    name="email"
                    value={camaraData.email}
                    onChange={handleCamaraChange}
                    className={`${inputClass} pl-12`}
                    placeholder='camara@municipio.gob.ar'
                    type="email"
                    required
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-1">
                  Teléfono
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center w-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shrink-0">+54</div>
                  <input
                    name="telefono"
                    value={camaraData.telefono}
                    onChange={handleCamaraChange}
                    className={inputClass}
                    placeholder="Cód. de área + número"
                    type="tel"
                    required
                  />
                </div>
              </div>

              {/* Información importante para la Cámara */}
              <div className="flex gap-3 items-start bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-xl p-5 mb-2 mt-4">
                <div className="bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 p-2 rounded-full shrink-0">
                  <span className="material-symbols-outlined text-xl block">info</span>
                </div>
                <div>
                  <h4 className="text-teal-800 dark:text-teal-300 text-sm font-bold">Información de Registro</h4>
                  <p className="text-teal-700/80 dark:text-teal-400/80 text-xs mt-1 leading-relaxed">
                    Tu solicitud será enviada para aprobación administrativa. Una vez aprobada, recibirás una notificación y podrás reestablecer tu contraseña antes de realizar tu primer ingreso.
                  </p>
                  <p className="text-teal-700/80 dark:text-teal-400/80 text-xs mt-2 font-semibold">
                    Contraseña temporal: <span className="text-teal-900 dark:text-teal-200">camara1234</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 mb-10">
                <button
                  type="submit"
                  disabled={camaraLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/30 disabled:opacity-50"
                >
                  {camaraLoading
                    ? 'Enviando solicitud...'
                    : <>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
                      Enviar Solicitud al Administrador
                    </>
                  }
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Footer */}
      <div className="px-4 pb-8 text-center mt-auto">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          ¿Ya tenés una cuenta?{' '}
          <Link to="/login" className="text-primary font-bold cursor-pointer">Iniciá sesión</Link>
        </p>
      </div>
    </div>
  );
}
