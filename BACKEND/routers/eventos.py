"""
Routers para Gestión de Eventos y Municipios
SPEC Avanzado - Sistema de Eventos por Municipio
"""

import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, status, Request, BackgroundTasks
from pydantic import ValidationError
import re

# Imports locales (ajustar según tu estructura)
# from ..schemas.eventos import *
# from ..core.security import get_current_admin, get_current_user
# from ..db import supabase
# from ..utils.audit import registrar_auditoria

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Eventos y Municipios"])

# ────────────────────────────────────────────────────────────────────────────
# UTILIDADES
# ────────────────────────────────────────────────────────────────────────────

def validar_url(url: Optional[str]) -> bool:
    """Valida que una URL sea válida"""
    if not url:
        return True
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return bool(url_pattern.match(url))


def generar_slug_unico(titulo: str, supabase_client) -> str:
    """Genera un slug único basado en el título"""
    import re
    from datetime import datetime
    
    # Normalizar título
    slug = titulo.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    
    # Agregar timestamp para garantizar unicidad
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    base_slug = f"{slug}-{timestamp}"
    
    # Verificar que sea único en la BD
    try:
        existing = supabase_client.table("eventos").select("id").eq("slug", base_slug).execute()
        if not existing.data:
            return base_slug
    except Exception:
        pass
    
    # Si existe, agregar número
    for i in range(1, 100):
        slug_candidate = f"{base_slug}-{i}"
        try:
            existing = supabase_client.table("eventos").select("id").eq("slug", slug_candidate).execute()
            if not existing.data:
                return slug_candidate
        except Exception:
            return slug_candidate
    
    return base_slug


# ────────────────────────────────────────────────────────────────────────────
# ENDPOINTS: MUNICIPIOS (CRUD)
# ────────────────────────────────────────────────────────────────────────────

# @router.get("/municipios", response_model=List[MunicipioResponse])
# def listar_municipios(
#     activo_solo: Optional[bool] = Query(True, description="¿Mostrar solo municipios activos?"),
# ):
#     """Lista todos los municipios disponibles"""
#     try:
#         query = supabase.table("municipios").select("*")
#         if activo_solo:
#             query = query.eq("activo", True)
#         
#         res = query.order("nombre", desc=False).execute()
#         return res.data or []
#     except Exception as e:
#         logger.error(f"Error listando municipios: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Error al obtener municipios: {str(e)}"
#         )


# @router.post("/admin/municipios", response_model=MunicipioResponse, status_code=201)
# def crear_municipio(
#     municipio: MunicipioCreate,
#     request: Request,
#     background_tasks: BackgroundTasks,
#     admin_user=Depends(get_current_admin),
# ):
#     """Crea un nuevo municipio (solo admins)"""
#     try:
#         municipio_data = municipio.dict()
#         
#         # Verificar que no exista ya
#         existing = supabase.table("municipios").select("id").eq("nombre", municipio_data["nombre"]).execute()
#         if existing.data:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Ya existe un municipio con ese nombre"
#             )
#         
#         res = supabase.table("municipios").insert(municipio_data).execute()
#         
#         if res.data:
#             background_tasks.add_task(
#                 registrar_auditoria,
#                 usuario_id=admin_user.id,
#                 email_usuario=admin_user.email,
#                 rol_usuario="ADMIN",
#                 accion="CREATE",
#                 tabla="municipios",
#                 registro_id=res.data[0]["id"],
#                 datos_anteriores=None,
#                 datos_nuevos=municipio_data,
#                 modulo="Gestión Municipios",
#                 request=request,
#             )
#             return res.data[0]
#         
#         raise HTTPException(status_code=500, detail="Error al crear municipio")
#     except ValidationError as e:
#         raise HTTPException(status_code=422, detail=str(e))
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error creando municipio: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.put("/admin/municipios/{municipio_id}", response_model=MunicipioResponse)
# def actualizar_municipio(
#     municipio_id: UUID,
#     municipio: MunicipioUpdate,
#     request: Request,
#     background_tasks: BackgroundTasks,
#     admin_user=Depends(get_current_admin),
# ):
#     """Actualiza un municipio (solo admins)"""
#     try:
#         # Obtener municipio actual
#         existing = supabase.table("municipios").select("*").eq("id", str(municipio_id)).execute()
#         if not existing.data:
#             raise HTTPException(status_code=404, detail="Municipio no encontrado")
#         
#         datos_anteriores = existing.data[0]
#         update_data = {k: v for k, v in municipio.dict().items() if v is not None}
#         
#         if not update_data:
#             return datos_anteriores
#         
#         res = supabase.table("municipios").update(update_data).eq("id", str(municipio_id)).execute()
#         
#         if res.data:
#             background_tasks.add_task(
#                 registrar_auditoria,
#                 usuario_id=admin_user.id,
#                 email_usuario=admin_user.email,
#                 rol_usuario="ADMIN",
#                 accion="UPDATE",
#                 tabla="municipios",
#                 registro_id=str(municipio_id),
#                 datos_anteriores=datos_anteriores,
#                 datos_nuevos=update_data,
#                 modulo="Gestión Municipios",
#                 request=request,
#             )
#             return res.data[0]
#         
#         raise HTTPException(status_code=500, detail="Error al actualizar municipio")
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error actualizando municipio: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.delete("/admin/municipios/{municipio_id}", status_code=204)
# def eliminar_municipio(
#     municipio_id: UUID,
#     request: Request,
#     background_tasks: BackgroundTasks,
#     admin_user=Depends(get_current_admin),
# ):
#     """Elimina un municipio (solo admins)"""
#     try:
#         existing = supabase.table("municipios").select("*").eq("id", str(municipio_id)).execute()
#         if not existing.data:
#             raise HTTPException(status_code=404, detail="Municipio no encontrado")
#         
#         datos_anteriores = existing.data[0]
#         
#         # Verificar que no haya eventos asociados
#         eventos = supabase.table("eventos").select("id").eq("municipio_id", str(municipio_id)).execute()
#         if eventos.data:
#             raise HTTPException(
#                 status_code=400,
#                 detail="No se puede eliminar municipio con eventos asociados. Marcar como inactivo en su lugar."
#             )
#         
#         supabase.table("municipios").delete().eq("id", str(municipio_id)).execute()
#         
#         background_tasks.add_task(
#             registrar_auditoria,
#             usuario_id=admin_user.id,
#             email_usuario=admin_user.email,
#             rol_usuario="ADMIN",
#             accion="DELETE",
#             tabla="municipios",
#             registro_id=str(municipio_id),
#             datos_anteriores=datos_anteriores,
#             datos_nuevos=None,
#             modulo="Gestión Municipios",
#             request=request,
#         )
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error eliminando municipio: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ────────────────────────────────────────────────────────────────────────────
# ENDPOINTS: EVENTOS (CRUD)
# ────────────────────────────────────────────────────────────────────────────

# @router.get("/eventos", response_model=List[EventoPublicResponse])
# def listar_eventos_publicos(
#     municipio_id: Optional[UUID] = None,
#     tipo: Optional[str] = None,
#     destacado_solo: Optional[bool] = None,
#     fecha_desde: Optional[str] = None,
# ):
#     """Lista eventos públicos y publicados (accesible a todos)"""
#     try:
#         query = supabase.table("eventos").select("*")
#         query = query.eq("estado", "publicado")
#         query = query.eq("publico", True)
#         
#         if municipio_id:
#             query = query.eq("municipio_id", str(municipio_id))
#         if tipo:
#             query = query.eq("tipo", tipo)
#         if destacado_solo:
#             query = query.eq("destacado", True)
#         if fecha_desde:
#             query = query.gte("fecha_inicio", fecha_desde)
#         
#         res = query.order("fecha_inicio", desc=False).execute()
#         return res.data or []
#     except Exception as e:
#         logger.error(f"Error listando eventos públicos: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.get("/eventos/{evento_id}", response_model=EventoPublicResponse)
# def obtener_evento_detalle(evento_id: UUID):
#     """Obtiene detalles completos de un evento público"""
#     try:
#         res = supabase.table("eventos").select("*").eq("id", str(evento_id)).eq("estado", "publicado").execute()
#         
#         if not res.data:
#             raise HTTPException(status_code=404, detail="Evento no encontrado")
#         
#         return res.data[0]
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error obteniendo evento: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.post("/admin/eventos", response_model=EventoResponse, status_code=201)
# def crear_evento(
#     evento: EventoCreate,
#     request: Request,
#     background_tasks: BackgroundTasks,
#     admin_user=Depends(get_current_admin),
# ):
#     """Crea un nuevo evento (solo admins)"""
#     try:
#         evento_data = evento.dict()
#         
#         # Validar URLs
#         for url_field in ["link_instagram", "link_facebook", "link_whatsapp", "link_externo", "imagen_principal", "video_url"]:
#             if evento_data.get(url_field) and not validar_url(evento_data[url_field]):
#                 raise HTTPException(
#                     status_code=422,
#                     detail=f"URL inválida en campo {url_field}"
#                 )
#         
#         # Generar slug si no se proporciona
#         if not evento_data.get("slug"):
#             evento_data["slug"] = generar_slug_unico(evento_data["titulo"], supabase)
#         else:
#             # Verificar que slug sea único
#             existing = supabase.table("eventos").select("id").eq("slug", evento_data["slug"]).execute()
#             if existing.data:
#                 raise HTTPException(status_code=400, detail="Slug ya existe. Usar uno único.")
#         
#         evento_data["creado_por"] = admin_user.id
#         
#         res = supabase.table("eventos").insert(evento_data).execute()
#         
#         if res.data:
#             background_tasks.add_task(
#                 registrar_auditoria,
#                 usuario_id=admin_user.id,
#                 email_usuario=admin_user.email,
#                 rol_usuario="ADMIN",
#                 accion="CREATE",
#                 tabla="eventos",
#                 registro_id=res.data[0]["id"],
#                 datos_anteriores=None,
#                 datos_nuevos=evento_data,
#                 modulo="Gestión Eventos",
#                 request=request,
#             )
#             return res.data[0]
#         
#         raise HTTPException(status_code=500, detail="Error al crear evento")
#     except ValidationError as e:
#         raise HTTPException(status_code=422, detail=str(e))
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error creando evento: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.put("/admin/eventos/{evento_id}", response_model=EventoResponse)
# def actualizar_evento(
#     evento_id: UUID,
#     evento: EventoUpdate,
#     request: Request,
#     background_tasks: BackgroundTasks,
#     admin_user=Depends(get_current_admin),
# ):
#     """Actualiza un evento (solo admins)"""
#     try:
#         # Obtener evento actual
#         existing = supabase.table("eventos").select("*").eq("id", str(evento_id)).execute()
#         if not existing.data:
#             raise HTTPException(status_code=404, detail="Evento no encontrado")
#         
#         datos_anteriores = existing.data[0]
#         update_data = {k: v for k, v in evento.dict().items() if v is not None}
#         
#         if not update_data:
#             return datos_anteriores
#         
#         # Validar URLs
#         for url_field in ["link_instagram", "link_facebook", "link_whatsapp", "link_externo", "imagen_principal", "video_url"]:
#             if update_data.get(url_field) and not validar_url(update_data[url_field]):
#                 raise HTTPException(
#                     status_code=422,
#                     detail=f"URL inválida en campo {url_field}"
#                 )
#         
#         res = supabase.table("eventos").update(update_data).eq("id", str(evento_id)).execute()
#         
#         if res.data:
#             background_tasks.add_task(
#                 registrar_auditoria,
#                 usuario_id=admin_user.id,
#                 email_usuario=admin_user.email,
#                 rol_usuario="ADMIN",
#                 accion="UPDATE",
#                 tabla="eventos",
#                 registro_id=str(evento_id),
#                 datos_anteriores=datos_anteriores,
#                 datos_nuevos=update_data,
#                 modulo="Gestión Eventos",
#                 request=request,
#             )
#             return res.data[0]
#         
#         raise HTTPException(status_code=500, detail="Error al actualizar evento")
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error actualizando evento: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.delete("/admin/eventos/{evento_id}", status_code=204)
# def eliminar_evento(
#     evento_id: UUID,
#     request: Request,
#     background_tasks: BackgroundTasks,
#     admin_user=Depends(get_current_admin),
# ):
#     """Elimina un evento (solo admins)"""
#     try:
#         existing = supabase.table("eventos").select("*").eq("id", str(evento_id)).execute()
#         if not existing.data:
#             raise HTTPException(status_code=404, detail="Evento no encontrado")
#         
#         datos_anteriores = existing.data[0]
#         supabase.table("eventos").delete().eq("id", str(evento_id)).execute()
#         
#         background_tasks.add_task(
#             registrar_auditoria,
#             usuario_id=admin_user.id,
#             email_usuario=admin_user.email,
#             rol_usuario="ADMIN",
#             accion="DELETE",
#             tabla="eventos",
#             registro_id=str(evento_id),
#             datos_anteriores=datos_anteriores,
#             datos_nuevos=None,
#             modulo="Gestión Eventos",
#             request=request,
#         )
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error eliminando evento: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ────────────────────────────────────────────────────────────────────────────
# ENDPOINTS: EVENTOS DESTACADOS Y ESPECIALES
# ────────────────────────────────────────────────────────────────────────────

# @router.get("/eventos/destacados", response_model=List[EventoPublicResponse])
# def listar_eventos_destacados(
#     limit: int = 6,
# ):
#     """Lista eventos destacados (máximo 6)"""
#     try:
#         res = supabase.table("eventos").select("*")\
#             .eq("estado", "publicado")\
#             .eq("publico", True)\
#             .eq("destacado", True)\
#             .order("fecha_inicio", desc=False)\
#             .limit(limit)\
#             .execute()
#         return res.data or []
#     except Exception as e:
#         logger.error(f"Error listando eventos destacados: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# @router.get("/eventos/proximos", response_model=List[EventoPublicResponse])
# def listar_proximos_eventos(
#     dias: int = 30,
#     limit: int = 10,
# ):
#     """Lista próximos eventos en los próximos N días"""
#     try:
#         from datetime import datetime, timedelta
#         hoy = datetime.now().isoformat()
#         futuro = (datetime.now() + timedelta(days=dias)).isoformat()
#         
#         res = supabase.table("eventos").select("*")\
#             .eq("estado", "publicado")\
#             .eq("publico", True)\
#             .gte("fecha_inicio", hoy)\
#             .lte("fecha_inicio", futuro)\
#             .order("fecha_inicio", desc=False)\
#             .limit(limit)\
#             .execute()
#         return res.data or []
#     except Exception as e:
#         logger.error(f"Error listando próximos eventos: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
