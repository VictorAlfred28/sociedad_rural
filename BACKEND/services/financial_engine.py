"""
Módulo de Motor Financiero Centralizado
---------------------------------------
Este módulo contiene lógica pura y desacoplada para el cálculo de estados financieros,
vencimientos, mora y cuotas de la Sociedad Rural del Norte.

IMPORTANTE: 
Este módulo NO interactúa con la base de datos (Supabase) directamente en sus funciones puras,
ni muta el estado del sistema en producción. Su propósito es ser llamado por endpoints y crons
para obtener decisiones financieras inmutables y consistentes.

Nuevos Estados Financieros Teóricos (Fase 4 - Preparación):
- ACTIVO: Al día o con pago en revisión.
- PROXIMO_A_VENCER: Aún no es el día 10 del mes en curso.
- VENCIDO: Pasó el día 10, pero está dentro de los 40 días de gracia.
- EN_MORA: Superó los 40 días de gracia. Requiere suspensión.
"""

from datetime import date, datetime, timedelta
from typing import Dict, Any, Optional

# --- Utilidades de Fechas ---
def _es_dia_habil(fecha: date) -> bool:
    """Devuelve True si el día es Lunes a Viernes."""
    return fecha.weekday() < 5

def calcular_dias_habiles(desde: date, hasta: date) -> int:
    """Calcula la cantidad de días hábiles entre dos fechas."""
    if desde > hasta:
        return 0
    dias = 0
    actual = desde
    while actual < hasta:
        actual += timedelta(days=1)
        if _es_dia_habil(actual):
            dias += 1
    return dias

# --- Funciones Principales Requeridas ---

def calcular_fecha_vencimiento(anio: int, mes: int) -> date:
    """
    Calcula la fecha de vencimiento estándar de una cuota.
    Históricamente, la cuota vence el día 10 de cada mes.
    
    Args:
        anio (int): Año de la cuota.
        mes (int): Mes de la cuota.
    
    Returns:
        date: Fecha de vencimiento exacta (ej. 10 del mes).
    """
    return date(anio, mes, 10)


def calcular_dias_mora(fecha_vencimiento: date, fecha_actual: Optional[date] = None, solo_habiles: bool = False) -> int:
    """
    Calcula cuántos días de mora han pasado desde la fecha de vencimiento.
    
    Args:
        fecha_vencimiento (date): La fecha en la que venció la cuota.
        fecha_actual (date, optional): Fecha contra la cual calcular. Por defecto es HOY.
        solo_habiles (bool): Si True, solo cuenta días de Lunes a Viernes.
    
    Returns:
        int: Días de mora (0 si no está vencido).
    """
    if not fecha_actual:
        fecha_actual = date.today()
        
    if fecha_vencimiento >= fecha_actual:
        return 0
        
    if solo_habiles:
        return calcular_dias_habiles(fecha_vencimiento, fecha_actual)
    else:
        return (fecha_actual - fecha_vencimiento).days


def verificar_gracia_40_dias(dias_mora_corridos: int, gracia_extendida_hasta: Optional[date] = None) -> bool:
    """
    Verifica si un socio en mora aún se encuentra dentro del período de gracia
    de 40 días donde su carnet sigue habilitado, o si tiene una gracia manual extendida.
    """
    if gracia_extendida_hasta and date.today() <= gracia_extendida_hasta:
        return True
    return 0 <= dias_mora_corridos <= 40


def calcular_estado_financiero(
    dias_mora: int, 
    tiene_pago_revision: bool = False,
    gracia_extendida_hasta: Optional[date] = None
) -> str:
    """
    Determina el estado financiero de un socio basado en su deuda.
    """
    if tiene_pago_revision:
        return "ACTIVO"
        
    if dias_mora == 0:
        return "ACTIVO"
        
    if verificar_gracia_40_dias(dias_mora, gracia_extendida_hasta):
        return "VENCIDO" # En gracia, carnet activo, solo advertencia
        
    return "EN_MORA" # Perdió la gracia, corresponde suspensión


def socio_debe_ser_suspendido(estado_financiero: str) -> bool:
    """
    Regla de negocio: Determina si el sistema debe bloquear el acceso / QR del socio.
    El socio SOLO se suspende si superó el período de gracia y está EN_MORA.
    """
    return estado_financiero == "EN_MORA"


def socio_debe_ser_reactivado(
    estado_actual_perfil: str, 
    estado_financiero_calculado: str
) -> bool:
    """
    Determina si un socio que actualmente figura bloqueado debe ser rehabilitado.
    Ocurre, por ejemplo, cuando un admin aprueba su pago.
    """
    estados_bloqueantes = {"RESTRINGIDO", "SUSPENDIDO", "RECHAZADO"}
    
    if estado_actual_perfil in estados_bloqueantes and estado_financiero_calculado == "ACTIVO":
        return True
    return False


def obtener_cuota_real(
    rol: str, 
    es_estudiante: bool, 
    es_profesional: bool, 
    cantidad_familiares: int, 
    valores_base: Dict[str, float]
) -> Dict[str, Any]:
    """
    Calcula el monto real de la cuota a pagar de forma dinámica.
    Reemplaza al "hardcodeo de $5000".
    
    Args:
        rol (str): Rol del socio (ej. 'SOCIO', 'COMERCIO').
        es_estudiante (bool): Flag del perfil.
        es_profesional (bool): Flag del perfil.
        cantidad_familiares (int): Cantidad de dependientes vinculados.
        valores_base (Dict[str, float]): Mapa de costos por tipo obtenido de BD 
            (ej: {"GRUPO FAMILIAR": 20000, "PROFESIONAL": 7000, "ESTUDIANTE": 5000, "SOCIO": 10000})
            
    Returns:
        Dict: Detalle de la cuota con 'monto_total', 'tipo_plan', etc.
    """
    rol_upper = rol.upper()
    membership_type = "FAMILIAR" if cantidad_familiares > 0 else "INDIVIDUAL"
    
    if membership_type == "FAMILIAR":
        rol_efectivo = "GRUPO FAMILIAR"
        tipo_plan = "Grupo Familiar"
    elif es_profesional:
        rol_efectivo = "PROFESIONAL"
        tipo_plan = "Socio Profesional"
    elif es_estudiante:
        rol_efectivo = "ESTUDIANTE"
        tipo_plan = "Estudiante"
    else:
        rol_efectivo = rol_upper
        tipo_plan = "Individual"
        
    # Obtener monto de los valores base, usar default razonable si no se provee
    monto_base = valores_base.get(rol_efectivo, 0)
    if monto_base == 0:
        defaults = {
            "GRUPO FAMILIAR": 20000.0,
            "PROFESIONAL": 7000.0,
            "ESTUDIANTE": 5000.0,
            "SOCIO": 10000.0,
            "COMERCIO": 10000.0
        }
        monto_base = defaults.get(rol_efectivo, 10000.0)
        
    return {
        "monto_total": float(monto_base),
        "tipo_plan": tipo_plan,
        "rol_efectivo": rol_efectivo,
        "familiares_incluidos": cantidad_familiares
    }
