"""
Whisper Service — Transkripsi audio ke teks menggunakan faster-whisper.
Menggunakan CTranslate2 backend yang jauh lebih cepat dan efisien VRAM
dibandingkan OpenAI Whisper standar. Berjalan di GPU (CUDA) jika tersedia.
"""

import os
from typing import Optional, Any, Dict
from dotenv import load_dotenv

try:
    from faster_whisper import WhisperModel
except ImportError:
    raise ImportError("Library 'faster-whisper' belum terinstal. Jalankan: pip install faster-whisper")

load_dotenv()

# Model yang digunakan (dari .env, default: medium)
# 'small' atau 'base' bisa lebih ngebut lagi, tapi 'medium' paling aman untuk bahasa Indonesia.
MODEL_NAME = os.getenv("WHISPER_MODEL", "medium")

# Cache model agar tidak load ulang dari disk setiap kali transcribe
_model = None

def get_model():
    """Load Faster-Whisper model (cached)."""
    global _model
    if _model is None:
        print(f"[INFO] Loading faster-whisper model '{MODEL_NAME}'...")
        # 'device="auto"' akan mencoba CUDA (GPU) dulu, jika gagal akan turun ke CPU
        # 'compute_type="float16"' mempercepat perhitungan di GPU. Jika CPU, dia otomatis akan pakai int8/float32.
        _model = WhisperModel(MODEL_NAME, device="cuda", compute_type="float16")
        print(f"[OK] Faster-whisper model '{MODEL_NAME}' loaded successfully")
    return _model


def transcribe_audio(audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
    """
    Transkripsi file audio → teks menggunakan faster-whisper.
    
    Args:
        audio_path: Path ke file audio (via FFmpeg)
        language: Kode bahasa ('id', 'en', dll). None = auto-detect.
    
    Returns:
        dict: { 'text': str, 'language': str, 'segments': list }
    """
    model = get_model()

    # Siapkan param untuk transcribe
    # vad_filter=True akan menghapus jeda hening/diam secara otomatis
    # sehingga inference jauh lebih cepat.
    transcribe_options = {
        "vad_filter": True,
        "vad_parameters": dict(min_silence_duration_ms=500),
    }
    
    if language and language != "auto":
        transcribe_options["language"] = language

    print(f"[INFO] Starting faster-transcription: {os.path.basename(audio_path)}")
    
    # model.transcribe mengembalikan generator object untuk segments, dan info language
    segments_generator, info = model.transcribe(audio_path, **transcribe_options)

    # Iterasi generator untuk mendapatkan hasil teksnya
    text_chunks = []
    seg_list = []
    
    # Proses baris per baris. Bagian ini akan jalan sambil Whisper bekerja di layar belakang.
    for segment in segments_generator:
        text_chunks.append(segment.text)
        seg_list.append({
            'start': segment.start,           # waktu mulai dalam detik
            'end': segment.end,             # waktu selesai dalam detik
            'text': segment.text.strip(),
        })

    # Gabungkan semua teks segment menjadi satu tranksrip penuh
    full_text = " ".join(text_chunks).strip()

    print(f"[OK] Faster-transcription done — {len(full_text)} chars, detected language: {info.language} (probability: {info.language_probability:.2f})")

    return {
        'text': full_text,
        'language': info.language,
        'segments': seg_list,
    }
