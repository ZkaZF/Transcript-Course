"""
Gemini Service — AI rangkuman & tanya jawab menggunakan Google Gemini API (free tier).
Termasuk retry logic untuk menangani 429 Rate Limit errors.
"""

import google.generativeai as genai
import os
import time
import re
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv()

# Konfigurasi API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Model — gemini-2.5-flash confirmed working on free tier
# Override via env: GEMINI_MODEL=other-model-name
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Maximum tokens (karakter) untuk transkrip — hindari quota input token
MAX_TRANSCRIPT_CHARS = 15000


def get_model():
    """Inisialisasi Gemini model."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY belum diset di file .env")
    return genai.GenerativeModel(MODEL_NAME)


def _extract_retry_delay(error_str: str) -> int:
    """Ambil delay (detik) dari pesan 429 error."""
    match = re.search(r"retry in (\d+\.?\d*)", error_str, re.IGNORECASE)
    if match:
        return min(int(float(match.group(1))) + 2, 65)
    return 30  # default 30 detik


def _call_with_retry(fn, max_retries: int = 3):
    """Panggil fungsi dengan retry jika kena 429 Rate Limit."""
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                if attempt < max_retries - 1:
                    wait_sec = _extract_retry_delay(err_str)
                    print(f"⏳ Rate limit hit, tunggu {wait_sec}s lalu retry ({attempt+1}/{max_retries})...")
                    time.sleep(wait_sec)
                    continue
                # Berikan pesan yang jelas ke user
                raise RuntimeError(
                    f"Gemini API quota habis. Coba lagi dalam ~1 menit. "
                    f"Kamu bisa ganti model ke 'gemini-1.5-flash' di backend/.env: GEMINI_MODEL=gemini-1.5-flash"
                )
            raise  # Error lain langsung raise


def _truncate_transcript(transcript: str, max_chars: int = MAX_TRANSCRIPT_CHARS) -> str:
    """Potong transkrip jika terlalu panjang agar tidak melebihi token quota."""
    if len(transcript) <= max_chars:
        return transcript
    print(f"⚠️  Transkrip dipotong dari {len(transcript)} → {max_chars} karakter")
    return transcript[:max_chars] + "\n\n[... transkrip dipotong karena terlalu panjang ...]"


def summarize_transcript(transcript: str, material_text: str = "", language: str = "auto") -> str:
    """
    Buat rangkuman terstruktur dari transkrip kuliah.
    Otomatis retry jika kena rate limit.
    """
    model = get_model()
    transcript_text = _truncate_transcript(transcript)

    # Tentukan bahasa instruksi
    lang_instruction = "dalam Bahasa Indonesia" if language in ("auto", "id") else f"dalam bahasa yang sama dengan transkrip"

    # Tambahkan konteks materi jika ada
    material_section = ""
    if material_text:
        material_truncated = _truncate_transcript(material_text, max_chars=8000)
        material_section = f"""\n\nSelain transkrip, berikut adalah materi kuliah (PDF) yang relevan:
---
{material_truncated}
---
Gunakan materi ini sebagai referensi tambahan untuk memperkaya rangkuman."""

    prompt = f"""Kamu adalah asisten akademik yang sangat membantu. 
Berikut adalah transkrip dari sebuah kuliah/pertemuan. 
Buatkan rangkuman yang terstruktur dan mudah dipahami {lang_instruction}.

Format rangkuman:
1. **Topik Utama**: Jelaskan topik utama yang dibahas
2. **Poin-Poin Penting**: Daftar poin-poin kunci dari materi
3. **Penjelasan Detail**: Rangkuman penjelasan yang lebih detail untuk setiap poin
4. **Kesimpulan**: Ringkasan penutup

Transkrip:
---
{transcript_text}
---{material_section}

Buatkan rangkumannya:"""

    def call():
        response = model.generate_content(prompt)
        return response.text

    return _call_with_retry(call)


def chat_about_transcript(
    transcript: str,
    question: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    material_text: str = "",
    language: str = "auto",
) -> str:
    """
    Jawab pertanyaan tentang materi kuliah berdasarkan transkrip.
    Otomatis retry jika kena rate limit.
    """
    model = get_model()
    transcript_text = _truncate_transcript(transcript)

    lang_instruction = "dalam Bahasa Indonesia" if language in ("auto", "id") else "dalam bahasa yang sama dengan transkrip"

    material_section = ""
    if material_text:
        material_truncated = _truncate_transcript(material_text, max_chars=8000)
        material_section = f"""\n\nMateri Kuliah (PDF):
---
{material_truncated}
---"""

    system_context = f"""Kamu adalah asisten akademik yang membantu mahasiswa memahami materi kuliah.
Jawab pertanyaan berdasarkan transkrip kuliah yang diberikan{' dan materi PDF' if material_text else ''}.
Jika jawabannya tidak ada di transkrip{'maupun materi' if material_text else ''}, bilang bahwa informasi tersebut tidak dibahas dalam kuliah ini.
Jawab {lang_instruction} dengan jelas dan ringkas.

Transkrip Kuliah:
---
{transcript_text}
---{material_section}"""

    # Build chat history jika ada
    messages = []
    if chat_history:
        for msg in chat_history:
            role = "model" if msg.get("role") == "assistant" else msg.get("role", "user")
            messages.append({
                "role": role,
                "parts": [msg.get("message", msg.get("parts", [""])[0])],
            })

    def call():
        chat = model.start_chat(history=[
            {"role": "user", "parts": [system_context]},
            {"role": "model", "parts": ["Saya siap membantu menjawab pertanyaan tentang materi kuliah ini. Silakan tanyakan apa saja!"]},
            *messages,
        ])
        response = chat.send_message(question)
        return response.text

    return _call_with_retry(call)
