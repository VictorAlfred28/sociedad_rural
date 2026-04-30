import React, { useEffect, useState } from 'react';
import { ProfesionalDTO } from '../../types/profesional';

interface ProfesionalFormProps {
    formData: ProfesionalDTO;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading?: boolean;
    buttonText?: string;
    mode?: 'ADMIN' | 'PUBLIC';
    showPasswordHint?: boolean;
}

export function ProfesionalForm({
    formData,
    onChange,
    onSubmit,
    isLoading = false,
    buttonText = 'Guardar',
    mode = 'PUBLIC',
    showPasswordHint = false
}: ProfesionalFormProps) {
    const [municipios, setMunicipios] = useState<{ id: string; nombre: string }[]>([]);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/municipios`)
            .then(res => res.json())
            .then(data => {
                const list = data.municipios || [];
                const sorted = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre));
                setMunicipios(sorted);
            })
            .catch(err => console.error("Error cargando municipios:", err));
    }, []);

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
            {/* Nombre y Apellido */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Nombre y Apellido</label>
                <div className="relative">
                    <Icon name="person" />
                    <input
                        name="nombreApellido"
                        value={formData.nombreApellido}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Ej. Juan Pérez"
                        required
                    />
                </div>
            </div>

            {/* DNI */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>DNI</label>
                <div className="relative">
                    <Icon name="badge" />
                    <input
                        type="number"
                        name="dni"
                        value={formData.dni}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Solo números, sin puntos"
                        required
                    />
                </div>
            </div>

            {/* Nro Matrícula */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Nro Matrícula</label>
                <div className="relative">
                    <Icon name="assignment_ind" />
                    <input
                        name="nroMatricula"
                        value={formData.nroMatricula}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Ej. MP-12345"
                        required
                    />
                </div>
            </div>

            {/* Profesión */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Profesión</label>
                <div className="relative">
                    <Icon name="work" />
                    <input
                        name="profesion"
                        value={formData.profesion}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Ej. Médico Veterinario"
                        required
                    />
                </div>
            </div>

            {/* Email */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Correo Electrónico</label>
                <div className="relative">
                    <Icon name="mail" />
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="contacto@profesional.com"
                        required
                    />
                </div>
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

            {/* Domicilio */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Domicilio</label>
                <div className="relative">
                    <Icon name="location_on" />
                    <input
                        type="text"
                        name="domicilio"
                        value={formData.domicilio}
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

            {/* Provincia */}
            <div {...fieldContainerProps}>
                <label className={labelClass}>Provincia</label>
                <div className="relative">
                    <Icon name="map" />
                    <input
                        type="text"
                        name="provincia"
                        value={formData.provincia}
                        onChange={onChange}
                        className={inputClass}
                        placeholder="Ej. Corrientes"
                    />
                </div>
            </div>

            {/* Hint de password temporal */}
            {showPasswordHint && (
                <div className="mt-2 mb-2 flex flex-col gap-1.5">
                    {isAdmin && (
                        <>
                            <label className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400 mt-2">Contraseña del Profesional</label>
                            <div className="h-12 w-full rounded-xl bg-slate-100 dark:bg-slate-800/50 px-4 text-sm font-medium border border-slate-200 dark:border-slate-700 flex items-center text-slate-500 cursor-not-allowed">
                                profesional1234
                            </div>
                            <p className="text-[10px] text-slate-400 pl-1">Esta es la contraseña provisoria. Se le solicitará cambiarla al ingresar por primera vez.</p>
                        </>
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
