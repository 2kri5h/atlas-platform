from fastapi.testclient import TestClient
from backend.api.main import app
import sys

client = TestClient(app)

print("Attempting to login...")
response = client.post(
    "/api/auth/token",
    data={"username": "21001001", "password": "password123"}
)
if response.status_code != 200:
    print(f"Login failed: {response.text}")
    sys.exit(1)

token = response.json().get("access_token")
print("Login successful.")

print("\nTesting /api/burnout-score...")
headers = {"Authorization": f"Bearer {token}"}
payload = {
    "cgpa": 3.5,
    "daily_sleep_hours": 6.0,
    "daily_study_hours": 5.0,
    "physical_activity_hours": 1.0,
    "social_support_score": 3.0,
    "screen_time_hours": 4.0
}
response = client.post(
    "/api/ai/burnout-score",
    json=payload,
    headers=headers
)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")
