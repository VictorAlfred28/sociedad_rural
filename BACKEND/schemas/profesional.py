from pydantic import BaseModel, EmailStr
from typing import Optional

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
