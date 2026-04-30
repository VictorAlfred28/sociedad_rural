import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    { id: 'carnet', label: 'Mi Carnet Digital', icon: <CreditCard size={14} />, response: '¡Hola! Para ver tu Carnet Digital, podés ir a la sección "Pasaporte" en el menú inferior. Ahí encontrarás tu QR para identificarte.' },
    { id: 'mercado', label: 'Mercado Agroganadero', icon: <Info size={14} />, url: 'https://www.mercadoagroganadero.com.ar/dll/hacienda1.dll/haciinfo000502', response: 'Redirigiendo al Mercado Agroganadero...' },
    { id: 'rosgan', label: 'Rosgan', icon: <Info size={14} />, url: 'https://www.rosgan.com.ar/', response: 'Redirigiendo a Rosgan...' },
    { id: 'eventos', label: 'Agenda Rural', icon: <Calendar size={14} />, response: 'Podés consultar todos los eventos en la sección "Agenda Rural" desde el inicio.' },
    { id: 'beneficios', label: 'Beneficios', icon: <Gift size={14} />, response: 'Como socio tenés descuentos exclusivos. Miralos en "Beneficios del Socio".' },
    { id: 'ayuda', label: 'Soporte', icon: <Info size={14} />, response: 'Si necesitás ayuda técnica, escribinos por WhatsApp al +54 9 11 1234-5678.' },
];

export const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: '¡Hola! Soy SapucAI, tu asistente de la Sociedad Rural. ¿En qué puedo asesorarte hoy?',
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
        
        if (option.response) {
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
            handleSendMessage(option.label);
        }
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es demasiado grande (máx 5MB).');
            return;
        }

        setIsUploadingImage(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/chat/upload-image`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Error en subida');

            setSelectedImage({ url: data.image_url, path: data.path });
        } catch (error: any) {
            console.error('Error en subida:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
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

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Error de conexión');

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: data.response,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error: any) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: error?.message || 'Lo siento, tuve un problema técnico. Reintentá en unos momentos.',
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-28 right-6 z-50 flex flex-col items-end pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-end">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9, originX: 1, originY: 1 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.9 }}
                            className="mb-4 w-[360px] max-w-[90vw] h-[550px] bg-[#f4eedd] dark:bg-stone-900 rounded-[2.5rem] shadow-[0_20px_50px_rgba(36,91,49,0.15)] border border-stone-200/50 dark:border-stone-700/50 flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-[#245b31] p-6 flex items-center justify-between text-white relative overflow-hidden">
                                {/* Ornamento botánico sutil en el fondo del header */}
                                <div className="absolute -top-4 -right-4 text-white/10 opacity-30 pointer-events-none rotate-12">
                                    <span className="material-symbols-outlined text-7xl select-none">eco</span>
                                </div>
                                
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="size-11 rounded-2xl bg-white/20 p-0.5 backdrop-blur-md border border-white/30 overflow-hidden shadow-inner">
                                        <img src={avatarImg} alt="SapucAI" className="w-full h-full object-cover rounded-xl" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl tracking-tighter uppercase italic leading-none font-display">SapucAI</h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="size-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100/80">Experto Rural</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="size-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 relative z-10 border border-white/10"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth custom-scrollbar">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, x: msg.sender === 'bot' ? -10 : 10, y: 5 }}
                                        animate={{ opacity: 1, x: 0, y: 0 }}
                                        className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div
                                            className={`max-w-[88%] p-4 rounded-[1.8rem] text-xs shadow-sm transition-all border ${msg.sender === 'bot'
                                                ? 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 rounded-tl-none border-stone-200/60 dark:border-stone-700'
                                                : 'bg-[#245b31] text-white rounded-tr-none border-[#245b31]/10'
                                                }`}
                                        >
                                            {msg.image && (
                                                <div className="mb-3 rounded-2xl overflow-hidden border border-black/5 shadow-md">
                                                    <img src={msg.image} alt="Adjunto" className="w-full max-h-48 object-cover" />
                                                </div>
                                            )}
                                            <p className="leading-relaxed font-semibold whitespace-pre-wrap">{msg.text}</p>
                                            <div className={`text-[8px] mt-2.5 font-black uppercase tracking-widest flex items-center gap-1 ${msg.sender === 'bot' ? 'text-stone-400' : 'text-emerald-100/60'}`}>
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {msg.sender === 'user' && <span className="material-symbols-outlined text-[10px] leading-none">done_all</span>}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white dark:bg-stone-800 p-4 rounded-[1.5rem] rounded-tl-none border border-stone-200/60 dark:border-stone-700 shadow-sm flex items-center gap-3">
                                            <div className="flex gap-1">
                                                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="size-1.5 bg-[#245b31] rounded-full" />
                                                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="size-1.5 bg-[#245b31] rounded-full" />
                                                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="size-1.5 bg-[#245b31] rounded-full" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Analizando...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Tags / Quick Actions */}
                            <div className="px-4 py-3 border-t border-stone-200/40 dark:border-stone-700/40 bg-white/50 dark:bg-stone-800/50 backdrop-blur-sm overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2">
                                    {PREDEFINED_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => handleOptionClick(option)}
                                            className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-stone-900 hover:bg-[#245b31] text-stone-600 hover:text-white dark:text-stone-400 dark:hover:text-white rounded-full text-[10px] font-black uppercase tracking-tight transition-all border border-stone-200 dark:border-stone-700 hover:border-[#245b31] shadow-sm active:scale-95"
                                        >
                                            {option.icon}
                                            <span>{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Input Area */}
                            <div className="p-5 bg-white dark:bg-stone-800 border-t border-stone-200/50 dark:border-stone-700/50 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
                                {selectedImage && (
                                    <div className="mb-4 relative inline-block">
                                        <motion.div 
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="size-20 rounded-2xl overflow-hidden border-2 border-[#245b31] shadow-xl relative group"
                                        >
                                            <img src={selectedImage.url} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button 
                                                    onClick={() => setSelectedImage(null)}
                                                    className="bg-red-500 text-white p-1.5 rounded-full shadow-lg transform hover:scale-110 transition-transform"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}

                                <form 
                                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                    className="flex items-center gap-2 bg-[#f4eedd]/50 dark:bg-stone-900 rounded-[1.5rem] px-4 py-2 border-2 border-transparent focus-within:border-[#245b31]/30 focus-within:bg-white transition-all shadow-inner"
                                >
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`p-2 rounded-xl transition-all ${isUploadingImage ? 'animate-pulse text-[#245b31]' : 'text-stone-400 hover:text-[#245b31] hover:bg-[#245b31]/5'}`}
                                        title="Adjuntar imagen"
                                    >
                                        {isUploadingImage ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
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
                                        placeholder="Consultar experto rural..."
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] py-2 text-stone-800 dark:text-stone-100 font-bold placeholder:text-stone-400 placeholder:font-medium tracking-tight"
                                    />
                                    <button
                                        type="submit"
                                        disabled={(!inputText.trim() && !selectedImage) || isLoading}
                                        className={`size-10 rounded-xl flex items-center justify-center transition-all ${
                                            (inputText.trim() || selectedImage) && !isLoading
                                                ? 'bg-[#245b31] text-white shadow-[0_5px_15px_rgba(36,91,49,0.3)] hover:scale-105 active:scale-95'
                                                : 'bg-stone-200 dark:bg-stone-700 text-stone-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <Send size={18} />
                                    </button>
                                </form>
                                <div className="mt-3 flex items-center justify-center gap-1.5 opacity-40">
                                    <div className="h-[1px] w-4 bg-stone-300" />
                                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-stone-500 font-display italic">SapucAI Intelligence</span>
                                    <div className="h-[1px] w-4 bg-stone-300" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`size-16 rounded-[1.8rem] shadow-2xl flex items-center justify-center transition-all duration-500 border-4 ${isOpen
                        ? 'bg-white border-[#245b31] text-[#245b31]'
                        : 'bg-[#245b31] border-white text-white'
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
                                <X size={24} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="avatar"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="w-full h-full relative p-0.5"
                            >
                                <img src={avatarImg} alt="Vaca" className="w-full h-full object-cover rounded-[1.4rem]" />
                                <div className="absolute -top-1 -right-1 bg-red-500 size-4 rounded-full border-2 border-white animate-bounce" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>
        </div>
    );
};
