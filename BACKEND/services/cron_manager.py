from datetime import datetime, date
from typing import Optional
import logging

logger = logging.getLogger(__name__)

def acquire_cron_lock(supabase_client, cron_name: str, source: str) -> Optional[str]:
    """
    Intenta adquirir un lock para ejecutar un cron garantizando idempotencia.
    Verifica si ya existe una ejecución exitosa o en proceso para el DÍA ACTUAL.
    Retorna el execution_id si obtiene el lock, o None si debe abortar (doble ejecución).
    """
    hoy = date.today().isoformat()
    try:
        # Buscar ejecuciones previas de hoy
        res = supabase_client.table("cron_execution_history").select("*").eq("cron_name", cron_name).gte("started_at", f"{hoy}T00:00:00").execute()
        
        if res.data:
            for ex in res.data:
                if ex["status"] in ["SUCCESS", "RUNNING"]:
                    logger.warning(f"[CRON LOCK] Cron '{cron_name}' bloqueado. Ya ejecutado/corriendo hoy (ID: {ex['id']}).")
                    # Registrar colisión / intento duplicado
                    supabase_client.table("cron_execution_history").insert({
                        "cron_name": cron_name,
                        "status": "DUPLICATED",
                        "source": source,
                        "duplicated_detected": True,
                        "errors": f"Colisión evitada. Ejecución original: {ex['id']}"
                    }).execute()
                    return None
                    
        # Crear nueva ejecución (Lock adquirido)
        new_ex = supabase_client.table("cron_execution_history").insert({
            "cron_name": cron_name,
            "status": "RUNNING",
            "source": source
        }).execute()
        
        execution_id = new_ex.data[0]["id"]
        logger.info(f"[CRON LOCK] Lock adquirido para '{cron_name}'. Execution ID: {execution_id}")
        return execution_id
        
    except Exception as e:
        logger.error(f"[CRON LOCK] Error crítico de DB al adquirir lock para '{cron_name}': {e}")
        # Fail-open o fail-closed? En caso de fallo de log, permitimos correr para que no se tranque el sistema
        # Pero podríamos retornar None. Lo más seguro es fail-closed si queremos estricta idempotencia.
        return None

def release_cron_lock(supabase_client, execution_id: str, status: str, errors: Optional[str] = None):
    """
    Libera el lock actualizando el registro de ejecución.
    """
    try:
        update_data = {
            "finished_at": datetime.now().isoformat(),
            "status": status,
        }
        if errors:
            update_data["errors"] = str(errors)
            
        supabase_client.table("cron_execution_history").update(update_data).eq("id", execution_id).execute()
        logger.info(f"[CRON LOCK] Lock liberado para Execution ID: {execution_id} con estado {status}")
    except Exception as e:
        logger.error(f"[CRON LOCK] Error liberando lock {execution_id}: {e}")
