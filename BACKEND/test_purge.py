import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend to path
sys.path.append(r"c:\Users\victo\Desktop\sociedad_rural-main\BACKEND")

from main import supabase

def test_purge():
    dias = 30
    try:
        fecha_corte = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
        print(f"Fecha corte: {fecha_corte}")

        print("Counting...")
        count_res = (
            supabase.table("auditoria_logs")
            .select("id", count="exact")
            .lt("fecha", fecha_corte)
            .execute()
        )
        print(f"Count: {count_res.count}")
        
        # we won't delete to avoid breaking production data, just testing if it throws
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_purge()
