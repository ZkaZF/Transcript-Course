from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import os
from datetime import datetime


from ..database import get_db
from ..models import Session as SessionModel, Subject
from ..schemas import SessionCreate, SessionResponse, StatusResponse, NotesUpdateRequest

router = APIRouter()

# Folder untuk menyimpan file audio yang diupload
# __file__ = backend/app/routers/sessions.py → perlu 3 level up ke backend/
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")


@router.get("/subjects/{subject_id}/sessions", response_model=list[SessionResponse])
def list_sessions(subject_id: int, db: Session = Depends(get_db)):
    """Ambil semua sesi untuk satu mata kuliah."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")

    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.subject_id == subject_id)
        .order_by(SessionModel.session_number.asc())
        .all()
    )
    return sessions


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """Ambil detail satu sesi (termasuk transkrip dan rangkuman)."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    return session


@router.post("/sessions", response_model=SessionResponse)
def create_session(
    subject_id: int = Form(...),
    session_number: int = Form(...),
    title: str = Form(""),
    language: str = Form("auto"),
    audio: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """
    Buat sesi pertemuan baru.
    Bisa langsung upload file audio, atau upload nanti.
    """
    # Validasi mata kuliah ada
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")

    # Buat record sesi baru
    session = SessionModel(
        subject_id=subject_id,
        session_number=session_number,
        title=title,
        language=language,
        status="pending",
    )

    # Simpan file audio jika ada
    if audio and audio.filename:
        # Buat nama file unik: matkul-id_sesi-number_timestamp.ext
        ext = os.path.splitext(audio.filename)[1]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"subject{subject_id}_session{session_number}_{timestamp}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        # Simpan file secara synchronous (lebih stabil di Windows)
        content = audio.file.read()
        with open(filepath, "wb") as f:
            f.write(content)

        session.audio_path = filename

    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/sessions/{session_id}", response_model=StatusResponse)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    """Hapus sesi beserta file audio dan riwayat chat."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    # Hapus file audio jika ada
    if session.audio_path:
        filepath = os.path.join(UPLOAD_DIR, session.audio_path)
        if os.path.exists(filepath):
            os.remove(filepath)

    db.delete(session)  # cascade delete chat messages
    db.commit()
    return StatusResponse(status="success", message=f"Sesi berhasil dihapus")


@router.post("/sessions/{session_id}/upload-audio", response_model=SessionResponse)
def upload_audio(
    session_id: int,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload file audio ke sesi yang sudah ada."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    if not audio or not audio.filename:
        raise HTTPException(status_code=400, detail="File audio harus disertakan")

    # Hapus file lama jika ada
    if session.audio_path:
        old_path = os.path.join(UPLOAD_DIR, session.audio_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    # Simpan file baru
    ext = os.path.splitext(audio.filename)[1]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"session{session_id}_{timestamp}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = audio.file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    session.audio_path = filename
    session.status = "pending"
    session.transcript = ""
    session.summary = ""
    db.commit()
    db.refresh(session)
    return session


@router.post("/sessions/{session_id}/upload-material", response_model=SessionResponse)
def upload_material(
    session_id: int,
    material: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload file PDF materi kuliah ke sesi."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    if not material or not material.filename:
        raise HTTPException(status_code=400, detail="File materi harus disertakan")

    # Validasi format file
    ext = os.path.splitext(material.filename)[1].lower()
    if ext != '.pdf':
        raise HTTPException(status_code=400, detail="Hanya file PDF yang didukung")

    # Hapus file lama jika ada
    if session.material_path:
        old_path = os.path.join(UPLOAD_DIR, session.material_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    # Simpan file baru
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"material_session{session_id}_{timestamp}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = material.file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    session.material_path = filename

    # Extract teks dari PDF
    try:
        from ..services.material_service import extract_text_from_pdf
        session.material_text = extract_text_from_pdf(filepath)
    except Exception as e:
        print(f"[WARN] Gagal extract PDF: {e}")
        session.material_text = f"(Gagal extract teks: {str(e)})"

    db.commit()
    db.refresh(session)
    return session


@router.put("/sessions/{session_id}/notes", response_model=SessionResponse)
def update_notes(session_id: int, body: NotesUpdateRequest, db: Session = Depends(get_db)):
    """Simpan catatan manual user untuk sesi ini (V5)."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    session.notes = body.notes
    db.commit()
    db.refresh(session)
    return session
