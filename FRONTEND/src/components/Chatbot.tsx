import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, User, ChevronRight, Info, Calendar, CreditCard, Gift, Loader2, Image as ImageIcon, Paperclip, Trash2 } from 'lucide-react';
import avatarImg from '../assets/vaquita.png';
import { useAuth } from '../context/AuthContext';

interface Message {
    id: string;
    text: string;
    sender: 'bot' | 'user';
    timestamp: Date;
    image?: string;
}

const PREDEFINED_OPTIONS = [
    { id: 'carnet', label: 'Mi Carnet Digital', icon: <CreditCard size={16} />, response: '¡Hola! Para ver tu Carnet Digital, podés ir a la sección "Carnet" en el menú inferior. Ahí encontrarás tu QR para identificarte en comercios.' },
    { id: 'guia', label: 'Guia Agro', icon: <Gift size={16} />, url: 'https://www.afip.gob.ar/actividadesAgropecuarias/sector-agro/novedades/', response: '¡Claro! Te estoy redirigiendo a la Guía Agro de AFIP...' },
    { id: 'senasa', label: 'Trámites SENASA', icon: <Info size={16} />, url: 'https://www.argentina.gob.ar/senasa/tramites', response: '¡Claro! Te estoy redirigiendo a la página de Trámites de SENASA...' },
    { id: 'eventos', label: 'Eventos Rurales', icon: <Calendar size={16} />, response: 'Estamos organizando la próxima gran feria para el mes que viene. ¡Estate atento a la sección de Novedades para inscribirte!' },
    { id: 'beneficios', label: 'Beneficios y Comercios', icon: <Gift size={16} />, response: 'Como socio, tenés descuentos exclusivos en más de 50 comercios adheridos. Revisá la lista completa en la pantalla "Comercios".' },
    { id: 'ayuda', label: 'Soporte Técnico', icon: <Info size={16} />, response: 'Si tenés algún problema con la App, podés contactarnos por WhatsApp al +54 9 11 1234-5678 o enviarnos un mail.' },
];

export const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: '¡Hola! Soy tu asistente de la Sociedad Rural. ¿En qué puedo ayudarte hoy?',
            sender: 'bot',
            timestamp: new Date(),
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ url: string, path: string } | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const { token } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            setTimeout(scrollToBottom, 100);
        }
    }, [messages, isOpen]);

    const handleOptionClick = (option: any) => {
        if (option.url) {
            window.open(option.url, '_blank');
            return;
        }
        
        // Si tiene respuesta predefinida, la usamos directamente (más rápido para FAQs)
        if (option.response && !option.id.includes('dynamic')) {
            const userMsg: Message = {
                id: Date.now().toString(),
                text: option.label,
                sender: 'user',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, userMsg]);
            
            setTimeout(() => {
                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    text: option.response,
                    sender: 'bot',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, botMsg]);
            }, 600);
        } else {
            // Si no, enviamos el texto a la API
            handleSendMessage(option.label);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validación de tamaño (Máximo 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es demasiado grande. Máximo 5MB.');
            return;
        }

        setIsUploadingImage(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/chat/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                const errorDetail = data.detail || 'Error desconocido en el servidor';
                throw new Error(errorDetail);
            }

            setSelectedImage({ url: data.image_url, path: data.path });
        } catch (error: any) {
            console.error('Error en subida:', error);
            alert(`No se pudo subir la imagen: ${error.message || 'Error de conexión'}`);
        } finally {
            setIsUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        }
    };

    const handleSendMessage = async (textToSend?: string) => {
        const text = textToSend || inputText;
        if ((!text.trim() && !selectedImage) || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: text,
            sender: 'user',
            timestamp: new Date(),
            image: selectedImage?.url
        };

        setMessages(prev => [...prev, userMsg]);
        if (!textToSend) setInputText('');
        const currentImage = selectedImage;
        setSelectedImage(null);
        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: text,
                    mode: 'Básico',
                    image_url: currentImage?.url
                })
            });

            if (!response.ok) {
                // Intentar leer el mensaje de error del servidor
                let serverMessage = 'Error en la comunicación con el asistente.';
                try {
                    const errData = await response.json();
                    if (errData?.detail) serverMessage = errData.detail;
                } catch { /* ignorar si no es JSON */ }
                console.error(`[Chatbot] Error ${response.status} del servidor:`, serverMessage);
                throw new Error(serverMessage);
            }

            const data = await response.json();

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: data.response,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error: any) {
            console.error('[Chatbot] Error al enviar mensaje:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: error?.message || 'Lo siento, tuve un problema al procesar tu consulta. Por favor, reintenta.',
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-4 w-[380px] max-w-[95vw] h-[550px] bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-emerald-600/90 to-teal-800/90 p-5 flex items-center justify-between text-white shadow-lg backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 p-1 backdrop-blur-lg border border-white/30 overflow-hidden shadow-inner">
                                    <img src={avatarImg} alt="Avatar" className="w-full h-full object-cover rounded-xl" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base tracking-tight">Asistente Virtual</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                        <span className="text-[11px] font-medium text-emerald-50 text-opacity-90">Soporte Rural 24/7</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-90"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div
                                        className={`max-w-[85%] p-4 rounded-[2rem] text-sm shadow-md transition-all ${msg.sender === 'bot'
                                            ? 'bg-white/70 backdrop-blur-sm text-slate-800 rounded-tl-none border border-white/50'
                                            : 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-tr-none shadow-emerald-900/10'
                                            }`}
                                    >
                                        {msg.image && (
                                            <div className="mb-2 rounded-xl overflow-hidden shadow-sm border border-black/5">
                                                <img src={msg.image} alt="Adjunto" className="w-full max-h-48 object-cover" />
                                            </div>
                                        )}
                                        <p className="leading-relaxed">{msg.text}</p>
                                        <div className={`text-[9px] mt-2 font-medium opacity-60 flex items-center gap-1 ${msg.sender === 'bot' ? 'text-slate-500' : 'text-emerald-50'}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            {msg.sender === 'user' && <span className="material-symbols-outlined text-[10px]">done_all</span>}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            {/* Indicador de carga */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-white text-slate-500 p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                                        <Loader2 size={16} className="animate-spin text-emerald-600" />
                                        <span className="text-xs">Escribiendo...</span>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Options Tags */}
                        <div className="p-3 border-t bg-white overflow-x-auto">
                            <div className="flex gap-2 pb-1">
                                {PREDEFINED_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleOptionClick(option)}
                                        className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-full text-[10px] transition-colors border border-slate-100"
                                    >
                                        {option.icon}
                                        <span>{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white/40 backdrop-blur-md border-t border-white/20">
                            {/* Selected Image Preview */}
                            <AnimatePresence>
                                {selectedImage && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mb-3 relative group"
                                    >
                                        <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                                            <img src={selectedImage.url} alt="Preview" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => setSelectedImage(null)}
                                                className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendMessage();
                                }}
                                className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 border border-slate-200 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all shadow-sm"
                            >
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-1.5 rounded-xl transition-all ${isUploadingImage ? 'text-emerald-300 animate-pulse' : 'text-slate-400 hover:bg-slate-100 hover:text-emerald-600'}`}
                                >
                                    {isUploadingImage ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Consultar al experto..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 text-slate-700 placeholder:text-slate-400 font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={(!inputText.trim() && !selectedImage) || isLoading}
                                    className={`p-2 rounded-xl transition-all transform active:scale-90 ${
                                        (inputText.trim() || selectedImage) && !isLoading
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                            : 'text-slate-300 cursor-not-allowed'
                                    }`}
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                            <div className="mt-3 flex items-center justify-center gap-1.5">
                                <Info size={10} className="text-emerald-600" />
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">Sociedad Rural Intelligence</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB (Floating Action Button) */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 border-2 ${isOpen
                    ? 'bg-white border-emerald-500 text-emerald-500'
                    : 'bg-emerald-600 border-white text-white'
                    }`}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                        >
                            <X size={28} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="avatar"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="w-full h-full relative p-0.5"
                        >
                            <img src={avatarImg} alt="Vaca" className="w-full h-full object-cover rounded-full" />
                            <div className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full border-2 border-white" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
};
