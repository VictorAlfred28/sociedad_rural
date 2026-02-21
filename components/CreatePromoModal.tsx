import React, { useState } from 'react';
import { Megaphone, Camera, Loader2, CheckCircle, X, Percent, FileText, Type } from 'lucide-react';
import { ApiService } from '../services/api';

interface CreatePromoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newPromo: any) => void;
}

export const CreatePromoModal: React.FC<CreatePromoModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        titulo: '',
        descripcion: '',
        descuento_base: 0,
        imagen_url: ''
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let finalImageUrl = formData.imagen_url;

            // 1. Subir imagen si hay una nueva
            if (imageFile) {
                setIsUploading(true);
                finalImageUrl = await ApiService.storage.uploadImage(imageFile, 'comercios');
                setIsUploading(false);
            }

            // 2. Crear promo en backend
            const newPromo = await ApiService.commerceSelf.createPromo({
                ...formData,
                imagen_url: finalImageUrl
            });

            onSuccess(newPromo);
            setFormData({ titulo: '', descripcion: '', descuento_base: 0, imagen_url: '' });
            setImageFile(null);
            setImagePreview(null);
            onClose();
        } catch (err: any) {
            alert(err.message || "Error al crear la promoción");
        } finally {
            setIsSaving(false);
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-rural-green px-6 py-4 flex justify-between items-center text-white">
                    <h3 className="text-xl font-serif font-bold flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-rural-gold" /> Nueva Promoción
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5">
                    {/* Imagen de la Promo */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 ml-1">Imagen de la Promoción</label>
                        <div className="relative group">
                            <div className="w-full h-40 bg-gray-50 dark:bg-slate-700 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-rural-green">
                                {imagePreview ? (
                                    <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                ) : (
                                    <>
                                        <Camera className="w-10 h-10 text-gray-300 dark:text-gray-500 mb-2" />
                                        <span className="text-xs text-gray-400">Click para subir imagen del producto o servicio</span>
                                    </>
                                )}
                                <label className="absolute inset-0 cursor-pointer">
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                </label>
                            </div>
                            {imagePreview && (
                                <button
                                    type="button"
                                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Título */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Título de la Promo</label>
                            <div className="relative">
                                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: 2x1 en hamburguesas"
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-rural-green dark:text-white"
                                    value={formData.titulo}
                                    onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Descripción */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Descripción corta</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <textarea
                                    required
                                    rows={2}
                                    placeholder="Detalles sobre el beneficio..."
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-rural-gold dark:text-white"
                                    value={formData.descripcion}
                                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Descuento */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Descuento (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-rural-green dark:text-white"
                                    value={formData.descuento_base}
                                    onChange={e => setFormData({ ...formData, descuento_base: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 ml-1">Opcional, se mostrará en la tarjeta.</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all dark:hover:bg-slate-700"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-[2] bg-rural-green text-white py-3 rounded-xl font-bold shadow-lg shadow-green-200 dark:shadow-none hover:bg-[#143225] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    {isUploading ? "Subiendo Imagen..." : "Guardando..."}
                                </>
                            ) : (
                                <><CheckCircle className="w-4 h-4" /> Publicar Promo</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
