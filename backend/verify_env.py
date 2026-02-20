import os
from dotenv import load_dotenv

load_dotenv()

service_key = os.getenv("SUPABASE_SERVICE_KEY")
anon_key = os.getenv("SUPABASE_KEY")

print(f"SUPABASE_SERVICE_KEY present: {bool(service_key)}")
if service_key:
    print(f"SUPABASE_SERVICE_KEY starts with: {service_key[:10]}...")

print(f"SUPABASE_KEY present: {bool(anon_key)}")
if anon_key:
    print(f"SUPABASE_KEY starts with: {anon_key[:10]}...")

if service_key and anon_key and service_key != anon_key:
    print("SUCCESS: Service key and Anon key are different and loaded.")
else:
    print("FAILURE: Keys are missing or identical.")
