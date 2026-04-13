"""
Material Service — Extract teks dari file PDF materi kuliah.
Menggunakan PyPDF2 untuk membaca konten PDF.
"""

import os
from typing import Optional


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract semua teks dari file PDF.
    
    Args:
        pdf_path: Path ke file PDF
    
    Returns:
        str: Teks yang di-extract dari PDF
    """
    try:
        from PyPDF2 import PdfReader
        
        reader = PdfReader(pdf_path)
        text_parts = []
        
        for page_num, page in enumerate(reader.pages, 1):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(f"--- Halaman {page_num} ---\n{page_text}")
        
        full_text = "\n\n".join(text_parts)
        print(f"[OK] PDF extracted — {len(reader.pages)} halaman, {len(full_text)} karakter")
        return full_text.strip()
        
    except ImportError:
        raise RuntimeError("PyPDF2 belum terinstall. Jalankan: pip install PyPDF2")
    except Exception as e:
        raise RuntimeError(f"Gagal membaca PDF: {str(e)}")
