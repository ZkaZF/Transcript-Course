"""
FastAPI Main Entry Point
========================
Ini file utama yang menjalankan backend. Saat distart:
1. Membuat tabel database (jika belum ada)
2. Membuat folder uploads/ (jika belum ada)
3. Menyalakan semua API endpoints

Jalankan dengan: uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Tambahkan ffmpeg dari imageio-ffmpeg ke PATH agar Whisper bisa menemukannya
try:
    import imageio_ffmpeg
    ffmpeg_path = os.path.dirname(imageio_ffmpeg.get_ffmpeg_exe())
    os.environ["PATH"] = ffmpeg_path + os.pathsep + os.environ.get("PATH", "")
    print(f"[OK] FFmpeg found at: {ffmpeg_path}")
except ImportError:
    print("[WARN] imageio-ffmpeg not installed. Ensure ffmpeg is in PATH.")

from .database import engine, Base
from .routers import subjects, sessions, transcribe, ai, search, export, quiz

# Buat semua tabel di database (jika belum ada)
Base.metadata.create_all(bind=engine)

# Buat folder uploads/ jika belum ada
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Inisialisasi FastAPI
app = FastAPI(
    title="Transcript Online Course",
    description="Web app untuk merekam & mentranskrip kuliah online dengan AI",
    version="3.0.0",
)

# CORS — izinkan frontend (Vite) mengakses backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount folder uploads agar bisa diakses sebagai static file
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Daftarkan semua routers (API endpoints)
app.include_router(subjects.router, prefix="/api", tags=["Mata Kuliah"])
app.include_router(sessions.router, prefix="/api", tags=["Sesi Pertemuan"])
app.include_router(transcribe.router, prefix="/api", tags=["Transkripsi"])
app.include_router(ai.router, prefix="/api", tags=["AI"])
app.include_router(search.router, prefix="/api", tags=["Pencarian"])
app.include_router(export.router, prefix="/api", tags=["Export"])
app.include_router(quiz.router, prefix="/api", tags=["Quiz"])  # V3


# Error handler — tampilkan traceback detail untuk debugging
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    tb = traceback.format_exc()
    print(f"[ERROR] {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb},
    )


@app.get("/")
def root():
    """Health check — untuk memastikan backend berjalan."""
    return {
        "status": "running",
        "app": "Transcript Online Course",
        "version": "3.0.0",
    }
