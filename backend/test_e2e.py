"""Minimal test — just check the upload-audio route."""
import requests

BASE = "http://localhost:8000/api"

# Check if upload-audio route exists in openapi
r = requests.get("http://localhost:8000/openapi.json")
paths = r.json()["paths"]
upload_key = "/api/sessions/{session_id}/upload-audio"
if upload_key in paths:
    print(f"Route EXISTS: {upload_key}")
    print(f"Methods: {list(paths[upload_key].keys())}")
else:
    print(f"Route MISSING: {upload_key}")
    print("All routes:")
    for k in sorted(paths.keys()):
        print(f"  {k} -> {list(paths[k].keys())}")

# Direct test
print("\n--- Direct upload test ---")
r = requests.post(f"{BASE}/sessions/1/upload-audio",
    files={"audio": ("test.wav", b"fake audio data", "audio/wav")})
print(f"Status: {r.status_code}")
print(f"Headers: {dict(r.headers)}")
print(f"Body: {r.text}")
