from pydantic import BaseModel, EmailStr
from typing import Optional

class ComercioDTO(BaseModel):
    nombre_comercio: str
    cuit: str
    email: EmailStr
    telefono: str
    rubro: str
    direccion: str
    municipio: str
    barrio: Optional[str] = None      # Barrio/localidad de comercio
    provincia: Optional[str] = "Corrientes"
    password: Optional[str] = None
