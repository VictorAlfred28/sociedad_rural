import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import { ApiService } from '../services/api';

// Configuración inicial de Gemini
const ai = new GoogleGenerativeAI((import.meta as any).env.VITE_API_KEY || '');

// Prompt del Sistema para darle personalidad y contexto
const SYSTEM_INSTRUCTION = `
Eres "Rumi", una vaquita simpática y servicial, asistente virtual de la Sociedad Rural del Norte de Corrientes.
Tu objetivo es ayudar a los socios con información rápida y precisa.

Información Clave de la Sociedad:
1. **Descuentos**: Los socios tienen descuentos en comercios adheridos (veterinarias, agroinsumos, talabarterías, indumentaria). El porcentaje varía según el plan del comercio (Premium ofrece más beneficios).
2. **Carnet Digital**: Se accede desde la sección "Carnet" o "Inicio" del portal. Sirve para validar identidad y acceder a eventos.
3. **Pagos**: Las cuotas se pueden pagar vía Mercado Pago desde la sección "Estado de Cuenta".
4. **Eventos**: La "Gran Exposición Rural" se realiza anualmente en Agosto. Hay remates mensuales el tercer jueves de cada mes.
5. **Contacto**: Para temas administrativos complejos, sugiere llamar al 3794-000-000 o ir a la sede en Ruta 12 Km 1000.

Tono de conversación:
- Amable, campero y profesional.
- Usa emojis relacionados con el campo esporádicamente (🐮, 🌾, 🚜, 🧉).
- Sé breve y directo.
- Si no sabes algo, di que no tienes la información y sugiere contactar a la administración.
`;

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: '¡Hola! Soy Rumi 🐮, tu asistente virtual. ¿En qué puedo ayudarte hoy? Consultame sobre descuentos, eventos o tu cuota.' }
  ]);

  // Referencia al chat de Gemini para mantener historial
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Inicializar sesión de chat al abrir
  useEffect(() => {
    if (isOpen && !chatSessionRef.current) {
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatSessionRef.current) {
        // Fallback por si la ref se perdió
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: { systemInstruction: SYSTEM_INSTRUCTION },
        });
      }

      const result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      const responseText = result.text;

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText
      }]);

    } catch (error) {
      console.error("Error Gemini:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: '¡Muuu! 🐮 Tuve un problema de conexión. Por favor, intenta de nuevo más tarde.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      {/* Botón Flotante (Vaquita) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-rural-green hover:bg-[#143225] text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 z-50 group border-2 border-rural-gold"
          title="Consultar a Rumi"
        >
          <span className="text-2xl animate-bounce">🐮</span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </button>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 flex flex-col animate-fade-in-up" style={{ maxHeight: '80vh', height: '500px' }}>

          {/* Header */}
          <div className="bg-rural-green p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl border-2 border-rural-gold shadow-sm">
                🐮
              </div>
              <div>
                <h3 className="font-bold font-serif">Rumi</h3>
                <p className="text-xs text-green-200 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> En línea
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F0F2F5]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user'
                    ? 'bg-rural-green text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                    }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rural-green" />
                  <span className="text-xs text-gray-500">Rumi está pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Pregunta sobre cuotas, eventos..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-rural-green focus:ring-1 focus:ring-rural-green"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-rural-green text-white rounded-full hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};