import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, User, ChevronRight, Info, Calendar, CreditCard, Gift } from 'lucide-react';
import avatarImg from '../assets/vaquita.png';

interface Message {
    id: string;
    text: string;
    sender: 'bot' | 'user';
    timestamp: Date;
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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            setTimeout(scrollToBottom, 100);
        }
    }, [messages, isOpen]);

    const handleOptionClick = (option: any) => {
        const userMsg: Message = {
            id: Date.now().toString(),
            text: option.label,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);

        // If option has a URL, open it
        if (option.url) {
            window.open(option.url, '_blank');
        }

        // Simulate bot thinking
        setTimeout(() => {
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: option.response,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        }, 600);
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
                        className="mb-4 w-[350px] max-w-[90vw] h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 flex items-center justify-between text-white shadow-md">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 p-1 backdrop-blur-sm border border-white/30 overflow-hidden">
                                    <img src={avatarImg} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Asistente Virtual</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                                        <span className="text-[10px] text-emerald-50 text-opacity-80">En línea</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, x: msg.sender === 'bot' ? -10 : 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div
                                        className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${msg.sender === 'bot'
                                            ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                                            : 'bg-emerald-600 text-white rounded-tr-none'
                                            }`}
                                    >
                                        {msg.text}
                                        <div className={`text-[9px] mt-1 opacity-60 ${msg.sender === 'bot' ? 'text-slate-500' : 'text-emerald-50'}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Options Tags */}
                        <div className="p-3 border-t bg-white">
                            <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wider font-semibold px-1">Temas frecuentes</p>
                            <div className="flex flex-wrap gap-2">
                                {PREDEFINED_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleOptionClick(option)}
                                        className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 rounded-full text-xs transition-colors border border-slate-200"
                                    >
                                        {option.icon}
                                        <span className="truncate">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Footer decoration */}
                        <div className="p-3 bg-slate-50 border-t flex items-center justify-center">
                            <span className="text-[10px] text-slate-400 italic">Sociedad Rural — Siempre con vos</span>
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
