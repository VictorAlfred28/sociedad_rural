import unittest
from unittest.mock import patch
import os
import sys

# Mapear el backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import enviar_whatsapp
from services.cron_manager import acquire_cron_lock, release_cron_lock
from unittest.mock import MagicMock
import requests

class TestFase4CSimulator(unittest.TestCase):

    @patch('main.requests.post')
    def test_whatsapp_retry_timeout(self, mock_post):
        # Configurar environment para pasar las validaciones iniciales
        os.environ["EVOLUTION_API_URL"] = "http://mockapi"
        os.environ["INSTANCE_NAME"] = "mock_instance"
        os.environ["EVOLUTION_API_TOKEN"] = "mock_token"

        # Simular que siempre tira Timeout
        mock_post.side_effect = requests.exceptions.Timeout("Mock Timeout")

        resultado = enviar_whatsapp("3794123456", "Test")

        # Debería intentar 3 veces y luego retornar False
        self.assertEqual(mock_post.call_count, 3)
        self.assertFalse(resultado)

    @patch('main.requests.post')
    def test_whatsapp_success_second_try(self, mock_post):
        # Simular Timeout en el primero, Éxito en el segundo
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.side_effect = [requests.exceptions.Timeout("Mock Timeout"), mock_resp]

        resultado = enviar_whatsapp("3794123456", "Test")

        # Debería intentar 2 veces y retornar True
        self.assertEqual(mock_post.call_count, 2)
        self.assertTrue(resultado)

    def test_cron_lock_idempotency(self):
        # Simular supabase client
        mock_supabase = MagicMock()
        
        # Simular que NO hay ejecuciones previas hoy
        mock_res = MagicMock()
        mock_res.data = []
        mock_supabase.table().select().eq().gte().execute.return_value = mock_res
        
        # Simular inserción exitosa devolviendo un ID
        mock_insert_res = MagicMock()
        mock_insert_res.data = [{"id": "mock_uuid_123"}]
        mock_supabase.table().insert().execute.return_value = mock_insert_res

        # Primer intento: Debería adquirir el lock
        cron_id = acquire_cron_lock(mock_supabase, "test_cron", "make.com")
        self.assertEqual(cron_id, "mock_uuid_123")

        # Ahora simular que YA existe una ejecución corriendo/exitosa hoy
        mock_res.data = [{"id": "mock_uuid_123", "status": "SUCCESS"}]
        
        # Segundo intento: Debería fallar y registrar la duplicación
        cron_id_duplicado = acquire_cron_lock(mock_supabase, "test_cron", "apscheduler")
        self.assertIsNone(cron_id_duplicado)

if __name__ == '__main__':
    unittest.main()
