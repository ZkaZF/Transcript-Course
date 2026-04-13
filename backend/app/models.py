"""
Database Models — Tabel-tabel yang menyimpan data app.
- subjects: Mata kuliah (Algoritma, Basis Data, dll)
- sessions: Pertemuan per mata kuliah (audio, transkrip, rangkuman)
- chat_messages: Riwayat tanya jawab AI per sesi
- quiz_questions: Soal quiz AI per sesi (V3)
"""

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class Subject(Base):
    """Mata Kuliah — contoh: Algoritma & Pemrograman, Basis Data, dll."""
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relasi: satu matkul punya banyak sesi
    sessions = relationship("Session", back_populates="subject", cascade="all, delete-orphan")


class Session(Base):
    """Pertemuan / Sesi Kuliah — menyimpan audio, transkrip, dan rangkuman."""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    session_number = Column(Integer, nullable=False)
    title = Column(String(300), default="")
    audio_path = Column(Text, default="")
    transcript = Column(Text, default="")
    transcript_segments = Column(Text, default="")  # JSON: [{start, end, text}] — V3 Timestamp Sync
    summary = Column(Text, default="")
    status = Column(String(50), default="pending")  # pending, transcribing, summarizing, done
    language = Column(String(10), default="auto")   # auto, id, en, ja, etc.
    duration_minutes = Column(Float, default=0.0)
    material_path = Column(Text, default="")        # Path file PDF materi (V2)
    material_text = Column(Text, default="")        # Teks hasil extract dari PDF (V2)
    notes = Column(Text, default="")               # Catatan manual user — Markdown (V5)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relasi
    subject = relationship("Subject", back_populates="sessions")
    chat_messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="session", cascade="all, delete-orphan")  # V3


class ChatMessage(Base):
    """Riwayat Chat AI — pertanyaan user dan jawaban AI tentang materi kuliah."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" atau "assistant"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relasi
    session = relationship("Session", back_populates="chat_messages")


class QuizQuestion(Base):
    """Soal Quiz AI — di-generate dari transkrip + materi kuliah. (V3)"""
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    question_type = Column(String(20), nullable=False)  # "multiple_choice" atau "essay"
    question = Column(Text, nullable=False)              # Bunyi soal
    options = Column(Text, default="")                   # JSON: ["A. ...", "B. ...", "C. ...", "D. ..."]
    correct_answer = Column(Text, default="")            # "A" / "B" / teks esai
    explanation = Column(Text, default="")               # Penjelasan jawaban
    user_answer = Column(Text, default="")               # Jawaban yang dipilih user
    is_correct = Column(Integer, default=-1)             # -1=belum dijawab, 0=salah, 1=benar
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="quiz_questions")
