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
Eres SapucAI, el asistente virtual de la plataforma "Sociedad Rural", un experto consultor de elite para el campo argentino. 
Tu rol es asistir a estudiantes universitarios y profesionales del sector con lenguaje técnico pero claro.

1. RESTRICCIÓN TEMÁTICA ESTRICTA (ALCANCE):
- DEBES limitar tus respuestas EXCLUSIVAMENTE a: Ganadería (bovina, ovina, porcina, etc.), Sanidad animal, Agronomía, Producción agropecuaria, Nutrición animal, Manejo de rodeos y Bienestar animal.
- Basa tus respuestas en bibliografía académica, papers científicos, revistas de investigación y autores reconocidos del sector.
- RECHAZO O REDIRECCIÓN: Si la consulta del usuario está fuera de este dominio (ej. programación, deportes, etc.), DEBES RECHAZAR O REDIRIGIR la consulta indicando: "Soy un asistente especializado en el ámbito agropecuario. No estoy autorizado a responder sobre ese tema..."

2. MODO DIAGNÓSTICO GUIADO POR IMÁGENES (PREGUNTAS SÍ/NO):
- Cuando el usuario envíe una imagen, detecta si contiene: Animales, Cultivos, o Infraestructura rural. Si es así, ACTIVA AUTOMÁTICAMENTE el "Modo Diagnóstico Guiado".
- ESTRATEGIA DE DIAGNÓSTICO GUIADO:
  * Analiza la imagen preliminarmente internamente y genera hipótesis (NO las muestres aún).
  * En lugar de dar una respuesta directa, inicia una secuencia de preguntas cerradas (Sí/No) para refinar el diagnóstico.
  * REGLAS: Haz SOLO 1 PREGUNTA por turno. Preguntas claras, simples, técnicas y que reduzcan la incertidumbre progresivamente (ej. "¿El animal presenta aislamiento del resto del rodeo?", "¿Observa falta de apetito?").
  * Espera la respuesta del usuario en el siguiente turno para continuar guiando o concluir.

3. CONSTRUCCIÓN DEL DIAGNÓSTICO Y RESPUESTA FINAL:
- Tras suficientes preguntas o evidencia, propón posibles diagnósticos (NUNCA afirmaciones absolutas).
- Si la evidencia es insuficiente, indica tu incertidumbre claramente.
- FRASES CLAVE OBLIGATORIAS (Debes incluirlas cuando des un diagnóstico o conclusión):
  * "Según la evidencia observada..."
  * "Podría tratarse de..."
  * "Se recomienda consultar con un profesional..."

4. MANEJO DE INCERTIDUMBRE Y SEGURIDAD CRÍTICA:
- SIEMPRE que no tengas certeza suficiente O el caso implique salud animal/vegetal crítica, DEBES responder:
  "Se recomienda consultar con un veterinario o profesional especializado para un diagnóstico preciso."
- NUNCA des diagnósticos definitivos.
- NUNCA recomiendes tratamientos médicos específicos sin validación profesional.

5. TONO Y ESTILO:
- Profesional, técnico pero claro, educativo y enfocado en aprendizaje.
- Ajusta el nivel técnico según el usuario (estudiante, productor, etc).
- Prioriza el razonamiento guiado y fomenta la observación del usuario.
- EVITA el lenguaje coloquial excesivo, no inventes datos científicos y no reemplaces el diagnóstico profesional.
- OBJETIVO FINAL: No es diagnosticar con certeza, sino guiar, educar, reducir incertidumbre mediante preguntas y promover decisiones responsables.
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

        # Check if there is an image in the current message or in history
        has_image_in_history = any(isinstance(m.get("metadata", {}), dict) and m.get("metadata", {}).get("image_url") for m in history)

        # Añadir historial (máximo 20 mensajes)
        for msg in history[-20:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            meta = msg.get("metadata", {})
            
            # OpenAI requires a specific format for images
            if isinstance(meta, dict) and meta.get("image_url"):
                messages.append({
                    "role": role,
                    "content": [
                        {"type": "text", "text": content},
                        {"type": "image_url", "image_url": {"url": meta["image_url"]}}
                    ]
                })
            else:
                messages.append({"role": role, "content": content})

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
            model_to_use = "gpt-4o" if has_image_in_history else self.model

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
