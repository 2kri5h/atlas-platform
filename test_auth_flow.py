import urllib.request
import urllib.parse
import json

def test_full_auth(base_url, username, password):
    print(f"=== Testing Auth Flow on {base_url} ===")
    login_url = f"{base_url}/auth/token"
    data = urllib.parse.urlencode({'username': username, 'password': password}).encode('utf-8')
    req = urllib.request.Request(
        login_url,
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            token = body.get('access_token')
            cookie = resp.headers.get('Set-Cookie')
            print("Login successful!")
            print(f"Token: {token[:20]}...")
            print(f"Set-Cookie: {cookie[:50] if cookie else None}")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    me_url = f"{base_url}/auth/me"
    me_req = urllib.request.Request(
        me_url,
        headers={
            'Authorization': f'Bearer {token}',
            'User-Agent': 'Mozilla/5.0'
        }
    )
    try:
        with urllib.request.urlopen(me_req, timeout=15) as resp:
            user = json.loads(resp.read().decode('utf-8'))
            print("Auth /me successful!")
            print(f"User: roll={user.get('roll_number')}, name={user.get('name')}")
    except Exception as e:
        print(f"Auth /me failed: {e}")

test_full_auth('http://localhost:8000/api', '21001001', 'password123')
test_full_auth('https://atlas-platform-51gn.onrender.com/api', '21001001', 'password123')
test_full_auth('https://team-atlas-itsp.vercel.app/api', '21001001', 'password123')
