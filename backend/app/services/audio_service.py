"""
Audio Service — Konversi dan validasi file audio/video via FFmpeg.
"""

import subprocess
import os
from typing import Optional, Tuple
import json

# Format yang didukung
ALLOWED_EXTENSIONS = {'.mp3', '.mp4', '.wav', '.m4a', '.webm', '.ogg', '.flac', '.aac'}
MAX_FILE_SIZE_MB = 500  # Batas upload 500 MB


def validate_audio_file(filename: str, file_size: int) -> Tuple[bool, str]:
    """Validasi format dan ukuran file."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Format {ext} tidak didukung. Gunakan: {', '.join(ALLOWED_EXTENSIONS)}"
    if file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        return False, f"File terlalu besar (max {MAX_FILE_SIZE_MB} MB)"
    return True, ""


def get_audio_duration(filepath: str) -> float:
    """Ambil durasi audio/video dalam menit menggunakan FFprobe."""
    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', filepath
            ],
            capture_output=True, text=True, timeout=30
        )
        info = json.loads(result.stdout)
        duration_seconds = float(info['format']['duration'])
        return round(float(duration_seconds) / 60.0, 2)
    except Exception:
        return 0.0


def convert_to_wav(input_path: str, output_path: Optional[str] = None) -> str:
    """
    Konversi file audio/video ke WAV (16kHz, mono) — format optimal untuk Whisper.
    Return path file WAV hasil konversi.
    """
    if output_path is None:
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}_converted.wav"

    try:
        subprocess.run(
            [
                'ffmpeg', '-i', input_path,
                '-ar', '16000',      # Sample rate 16kHz (optimal Whisper)
                '-ac', '1',          # Mono channel
                '-f', 'wav',
                '-y',                # Overwrite output
                output_path
            ],
            capture_output=True, text=True, timeout=300,
            check=True
        )
        return output_path
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg error: {e.stderr}")
    except FileNotFoundError:
        raise RuntimeError("FFmpeg tidak ditemukan. Pastikan FFmpeg sudah terinstall dan ada di PATH.")
