"""
Router: Transcription (Transkripsi Whisper)
============================================
Endpoint untuk memulai transkripsi audio dan cek status.
Transkripsi berjalan sebagai background task agar tidak blocking.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session as DBSession

from ..database import get_db, SessionLocal
from ..models import Session as SessionModel
from ..schemas import StatusResponse

router = APIRouter()


def run_transcription(session_id: int):
    """Background task: transkripsi audio menggunakan Whisper."""
    db = SessionLocal()
    try:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            return

        # Update status → transcribing
        session.status = "transcribing"
        db.commit()

        import os
        UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
        audio_path = os.path.join(UPLOAD_DIR, session.audio_path)

        if not os.path.exists(audio_path):
            session.status = "error"
            session.transcript = f"Error: File audio tidak ditemukan di path: {audio_path}"
            db.commit()
            return

        # Coba ambil durasi (opsional — tidak gagal jika FFmpeg CLI tidak ada)
        from ..services.audio_service import get_audio_duration
        duration = get_audio_duration(audio_path)
        session.duration_minutes = duration

        # Whisper bisa baca banyak format langsung (MP3, WAV, M4A, WebM, dll.)
        # via bundled ffmpeg-python. Tidak perlu konversi manual.
        audio_for_whisper = audio_path

        # Transkripsi
        from ..services.whisper_service import transcribe_audio
        language = session.language if session.language and session.language != "auto" else None
        result = transcribe_audio(audio_for_whisper, language=language)

        # Simpan hasil teks
        session.transcript = result['text']

        # Simpan segments dengan timestamp (V3 Timestamp Sync)
        import json
        if result.get('segments'):
            session.transcript_segments = json.dumps(result['segments'], ensure_ascii=False)
        else:
            session.transcript_segments = "[]"

        session.status = "transcribed"
        db.commit()

        print(f"✅ Transkripsi sesi #{session_id} selesai — {len(result['text'])} karakter")

    except Exception as e:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if session:
            session.status = "error"
            session.transcript = f"Error transkripsi: {str(e)}"
            db.commit()
        print(f"❌ Error transkripsi sesi #{session_id}: {e}")
    finally:
        db.close()


@router.post("/sessions/{session_id}/transcribe", response_model=StatusResponse)
def start_transcription(
    session_id: int,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
):
    """Mulai transkripsi audio sesi. Proses berjalan di background."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if not session.audio_path:
        raise HTTPException(status_code=400, detail="Sesi belum punya file audio")
    if session.status == "transcribing":
        raise HTTPException(status_code=400, detail="Transkripsi sedang berjalan")

    # Jalankan di background
    background_tasks.add_task(run_transcription, session_id)

    return StatusResponse(
        status="processing",
        message="Transkripsi dimulai. Cek status secara berkala."
    )


@router.get("/sessions/{session_id}/status")
def get_status(session_id: int, db: DBSession = Depends(get_db)):
    """Cek status transkripsi sesi."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    return {
        "status": session.status,
        "has_transcript": bool(session.transcript),
        "has_summary": bool(session.summary),
        "duration_minutes": session.duration_minutes,
    }
