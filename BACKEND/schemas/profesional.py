from pydantic import BaseModel, EmailStr, validator
from typing import Optional
import re

class ProfesionalDTO(BaseModel):
    nombreApellido: str
    dni: str
    email: EmailStr
    telefono: str
    nroMatricula: str
    profesion: str
    domicilio: str
    municipio: str
    provincia: Optional[str] = "Corrientes"

    @validator("telefono", pre=True, always=True)
    def validar_telefono(cls, v):
        if not v:
            return v
        t_limpio = re.sub(r'[\s\-]', '', str(v))
        if not t_limpio:
            raise ValueError("El teléfono solo puede contener números")
        if not t_limpio.isdigit():
            raise ValueError("El teléfono solo puede contener números")
        if len(t_limpio) < 8 or len(t_limpio) > 15:
            raise ValueError("Ingresá un número de teléfono válido (entre 8 y 15 dígitos)")
        return t_limpio
