"""
Pydantic Schemas — Struktur data untuk request & response API.
Ini yang menentukan format JSON yang dikirim/diterima frontend.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# ============ SUBJECTS (Mata Kuliah) ============

class SubjectCreate(BaseModel):
    """Data untuk membuat mata kuliah baru."""
    name: str
    description: Optional[str] = ""

class SubjectUpdate(BaseModel):
    """Data untuk edit mata kuliah."""
    name: Optional[str] = None
    description: Optional[str] = None

class SubjectResponse(BaseModel):
    """Format response mata kuliah."""
    id: int
    name: str
    description: str
    created_at: datetime
    session_count: int = 0

    class Config:
        from_attributes = True


# ============ SESSIONS (Pertemuan) ============

class SessionCreate(BaseModel):
    """Data untuk membuat sesi baru."""
    subject_id: int
    session_number: int
    title: Optional[str] = ""
    language: Optional[str] = "auto"

class SessionResponse(BaseModel):
    """Format response sesi."""
    id: int
    subject_id: int
    session_number: int
    title: str
    audio_path: str
    transcript: str
    transcript_segments: str  # JSON string [{start, end, text}] — V3 Timestamp Sync
    summary: str
    status: str
    language: str
    duration_minutes: float
    material_path: str
    material_text: str
    notes: str              # Catatan manual user — V5
    created_at: datetime

    class Config:
        from_attributes = True


class NotesUpdateRequest(BaseModel):
    """Request untuk update catatan manual sesi."""
    notes: str


# ============ CHAT (Tanya Jawab AI) ============

class ChatRequest(BaseModel):
    """Data untuk mengirim pertanyaan ke AI."""
    message: str

class ChatMessageResponse(BaseModel):
    """Format response pesan chat."""
    id: int
    session_id: int
    role: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============ GENERAL ============

class StatusResponse(BaseModel):
    """Response umum untuk status."""
    status: str
    message: str


# ============ SEARCH ============

class SearchMatch(BaseModel):
    """Satu match dalam pencarian."""
    session_id: int
    session_title: str
    subject_name: str
    subject_id: int
    session_number: int
    snippet: str

class SearchResponse(BaseModel):
    """Hasil pencarian global."""
    query: str
    total: int
    results: List[SearchMatch]


# ============ QUIZ (V3) ============

class QuizGenerateRequest(BaseModel):
    """Request untuk generate soal quiz."""
    num_questions: Optional[int] = 10
    include_essay: Optional[bool] = True

class QuizAnswerRequest(BaseModel):
    """Request untuk menjawab satu soal."""
    question_id: int
    answer: str  # "A"/"B"/"C"/"D" untuk PG, teks bebas untuk esai

class QuizQuestionResponse(BaseModel):
    """Format response satu soal quiz."""
    id: int
    session_id: int
    question_type: str      # "multiple_choice" | "essay"
    question: str
    options: str            # JSON string array
    correct_answer: str     # Dikembalikan hanya setelah user menjawab
    explanation: str        # Dikembalikan hanya setelah user menjawab
    user_answer: str
    is_correct: int         # -1=belum, 0=salah, 1=benar
    created_at: datetime

    class Config:
        from_attributes = True

class QuizResultResponse(BaseModel):
    """Hasil/skor keseluruhan quiz."""
    total: int
    answered: int
    correct: int
    wrong: int
    score_percent: float
