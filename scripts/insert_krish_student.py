import os
import requests
from dotenv import load_dotenv
load_dotenv()

from backend.api.auth import get_password_hash

h = get_password_hash("password123")
token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
ref = "mfibwvyzidmiwlcmxcuh"

sql = f"""
INSERT INTO students (
    id, roll_number, name, email, password_hash, branch, year,
    domains, study_hours_per_week, goals, weak_subjects, "wakingHoursPerDay",
    cpi, sleep_hours, screen_time_hours, role, created_at
) VALUES (
    6, '25B3004', 'Krish Tandel', '25b3004@iitb.ac.in', '{h}', 'CME', 1,
    'sde,ai_ml', 30, 'placements,startup', '', 16,
    8.8, 7.0, 6.0, 'admin', NOW()
)
ON CONFLICT (id) DO UPDATE SET
    roll_number = EXCLUDED.roll_number,
    password_hash = EXCLUDED.password_hash,
    email = EXCLUDED.email;

SELECT setval('students_id_seq', GREATEST(6, (SELECT MAX(id) FROM students)));
"""

res = requests.post(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    json={"query": sql}
)

print("Status:", res.status_code)
print("Response:", res.text)
