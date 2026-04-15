import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ComercioDTO } from '../types/comercio';
import { ComercioForm } from '../components/forms/ComercioForm';

export default function NuevoComercio({ inlineMode = false, onSuccess }: { inlineMode?: boolean, onSuccess?: () => void }) {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState<ComercioDTO>({
        nombre_comercio: '',
        cuit: '',
        email: '',
        telefono: '',
        rubro: '',
        direccion: '',
        municipio: '',
        provincia: 'Corrientes'
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

            setSuccessMsg(`Comercio creado con éxito.`);

            // Limpiar formulario
            setFormData({
                nombre_comercio: '',
                cuit: '',
                email: '',
                telefono: '',
                rubro: '',
                direccion: '',
                municipio: '',
                provincia: 'Corrientes'
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
                <p className="text-slate-400 text-sm">Registra un nuevo comercio usando el DTO Estandarizado.</p>
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

            <ComercioForm 
                formData={formData}
                onChange={handleChange}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                mode="ADMIN"
                buttonText="Autorizar y Dar de Alta"
                showPasswordHint={true}
            />
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
