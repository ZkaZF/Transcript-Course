"""
Router: AI (Rangkuman & Tanya Jawab)
=====================================
Endpoints untuk generate rangkuman AI dan tanya jawab tentang materi kuliah.
Menggunakan Google Gemini API (free tier).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from ..database import get_db
from ..models import Session as SessionModel, ChatMessage
from ..schemas import ChatRequest, ChatMessageResponse, StatusResponse
from ..services.gemini_service import summarize_transcript, chat_about_transcript

router = APIRouter()


@router.post("/sessions/{session_id}/summarize", response_model=StatusResponse)
def create_summary(session_id: int, db: DBSession = Depends(get_db)):
    """Generate rangkuman AI dari transkrip sesi."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if not session.transcript:
        raise HTTPException(status_code=400, detail="Belum ada transkrip. Lakukan transkripsi terlebih dahulu.")

    try:
        summary = summarize_transcript(
            session.transcript,
            material_text=session.material_text or "",
            language=session.language or "auto",
        )
        session.summary = summary
        session.status = "done"
        db.commit()
        return StatusResponse(status="success", message="Rangkuman berhasil dibuat")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat rangkuman: {str(e)}")


@router.post("/sessions/{session_id}/chat")
def chat_with_ai(session_id: int, data: ChatRequest, db: DBSession = Depends(get_db)):
    """Tanya jawab AI tentang materi kuliah berdasarkan transkrip."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if not session.transcript:
        raise HTTPException(status_code=400, detail="Belum ada transkrip. Lakukan transkripsi terlebih dahulu.")

    try:
        # Simpan pesan user
        user_msg = ChatMessage(session_id=session_id, role="user", message=data.message)
        db.add(user_msg)
        db.commit()

        # Ambil riwayat chat sebelumnya untuk konteks
        history = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        chat_history = [{"role": m.role, "message": m.message} for m in history[:-1]]  # Exclude current

        # Generate jawaban AI
        answer = chat_about_transcript(
            session.transcript,
            data.message,
            chat_history,
            material_text=session.material_text or "",
            language=session.language or "auto",
        )

        # Simpan jawaban AI
        ai_msg = ChatMessage(session_id=session_id, role="assistant", message=answer)
        db.add(ai_msg)
        db.commit()
        db.refresh(ai_msg)

        return ChatMessageResponse(
            id=ai_msg.id,
            session_id=session_id,
            role="assistant",
            message=answer,
            created_at=ai_msg.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses pertanyaan: {str(e)}")


@router.get("/sessions/{session_id}/chat", response_model=list[ChatMessageResponse])
def get_chat_history(session_id: int, db: DBSession = Depends(get_db)):
    """Ambil riwayat chat untuk sesi tertentu."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return messages
