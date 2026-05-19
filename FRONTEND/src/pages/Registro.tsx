import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordInput } from '../components/ui/PasswordInput';
import { ValidatedInput } from '../components/ui/ValidatedInput';
import { ComercioDTO } from '../types/comercio';
import { ComercioForm } from '../components/forms/ComercioForm';
import type { FieldState } from '../utils/validations';
import {
  validateDNI,
  validateEmailFormat,
  validateRequired,
  validatePassword,
  validatePasswordMatch,
  checkEmailExists,
  validatePhone,
  sanitizePhone,
} from '../utils/validations';

type Rol = 'SOCIO' | 'COMERCIO';

interface SocioFormData {
  nombre_apellido: string;
  dni_cuit: string;
  email: string;
  telefono: string;
  direccion: string;
  barrio?: string;
}

interface FieldMeta {
  state: FieldState;
  message: string;
}

const idle: FieldMeta = { state: 'idle', message: '' };

export default function Registro() {
  const navigate = useNavigate();

  // ── Persistencia sessionStorage ──────────────────────────────
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

  const [socioData, setSocioData] = useState<SocioFormData>(() =>
    loadSavedData('socioData', {
      nombre_apellido: '',
      dni_cuit: '',
      email: '',
      telefono: '',
      direccion: '',
      barrio: '',
    })
  );

  const [esProfesional, setEsProfesional] = useState(false);
  const [socioPassword, setSocioPassword] = useState('');
  const [socioConfirmPassword, setSocioConfirmPassword] = useState('');

  // ── Field states ──────────────────────────────────────────────
  const [nombreMeta, setNombreMeta] = useState<FieldMeta>(idle);
  const [dniMeta, setDniMeta] = useState<FieldMeta>(idle);
  const [emailMeta, setEmailMeta] = useState<FieldMeta>(idle);
  const [telefonoMeta, setTelefonoMeta] = useState<FieldMeta>(idle);
  const [passMeta, setPassMeta] = useState<FieldMeta>(idle);
  const [confirmPassMeta, setConfirmPassMeta] = useState<FieldMeta>(idle);

  const [comercioData, setComercioData] = useState<ComercioDTO>(() =>
    loadSavedData('comercioData', {
      nombre_comercio: '',
      cuit: '',
      email: '',
      telefono: '',
      rubro: '',
      direccion: '',
      municipio: '',
      provincia: 'Corrientes',
    })
  );

  // ── Guardar en sessionStorage ─────────────────────────────────
  React.useEffect(() => {
    sessionStorage.setItem(
      'registro_form_data',
      JSON.stringify({ rol, socioData, comercioData })
    );
  }, [rol, socioData, comercioData]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleSocioChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Para DNI: solo permitir números
    if (name === 'dni_cuit') {
      const cleaned = value.replace(/\D/g, '').slice(0, 8);
      setSocioData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }
    // Para Teléfono: sanitizar dejando solo números
    if (name === 'telefono') {
      const sanitized = sanitizePhone(value).slice(0, 15);
      setSocioData(prev => ({ ...prev, [name]: sanitized }));
      return;
    }
    setSocioData(prev => ({ ...prev, [name]: value }));
  };

  const handleComercioChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'telefono') {
      const sanitized = sanitizePhone(value).slice(0, 15);
      setComercioData(prev => ({ ...prev, [name]: sanitized }));
      return;
    }
    if (name === 'cuit') {
      const sanitized = sanitizePhone(value).slice(0, 11);
      setComercioData(prev => ({ ...prev, [name]: sanitized }));
      return;
    }
    setComercioData(prev => ({ ...prev, [name]: value }));
  };

  // ── Real-time validations ─────────────────────────────────────
  const onNombreValidate = useCallback((value: string) => {
    const r = validateRequired(value, 'su nombre y apellido');
    setNombreMeta(
      r.valid
        ? { state: 'valid', message: '' }
        : value.length > 0
        ? { state: 'error', message: r.message! }
        : idle
    );
  }, []);

  const onDniValidate = useCallback((value: string) => {
    if (value.length === 0) { setDniMeta(idle); return; }
    const r = validateDNI(value);
    setDniMeta(r.valid ? { state: 'valid', message: '' } : { state: 'error', message: r.message! });
  }, []);

  const onEmailValidate = useCallback((value: string) => {
    if (value.length === 0) { setEmailMeta(idle); return; }
    const r = validateEmailFormat(value);
    setEmailMeta(r.valid ? { state: 'idle', message: '' } : { state: 'error', message: r.message! });
  }, []);

  const onEmailBlur = useCallback(async (value: string) => {
    const fmt = validateEmailFormat(value);
    if (!fmt.valid) {
      setEmailMeta({ state: 'error', message: fmt.message! });
      return;
    }
    setEmailMeta({ state: 'checking', message: '' });
    const result = await checkEmailExists(value, 'socio');
    setEmailMeta(
      result.valid
        ? { state: 'valid', message: '' }
        : { state: 'error', message: result.message! }
    );
  }, []);

  const onTelefonoValidate = useCallback((value: string) => {
    if (value.length === 0) { setTelefonoMeta(idle); return; }
    const r = validatePhone(value);
    setTelefonoMeta(r.valid ? { state: 'valid', message: '' } : { state: 'error', message: r.message! });
  }, []);

  const onPassValidate = useCallback((value: string) => {
    if (value.length === 0) { setPassMeta(idle); return; }
    if (value.length < 8) {
      setPassMeta({ state: 'error', message: 'La contraseña debe tener al menos 8 caracteres.' });
    } else {
      setPassMeta({ state: 'valid', message: '' });
    }
  }, []);

  const onConfirmPassValidate = useCallback((value: string) => {
    if (value.length === 0) { setConfirmPassMeta(idle); return; }
    if (value !== socioPassword) {
      setConfirmPassMeta({ state: 'error', message: 'Las contraseñas no coinciden.' });
    } else {
      setConfirmPassMeta({ state: 'valid', message: '' });
    }
  }, [socioPassword]);

  // ── Submit ────────────────────────────────────────────────────
  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();

    if (rol === 'SOCIO') {
      // Validar todos los campos
      let hasErrors = false;

      const nombreR = validateRequired(socioData.nombre_apellido, 'su nombre y apellido');
      if (!nombreR.valid) {
        setNombreMeta({ state: 'error', message: nombreR.message! });
        hasErrors = true;
      }

      const dniR = validateDNI(socioData.dni_cuit);
      if (!dniR.valid) {
        setDniMeta({ state: 'error', message: dniR.message! });
        hasErrors = true;
      }

      const emailFmt = validateEmailFormat(socioData.email);
      if (!emailFmt.valid) {
        setEmailMeta({ state: 'error', message: emailFmt.message! });
        hasErrors = true;
      }

      if (emailMeta.state === 'error') {
        hasErrors = true;
      }

      const telR = validatePhone(socioData.telefono);
      if (!telR.valid) {
        setTelefonoMeta({ state: 'error', message: telR.message! });
        hasErrors = true;
      }

      const passR = validatePassword(socioPassword);
      if (!passR.valid) {
        setPassMeta({ state: 'error', message: passR.message! });
        hasErrors = true;
      }

      const matchR = validatePasswordMatch(socioPassword, socioConfirmPassword);
      if (!matchR.valid) {
        setConfirmPassMeta({ state: 'error', message: matchR.message! });
        hasErrors = true;
      }

      if (hasErrors) return;

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
            direccion: socioData.direccion,
          },
        },
      });
    } else if (rol === 'COMERCIO') {
      navigate('/registro-paso-2', {
        state: {
          registroData: {
            ...comercioData,
            password: 'SRNC2026!',
            rol: 'COMERCIO',
          },
        },
      });
    }
  };

  // ── Password wrapper classes ───────────────────────────────────
  const passInputClass = (meta: FieldMeta) =>
    `w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-0 border transition-all duration-200 bg-white dark:bg-slate-900 h-14 placeholder:text-slate-400 p-[15px] text-base font-normal leading-normal ${
      meta.state === 'error'
        ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
        : meta.state === 'valid'
        ? 'border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
        : 'border-slate-200 dark:border-slate-700'
    }`;

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

      {/* ── SELECTOR DE TIPO ── */}
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

      {/* ── FORMULARIO SOCIO ── */}
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
          <form className="flex flex-col gap-0 p-4" onSubmit={handleNext} noValidate>
            {/* Nombre */}
            <ValidatedInput
              label="Nombre y Apellido"
              name="nombre_apellido"
              value={socioData.nombre_apellido}
              onChange={handleSocioChange}
              placeholder="Ej: Juan Pérez"
              icon="person"
              fieldState={nombreMeta.state}
              errorMessage={nombreMeta.message}
              onValidate={onNombreValidate}
              required
            />

            {/* DNI */}
            <ValidatedInput
              label="DNI"
              name="dni_cuit"
              value={socioData.dni_cuit}
              onChange={handleSocioChange}
              placeholder="8 dígitos, sin puntos"
              icon="badge"
              type="text"
              inputMode="numeric"
              maxLength={8}
              fieldState={dniMeta.state}
              errorMessage={dniMeta.message}
              onValidate={onDniValidate}
              hint="Exactamente 8 dígitos numéricos."
              required
            />

            {/* Dirección */}
            <ValidatedInput
              label="Dirección"
              name="direccion"
              value={socioData.direccion}
              onChange={handleSocioChange}
              placeholder="Calle y número"
              icon="home"
              fieldState="idle"
            />

            {/* Teléfono */}
            <div className="flex flex-col gap-1 py-2">
              <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">Teléfono/Celular</span>
              <div className="flex gap-2">
                <div className="flex items-center justify-center w-16 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm shrink-0">
                  +54
                </div>
                <div className="relative flex-1">
                  <input
                    name="telefono"
                    value={socioData.telefono}
                    onChange={e => {
                      handleSocioChange(e);
                      onTelefonoValidate(e.target.value);
                    }}
                    className={`w-full h-14 rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 text-base font-normal placeholder:text-slate-400 focus:outline-none ${
                      telefonoMeta.state === 'error'
                        ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                        : telefonoMeta.state === 'valid'
                        ? 'border-emerald-500'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="Cód. de área + número"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                  />
                </div>
              </div>
              {telefonoMeta.state === 'error' && (
                <p className="text-red-500 text-xs px-1 mt-0.5">{telefonoMeta.message}</p>
              )}
            </div>

            {/* Email */}
            <ValidatedInput
              label="Email"
              name="email"
              value={socioData.email}
              onChange={handleSocioChange}
              placeholder="nombre@ejemplo.com"
              icon="mail"
              type="email"
              fieldState={emailMeta.state}
              errorMessage={emailMeta.message}
              onValidate={onEmailValidate}
              onBlurValidate={onEmailBlur}
              hint="Te enviaremos notificaciones importantes. Se verifica en tiempo real."
              required
            />

            {/* Barrio */}
            <ValidatedInput
              label="Barrio (Opcional)"
              name="barrio"
              value={socioData.barrio || ''}
              onChange={handleSocioChange}
              placeholder="Ej: Centro, Sudoeste, etc."
              icon="location_on"
              fieldState="idle"
              hint="Tu barrio de residencia."
            />

            {/* Contraseña */}
            <div className="flex flex-col gap-1 py-2">
              <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-1">Contraseña</span>
              <div className="relative">
                <PasswordInput
                  value={socioPassword}
                  onChange={e => {
                    setSocioPassword(e.target.value);
                    onPassValidate(e.target.value);
                  }}
                  className={passInputClass(passMeta)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
              {passMeta.state === 'error' && (
                <p className="text-red-500 text-xs px-1 mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  {passMeta.message}
                </p>
              )}

              <div className="relative mt-2">
                <PasswordInput
                  value={socioConfirmPassword}
                  onChange={e => {
                    setSocioConfirmPassword(e.target.value);
                    onConfirmPassValidate(e.target.value);
                  }}
                  className={passInputClass(confirmPassMeta)}
                  placeholder="Repetí la contraseña"
                  required
                />
              </div>
              {confirmPassMeta.state === 'error' && (
                <p className="text-red-500 text-xs px-1 mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  {confirmPassMeta.message}
                </p>
              )}
              {confirmPassMeta.state === 'valid' && (
                <p className="text-emerald-500 text-xs px-1 mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span>
                  Las contraseñas coinciden.
                </p>
              )}
              <p className="text-slate-400 text-xs px-1 mt-1">
                La usarás para ingresar una vez que el Administrador apruebe tu cuenta.
              </p>
            </div>

            <div className="mt-6 mb-10">
              <button
                className="w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                type="submit"
              >
                Siguiente
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
              </button>
            </div>
          </form>
        </>
      )}

      {/* ── FORMULARIO COMERCIO ── */}
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
