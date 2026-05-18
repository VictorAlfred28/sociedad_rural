import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend to path
sys.path.append(r"c:\Users\victo\Desktop\sociedad_rural-main\BACKEND")

from main import supabase

def test_delete():
    dias = 30
    try:
        fecha_corte = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
        print("Executing delete...")
        res = supabase.table("auditoria_logs").delete().lt("fecha", fecha_corte).execute()
        print(f"Delete success: {res}")
        
    except Exception as e:
        print(f"Error on delete: {e}")

if __name__ == "__main__":
    test_delete()
