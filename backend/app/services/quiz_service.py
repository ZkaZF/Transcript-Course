"""
Quiz Service — Generate soal quiz dari transkrip kuliah menggunakan Gemini AI.
Output berupa JSON array soal pilihan ganda dan esai singkat.
"""

import json
import re
from typing import List, Dict, Optional
from .gemini_service import get_model, _call_with_retry, _truncate_transcript


def generate_quiz(
    transcript: str,
    material_text: str = "",
    num_questions: int = 10,
    include_essay: bool = True,
    language: str = "auto",
) -> List[Dict]:
    """
    Panggil Gemini untuk generate soal quiz dari transkrip + materi.

    Returns list of dicts:
    [
        {
            "question_type": "multiple_choice",
            "question": "Apa yang dimaksud dengan ...",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_answer": "B",
            "explanation": "Karena ..."
        },
        {
            "question_type": "essay",
            "question": "Jelaskan secara singkat ...",
            "options": [],
            "correct_answer": "Jawaban model/kunci: ...",
            "explanation": "..."
        }
    ]
    """
    model = get_model()
    transcript_text = _truncate_transcript(transcript, max_chars=12000)

    lang_instruction = "Bahasa Indonesia" if language in ("auto", "id") else "bahasa yang sama dengan transkrip"

    material_section = ""
    if material_text:
        material_trunc = _truncate_transcript(material_text, max_chars=5000)
        material_section = f"""

Materi Kuliah Tambahan (PDF):
---
{material_trunc}
---"""

    # Hitung jumlah PG dan esai
    if include_essay:
        num_essay = max(1, num_questions // 4)
        num_mc = num_questions - num_essay
        type_instruction = f"{num_mc} soal pilihan ganda dan {num_essay} soal esai singkat"
    else:
        num_mc = num_questions
        type_instruction = f"{num_mc} soal pilihan ganda"

    prompt = f"""Kamu adalah pembuat soal ujian akademik yang ahli menguji pemahaman mahasiswa.
Berdasarkan transkrip kuliah berikut, buatlah {num_questions} soal ujian: {type_instruction}.

ATURAN PENTING:
1. Soal HARUS berdasarkan materi yang dibahas dalam transkrip (bukan pengetahuan umum).
2. Soal pilihan ganda: berikan 4 pilihan (A, B, C, D), hanya satu yang benar.
3. Soal esai: berikan kunci jawaban singkat (1-3 kalimat) sebagai 'correct_answer'.
4. Sertakan 'explanation' untuk menjelaskan mengapa jawaban tersebut benar.
5. Variasikan tingkat kesulitan soal (mudah, sedang, sulit).
6. Gunakan {lang_instruction}.

Transkrip Kuliah:
---
{transcript_text}
---{material_section}

OUTPUT: Kembalikan HANYA JSON array yang valid, tanpa teks tambahan apapun di luar JSON.
Format:
[
  {{
    "question_type": "multiple_choice",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_answer": "A",
    "explanation": "..."
  }},
  {{
    "question_type": "essay",
    "question": "...",
    "options": [],
    "correct_answer": "Kunci: ...",
    "explanation": "..."
  }}
]"""

    def call():
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Bersihkan markdown code fence jika ada
        raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
        raw = re.sub(r'\s*```$', '', raw, flags=re.MULTILINE)
        raw = raw.strip()

        # Parse JSON
        questions = json.loads(raw)
        if not isinstance(questions, list):
            raise ValueError("Response bukan JSON array")

        # Validasi dan normalisasi setiap soal
        validated = []
        for q in questions:
            if not q.get("question") or not q.get("question_type"):
                continue
            validated.append({
                "question_type": q.get("question_type", "multiple_choice"),
                "question": q.get("question", ""),
                "options": q.get("options", []),
                "correct_answer": q.get("correct_answer", ""),
                "explanation": q.get("explanation", ""),
            })
        return validated

    return _call_with_retry(call)
