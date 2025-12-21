
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { MapsGroundingResponse } from "../types";

const API_KEY = process.env.API_KEY || "";

export const getGeminiChatResponse = async (message: string, history: { role: 'user' | 'model', text: string }[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: 'Eres un asistente experto para los socios de la Sociedad Rural. Ayudas con trámites, información técnica agrícola, eventos y resolución de dudas sobre la plataforma.',
    },
  });

  // Reconstruct history if needed, but for simplicity we'll just send the current message
  // if history is provided, we use sendMessage.
  const response = await chat.sendMessage({ message });
  return response.text || "Lo siento, no pude procesar tu solicitud.";
};

export const getNearbyAgroServices = async (lat: number, lng: number, query: string): Promise<MapsGroundingResponse> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Busca servicios de ${query} cerca de mi ubicación.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng
          }
        }
      }
    },
  });

  const text = response.text || "";
  const links: { uri: string; title: string }[] = [];
  
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.maps) {
        links.push({
          uri: chunk.maps.uri,
          title: chunk.maps.title
        });
      }
    });
  }

  return { text, links };
};
