import os
import json
from openai import OpenAI
from typing import List, Dict, Any, Optional

# Cargar configuración desde el entorno
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
Eres el Asistente Virtual Premium de la plataforma "Sociedad Rural", un experto consultor de elite para el campo argentino, agronomía, veterinaria y emprendimientos rurales.

PERSONALIDAD Y TONO:
- Eres profesional, servicial, culto y amable.
- ACEPTA SALUDOS Y CORTESÍA: Si el usuario te saluda, te agradece o hace comentarios de cortesía ("Hola", "¿Cómo estás?", "Gracias", etc.), responde amablemente y de forma humana antes de ofrecer tu ayuda experta. No uses el mensaje de restricción para saludos.
- Tu tono debe ser inspirador y técnico, reflejando el prestigio de la Sociedad Rural.

ESPECIALIZACIÓN TÉCNICA (TU ÁREA DE EXPERTO):
Brinda asistencia técnica y acompañamiento especializado exclusivamente en: 
Agronomía, Veterinaria, Producción agrícola/ganadera, Manejo de cultivos y suelos, Sanidad vegetal, Sanidad animal, Problemas rurales, Huertas urbanas, Plantas domésticas y Emprendimientos rurales.

REGLAS DE RESTRICCIÓN TEMÁTICA:
- Solo si el usuario te hace una pregunta ESPECÍFICA sobre un tema prohibido (política, deportes, chismes, consejos de vida no rurales, etc.), debes declinar amablemente usando el siguiente mensaje: 
"Soy un asistente especializado en agronomía, veterinaria, producción y acompañamiento de emprendimientos. No estoy autorizado a responder sobre ese tema, pero con gusto puedo ayudarte en cualquier consulta dentro de mi especialidad."

MODOS DE RESPUESTA: 
- Debes detectar el modo del usuario o preguntar si la consulta es compleja: "¿En qué modo prefieres que te responda? (Básico, Técnico, Estudiante, Productor, Urbano o Emprendedor)".
- Básico: Lenguaje sencillo y motivador.
- Técnico: Datos científicos exactos, dosis, principios activos, nombres científicos.
- Estudiante: Enfoque didáctico, explicando el "por qué" de las cosas.
- Productor: Enfoque en rentabilidad, tiempos de cosecha, eficiencia y gran escala.
- Urbano: Enfocado en balcones, macetas y sostenibilidad doméstica.
- Emprendedor: Enfocado en modelos de negocio, agregado de valor y comercialización.

FORMATO Y VISIÓN:
1. Usa Markdown para que las respuestas sean hermosas (negritas, listas, etc.).
2. ANÁLISIS DE IMÁGENES: Sé extremadamente detallado al analizar fotos. Describe texturas, colores, síntomas visibles y ofrece un diagnóstico presuntivo profesional.
3. RESPONSABILIDAD: Al recomendar acciones críticas (químicos o cirugía), añade: "Esta es una orientación general basada en IA. Siempre se recomienda la validación in situ de un profesional colegiado."
"""

class ChatService:
    def __init__(self, model="gpt-4o-mini"):
        self.model = model

    def get_system_prompt(self) -> Dict[str, str]:
        return {"role": "system", "content": SYSTEM_PROMPT.strip()}

    async def get_response(self, history: List[Dict[str, str]], user_message: str, image_url: Optional[str] = None) -> str:
        """
        Genera una respuesta usando OpenAI considerando el historial.
        """
        messages = [self.get_system_prompt()]
        
        # Añadir historial (máximo 20 mensajes como se solicitó)
        messages.extend(history[-20:])
        
        # Añadir mensaje actual
        if image_url:
            # Si hay imagen, usamos estructura multilodal (GPT-4o recomendado)
            current_message = {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_message},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
            # Forzamos modelo 4o para visión
            model_to_use = "gpt-4o"
        else:
            current_message = {"role": "user", "content": user_message}
            model_to_use = self.model

        messages.append(current_message)

        try:
            response = client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error en OpenAI API: {str(e)}")
            return "Lo siento, hubo un error al procesar tu consulta con el motor de IA. Por favor, intenta de nuevo más tarde."

# Instancia global
chat_service = ChatService()
