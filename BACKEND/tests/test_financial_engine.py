import unittest
from datetime import date
from services.financial_engine import (
    calcular_dias_mora,
    verificar_gracia_40_dias,
    calcular_estado_financiero,
    socio_debe_ser_suspendido,
    socio_debe_ser_reactivado,
    obtener_cuota_real,
    calcular_fecha_vencimiento
)

class TestFinancialEngine(unittest.TestCase):

    def test_calcular_fecha_vencimiento(self):
        vto = calcular_fecha_vencimiento(2026, 5)
        self.assertEqual(vto, date(2026, 5, 10))

    def test_calcular_dias_mora_corridos(self):
        # Escenario: Vence el 10, hoy es el 15 -> 5 días de mora
        vto = date(2026, 5, 10)
        hoy = date(2026, 5, 15)
        self.assertEqual(calcular_dias_mora(vto, hoy, solo_habiles=False), 5)
        
    def test_calcular_dias_mora_no_vencido(self):
        # Escenario: Vence el 10, hoy es el 5 -> 0 días de mora
        vto = date(2026, 5, 10)
        hoy = date(2026, 5, 5)
        self.assertEqual(calcular_dias_mora(vto, hoy, solo_habiles=False), 0)

    def test_gracia_40_dias(self):
        # Dentro de la gracia
        self.assertTrue(verificar_gracia_40_dias(5))   # TEST 2: Socio con 5 días
        self.assertTrue(verificar_gracia_40_dias(39))  # TEST 3: Socio con 39 días
        self.assertTrue(verificar_gracia_40_dias(40))  # Límite
        # Fuera de la gracia
        self.assertFalse(verificar_gracia_40_dias(41)) # TEST 4: Socio con 41 días

    def test_calcular_estado_financiero(self):
        # TEST 1: Socio al día (0 mora)
        self.assertEqual(calcular_estado_financiero(dias_mora=0), "ACTIVO")
        
        # Con pago en revisión
        self.assertEqual(calcular_estado_financiero(dias_mora=50, tiene_pago_revision=True), "ACTIVO")

        # TEST 2 y 3: Socio en mora pero en gracia
        self.assertEqual(calcular_estado_financiero(dias_mora=5), "VENCIDO")
        self.assertEqual(calcular_estado_financiero(dias_mora=39), "VENCIDO")

        # TEST 4: Socio fuera de gracia
        self.assertEqual(calcular_estado_financiero(dias_mora=41), "EN_MORA")

    def test_socio_debe_ser_suspendido(self):
        self.assertFalse(socio_debe_ser_suspendido("ACTIVO"))
        self.assertFalse(socio_debe_ser_suspendido("VENCIDO"))
        self.assertTrue(socio_debe_ser_suspendido("EN_MORA"))

    def test_socio_debe_ser_reactivado(self):
        # TEST 5: Reactivación automática
        # Estaba bloqueado y ahora está ACTIVO
        self.assertTrue(socio_debe_ser_reactivado("SUSPENDIDO", "ACTIVO"))
        self.assertTrue(socio_debe_ser_reactivado("RESTRINGIDO", "ACTIVO"))
        
        # Estaba bloqueado pero sigue en mora
        self.assertFalse(socio_debe_ser_reactivado("SUSPENDIDO", "EN_MORA"))
        
        # Estaba bien y sigue bien
        self.assertFalse(socio_debe_ser_reactivado("APROBADO", "ACTIVO"))

    def test_obtener_cuota_real(self):
        valores_base = {
            "GRUPO FAMILIAR": 25000,
            "PROFESIONAL": 8000,
            "ESTUDIANTE": 6000,
            "SOCIO": 12000
        }
        
        # Prueba Estudiante
        res = obtener_cuota_real("SOCIO", True, False, 0, valores_base)
        self.assertEqual(res["monto_total"], 6000)
        self.assertEqual(res["tipo_plan"], "Estudiante")
        
        # Prueba Familiar (prioridad sobre estudiante)
        res = obtener_cuota_real("SOCIO", True, False, 2, valores_base)
        self.assertEqual(res["monto_total"], 25000)
        self.assertEqual(res["tipo_plan"], "Grupo Familiar")

if __name__ == '__main__':
    unittest.main()
