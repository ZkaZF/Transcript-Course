"""
Database setup — Koneksi SQLite via SQLAlchemy.
Database file (transcript.db) otomatis terbuat saat backend pertama kali dijalankan.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Simpan database di folder backend/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'transcript.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency untuk FastAPI — buka koneksi DB per request, tutup setelah selesai."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
