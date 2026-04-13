"""
Router: Quiz Generator (V3)
============================
Endpoints untuk generate dan mengelola soal quiz AI per sesi kuliah.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import List

from ..database import get_db
from ..models import Session as SessionModel, QuizQuestion
from ..schemas import (
    QuizGenerateRequest, QuizAnswerRequest,
    QuizQuestionResponse, QuizResultResponse, StatusResponse,
)

router = APIRouter()


@router.post("/sessions/{session_id}/quiz/generate", response_model=List[QuizQuestionResponse])
def generate_quiz(
    session_id: int,
    request: QuizGenerateRequest,
    db: DBSession = Depends(get_db),
):
    """Generate soal quiz dari transkrip sesi menggunakan Gemini AI."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if not session.transcript:
        raise HTTPException(status_code=400, detail="Sesi belum punya transkrip. Lakukan transkripsi terlebih dahulu.")

    # Hapus quiz lama jika ada
    db.query(QuizQuestion).filter(QuizQuestion.session_id == session_id).delete()
    db.commit()

    try:
        from ..services.quiz_service import generate_quiz as gen_quiz
        questions_data = gen_quiz(
            transcript=session.transcript,
            material_text=session.material_text or "",
            num_questions=request.num_questions or 10,
            include_essay=request.include_essay if request.include_essay is not None else True,
            language=session.language or "auto",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal generate quiz: {str(e)}")

    if not questions_data:
        raise HTTPException(status_code=500, detail="AI tidak berhasil membuat soal. Coba lagi.")

    # Simpan ke database
    quiz_objs = []
    for q in questions_data:
        quiz_q = QuizQuestion(
            session_id=session_id,
            question_type=q["question_type"],
            question=q["question"],
            options=json.dumps(q.get("options", []), ensure_ascii=False),
            correct_answer=q["correct_answer"],
            explanation=q["explanation"],
            user_answer="",
            is_correct=-1,
        )
        db.add(quiz_q)
        quiz_objs.append(quiz_q)

    db.commit()
    for q in quiz_objs:
        db.refresh(q)

    return quiz_objs


@router.get("/sessions/{session_id}/quiz", response_model=List[QuizQuestionResponse])
def get_quiz(session_id: int, db: DBSession = Depends(get_db)):
    """Ambil semua soal quiz untuk sesi ini."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    questions = db.query(QuizQuestion).filter(QuizQuestion.session_id == session_id).all()
    return questions


@router.post("/sessions/{session_id}/quiz/answer", response_model=QuizQuestionResponse)
def answer_quiz(
    session_id: int,
    request: QuizAnswerRequest,
    db: DBSession = Depends(get_db),
):
    """Submit jawaban untuk satu soal quiz. Return soal + jawaban benar + penjelasan."""
    question = db.query(QuizQuestion).filter(
        QuizQuestion.id == request.question_id,
        QuizQuestion.session_id == session_id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Soal tidak ditemukan")

    user_answer = request.answer.strip()
    question.user_answer = user_answer

    # Cek benar/salah (case-insensitive untuk PG)
    correct = question.correct_answer.strip()
    if question.question_type == "multiple_choice":
        # Ambil hanya huruf jawaban (A/B/C/D)
        user_letter = user_answer[0].upper() if user_answer else ""
        correct_letter = correct[0].upper() if correct else ""
        question.is_correct = 1 if user_letter == correct_letter else 0
    else:
        # Esai: anggap benar jika user sudah menjawab (evaluasi manual/AI tidak dilakukan sekarang)
        question.is_correct = 1 if user_answer else 0

    db.commit()
    db.refresh(question)
    return question


@router.get("/sessions/{session_id}/quiz/result", response_model=QuizResultResponse)
def get_quiz_result(session_id: int, db: DBSession = Depends(get_db)):
    """Hitung dan kembalikan hasil/skor quiz."""
    questions = db.query(QuizQuestion).filter(QuizQuestion.session_id == session_id).all()

    total = len(questions)
    answered = sum(1 for q in questions if q.is_correct != -1)
    correct = sum(1 for q in questions if q.is_correct == 1)
    wrong = sum(1 for q in questions if q.is_correct == 0)
    score_percent = (correct / total * 100) if total > 0 else 0.0

    return QuizResultResponse(
        total=total,
        answered=answered,
        correct=correct,
        wrong=wrong,
        score_percent=round(score_percent, 1),
    )


@router.delete("/sessions/{session_id}/quiz", response_model=StatusResponse)
def delete_quiz(session_id: int, db: DBSession = Depends(get_db)):
    """Hapus semua soal quiz sesi ini (reset)."""
    deleted = db.query(QuizQuestion).filter(QuizQuestion.session_id == session_id).delete()
    db.commit()
    return StatusResponse(status="ok", message=f"{deleted} soal berhasil dihapus")
