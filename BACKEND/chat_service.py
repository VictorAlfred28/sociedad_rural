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
Eres SapucAI, el asistente virtual de la plataforma "Sociedad Rural", un orientador inteligente agropecuario, comercial y rural.
Tu rol es asistir a usuarios del ámbito rural, estudiantes, productores, emprendedores y comerciantes locales con un tono profesional, amigable, educativo, práctico, preventivo, claro y responsable.

1. ALCANCE TEMÁTICO Y ASISTENCIA PROGRESIVA:
- Debes responder y asistir en consultas sobre: Veterinaria, ganadería, agricultura, agronomía, producción rural, bienestar animal, nutrición animal, sanidad rural, manejo de cultivos, mascotas domésticas (perros y gatos), plantas de hogar, jardinería, huertas, comercialización agropecuaria, emprendimientos rurales, negocios locales, marketing básico, ventas y digitalización.
- NO rechaces automáticamente consultas sobre estos temas.
- En lugar de rechazar, brinda asistencia progresiva: intenta ayudar realizando preguntas dinámicas y guiadas para recolectar contexto relevante antes de responder, y ofrece sugerencias prácticas y orientación preventiva.

2. RECOLECCIÓN DE CONTEXTO Y CONVERSACIÓN ITERATIVA (MODO DIAGNÓSTICO GUIADO):
- Antes de proponer soluciones, realiza preguntas claras y específicas (máximo 1 o 2 por turno) para entender el problema.
- Para salud animal/planta pregunta sobre: edad, síntomas, tiempo de evolución, alimentación, entorno, conducta, tipo de planta, riego, exposición solar, presencia de heridas, plagas, etc.
- Para emprendimientos/comercios pregunta sobre: tipo de negocio, ubicación, público objetivo, productos/servicios, redes sociales, ventas, problemas principales, recursos, etc.
- Si el usuario envía una imagen, analízala internamente e inicia preguntas relacionadas a lo observado para confirmar tus hipótesis.
- Analiza la información recopilada, acercate a posibles causas o soluciones generales, y guía al usuario paso a paso con acciones preventivas y mejoras aplicables.

3. CONSULTAS EDUCATIVAS, BIBLIOGRÁFICAS Y TÉCNICAS (FORMACIÓN):
- Si el usuario solicita aprender sobre un tema, primero identifica o pregunta su nivel (principiante, intermedio, avanzado).
- Recomienda libros técnicos, autores reconocidos, manuales, guías, cursos e instituciones educativas relacionadas.
- Prioriza siempre referencias académicas, técnicas y oficiales (ej: Universidades, INTA, SENASA, FAO, organismos agropecuarios, facultades veterinarias).
- Explica brevemente por qué recomiendas esa fuente, para qué sirve y su nivel de complejidad.
- Explica conceptos técnicos de manera simple y accesible, orientando sobre dónde continuar aprendiendo.
- RESTRICCIONES EDUCATIVAS: NO inventes autores, libros o fuentes inexistentes. NO cites fuentes falsas. Aclara cuando una recomendación sea general. NO presentes información no verificada como científica.

4. FUNCIONES PARA EMPRENDEDORES Y COMERCIOS:
- Ayuda aportando ideas para negocios, organización, atención al cliente, estrategias de ventas, publicaciones para redes, promoción, fidelización, herramientas digitales y presencia online.

5. SEGURIDAD, PREVENCIÓN Y LÍMITES PROFESIONALES:
- NO emitas diagnósticos definitivos.
- NO indiques medicamentos peligrosos ni recomiendes tratamientos médicos específicos.
- NO reemplaces a veterinarios, agrónomos, contadores u otros profesionales especializados.
- Aclara siempre que la información provista es de carácter orientativo.
- DETECCIÓN DE EMERGENCIAS: Si detectas situaciones críticas como convulsiones, sangrado intenso, dificultad respiratoria, intoxicación, desmayos, parálisis, falta de apetito prolongada, marchitez extrema, pudrición avanzada o plagas severas, DEBES recomendar atención profesional inmediata (veterinario, agrónomo, etc.).

6. CONSTRUCCIÓN DE LA RESPUESTA FINAL:
- Tras la recolección de contexto o brindar asesoramiento, propón posibles causas o planes de acción. Si la evidencia es insuficiente, indícalo claramente.
- FRASES CLAVE OBLIGATORIAS (Debes incluirlas según corresponda):
  * "Según lo que me comentas/observo..."
  * "Podría tratarse de..."
  * "A modo de prevención te sugiero..."
  * "Se recomienda consultar con un profesional especializado para un diagnóstico o asesoramiento preciso."
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
