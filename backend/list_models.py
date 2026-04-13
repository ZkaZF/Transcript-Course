"""Test ALL available Gemini models on this API key."""
import google.generativeai as genai, os
from dotenv import load_dotenv
load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

working = []
failed = []

for m in genai.list_models():
    if 'generateContent' not in m.supported_generation_methods:
        continue
    name = m.name.replace("models/", "")
    try:
        model = genai.GenerativeModel(name)
        r = model.generate_content("Reply with: OK")
        print(f"✅ WORKS: {name}")
        working.append(name)
    except Exception as e:
        err = str(e)[:60]
        print(f"❌ FAIL:  {name} - {err}")
        failed.append(name)

print(f"\n=== SUMMARY ===")
print(f"Working: {working}")
print(f"Total available: {len(working) + len(failed)}")
