import os
import sys
from datetime import datetime, date
import logging

# Configurar path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()
from supabase import create_client, Client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

from services.financial_engine import calcular_dias_mora, calcular_estado_financiero

# Setup logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def run_backfill(chunk_size=100):
    logger.info("=== Iniciando Backfill Seguro: estado_financiero (SHADOW MODE) ===")
    
    # Obtener todos los perfiles activos/suspendidos
    response = supabase.table("profiles").select("id, nombre_apellido, estado").execute()
    profiles = response.data or []
    total_profiles = len(profiles)
    
    logger.info(f"Se encontraron {total_profiles} perfiles para auditar y migrar.")
    
    inconsistencias = 0
    actualizados = 0

    for i in range(0, total_profiles, chunk_size):
        chunk = profiles[i:i+chunk_size]
        logger.info(f"Procesando chunk {i} al {i+len(chunk)}")
        
        for p in chunk:
            socio_id = p["id"]
            estado_actual = p["estado"]
            
            try:
                # Buscar todas las deudas del socio
                pagos_res = supabase.table("pagos_cuotas").select("fecha_vencimiento, estado_pago").eq("socio_id", socio_id).in_("estado_pago", ["PENDIENTE", "VENCIDO", "PENDIENTE_VALIDACION"]).execute()
                pagos = pagos_res.data or []
                
                tiene_pago_revision = any(pago["estado_pago"] == "PENDIENTE_VALIDACION" for pago in pagos)
                
                # Obtener la deuda más antigua
                deudas_activas = [pago for pago in pagos if pago["estado_pago"] in ["PENDIENTE", "VENCIDO"]]
                max_dias_mora = 0
                
                if deudas_activas:
                    # Ordenar por fecha de vencimiento ascendente para encontrar la más antigua
                    deudas_activas.sort(key=lambda x: x["fecha_vencimiento"])
                    vto_mas_antiguo_str = deudas_activas[0]["fecha_vencimiento"]
                    # vto_mas_antiguo_str format: "2026-05-10"
                    vto_dt = datetime.strptime(vto_mas_antiguo_str, "%Y-%m-%d").date()
                    max_dias_mora = calcular_dias_mora(vto_dt, date.today(), solo_habiles=False)
                
                # Calcular nuevo estado financiero
                estado_financiero_nuevo = calcular_estado_financiero(
                    dias_mora=max_dias_mora,
                    tiene_pago_revision=tiene_pago_revision
                )
                
                # Reportar inconsistencia si la semántica no cuadra
                # APROBADO -> ACTIVO
                # RESTRINGIDO -> VENCIDO (dentro de gracia)
                # SUSPENDIDO -> EN_MORA (fuera de gracia)
                
                inconsistente = False
                if estado_actual == "APROBADO" and estado_financiero_nuevo != "ACTIVO":
                    inconsistente = True
                elif estado_actual in ["RESTRINGIDO", "SUSPENDIDO"] and estado_financiero_nuevo == "ACTIVO":
                    inconsistente = True
                
                if inconsistente:
                    inconsistencias += 1
                    logger.warning(
                        f"[SHADOW_MODE] INCONSISTENCIA | Socio {socio_id} ({p.get('nombre_apellido')}) | "
                        f"estado_actual={estado_actual} | estado_financiero_nuevo={estado_financiero_nuevo} | dias_mora={max_dias_mora}"
                    )
                
                # Upsert / Update de la nueva columna (Shadow Mode)
                # OJO: NO alteramos 'estado', solo 'estado_financiero'
                supabase.table("profiles").update({"estado_financiero": estado_financiero_nuevo}).eq("id", socio_id).execute()
                actualizados += 1
                
            except Exception as e:
                logger.error(f"[SHADOW_MODE] Error procesando socio {socio_id}: {str(e)}")
                
    logger.info("=== Fin del Backfill ===")
    logger.info(f"Perfiles procesados/actualizados: {actualizados}/{total_profiles}")
    logger.info(f"Divergencias/Inconsistencias detectadas: {inconsistencias}")

if __name__ == "__main__":
    run_backfill()
