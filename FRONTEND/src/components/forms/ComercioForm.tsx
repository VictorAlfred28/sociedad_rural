import React, { useEffect, useState } from 'react';
import { ComercioDTO, RUBROS_COMERCIO } from '../../types/comercio';

interface ComercioFormProps {
    formData: ComercioDTO;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading?: boolean;
    buttonText?: string;
    mode?: 'ADMIN' | 'PUBLIC';
    showPasswordHint?: boolean;
}

export function ComercioForm({
    formData,
    onChange,
    onSubmit,
    isLoading = false,
    buttonText = 'Guardar',
    mode = 'PUBLIC',
    showPasswordHint = false
}: ComercioFormProps) {
    const [municipios, setMunicipios] = useState<{ id: string; nombre: string }[]>([]);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`)
            .then(res => res.json())
            .then(data => {
                const list = data.municipios || [];
                const ordenManual = ['Capital', 'Itatí', 'Ramada Paso', 'San Cosme', 'Santa Ana', 'Riachuelo', 'El Sombrero', 'Paso de la Patria'];
                const sorted = [...list].sort((a, b) => {
                    const idxA = ordenManual.indexOf(a.nombre);
                    const idxB = ordenManual.indexOf(b.nombre);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    return a.nombre.localeCompare(b.nombre);
                });
                setMunicipios(sorted);
            })
            .catch(err => console.error("Error cargando municipios:", err));
    }, []);

    // Determinamos el estilo de input basado en el modo (si es admin es más corporativo, public usa dark mode mas marcado)
    const isAdmin = mode === 'ADMIN';

    const inputClass = isAdmin
        ? "h-12 w-full rounded-xl bg-admin-card px-4 pl-12 text-sm font-medium shadow-sm outline-none border border-admin-border focus:border-admin-accent focus:ring-1 focus:ring-admin-accent transition-colors placeholder:text-slate-600 text-admin-text"
        : "w-full rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-14 pl-12 pr-4 text-base font-normal leading-normal placeholder:text-slate-400";

    const labelClass = isAdmin
        ? "text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400 pb-1.5"
        : "text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2";

    const containerProps = isAdmin ? { className: "flex flex-col gap-5 max-w-2xl" } : { className: "flex flex-col gap-0 p-4" };
    const fieldContainerProps = isAdmin ? { className: "flex flex-col" } : { className: "flex flex-col gap-1 py-2" };

    const Icon = ({ name, colorClass }: { name: string, colorClass?: string }) => (
        <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 ${colorClass || (isAdmin ? 'text-admin-accent/70' : 'text-primary')}`}>
            {name}
        </span>
    );

    return (
        <form onSubmit={onSubmit} {...containerProps}>
            {/* Nombre del Comercio */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Nombre del Comercio</label>
                <div className="relative">
                    <Icon name="storefront" />
                    <input
                        name="nombre_comercio"
                        value={formData.nombre_comercio}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Ej. Agropecuaria El Sol"
                        required
                    />
                </div>
            </div>

            {/* CUIT */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>CUIT Institucional</label>
                <div className="relative">
                    <Icon name="fingerprint" />
                    <input
                        type="number"
                        name="cuit"
                        value={formData.cuit}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Solo números, sin guiones"
                        required
                    />
                </div>
            </div>

            {/* Email */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Correo Electrónico Oficial</label>
                <div className="relative">
                    <Icon name="mail" />
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="contacto@comercio.com"
                        required
                    />
                </div>
                {!isAdmin && <p className="text-slate-500 dark:text-slate-400 text-xs px-1 pt-1">Te enviaremos notificaciones importantes.</p>}
            </div>

            {/* Teléfono */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Teléfono de Contacto</label>
                <div className="flex gap-2 relative">
                    <div className={`flex items-center justify-center w-16 shrink-0 rounded-xl text-sm font-medium ${isAdmin ? 'bg-admin-card border border-admin-border text-admin-text' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>
                        +54
                    </div>
                    <div className="relative flex-1">
                        <Icon name="call" />
                        <input
                            type="tel"
                            name="telefono"
                            value={formData.telefono}
                            onChange={onChange}
                            className={inputClass}
                            placeholder="Cód. de área + número"
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Rubro */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Rubro Principal</label>
                <div className="relative">
                    <Icon name="category" />
                    <select
                        name="rubro"
                        value={formData.rubro}
                        onChange={onChange}
                        className={`${inputClass} appearance-none cursor-pointer`}
                        required
                    >
                        <option value="" disabled className="text-slate-500">Seleccionar rubro comercial</option>
                        {RUBROS_COMERCIO.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        expand_more
                    </span>
                </div>
            </div>

            {/* Dirección */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Dirección Física</label>
                <div className="relative">
                    <Icon name="location_on" />
                    <input
                        type="text"
                        name="direccion"
                        value={formData.direccion}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Calle y Número"
                        required
                    />
                </div>
            </div>

            {/* Municipio */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Municipio / Localidad</label>
                <div className="relative">
                    <Icon name="location_city" />
                    <select
                        name="municipio"
                        value={formData.municipio}
                        onChange={onChange}
                        className={`${inputClass} appearance-none cursor-pointer`}
                        required
                    >
                        <option value="" disabled>Seleccioná una localidad</option>
                        {municipios.map(m => (
                            <option key={m.id} value={m.nombre}>{m.nombre}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        expand_more
                    </span>
                </div>
            </div>

            {/* Provincia (solo visible en ADMIN si es necesario, o público opcional) */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Provincia</label>
                <div className="relative">
                    <Icon name="map" />
                    <input
                        type="text"
                        name="provincia"
                        value={formData.provincia || 'Corrientes'}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Ej. Corrientes"
                    />
                </div>
            </div>

            {/* Hint de password temporal */}
            {showPasswordHint && (
                <div className="mt-2 mb-2 flex flex-col gap-1.5">
                    {isAdmin ? (
                        <>
                            <label className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400 mt-2">Contraseña del Comercio</label>
                            <div className="h-12 w-full rounded-xl bg-slate-100 dark:bg-slate-800/50 px-4 text-sm font-medium border border-slate-200 dark:border-slate-700 flex items-center text-slate-500 cursor-not-allowed">
                                comercio1234
                            </div>
                            <p className="text-[10px] text-slate-400 pl-1">Esta es la contraseña provisoria. Se le solicitará cambiarla al ingresar por primera vez.</p>
                        </>
                    ) : (
                        <div className="flex gap-3 items-start bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-5 mb-2 mt-4">
                            <div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-2 rounded-full shrink-0">
                                <span className="material-symbols-outlined text-xl block">info</span>
                            </div>
                            <div>
                                <h4 className="text-indigo-800 dark:text-indigo-300 text-sm font-bold">Resumen de Cuenta</h4>
                                <p className="text-indigo-700/80 dark:text-indigo-400/80 text-xs mt-1 leading-relaxed">
                                    Tu solicitud será enviada para aprobación administrativa. Una vez aprobada, recibirás un correo y podrás reestablecer tu contraseña en tu primer ingreso.
                                </p>
                                <p className="text-indigo-700/80 dark:text-indigo-400/80 text-xs mt-2 font-semibold">
                                    Contraseña temporal: <span className="text-indigo-900 dark:text-indigo-200">comercio1234</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Botón */}
            <div className={isAdmin ? "" : "mt-4 mb-10"}>
                <button
                    type="submit"
                    disabled={isLoading}
                    className={isAdmin
                        ? "mt-4 flex w-full items-center justify-center rounded-xl h-14 bg-admin-accent/10 border border-admin-accent/20 text-admin-accent hover:bg-admin-accent hover:text-white text-sm uppercase tracking-widest font-bold shadow-md active:scale-95 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        : "w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    }
                >
                    {isLoading ? 'Cargando...' : buttonText}
                    {!isAdmin && <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{isLoading ? 'hourglass_empty' : 'arrow_forward'}</span>}
                </button>
            </div>
        </form>
    );
}
