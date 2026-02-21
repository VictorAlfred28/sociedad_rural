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

const STATIC_RESPONSES: Record<string, string> = {
  "beneficios": "¡Ser socio tiene muchas ventajas! 🐮 Tienes descuentos de hasta el 20% en veterinarias, agroinsumos y tiendas locales. Puedes ver todos los comercios adheridos en la sección 'Comercios' del portal.",
  "descuentos": "Contamos con una amplia red de comercios amigos. Presentando tu carnet digital (que encontrás en la sección 'Carnet') accedés a beneficios exclusivos en toda la zona.",
  "exposicion": "La Gran Exposición Rural es nuestro evento estrella. Generalmente se realiza en agosto con muestras de ganado, maquinaria y tradición. ¡Estate atento a la sección de 'Eventos'!",
  "cuota": "Podés consultar tu estado de deuda en la sección 'Estado de Cuenta'. Los pagos se realizan de forma segura a través de Mercado Pago directamente desde la app. 💳",
  "contacto": "Nuestra administración atiende en Ruta 12 Km 1000. También podés llamarnos al 3794-000-000 de lunes a viernes de 8 a 16hs. 🧉",
  "carnet": "Tu carnet de socio es digital. Lo encontrás siempre disponible en la pestaña 'Carnet'. Sirve para validar que sos socio activo en los comercios adheridos.",
  "remates": "Realizamos remates ferias mensuales, generalmente el tercer jueves de cada mes. Consultá el calendario de remates en la sección 'Eventos'."
};

const SUGGESTIONS = [
  { label: "Beneficios de socio 🐮", key: "beneficios" },
  { label: "Próximos eventos 🚜", key: "exposicion" },
  { label: "Pagar mi cuota 💳", key: "cuota" },
  { label: "Carnet digital 🆔", key: "carnet" },
];

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
    { id: '1', role: 'model', text: '¡Hola! Soy Rumi 🐮, tu asistente virtual de la Sociedad Rural. ¿En qué puedo ayudarte hoy? Podés elegir una opción abajo o escribirme lo que necesites.' }
  ]);

  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && !chatSessionRef.current) {
      try {
        const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
        chatSessionRef.current = model.startChat({
          history: [],
          // Nota: Las instrucciones del sistema en el SDK se pasan al obtener el modelo, pero usaremos el prompt inicial en el historial si es necesario
          // Por simplicidad en este entorno, mantenemos la lógica de envío
        });
      } catch (e) {
        console.warn("AI no disponible, usando modo estático.");
      }
    }
  }, [isOpen]);

  const handleSend = async (customText?: string) => {
    const textToSubmit = customText || input;
    if (!textToSubmit.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSubmit };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // 1. Lógica de Respuesta Local (Estática)
    const normalizedText = textToSubmit.toLowerCase();
    let localResponse = "";

    for (const [key, value] of Object.entries(STATIC_RESPONSES)) {
      if (normalizedText.includes(key)) {
        localResponse = value;
        break;
      }
    }

    if (localResponse) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: localResponse
        }]);
        setIsLoading(false);
      }, 800);
      return;
    }

    // 2. Fallback a Gemini
    try {
      if (!chatSessionRef.current) {
        const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
        chatSessionRef.current = model.startChat({ history: [] });
        // Pre-alimentamos el contexto como primer mensaje invisible o instrucción
        await chatSessionRef.current.sendMessage(SYSTEM_INSTRUCTION + "\n\nEntendido. Ahora respóndeme como Rumi.");
      }

      const result = await chatSessionRef.current.sendMessage(userMsg.text);
      const responseText = result.response.text();

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
        text: '¡Muuu! 🐮 Por ahora tengo información sobre cuotas, beneficios y eventos. ¿Sobre qué tema te gustaría saber más?'
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F0F2F5] scrollbar-thin scrollbar-thumb-gray-300">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm animate-fade-in ${msg.role === 'user'
                    ? 'bg-rural-green text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                    }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Chips de sugerencia (Solo si no está cargando) */}
            {!isLoading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug.key}
                    onClick={() => handleSend(sug.label)}
                    className="bg-white border border-rural-green/30 text-rural-green text-xs py-1.5 px-3 rounded-full hover:bg-rural-green hover:text-white transition-all duration-200 shadow-sm flex items-center gap-1"
                  >
                    {sug.label}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rural-green" />
                  <span className="text-xs text-gray-500 italic">Rumi está pensando...</span>
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
              placeholder="Escribe tu consulta aquí..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-rural-green focus:ring-1 focus:ring-rural-green"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-rural-green text-white rounded-full hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};