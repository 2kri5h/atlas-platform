import requests
import json

base_url = "http://localhost:8000/api"

# Login
login_data = {
    "username": "admin",
    "password": "admin123"
}
r = requests.post(f"{base_url}/auth/token", data=login_data)
if r.status_code != 200:
    print(f"Login failed: {r.status_code} {r.text}")
    exit(1)

token = r.json()["access_token"]
print("Logged in successfully.")

# Post Burnout
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}
payload = {
    "cgpa": 3.5,
    "daily_sleep_hours": 7.0,
    "daily_study_hours": 40.0 / 7.0,
    "physical_activity_hours": 1.0,
    "social_support_score": 3.0,
    "screen_time_hours": 4.0
}
r2 = requests.post(f"{base_url}/ai/burnout-score", headers=headers, json=payload)
print(f"Burnout response: {r2.status_code}")
print(r2.text)
