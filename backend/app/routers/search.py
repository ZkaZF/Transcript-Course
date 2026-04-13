"""
Router: Search (Pencarian Keyword di Transkrip)
================================================
Endpoint untuk mencari keyword di semua transkrip sessions.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from ..database import get_db
from ..models import Session as SessionModel, Subject
from ..schemas import SearchResponse, SearchMatch

router = APIRouter()


def _get_snippet(text: str, keyword: str, context_chars: int = 80) -> str:
    """Ambil snippet teks di sekitar keyword yang ditemukan."""
    lower_text = text.lower()
    lower_keyword = keyword.lower()
    pos = lower_text.find(lower_keyword)
    if pos == -1:
        return text[:context_chars * 2] + "..."

    start = max(0, pos - context_chars)
    end = min(len(text), pos + len(keyword) + context_chars)

    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."

    return snippet


@router.get("/search", response_model=SearchResponse)
def search_transcripts(
    q: str = Query(..., min_length=1, description="Keyword pencarian"),
    db: DBSession = Depends(get_db),
):
    """Cari keyword di semua transkrip. Return sesi yang cocok dengan snippet."""
    # Case-insensitive search di SQLite
    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.transcript.ilike(f"%{q}%"))
        .order_by(SessionModel.created_at.desc())
        .limit(20)
        .all()
    )

    results = []
    for session in sessions:
        # Ambil info subject
        subject = db.query(Subject).filter(Subject.id == session.subject_id).first()
        subject_name = subject.name if subject else "Unknown"

        results.append(SearchMatch(
            session_id=session.id,
            session_title=session.title or f"Pertemuan {session.session_number}",
            subject_name=subject_name,
            subject_id=session.subject_id,
            session_number=session.session_number,
            snippet=_get_snippet(session.transcript, q),
        ))

    return SearchResponse(
        query=q,
        total=len(results),
        results=results,
    )
