
import React, { useState, useRef, useEffect } from 'react';
import { getGeminiChatResponse } from '../services/geminiService';
import { ChatMessage } from '../types';

export const AIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const responseText = await getGeminiChatResponse(input, history);
      const botMsg: ChatMessage = { role: 'model', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Hubo un error al procesar tu mensaje.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="w-80 md:w-96 h-[500px] bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-border-light dark:border-border-dark flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-primary p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-black font-bold">smart_toy</span>
              <h3 className="text-black font-bold">Asistente Rural</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-black/70 hover:text-black">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-black/10">
            {messages.length === 0 && (
              <div className="text-center mt-10 space-y-2">
                <span className="material-symbols-outlined text-4xl text-primary/40">agriculture</span>
                <p className="text-sm text-gray-500">¡Hola! Soy tu asistente inteligente. ¿En qué puedo ayudarte hoy?</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  m.role === 'user' 
                  ? 'bg-primary text-black rounded-tr-none' 
                  : 'bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark dark:text-gray-100 rounded-tl-none shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-surface-dark p-3 rounded-2xl rounded-tl-none border border-border-light dark:border-border-dark shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escribe tu mensaje..."
                className="flex-1 rounded-xl border-border-light dark:border-border-dark dark:bg-black/20 focus:ring-primary focus:border-primary text-sm"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className="size-10 bg-primary text-black rounded-xl flex items-center justify-center hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="size-14 bg-primary text-black rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-bounce"
      >
        <span className="material-symbols-outlined text-3xl">{isOpen ? 'close' : 'chat'}</span>
      </button>
    </div>
  );
};
