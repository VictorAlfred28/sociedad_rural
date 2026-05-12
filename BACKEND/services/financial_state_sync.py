import os
import sys
import logging
from datetime import datetime, date

logger = logging.getLogger(__name__)

def sync_financial_states(supabase_client, financial_engine) -> dict:
    """
    Sincronizador continuo en Fase 5.
    Compara perfiles.estado con el estado_financiero calculado.
    Registra inconsistencias en una tabla de auditoría (opcional) o en logs.
    Actualiza profiles.estado_financiero en modo sombra/aviso (Gradual Rollout).
    NO modifica profiles.estado.
    """
    try:
        hoy = datetime.now()
        
        # Traer todos los perfiles relevantes
        response = supabase_client.table("profiles").select("id, estado, estado_financiero, nombre_apellido, gracia_extendida_hasta").in_("estado", ["APROBADO", "RESTRINGIDO", "SUSPENDIDO"]).execute()
        perfiles = response.data or []
        
        inconsistencias = []
        actualizados = 0
        
        for p in perfiles:
            socio_id = p["id"]
            estado_actual = p["estado"]
            estado_fin_actual_db = p.get("estado_financiero")
            gracia_extendida = p.get("gracia_extendida_hasta")
            gracia_date = datetime.fromisoformat(gracia_extendida).date() if gracia_extendida else None
            
            # Buscar deuda más antigua
            pagos_res = supabase_client.table("pagos_cuotas").select("fecha_vencimiento, estado_pago").eq("socio_id", socio_id).in_("estado_pago", ["PENDIENTE", "VENCIDO", "PENDIENTE_VALIDACION"]).execute()
            pagos = pagos_res.data or []
            
            tiene_pago_revision = any(pago["estado_pago"] == "PENDIENTE_VALIDACION" for pago in pagos)
            deudas_activas = [pago for pago in pagos if pago["estado_pago"] in ["PENDIENTE", "VENCIDO"]]
            
            max_dias_mora = 0
            if deudas_activas:
                deudas_activas.sort(key=lambda x: x["fecha_vencimiento"])
                vto_mas_antiguo = datetime.strptime(deudas_activas[0]["fecha_vencimiento"], "%Y-%m-%d").date()
                max_dias_mora = financial_engine.calcular_dias_mora(vto_mas_antiguo, hoy.date(), solo_habiles=False)
            
            # Calcular estado propuesto
            estado_financiero_nuevo = financial_engine.calcular_estado_financiero(
                dias_mora=max_dias_mora,
                tiene_pago_revision=tiene_pago_revision,
                gracia_extendida_hasta=gracia_date
            )
            
            # Detectar divergencias críticas de autoridad
            inconsistente = False
            if estado_actual == "APROBADO" and estado_financiero_nuevo not in ["ACTIVO", "PROXIMO_A_VENCER", "VENCIDO"]:
                inconsistente = True
            elif estado_actual == "SUSPENDIDO" and estado_financiero_nuevo in ["ACTIVO", "PROXIMO_A_VENCER"]:
                inconsistente = True
                
            if inconsistente:
                inconsistencias.append({
                    "socio_id": socio_id,
                    "nombre": p.get("nombre_apellido"),
                    "estado_autoridad": estado_actual,
                    "estado_financiero": estado_financiero_nuevo,
                    "dias_mora": max_dias_mora
                })
                logger.warning(f"[FINANCIAL SYNC] Divergencia detectada: Socio {socio_id} - Autoridad: {estado_actual} vs Financiero: {estado_financiero_nuevo}")
            
            # Sincronizar columna (Rollout fase 5: exponer al frontend)
            if estado_fin_actual_db != estado_financiero_nuevo:
                supabase_client.table("profiles").update({"estado_financiero": estado_financiero_nuevo}).eq("id", socio_id).execute()
                actualizados += 1
                
        return {
            "status": "success",
            "evaluados": len(perfiles),
            "actualizados": actualizados,
            "inconsistencias": inconsistencias
        }
        
    except Exception as e:
        logger.error(f"[FINANCIAL SYNC] Error crítico: {str(e)}")
        return {"status": "error", "message": str(e)}
