"""
Router: Subjects (Mata Kuliah)
==============================
CRUD endpoints untuk mengelola mata kuliah.
- List semua matkul
- Tambah matkul baru
- Edit matkul
- Hapus matkul (beserta semua sesi di dalamnya)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Subject
from ..schemas import SubjectCreate, SubjectUpdate, SubjectResponse, StatusResponse

router = APIRouter()


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(db: Session = Depends(get_db)):
    """Ambil semua mata kuliah, lengkap dengan jumlah sesi."""
    subjects = db.query(Subject).order_by(Subject.created_at.desc()).all()
    result = []
    for s in subjects:
        result.append(SubjectResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            created_at=s.created_at,
            session_count=len(s.sessions),
        ))
    return result


@router.post("/subjects", response_model=SubjectResponse)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db)):
    """Tambah mata kuliah baru."""
    subject = Subject(name=data.name, description=data.description or "")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        created_at=subject.created_at,
        session_count=0,
    )


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(subject_id: int, data: SubjectUpdate, db: Session = Depends(get_db)):
    """Edit nama/deskripsi mata kuliah."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")

    if data.name is not None:
        subject.name = data.name
    if data.description is not None:
        subject.description = data.description

    db.commit()
    db.refresh(subject)
    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        created_at=subject.created_at,
        session_count=len(subject.sessions),
    )


@router.delete("/subjects/{subject_id}", response_model=StatusResponse)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    """Hapus mata kuliah beserta semua sesi di dalamnya."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Mata kuliah tidak ditemukan")

    db.delete(subject)  # cascade delete sessions & chat messages
    db.commit()
    return StatusResponse(status="success", message=f"Mata kuliah '{subject.name}' berhasil dihapus")
