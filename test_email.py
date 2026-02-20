
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_SERVICE_KEY") # We use service key to mimic backend behavior if needed, or anon key.
# backend uses: supabase.auth.sign_up

if not key:
    print("Error: env vars missing")
    exit(1)

supabase: Client = create_client(url, key)

# Test 1: Email with spaces
email_bad = " gino@gmail.com "
password = "Password123!"

print(f"Testing sign_up with '{email_bad}'...")

try:
    res = supabase.auth.sign_up({
        "email": email_bad,
        "password": password
    })
    print("Success (Unexpected if strict):", res)
except Exception as e:
    print(f"Caught expected error: {e}")

# Test 2: Clean email
email_good = "gino_test_clean@gmail.com"
print(f"Testing sign_up with '{email_good}'...")
try:
    # ensuring we don't actually create it effectively if we don't want to pollute, but for test it's fine.
    # actually, let's just see if it fails validation first.
    pass 
    # res = supabase.auth.sign_up({"email": email_good, "password": password})
    # print("Success clean:", res.user.id)
except Exception as e:
    print(f"Error clean: {e}")
