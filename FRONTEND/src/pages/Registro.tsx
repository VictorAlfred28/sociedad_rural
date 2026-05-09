import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordInput } from '../components/ui/PasswordInput';
import { ComercioDTO } from '../types/comercio';
import { ComercioForm } from '../components/forms/ComercioForm';

type Rol = 'SOCIO' | 'COMERCIO';

// Campos comunes a ambos formularios (tabla profiles)
interface FormDataBase {
  email: string;
  telefono: string;
}

interface SocioFormData extends FormDataBase {
  nombre_apellido: string;
  dni_cuit: string; // mapea a 'dni' en profiles
  direccion: string;
  barrio?: string;  // Barrio/localidad (nuevo)
}

export default function Registro() {
  const navigate = useNavigate();
  // --- Persistencia con sessionStorage ---
  const loadSavedData = (key: string, defaultValue: any) => {
    try {
      const saved = sessionStorage.getItem('registro_form_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed[key] !== undefined ? parsed[key] : defaultValue;
      }
    } catch (e) {}
    return defaultValue;
  };

  const [rol, setRol] = useState<Rol | null>(() => loadSavedData('rol', null));

  const [socioData, setSocioData] = useState<SocioFormData>(() => loadSavedData('socioData', {
    nombre_apellido: '',
    dni_cuit: '',
    email: '',
    telefono: '',
    direccion: '',
    barrio: '',
  }));
  const [esProfesional, setEsProfesional] = useState(false);
  const [socioPassword, setSocioPassword] = useState('');
  const [socioConfirmPassword, setSocioConfirmPassword] = useState('');
  const [socioPasswordError, setSocioPasswordError] = useState('');
  const [socioDniError, setSocioDniError] = useState('');

  const [comercioData, setComercioData] = useState<ComercioDTO>(() => loadSavedData('comercioData', {
    nombre_comercio: '',
    cuit: '',
    email: '',
    telefono: '',
    rubro: '',
    direccion: '',
    municipio: '',
    provincia: 'Corrientes',
  }));
  const [municipios, setMunicipios] = useState<{ id: string; nombre: string }[]>([]);

  // Guardar en sessionStorage cuando cambian los datos
  React.useEffect(() => {
    const dataToSave = {
      rol,
      socioData,
      comercioData,
    };
    sessionStorage.setItem('registro_form_data', JSON.stringify(dataToSave));
  }, [rol, socioData, comercioData]);

  // Cargar municipios dinámicamente
  React.useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`)
      .then(res => res.json())
      .then(data => {
        const list = data.municipios || [];
        const sorted = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre));
        setMunicipios(sorted);
      })
      .catch(err => console.error("Error cargando municipios:", err));
  }, []);

  const handleSocioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSocioData({ ...socioData, [e.target.name]: e.target.value });
  };

  const handleComercioChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setComercioData({ ...comercioData, [e.target.name]: e.target.value });
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();

    if (rol === 'SOCIO') {
      if (!/^\d{8}$/.test(socioData.dni_cuit)) {
        setSocioDniError('El DNI debe contener exactamente 8 números');
        return;
      }
      setSocioDniError('');

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
            barrio: socioData.barrio,
          },
        },
      });
    } else if (rol === 'COMERCIO') {
      navigate('/registro-paso-2', {
        state: {
          registroData: {
            ...comercioData,
            password: 'comercio1234',
            rol: 'COMERCIO',
          },
        },
      });
    }
  };

  const inputClass =
    'w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 p-[15px] text-base font-normal leading-normal';

  const renderField = (
    label: string,
    name: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void,
    opts?: { type?: string; placeholder?: string; hint?: string; error?: string }
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
      {opts?.error && <p className="text-red-500 text-xs px-1">{opts.error}</p>}
      {opts?.hint && !opts?.error && <p className="text-slate-500 dark:text-slate-400 text-xs px-1">{opts.hint}</p>}
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
            {renderField('DNI', 'dni_cuit', socioData.dni_cuit, handleSocioChange, { type: 'number', placeholder: 'Solo números, sin puntos', error: socioDniError })}
            {renderField('Dirección', 'direccion', socioData.direccion, handleSocioChange, { placeholder: 'Calle y número' })}

            {/* Teléfono con prefijo */}
            <div className="flex flex-col gap-1 py-2">
              <label className="flex flex-col w-full">
                <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">Teléfono/Celular</span>
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

            {renderField('Email', 'email', socioData.email, handleSocioChange, { type: 'email', placeholder: 'nombre@ejemplo.com', hint: 'Te enviaremos notificaciones importantes.' })}

            {renderField('Barrio', 'barrio', socioData.barrio || '', handleSocioChange, { placeholder: 'Ej: Centro, Sudoeste, etc.', hint: 'Opcional - Tu barrio de residencia.' })}

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
          <ComercioForm
            formData={comercioData}
            onChange={handleComercioChange}
            onSubmit={handleNext}
            mode="PUBLIC"
            buttonText="Siguiente Paso"
            showPasswordHint={true}
          />
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
