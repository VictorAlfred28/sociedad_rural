import os
import logging
from openai import OpenAI, AuthenticationError, RateLimitError, APIConnectionError, APIStatusError
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── VALIDACIÓN DE API KEY AL INICIO ──────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.critical(
        "[ChatService] OPENAI_API_KEY no configurada. "
        "El chatbot estará INACTIVO. Verificar variables de entorno."
    )

# Inicializar cliente solo si hay key
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

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
    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self._ready = client is not None
        if self._ready:
            logger.info(f"[ChatService] Iniciado con modelo '{self.model}'.")
        else:
            logger.warning("[ChatService] Servicio degradado: OPENAI_API_KEY no disponible.")

    def get_system_prompt(self) -> Dict[str, str]:
        return {"role": "system", "content": SYSTEM_PROMPT.strip()}

    async def get_response(
        self,
        history: List[Dict[str, str]],
        user_message: str,
        image_url: Optional[str] = None
    ) -> str:
        """
        Genera una respuesta usando OpenAI considerando el historial.
        Lanza excepción en caso de error para que el endpoint HTTP retorne
        el código de estado correcto al frontend.
        """
        if not self._ready:
            logger.error("[ChatService] get_response llamado sin OPENAI_API_KEY configurada.")
            raise RuntimeError("El servicio de IA no está disponible. Contacte al administrador.")

        messages = [self.get_system_prompt()]

        # Añadir historial (máximo 20 mensajes)
        messages.extend(history[-20:])

        # Construir mensaje actual
        if image_url:
            # Mensaje multimodal: forzar gpt-4o para visión
            current_message = {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_message},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
            model_to_use = "gpt-4o"
        else:
            current_message = {"role": "user", "content": user_message}
            model_to_use = self.model

        messages.append(current_message)

        logger.info(
            f"[ChatService] Enviando request → modelo={model_to_use}, "
            f"history_len={len(history)}, has_image={image_url is not None}"
        )

        try:
            response = client.chat.completions.create(
                model=model_to_use,
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            content = response.choices[0].message.content
            logger.info(
                f"[ChatService] Respuesta OK → tokens_usados={response.usage.total_tokens if response.usage else 'N/A'}"
            )
            return content

        except AuthenticationError as e:
            logger.error(f"[ChatService] AuthenticationError – API Key inválida o expirada: {e}")
            raise RuntimeError("Error de autenticación con OpenAI. Contacte al administrador.")

        except RateLimitError as e:
            logger.warning(f"[ChatService] RateLimitError – Límite de solicitudes excedido: {e}")
            raise RuntimeError("Se alcanzó el límite de solicitudes. Intente nuevamente en unos instantes.")

        except APIConnectionError as e:
            logger.error(f"[ChatService] APIConnectionError – Sin conexión a OpenAI: {e}")
            raise RuntimeError("No se pudo conectar con el servicio de IA. Verifique la conexión del servidor.")

        except APIStatusError as e:
            logger.error(f"[ChatService] APIStatusError {e.status_code} – {e.message}")
            raise RuntimeError(f"Error del servicio de IA (código {e.status_code}). Intente más tarde.")

        except Exception as e:
            logger.error(f"[ChatService] Error inesperado en OpenAI: {type(e).__name__}: {e}")
            raise RuntimeError("Error inesperado al procesar la consulta. Intente de nuevo.")


# Instancia global
chat_service = ChatService()
