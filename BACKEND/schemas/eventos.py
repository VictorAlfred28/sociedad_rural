"""
Schemas para Municipios - SPEC Avanzado Eventos por Municipio
Validaciones y DTOs para municipios
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime
from uuid import UUID


class MunicipioBase(BaseModel):
    """Base para crear/actualizar municipios"""
    nombre: str = Field(..., min_length=1, max_length=100, description="Nombre del municipio")
    provincia: str = Field(..., min_length=1, max_length=50, description="Provincia")
    descripcion: Optional[str] = Field(None, max_length=500, description="Descripción del municipio")
    imagen_principal: Optional[str] = Field(None, description="URL de imagen principal")
    activo: bool = Field(default=True, description="¿Municipio activo?")
    latitud: Optional[float] = Field(None, description="Coordenada de latitud (opcional)")
    longitud: Optional[float] = Field(None, description="Coordenada de longitud (opcional)")


class MunicipioCreate(MunicipioBase):
    """Crear nuevo municipio"""
    pass


class MunicipioUpdate(BaseModel):
    """Actualizar municipio (todos los campos opcionales)"""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    provincia: Optional[str] = Field(None, min_length=1, max_length=50)
    descripcion: Optional[str] = Field(None, max_length=500)
    imagen_principal: Optional[str] = None
    activo: Optional[bool] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None


class MunicipioResponse(MunicipioBase):
    """Respuesta de municipio con metadatos"""
    id: UUID
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


# ───────────────────────────────────────────────────────────────────────────

class EventoBase(BaseModel):
    """Base para crear/actualizar eventos"""
    
    # RELACIÓN
    municipio_id: UUID = Field(..., description="ID del municipio donde ocurre el evento")
    
    # INFORMACIÓN GENERAL
    titulo: str = Field(..., min_length=1, max_length=200, description="Título del evento")
    subtitulo: Optional[str] = Field(None, max_length=300, description="Subtítulo o lema")
    slug: str = Field(..., min_length=1, max_length=200, description="URL-friendly slug (único)")
    tipo: str = Field(
        ..., 
        description="Tipo de evento",
        pattern="^(Remate|Festival|Exposición|Charla|Otro)$"
    )
    organizador: Optional[str] = Field(None, max_length=200, description="Organizador del evento")
    contacto: Optional[str] = Field(None, max_length=100, description="Teléfono o email de contacto")
    
    # UBICACIÓN DETALLADA
    lugar: str = Field(..., min_length=1, max_length=200, description="Lugar/Venue del evento")
    direccion: Optional[str] = Field(None, max_length=300, description="Dirección completa")
    coordenadas_lat: Optional[float] = Field(None, description="Latitud del evento")
    coordenadas_lng: Optional[float] = Field(None, description="Longitud del evento")
    
    # FECHAS
    fecha_inicio: Optional[datetime] = Field(None, description="Fecha y hora de inicio")
    fecha_fin: Optional[datetime] = Field(None, description="Fecha y hora de fin (si es multi-día)")
    es_evento_de_un_dia: bool = Field(default=True, description="¿Evento de un solo día?")
    
    # ESTADO Y VISIBILIDAD
    estado: str = Field(
        default="borrador",
        description="Estado del evento",
        pattern="^(borrador|publicado|cancelado|finalizado)$"
    )
    destacado: bool = Field(default=False, description="¿Destacar en portada?")
    publico: bool = Field(default=True, description="¿Visible para público?")
    
    # MULTIMEDIA
    imagen_principal: Optional[str] = Field(None, description="URL de imagen principal")
    galeria_imagenes: Optional[list] = Field(default_factory=list, description="Array de imágenes")
    video_url: Optional[str] = Field(None, description="URL de video (YouTube, Vimeo, etc)")
    
    # REDES SOCIALES - CLAVE DEL SPEC
    link_instagram: Optional[str] = Field(None, description="URL de Instagram del evento")
    link_facebook: Optional[str] = Field(None, description="URL de Facebook del evento")
    link_whatsapp: Optional[str] = Field(None, description="Link de WhatsApp (wa.me/...)")
    link_externo: Optional[str] = Field(None, description="Link externo general")
    
    # CONTENIDO
    descripcion_corta: Optional[str] = Field(None, max_length=500, description="Descripción corta (preview)")
    descripcion_larga: Optional[str] = Field(None, description="Descripción completa (puede contener HTML)")
    
    # DATOS ADICIONALES
    precio: Optional[str] = Field(None, max_length=100, description="Precio (Gratis, $5000, etc)")
    capacidad: Optional[int] = Field(None, ge=0, description="Capacidad de asistentes")
    requiere_inscripcion: bool = Field(default=False, description="¿Requiere inscripción previa?")


class EventoCreate(EventoBase):
    """Crear nuevo evento"""
    pass


class EventoUpdate(BaseModel):
    """Actualizar evento (todos los campos opcionales)"""
    municipio_id: Optional[UUID] = None
    titulo: Optional[str] = Field(None, min_length=1, max_length=200)
    subtitulo: Optional[str] = Field(None, max_length=300)
    slug: Optional[str] = Field(None, min_length=1, max_length=200)
    tipo: Optional[str] = Field(None, pattern="^(Remate|Festival|Exposición|Charla|Otro)$")
    organizador: Optional[str] = Field(None, max_length=200)
    contacto: Optional[str] = Field(None, max_length=100)
    lugar: Optional[str] = Field(None, min_length=1, max_length=200)
    direccion: Optional[str] = Field(None, max_length=300)
    coordenadas_lat: Optional[float] = None
    coordenadas_lng: Optional[float] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    es_evento_de_un_dia: Optional[bool] = None
    estado: Optional[str] = Field(None, pattern="^(borrador|publicado|cancelado|finalizado)$")
    destacado: Optional[bool] = None
    publico: Optional[bool] = None
    imagen_principal: Optional[str] = None
    galeria_imagenes: Optional[list] = None
    video_url: Optional[str] = None
    link_instagram: Optional[str] = None
    link_facebook: Optional[str] = None
    link_whatsapp: Optional[str] = None
    link_externo: Optional[str] = None
    descripcion_corta: Optional[str] = Field(None, max_length=500)
    descripcion_larga: Optional[str] = None
    precio: Optional[str] = Field(None, max_length=100)
    capacidad: Optional[int] = Field(None, ge=0)
    requiere_inscripcion: Optional[bool] = None


class EventoResponse(EventoBase):
    """Respuesta de evento con metadatos"""
    id: UUID
    creado_por: Optional[UUID] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


class EventoPublicResponse(BaseModel):
    """Respuesta pública de evento (sin metadata sensible)"""
    id: UUID
    titulo: str
    subtitulo: Optional[str]
    slug: str
    tipo: str
    lugar: str
    direccion: Optional[str]
    fecha_inicio: Optional[datetime]
    fecha_fin: Optional[datetime]
    es_evento_de_un_dia: bool
    imagen_principal: Optional[str]
    descripcion_corta: Optional[str]
    precio: Optional[str]
    capacidad: Optional[int]
    requiere_inscripcion: bool
    link_instagram: Optional[str]
    link_facebook: Optional[str]
    link_whatsapp: Optional[str]
    link_externo: Optional[str]
    municipio_id: UUID
    destacado: bool

    class Config:
        from_attributes = True


class EventoFiltrosQueryParams(BaseModel):
    """Parámetros de filtrado para listar eventos"""
    municipio_id: Optional[UUID] = None
    tipo: Optional[str] = None
    destacado: Optional[bool] = None
    estado: Optional[str] = Field(None, pattern="^(borrador|publicado|cancelado|finalizado)$")
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    requiere_inscripcion: Optional[bool] = None
