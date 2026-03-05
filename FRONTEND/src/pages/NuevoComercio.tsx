import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NuevoComercio({ inlineMode = false, onSuccess }: { inlineMode?: boolean, onSuccess?: () => void }) {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        nombre_comercio: '',
        cuit: '',
        email: '',
        telefono: '',
        rubro: '',
        direccion: ''
    });

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/admin/comercios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.detail || 'Error al crear el comercio');
            }

            setSuccessMsg(`Comercio creado con éxito. Contraseña temporal: comercio1234`);

            // Limpiar formulario
            setFormData({
                nombre_comercio: '',
                cuit: '',
                email: '',
                telefono: '',
                rubro: '',
                direccion: ''
            });

            // Redirigir al dashboard despues de unos segundos
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess();
                } else if (!inlineMode) {
                    navigate('/admin');
                }
            }, 3000);

        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const content = (
        <main className={`flex-1 ${inlineMode ? 'p-4' : 'p-6'}`}>
            <div className={inlineMode ? "mb-6" : "hidden"}>
                <h2 className="text-xl font-bold tracking-tight text-admin-text mt-2">Alta de Comercio</h2>
                <p className="text-slate-400 text-sm">Registra un nuevo comercio en la plataforma de la Institución.</p>
            </div>

            {successMsg && (
                <div className="mb-6 p-4 bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl text-[#10b981] text-sm font-medium text-center">
                    {successMsg}
                </div>
            )}

            {errorMsg && (
                <div className="mb-6 p-4 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl text-[#ef4444] text-sm font-medium text-center">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
                <div className="flex flex-col gap-1.5 focus-within:text-admin-accent transition-colors">
                    <label htmlFor="nombre_comercio" className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400">Nombre del Comercio</label>
                    <input
                        type="text"
                        id="nombre_comercio"
                        name="nombre_comercio"
                        value={formData.nombre_comercio}
                        onChange={handleChange}
                        placeholder="Ej. Agropecuaria El Sol"
                        className="h-12 w-full rounded-xl bg-admin-card px-4 text-sm font-medium shadow-sm outline-none border border-admin-border focus:border-admin-accent focus:ring-1 focus:ring-admin-accent admin-transition placeholder:text-slate-600 text-admin-text"
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5 focus-within:text-admin-accent transition-colors">
                    <label htmlFor="cuit" className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400">CUIT Institucional</label>
                    <input
                        type="number"
                        id="cuit"
                        name="cuit"
                        value={formData.cuit}
                        onChange={handleChange}
                        placeholder="Sin guiones ni espacios"
                        className="h-12 w-full rounded-xl bg-admin-card px-4 text-sm font-medium shadow-sm outline-none border border-admin-border focus:border-admin-accent focus:ring-1 focus:ring-admin-accent admin-transition placeholder:text-slate-600 text-admin-text"
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5 focus-within:text-admin-accent transition-colors">
                    <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400">Correo Electrónico Oficial</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="contacto@comercio.com"
                        className="h-12 w-full rounded-xl bg-admin-card px-4 text-sm font-medium shadow-sm outline-none border border-admin-border focus:border-admin-accent focus:ring-1 focus:ring-admin-accent admin-transition placeholder:text-slate-600 text-admin-text"
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5 focus-within:text-admin-accent transition-colors">
                    <label htmlFor="telefono" className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400">Teléfono de Contacto</label>
                    <input
                        type="tel"
                        id="telefono"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        placeholder="Ej. +54 379 4123456"
                        className="h-12 w-full rounded-xl bg-admin-card px-4 text-sm font-medium shadow-sm outline-none border border-admin-border focus:border-admin-accent focus:ring-1 focus:ring-admin-accent admin-transition placeholder:text-slate-600 text-admin-text"
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5 focus-within:text-admin-accent transition-colors relative">
                    <label htmlFor="rubro" className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400">Rubro Principal</label>
                    <select
                        id="rubro"
                        name="rubro"
                        value={formData.rubro}
                        onChange={handleChange}
                        className="h-12 w-full rounded-xl bg-admin-card px-4 text-sm font-medium shadow-sm outline-none border border-admin-border focus:border-admin-accent focus:ring-1 focus:ring-admin-accent admin-transition appearance-none text-admin-text cursor-pointer"
                        required
                    >
                        <option value="" disabled className="text-slate-500">Seleccionar rubro comercial</option>
                        <option value="Insumos Agropecuarios">Insumos Agropecuarios</option>
                        <option value="Maquinaria">Maquinaria</option>
                        <option value="Veterinaria">Veterinaria</option>
                        <option value="Servicios Rurales">Servicios Rurales</option>
                        <option value="Otro">Otro Rubro</option>
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 mt-2">
                        <span className="material-symbols-outlined pb-1">expand_more</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 focus-within:text-admin-accent transition-colors">
                    <label htmlFor="direccion" className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400">Dirección Física</label>
                    <input
                        type="text"
                        id="direccion"
                        name="direccion"
                        value={formData.direccion}
                        onChange={handleChange}
                        placeholder="Calle, Número y Localidad"
                        className="h-12 w-full rounded-xl bg-admin-card px-4 text-sm font-medium shadow-sm outline-none border border-admin-border focus:border-admin-accent focus:ring-1 focus:ring-admin-accent admin-transition placeholder:text-slate-600 text-admin-text"
                        required
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest pl-1 text-slate-400">Contraseña del Comercio</label>
                    <div className="h-12 w-full rounded-xl bg-slate-100 dark:bg-slate-800/50 px-4 text-sm font-medium border border-slate-200 dark:border-slate-700 flex items-center text-slate-500 cursor-not-allowed">
                        comercio1234
                    </div>
                    <p className="text-[10px] text-slate-400 pl-1">Esta es la contraseña provisoria. Se le solicitará cambiarla al ingresar por primera vez.</p>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-6 flex w-full items-center justify-center rounded-xl h-14 bg-admin-accent/10 border border-admin-accent/20 text-admin-accent hover:bg-admin-accent hover:text-white text-sm uppercase tracking-widest font-bold shadow-md active:scale-95 admin-transition disabled:opacity-50 disabled:pointer-events-none">
                    {isLoading ? 'Aprovisionando...' : 'Autorizar y Dar de Alta'}
                </button>
            </form>
        </main>
    );

    if (inlineMode) {
        return content;
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            <header className="flex items-center bg-white dark:bg-slate-900 p-4 sticky top-0 z-10 border-b border-primary/10">
                <Link to="/admin" className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center justify-center cursor-pointer">
                    <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <div className="flex-1 pr-10 text-center">
                    <h2 className="text-lg font-bold leading-tight tracking-tight">Nuevo Comercio</h2>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Administración</p>
                </div>
            </header>
            {content}
        </div>
    );
}
