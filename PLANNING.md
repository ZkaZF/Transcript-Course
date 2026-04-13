# 🎓 Transcript Online Course — Project Plan

## Deskripsi
Web app personal untuk merekam & mentranskrip kuliah online, menghasilkan rangkuman AI, dan tanya jawab tentang materi — 100% gratis.

## Tech Stack
| Komponen | Tech | Keterangan |
|---|---|---|
| Frontend | Vite + React + Tailwind CSS | UI web app |
| Backend | Python + FastAPI | REST API server |
| Speech-to-Text | OpenAI Whisper (local) | GPU accelerated, gratis |
| AI | Google Gemini API (free tier) | Rangkuman + Q&A |
| Database | SQLite | File-based, tanpa server |
| Audio Tool | FFmpeg | Konversi format audio/video |

## Fitur V1
- ✅ Upload file audio/video dari rekaman kuliah
- ✅ Record audio dari tab browser (Zoom/Meet di Chrome)
- ✅ Transkripsi otomatis (Whisper lokal + GPU)
- ✅ Rangkuman AI otomatis (Gemini free)
- ✅ Tanya jawab AI tentang materi kuliah
- ✅ Organisasi per mata kuliah & per pertemuan

## Fitur V2 ✅
- ✅ Cari keyword di transkrip (global search + highlight)
- ✅ Export ke PDF/Word
- ✅ Upload PDF materi agar transkrip dan materi bisa sinkron untuk memperbagus summarize
- ✅ Multi-bahasa support (pilih bahasa saat transkripsi)

## Fitur V3 ✅
- ✅ Quiz/Flashcard Generator — AI buat soal-soal dari transkrip + materi untuk persiapan ujian
- ✅ Timestamp Sync — Klik bagian transkrip → audio loncat ke waktu tsb

---

## PHASE-BY-PHASE BUILD PLAN — V2

---

### Phase 8: Keyword Search di Transkrip
> **Goal**: Bisa cari keyword di semua transkrip (global) dan highlight di dalam satu sesi

**Backend:**
- [ ] Endpoint `GET /api/search?q=keyword` — cari di semua sessions
- [ ] Return snippet teks + nama sesi + matkul

**Frontend:**
- [ ] Search bar di header Layout (global search) + dropdown hasil
- [ ] Search input di tab Transkrip (per-sesi) + highlight keyword

---

### Phase 9: Export ke PDF/Word
> **Goal**: Bisa download transkrip + rangkuman sebagai file PDF atau Word

**Backend:**
- [ ] Install `fpdf2` + `python-docx`
- [ ] Buat router `export.py` — `GET /api/sessions/{id}/export/pdf` dan `/docx`

**Frontend:**
- [ ] Tombol Export (PDF / Word) di header sesi

---

### Phase 10: Multi-Bahasa Support
> **Goal**: Bisa pilih bahasa saat transkripsi (Indonesia, English, dll)

**Backend:**
- [ ] Tambah kolom `language` di tabel sessions
- [ ] Update Whisper + Gemini untuk support bahasa yang dipilih

**Frontend:**
- [ ] Dropdown pilih bahasa di modal buat sesi + sebelum transkripsi

---

### Phase 11: Upload PDF Materi Kuliah
> **Goal**: Upload PDF materi agar AI punya konteks lebih lengkap saat merangkum & menjawab

**Backend:**
- [ ] Tambah kolom `material_path` + `material_text` di tabel sessions
- [ ] Endpoint upload PDF + extract teks (PyPDF2/pdfplumber)
- [ ] Update Gemini prompts — gabungkan transkrip + materi PDF

**Frontend:**
- [ ] Tombol upload materi di halaman sesi
- [ ] Tab "Materi" untuk preview teks PDF

---

## PHASE-BY-PHASE BUILD PLAN — V3

---

### Phase 12: Quiz / Flashcard Generator
> **Goal**: AI otomatis buat soal-soal (pilihan ganda + esai singkat) dari transkrip + materi untuk bantu belajar

#### 12.1 Database — Tabel Baru `quiz_questions`

**File**: `backend/app/models.py`

Tambah model baru `QuizQuestion`:

```python
class QuizQuestion(Base):
    """Soal quiz yang di-generate AI dari transkrip + materi."""
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    question_type = Column(String(20), nullable=False)  # "multiple_choice" atau "essay"
    question = Column(Text, nullable=False)              # Teks soal
    options = Column(Text, default="")                   # JSON string: ["A. ...", "B. ...", "C. ...", "D. ..."]
    correct_answer = Column(Text, default="")            # Jawaban benar ("A" / teks esai)
    explanation = Column(Text, default="")               # Penjelasan jawaban
    user_answer = Column(Text, default="")               # Jawaban user (untuk tracking)
    is_correct = Column(Integer, default=-1)             # -1=belum dijawab, 0=salah, 1=benar
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="quiz_questions")
```

Tambahkan juga relasi di model `Session`:
```python
# Di class Session, tambah:
quiz_questions = relationship("QuizQuestion", back_populates="session", cascade="all, delete-orphan")
```

**Migration**: Tabel baru, jadi `Base.metadata.create_all()` otomatis buat. Tidak perlu ALTER TABLE.

---

#### 12.2 Schema — Pydantic Models

**File**: `backend/app/schemas.py`

Tambah schemas:

```python
class QuizQuestionResponse(BaseModel):
    id: int
    session_id: int
    question_type: str        # "multiple_choice" | "essay"
    question: str
    options: str              # JSON string array
    correct_answer: str
    explanation: str
    user_answer: str
    is_correct: int           # -1, 0, 1
    created_at: datetime
    class Config:
        from_attributes = True

class QuizAnswerRequest(BaseModel):
    question_id: int
    answer: str

class QuizGenerateRequest(BaseModel):
    num_questions: Optional[int] = 10
    include_essay: Optional[bool] = True

class QuizResultResponse(BaseModel):
    total: int
    answered: int
    correct: int
    wrong: int
    score_percent: float
```

---

#### 12.3 Backend — Quiz Service (Gemini Prompt)

**File BARU**: `backend/app/services/quiz_service.py`

Fungsi utama:

```python
def generate_quiz(transcript: str, material_text: str = "", num_questions: int = 10, include_essay: bool = True, language: str = "auto") -> list[dict]:
    """
    Panggil Gemini untuk generate soal quiz.
    Return list of dicts:
    [
        {
            "question_type": "multiple_choice",
            "question": "Apa itu ...",
            "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
            "correct_answer": "B",
            "explanation": "Karena ..."
        },
        ...
    ]
    """
```

**Prompt strategy**:
- Kirim transkrip (truncated) + materi ke Gemini
- Minta output **JSON array** dengan format di atas
- Instruksikan: 70% pilihan ganda, 30% esai singkat (jika `include_essay=True`)
- Instruksikan: soal harus berdasarkan materi yang dibahas, bukan pengetahuan umum
- Instruksikan: sertakan `explanation` untuk setiap soal
- Parse JSON response, handle error jika format tidak sesuai
- Gunakan `_call_with_retry` dari `gemini_service.py` (import atau duplikasi)

---

#### 12.4 Backend — Quiz Router

**File BARU**: `backend/app/routers/quiz.py`

Endpoints:

| Method | Path | Deskripsi |
|--------|------|------------|
| `POST` | `/api/sessions/{id}/quiz/generate` | Generate soal baru (body: `QuizGenerateRequest`) |
| `GET` | `/api/sessions/{id}/quiz` | List semua soal quiz sesi ini |
| `POST` | `/api/sessions/{id}/quiz/answer` | Jawab satu soal (body: `QuizAnswerRequest`) |
| `GET` | `/api/sessions/{id}/quiz/result` | Ambil hasil/skor quiz |
| `DELETE` | `/api/sessions/{id}/quiz` | Hapus semua soal quiz sesi ini (reset) |

**Logic `POST /generate`**:
1. Ambil session → pastikan punya transcript
2. Hapus quiz lama jika ada (atau tanya user, optional)
3. Panggil `quiz_service.generate_quiz()`
4. Parse result → buat `QuizQuestion` records → save ke DB
5. Return list soal (tanpa jawaban benar di response, kecuali sudah dijawab)

**Logic `POST /answer`**:
1. Ambil question by id
2. Simpan `user_answer`
3. Cek benar/salah → update `is_correct`
4. Return question + correct_answer + explanation

**Registrasi router di `main.py`**:
```python
from .routers import ..., quiz
app.include_router(quiz.router, prefix="/api", tags=["Quiz"])
```

---

#### 12.5 Frontend — API Functions

**File**: `frontend/src/services/api.js`

Tambah:
```javascript
export function generateQuiz(sessionId, numQuestions = 10, includeEssay = true) {
  return request(`/sessions/${sessionId}/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ num_questions: numQuestions, include_essay: includeEssay }),
  });
}

export function getQuiz(sessionId) {
  return request(`/sessions/${sessionId}/quiz`);
}

export function answerQuiz(sessionId, questionId, answer) {
  return request(`/sessions/${sessionId}/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, answer }),
  });
}

export function getQuizResult(sessionId) {
  return request(`/sessions/${sessionId}/quiz/result`);
}

export function deleteQuiz(sessionId) {
  return request(`/sessions/${sessionId}/quiz`, { method: 'DELETE' });
}
```

---

#### 12.6 Frontend — Tab "Quiz" di SessionDetail.jsx

**File**: `frontend/src/pages/SessionDetail.jsx`

**Perubahan**:
1. Tambah tab baru `{ id: 'quiz', label: 'Quiz', icon: HelpCircle }` (import `HelpCircle` dari lucide-react)
2. Tambah state: `quizQuestions`, `quizLoading`, `quizGenerating`, `currentQuestionIdx`, `selectedAnswer`, `showResult`, `quizResult`
3. Buat UI tab quiz:

**UI Flow**:
- **Belum ada quiz**: Tampilkan tombol "Generate Quiz" + slider jumlah soal (5-20) + toggle esai
- **Sedang generate**: Loading spinner + "AI sedang membuat soal..."
- **Quiz aktif**: Tampilkan satu soal per kartu:
  - Header: "Soal 3/10" + badge tipe (Pilihan Ganda / Esai)
  - Teks soal
  - Pilihan ganda: 4 tombol A-D (highlight saat dipilih, hijau/merah setelah dijawab)
  - Esai: input text + tombol submit
  - Setelah jawab → tampilkan benar/salah + `explanation`
  - Tombol "Soal Selanjutnya" / "Soal Sebelumnya"
  - Progress bar di atas
- **Selesai semua**: Tampilkan skor (misalnya "8/10 = 80%") + tombol "Ulangi Quiz" + tombol "Generate Baru"

**Styling**: Gunakan warna yang sudah ada:
- Benar: `bg-green-500/10 text-green-400`
- Salah: `bg-red-500/10 text-red-400`
- Belum dijawab: `bg-surface-800 text-surface-200`
- Soal aktif: `border-primary-500`

---

#### 12.7 Verification Checklist
```
✅ Generate quiz 10 soal dari sesi yang punya transkrip
✅ Soal pilihan ganda: pilih jawaban → feedback benar/salah + penjelasan
✅ Soal esai: ketik jawaban → feedback dari AI
✅ Navigasi antar soal (prev/next)
✅ Skor akhir ditampilkan setelah semua dijawab
✅ Bisa reset quiz dan generate baru
✅ Quiz disimpan di database (persist antar reload)
```

---

### Phase 13: Timestamp Sync (Klik Transkrip → Audio Loncat)
> **Goal**: Transkrip ditampilkan per-segment dengan timestamp. Klik segment → audio player langsung loncat ke waktu itu.

#### PENTING — Konteks Teknis
Whisper sudah mengembalikan data segment dari `whisper_service.py`:
```python
# whisper_service.py - return value:
{
    'text': '...',
    'language': 'id',
    'segments': [
        { 'start': 0.0, 'end': 5.2, 'text': 'Selamat pagi...' },
        { 'start': 5.2, 'end': 11.8, 'text': 'Hari ini kita akan membahas...' },
        ...
    ]
}
```
Saat ini di `transcribe.py` baris 55, hanya `result['text']` yang disimpan. **Segments dibuang**. Kita perlu simpan segments juga.

---

#### 13.1 Database — Kolom Baru `transcript_segments`

**File**: `backend/app/models.py`

Tambah kolom di Session:
```python
transcript_segments = Column(Text, default="")  # JSON string array of {start, end, text}
```

**Migration**: Karena ALTER TABLE di SQLite, tambahkan ke `migrate_v2.py` (atau buat `migrate_v3.py`):
```python
# Tambah di migration script:
if "transcript_segments" not in cols:
    c.execute('ALTER TABLE sessions ADD COLUMN transcript_segments TEXT DEFAULT ""')
```

---

#### 13.2 Schema — Update SessionResponse

**File**: `backend/app/schemas.py`

Tambah field di `SessionResponse`:
```python
transcript_segments: str  # JSON string
```

Tambah schema baru (opsional, untuk kejelasan):
```python
class TranscriptSegment(BaseModel):
    start: float   # detik dari awal audio
    end: float
    text: str
```

---

#### 13.3 Backend — Simpan Segments saat Transkripsi

**File**: `backend/app/routers/transcribe.py`

Ubah di fungsi `run_transcription()`, setelah baris `result = transcribe_audio(...)`, tambah:

```python
import json

# Simpan teks lengkap
session.transcript = result['text']

# Simpan segments dengan timestamp (BARU)
if result.get('segments'):
    session.transcript_segments = json.dumps(result['segments'], ensure_ascii=False)
else:
    session.transcript_segments = "[]"
```

---

#### 13.4 Frontend — API

**File**: `frontend/src/services/api.js`

Tidak perlu endpoint baru — segments sudah tersedia di `getSession()` response karena ditambahkan ke `SessionResponse` schema.

---

#### 13.5 Frontend — Tampilan Transkrip dengan Timestamp

**File**: `frontend/src/pages/SessionDetail.jsx`

**Perubahan di tab Transkrip**:

1. **Parse segments**: Saat session loaded, parse `session.transcript_segments` (JSON string) ke array
2. **Toggle mode**: Tambah tombol toggle "Mode Timestamp" vs "Mode Teks Biasa" di atas transkrip
3. **Render segments**: Jika mode timestamp aktif, render tiap segment sebagai blok:

```jsx
{/* Satu segment */}
<div
  onClick={() => seekAudio(segment.start)}
  className={`flex gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all
    hover:bg-surface-800/70
    ${isCurrentSegment ? 'bg-primary-500/10 border-l-2 border-primary-400' : ''}
  `}
>
  <span className="text-xs text-primary-400 font-mono whitespace-nowrap pt-0.5">
    {formatTime(segment.start)}
  </span>
  <p className="text-surface-200 text-sm leading-relaxed">
    {transcriptSearch ? highlightText(segment.text, transcriptSearch) : segment.text}
  </p>
</div>
```

4. **Fungsi `seekAudio(seconds)`**: Set `audioRef.current.currentTime = seconds` dan play
5. **Highlight segment aktif**: Saat audio playing, track `currentTime` → highlight segment yang sedang diputar
6. **Format waktu**: Fungsi `formatTime(seconds)` → "01:23" atau "1:23:45"

**Auto-scroll**: Segment yang sedang aktif (audio playing) otomatis scroll ke view.

**Penting**: Jika `transcript_segments` kosong/null (sesi lama yang di-transcribe sebelum V3), fallback ke tampilan teks biasa seperti sekarang.

---

#### 13.6 Frontend — Audio Player Integration

Di `SessionDetail.jsx`, tambah:

1. **State baru**: `currentAudioTime` (float, detik)
2. **useEffect**: Pasang event listener `timeupdate` pada `audioRef.current`:
```javascript
useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;
  const handler = () => setCurrentAudioTime(audio.currentTime);
  audio.addEventListener('timeupdate', handler);
  return () => audio.removeEventListener('timeupdate', handler);
}, [session?.audio_path]);
```
3. **Fungsi `seekAudio`**:
```javascript
function seekAudio(seconds) {
  if (!audioRef.current) return;
  audioRef.current.currentTime = seconds;
  audioRef.current.play();
  setIsPlaying(true);
}
```
4. **Deteksi segment aktif**:
```javascript
const currentSegmentIdx = segments.findIndex(
  seg => currentAudioTime >= seg.start && currentAudioTime < seg.end
);
```

---

#### 13.7 Handling Sesi Lama (Backward Compatibility)

Sesi yang sudah di-transcribe sebelum Phase 13 tidak punya `transcript_segments`. Solusi:
- Cek `session.transcript_segments`: jika kosong → tampilkan mode teks biasa saja
- Tambah tombol **"Re-transcribe untuk Timestamp"** yang memanggil ulang transkripsi (akan mengisi segments)
- Atau: buat endpoint baru `POST /api/sessions/{id}/generate-segments` yang menjalankan Whisper ulang HANYA untuk mendapatkan segments (opsional, karena re-transcribe sudah cukup)

---

#### 13.8 Verification Checklist
```
✅ Transcribe audio baru → segments tersimpan di DB
✅ Tab transkrip menampilkan per-segment dengan timestamp (00:00, 00:05, ...)
✅ Klik segment → audio loncat ke waktu tsb dan play
✅ Segment yang sedang di-play di-highlight
✅ Search keyword tetap bekerja di mode timestamp
✅ Sesi lama tanpa segments → fallback ke tampilan teks biasa
✅ Toggle antara mode timestamp dan mode teks biasa
```

---

## 📋 PHASE-BY-PHASE BUILD PLAN

---

### 🟢 Phase 1: Project Setup & Foundation ✅
> **Goal**: Semua tools terinstall, project bisa dijalankan (belum ada fitur)

**Backend:**
- [ ] Buat folder structure `backend/`
- [ ] Setup Python virtual environment
- [ ] Install dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `python-multipart`)
- [ ] Buat `main.py` — FastAPI entry point dengan hello world
- [ ] Buat `database.py` — Koneksi SQLite + SQLAlchemy
- [ ] Buat `models.py` — Tabel `subjects`, `sessions`, `chat_messages`
- [ ] Buat `.env` dan file `requirements.txt`

**Frontend:**
- [ ] Buat project Vite + React di folder `frontend/`
- [ ] Install & konfigurasi Tailwind CSS
- [ ] Buat layout dasar (sidebar + header + content area)
- [ ] Setup React Router (halaman Dashboard, Subject, Session)

**Checkpoint:**
```
✅ Backend jalan di http://localhost:8000
✅ Frontend jalan di http://localhost:5173
✅ Database terbuat otomatis saat backend start
✅ Halaman kosong bisa dibuka di browser
```

---

### 🟢 Phase 2: CRUD Mata Kuliah & Sesi ✅
> **Goal**: Bisa tambah, lihat, edit, hapus mata kuliah dan sesi pertemuan

**Backend:**
- [ ] Buat router `subjects.py` — CRUD mata kuliah
  - `GET /api/subjects` — List semua
  - `POST /api/subjects` — Tambah baru
  - `PUT /api/subjects/{id}` — Edit
  - `DELETE /api/subjects/{id}` — Hapus
- [ ] Buat router `sessions.py` — CRUD sesi
  - `GET /api/subjects/{id}/sessions` — List sesi per matkul
  - `POST /api/sessions` — Buat sesi baru
  - `GET /api/sessions/{id}` — Detail sesi
  - `DELETE /api/sessions/{id}` — Hapus sesi
- [ ] Test semua endpoint di Swagger UI

**Frontend:**
- [ ] Halaman Dashboard — Tampilkan semua matkul sebagai card grid
- [ ] Modal/form tambah mata kuliah baru
- [ ] Halaman Subject — List pertemuan per matkul
- [ ] Tombol hapus & edit matkul

**Checkpoint:**
```
✅ Bisa tambah mata kuliah "Algoritma", "Basis Data", dll
✅ Bisa lihat list matkul di dashboard
✅ Bisa buat sesi pertemuan di dalam matkul
✅ Data tersimpan di SQLite (persist setelah restart)
```

---

### 🟢 Phase 3: Upload & Record Audio ✅
> **Goal**: Bisa upload file audio/video ATAU record dari tab browser

**Backend:**
- [ ] Buat folder `uploads/` untuk menyimpan file audio
- [ ] Endpoint upload file audio (support .mp3, .mp4, .wav, .m4a, .webm)
- [ ] Buat `audio_service.py` — Konversi video→audio via FFmpeg
- [ ] Validasi file (ukuran, format)
- [ ] Simpan path file ke database

**Frontend:**
- [ ] Komponen Upload — Drag & drop atau pilih file
- [ ] Komponen Recorder — Capture audio tab browser (`getDisplayMedia`)
- [ ] Progress bar saat upload
- [ ] Preview audio sebelum submit (audio player)
- [ ] Pilih matkul + nomor pertemuan saat upload

**Checkpoint:**
```
✅ Upload file .mp4 dari rekaman Zoom → tersimpan di server
✅ Record audio dari tab browser → tersimpan di server
✅ Audio bisa di-play kembali dari web app
✅ File terkonversi otomatis ke format yang tepat
```

---

### 🟢 Phase 4: Transkripsi Whisper ✅
> **Goal**: Audio yang di-upload bisa di-transcribe jadi teks

**Backend:**
- [ ] Install `openai-whisper` + dependensi CUDA/GPU
- [ ] Buat `whisper_service.py`
  - Load model `medium` (optimal untuk RTX 3050, 4GB VRAM)
  - Transcribe audio → teks Bahasa Indonesia
  - Deteksi bahasa otomatis
- [ ] Buat router `transcribe.py`
  - `POST /api/sessions/{id}/transcribe` — Mulai transkripsi (background task)
  - `GET /api/sessions/{id}/status` — Cek progress
- [ ] Background task dengan FastAPI BackgroundTasks
- [ ] Simpan hasil transkrip ke database

**Frontend:**
- [ ] Tombol "Mulai Transkripsi" di halaman sesi
- [ ] Status indicator (⏳ Processing... → ✅ Selesai)
- [ ] Tampilkan transkrip setelah selesai (text viewer)
- [ ] Loading animation selama proses

**Checkpoint:**
```
✅ Upload audio 2 menit → klik Transcribe → dapat teks
✅ Teks muncul di halaman sesi
✅ Status berubah: pending → transcribing → done
✅ GPU terpakai saat transkripsi (lebih cepat)
```

---

### 🟢 Phase 5: AI Rangkuman & Tanya Jawab ✅
> **Goal**: Transkrip bisa dirangkum oleh AI dan bisa tanya jawab

**Backend:**
- [ ] Install `google-generativeai` SDK
- [ ] Buat `gemini_service.py`
  - Fungsi summarize: transkrip → rangkuman terstruktur
  - Fungsi chat: transkrip + pertanyaan → jawaban kontekstual
  - Prompt engineering dalam Bahasa Indonesia
- [ ] Buat router `ai.py`
  - `POST /api/sessions/{id}/summarize` — Generate rangkuman
  - `POST /api/sessions/{id}/chat` — Tanya jawab
  - `GET /api/sessions/{id}/chat` — Riwayat chat
- [ ] Simpan rangkuman & riwayat chat ke database

**Frontend:**
- [ ] Tab "Rangkuman" — Tampilkan rangkuman AI terstruktur
- [ ] Tombol "Generate Rangkuman" jika belum ada
- [ ] Tab "Tanya Jawab" — Chat interface
  - Input box untuk pertanyaan
  - Bubble chat (user & AI)
  - Riwayat chat tersimpan
- [ ] Loading state saat AI memproses

**Checkpoint:**
```
✅ Klik "Rangkum" → muncul rangkuman terstruktur
✅ Ketik pertanyaan → AI jawab berdasarkan materi kuliah
✅ Riwayat chat tersimpan dan muncul saat buka lagi
✅ Rangkuman menampilkan poin-poin penting kuliah
```

---

### 🟢 Phase 6: Polish & Finishing ✅
> **Goal**: Tampilan profesional, bukan hackathon project

**UI/UX Polish:**
- [ ] Dark mode / light mode toggle
- [ ] Micro-animations (hover, transitions, loading)
- [ ] Empty states yang informatif ("Belum ada mata kuliah", dll)
- [ ] Responsive design (tablet & desktop)
- [ ] Warna & typography konsisten (premium feel)
- [ ] Icon set yang clean (Lucide atau Heroicons)

**Error Handling:**
- [ ] Handle upload gagal — tampilkan pesan error yang jelas
- [ ] Handle Whisper error — retry option
- [ ] Handle Gemini API limit — tampilkan pesan & saran
- [ ] Handle file format tidak didukung
- [ ] Konfirmasi sebelum hapus data

**Detail Kecil yang Bikin "Finished":**
- [ ] Favicon & title yang proper
- [ ] Toast notification untuk aksi berhasil/gagal
- [ ] Durasi audio ditampilkan otomatis
- [ ] Timestamp pada transkrip (kalau Whisper support)
- [ ] Smooth page transitions

**Checkpoint:**
```
✅ Tampilannya bangga untuk di-screenshot
✅ Semua error ditangani dengan pesan yang jelas
✅ Tidak ada halaman "rusak" atau "kosong" tanpa feedback
✅ Terasa seperti produk jadi, bukan prototype
```

---

### 🟢 Phase 7: Handoff & Dokumentasi ✅
> **Goal**: Bisa jalan tanpa bantuan saya

- [ ] README.md lengkap (install, setup, cara pakai)
- [ ] Dokumentasi cara menambah Gemini API key
- [ ] Dokumentasi cara install FFmpeg
- [ ] Dokumentasi cara jalankan project (backend + frontend)
- [ ] List fitur V2 yang bisa dikembangkan nanti
- [ ] Tips troubleshooting (Whisper lambat, Gemini error, dll)

**Checkpoint:**
```
✅ Kamu bisa jalankan project dari nol hanya dengan baca README
✅ Kamu tidak tergantung pada conversation ini untuk maintenance
✅ Ada jalan untuk pengembangan selanjutnya (V2 roadmap)
```

---

## Arsitektur Project
```
transcript-online-course/
├── frontend/                    # Vite + React + Tailwind
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Halaman utama
│   │   ├── services/            # API calls ke backend
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                     # Python FastAPI
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── database.py          # SQLite setup
│   │   ├── models.py            # Database models
│   │   ├── routers/
│   │   │   ├── subjects.py      # CRUD mata kuliah
│   │   │   ├── sessions.py      # CRUD sesi/pertemuan
│   │   │   ├── transcribe.py    # Transcription endpoint
│   │   │   └── ai.py            # Summarize + Chat endpoints
│   │   └── services/
│   │       ├── whisper_service.py
│   │       ├── gemini_service.py
│   │       └── audio_service.py
│   ├── uploads/
│   ├── requirements.txt
│   └── .env
│
├── PLANNING.md                  # File ini
└── README.md                    # Dokumentasi user
```

## Database Schema

### subjects (Mata Kuliah)
| Column | Type | Deskripsi |
|---|---|---|
| id | INTEGER PK | Auto increment |
| name | TEXT | Nama mata kuliah |
| description | TEXT | Deskripsi opsional |
| created_at | DATETIME | Waktu dibuat |

### sessions (Pertemuan)
| Column | Type | Deskripsi |
|---|---|---|
| id | INTEGER PK | Auto increment |
| subject_id | INTEGER FK | Relasi ke subjects |
| session_number | INTEGER | Pertemuan ke-berapa |
| title | TEXT | Judul/topik pertemuan |
| audio_path | TEXT | Path file audio |
| transcript | TEXT | Hasil transkripsi |
| transcript_segments | TEXT | JSON array [{start, end, text}] — V3 |
| summary | TEXT | Rangkuman AI |
| status | TEXT | pending/transcribing/summarizing/done |
| language | TEXT | Bahasa transkripsi (auto/id/en/...) — V2 |
| duration_minutes | FLOAT | Durasi dalam menit |
| material_path | TEXT | Path file PDF materi — V2 |
| material_text | TEXT | Teks extract dari PDF — V2 |
| created_at | DATETIME | Waktu dibuat |

### chat_messages (Riwayat Chat AI)
| Column | Type | Deskripsi |
|---|---|---|
| id | INTEGER PK | Auto increment |
| session_id | INTEGER FK | Relasi ke sessions |
| role | TEXT | "user" atau "assistant" |
| message | TEXT | Isi pesan |
| created_at | DATETIME | Waktu dibuat |

### quiz_questions (Soal Quiz AI) — V3
| Column | Type | Deskripsi |
|---|---|---|
| id | INTEGER PK | Auto increment |
| session_id | INTEGER FK | Relasi ke sessions |
| question_type | TEXT | "multiple_choice" / "essay" |
| question | TEXT | Teks soal |
| options | TEXT | JSON array pilihan (PG) |
| correct_answer | TEXT | Jawaban benar |
| explanation | TEXT | Penjelasan jawaban |
| user_answer | TEXT | Jawaban user |
| is_correct | INTEGER | -1=belum, 0=salah, 1=benar |
| created_at | DATETIME | Waktu dibuat |

## Requirements
- Python 3.10+
- Node.js 18+
- FFmpeg
- Google Gemini API Key (gratis via aistudio.google.com)

---

## PHASE-BY-PHASE BUILD PLAN — V4 (UI Redesign)

---

### Phase 14: UI Redesign — Teal + Orange Palette
> **Goal**: Ganti palet warna dari Crimson Dark ke Teal + Orange yang lebih fun & energetic. Tambah Google Font "Plus Jakarta Sans".

**Status**: ✅ Selesai

#### Latar Belakang
Palet sekarang menggunakan Crimson Red (`#f43f5e`) sebagai primary. Semua komponen sudah menggunakan token `primary-*` dan `surface-*` via Tailwind CSS v4 `@theme {}`, sehingga **ganti palet cukup di `index.css`** saja — tidak perlu ubah banyak komponen.

#### Palet Baru: Teal + Orange
| Token | Hex | Keterangan |
|---|---|---|
| `primary-600` | `#0d9488` | Teal — warna utama (button, active tab, dll) |
| `primary-500` | `#14b8a6` | Teal terang — hover state |
| `primary-400` | `#2dd4bf` | Teal soft — icon, badge |
| `accent-500` | `#f97316` | Orange — CTA sekunder, highlight |
| `surface-950` | `#070e0e` | Background utama (cool dark) |
| `surface-900` | `#0f1e1d` | Surface card |
| `surface-800` | `#1a2a29` | Input background |
| `surface-700` | `#2a3f3e` | Border, divider |

#### Font Baru
- **Plus Jakarta Sans** (Google Fonts) — lebih modern & fun dibanding Inter
- Import URL: `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap`

---

#### 14.1 Ubah CSS Tokens

**File**: `frontend/src/index.css`

Tambah Google Fonts import di baris **paling atas**:
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
```

Ganti seluruh blok `@theme { ... }` dengan:
```css
@theme {
  /* Primary: Teal */
  --color-primary-50:  #f0fdfa;
  --color-primary-100: #ccfbf1;
  --color-primary-200: #99f6e4;
  --color-primary-300: #5eead4;
  --color-primary-400: #2dd4bf;
  --color-primary-500: #14b8a6;
  --color-primary-600: #0d9488;
  --color-primary-700: #0f766e;
  --color-primary-800: #115e59;
  --color-primary-900: #134e4a;

  /* Accent: Orange */
  --color-accent-300: #fdba74;
  --color-accent-400: #fb923c;
  --color-accent-500: #f97316;
  --color-accent-600: #ea580c;

  /* Surface: Cool Dark (slate dengan tint teal) */
  --color-surface-50:  #f0fdfa;
  --color-surface-100: #e0f2f1;
  --color-surface-200: #b2dfdb;
  --color-surface-300: #80cbc4;
  --color-surface-400: #4db6ac;
  --color-surface-500: #5a7a78;
  --color-surface-600: #3d5c5a;
  --color-surface-700: #2a3f3e;
  --color-surface-800: #1a2a29;
  --color-surface-900: #0f1e1d;
  --color-surface-950: #070e0e;

  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
}
```

---

#### 14.2 Polish Sidebar Logo (Layout.jsx)

**File**: `frontend/src/components/Layout.jsx`

Ubah gradient logo brand di sidebar dari `from-primary-500 to-primary-700` menjadi **teal→orange gradient** untuk lebih pop:
```jsx
// Sebelum:
className="... bg-gradient-to-br from-primary-500 to-primary-700 ..."
// Sesudah:
className="... bg-gradient-to-br from-primary-500 to-accent-500 ..."
```

---

#### 14.3 Update Gradients Card di Dashboard.jsx

**File**: `frontend/src/pages/Dashboard.jsx`

Array `gradients` dan `iconColors` sudah pakai token `primary-*`, jadi otomatis berubah ke teal. Pastikan variasi warna tetap menarik — bisa tambahkan variasi `accent-500/15` untuk orange mix:
```javascript
const gradients = [
  'from-primary-600/25 to-primary-800/10',
  'from-accent-500/15 to-primary-700/10',   // teal-orange
  'from-primary-500/20 to-primary-800/10',
  'from-accent-600/15 to-primary-800/10',
  'from-primary-400/15 to-primary-900/10',
  'from-accent-500/10 to-primary-700/15',
];
```

---

#### 14.4 Verification Checklist
```
[x] Buka http://localhost:5173 — background hadir dark teal (bukan hitam kemerahan)
[x] Dashboard: card mata kuliah bergradien teal (bukan merah muda)
[x] SubjectDetail: badge nomor sesi berwarna teal
[x] SessionDetail: tab aktif teal, progress bar quiz teal, timestamp highlight teal
[x] Light mode toggle — kontras tetap terjaga
[x] Font berubah ke Plus Jakarta Sans (lebih rounded dibanding Inter)
[x] Logo sidebar menampilkan gradient teal → orange
```

---

## PHASE-BY-PHASE BUILD PLAN — V5 (Fitur Lanjutan)

> **Status**: 🔲 Belum dikerjakan — Roadmap untuk pengembangan berikutnya.

---

### Phase 15: Notifikasi Transkripsi Selesai ✅
> **Goal**: User mendapat notifikasi saat proses transkripsi selesai, karena proses bisa memakan waktu lama (5-30 menit).

#### 15.1 Notifikasi Browser (Push Notification)
**File**: `frontend/src/pages/SessionDetail.jsx`

- [x] Minta izin `Notification.requestPermission()` saat user mulai transkripsi
- [x] Saat polling status selesai (`status === 'done'`), tampilkan:
  - **Browser notification** (jika tab tidak aktif): `new Notification("Transkripsi Selesai!", { body: "Sesi: ..." })`
  - **Toast notification** (jika tab aktif): via `toast.success()`
- [x] Tambah **sound effect** via Web Audio API (tanpa file eksternal) — G5 → C6 ding

**File baru**: `frontend/src/hooks/useNotification.js`
- Hook `useNotification` mengekspos `requestPermission()` dan `notify(title, body)`
- `playDing()` menggunakan `AudioContext` untuk suara lonceng 2-nada

#### 15.2 Visual Indicator di Sidebar
**File**: `frontend/src/components/Layout.jsx`

- [x] Sesi yang sedang di-transcribe menampilkan **spinner Loader2 amber** di sidebar (menggantikan status dot)
- [x] Label "AI..." kecil di sebelah kanan nama sesi saat transcribing

#### 15.3 Verification
```
[x] Mulai transkripsi → minimize tab → notifikasi browser muncul saat selesai
[x] Mulai transkripsi → tetap di halaman → toast + sound muncul saat selesai
[x] Sidebar menampilkan spinner + label "AI..." saat status transcribing
```

---

### Phase 16: Responsive Mobile ✅
> **Goal**: Tampilan optimal di layar HP (360-480px) dan tablet (768px). Semua fitur bisa diakses dari mobile browser.

#### 16.1 Layout Responsive
**File**: `frontend/src/components/Layout.jsx`

- [x] Sidebar collapse di mobile — hamburger menu berfungsi + overlay klik untuk tutup
- [x] Header search bar: ikon 🔍 di mobile, expand inline saat diklik, collapse saat blur jika kosong
- [x] Theme toggle tetap accessible di mobile (kanan atas)

#### 16.2 Dashboard Responsive
**File**: `frontend/src/pages/Dashboard.jsx`

- [x] Layout utama `flex-col lg:flex-row` — stacks fully on mobile
- [x] Featured card row: `flex-col sm:flex-row` — stacks on xs
- [x] Small cards: `flex-row` on mobile (horizontal), `flex-col` on sm+
- [x] Stats dan Activity feed: `w-full lg:w-72` — full width on mobile

#### 16.3 Session Detail Responsive
**File**: `frontend/src/pages/SessionDetail.jsx`

- [x] Tab bar: label hidden on xs (`hidden sm:inline`), icon only on mobile
- [x] Session header: `flex-col sm:flex-row` — export buttons below title on mobile
- [x] Audio player: volume slider `hidden sm:flex` on mobile to save space
- [x] Content cards: `p-4 sm:p-6` — smaller padding on mobile

#### 16.4 Subject Detail Responsive
**File**: `frontend/src/pages/SubjectDetail.jsx`

- [x] Header title + button: `flex-col sm:flex-row`
- [x] Session cards: smaller padding, wrapping meta info
- [x] Modal form grid: `grid-cols-1 sm:grid-cols-3`

#### 16.5 Verification
```
[x] Layout stacks correctly on mobile (flex-col → flex-row breakpoints)
[x] Search bar collapses to icon on mobile
[x] Sidebar hamburguer menu + overlay dimmer
[x] Audio player clean on mobile (volume hidden)
[x] All touch targets adequately sized
```

---

### Phase 17: Catatan Manual (Rich Notes) ✅
> **Goal**: User bisa menulis catatan sendiri di samping transkrip, untuk menambah konteks atau highlight poin penting.

#### 17.1 Database
**File**: `backend/app/models.py`, `backend/migrate_v5.py`

- [x] Tambah kolom `notes = Column(Text, default="")` di Session model
- [x] Migration script `migrate_v5.py` — sudah dijalankan, kolom ditambahkan ke DB

#### 17.2 Schema
**File**: `backend/app/schemas.py`

- [x] Field `notes: str` ditambahkan di `SessionResponse`
- [x] `NotesUpdateRequest(BaseModel)` dibuat

#### 17.3 Backend API
**File**: `backend/app/routers/sessions.py`

- [x] Endpoint `PUT /api/sessions/{id}/notes` — simpan catatan ke DB

#### 17.4 Frontend API
**File**: `frontend/src/services/api.js`

- [x] `saveNotes(sessionId, notes)` — PUT request ke endpoint notes

#### 17.5 Frontend UI — Tab "Catatan"
**File**: `frontend/src/pages/SessionDetail.jsx`

- [x] Tab baru `{ id: 'notes', label: 'Catatan', icon: PenLine }`
- [x] Toolbar markdown: **Tebal**, *Miring*, `Kode`, # Judul, • List, 1. Urut
- [x] Tombol **Timestamp** — sisipkan `[mm:ss] *HH:MM* — ` berdasarkan posisi audio saat ini
- [x] **Auto-save** debounce 1.5 detik — indicator dot: amber (menyimpan) / hijau (tersimpan)
- [x] Session notes diload saat halaman pertama dibuka dan disinkronkan ke textarea
- [x] Textarea `font-mono`, resizable, placeholder dengan tips

#### 17.6 Verification
```
[x] Buka tab Catatan → ketik teks → otomatis tersimpan setelah 1.5 detik
[x] Refresh halaman → catatan masih ada (diload dari backend)
[x] Toolbar markdown: klik tombol → format disisipkan ke textarea
[x] Klik Timestamp saat audio bermain → timestamp audio disisipkan
[x] Indicator "Menyimpan..." → "Tersimpan" bekerja
```

---

## Fitur V5 — Ringkasan

| # | Fitur | Prioritas | Estimasi |
|---|---|---|---|
| 15 | Notifikasi transkripsi selesai | 🟢 Mudah | 1-2 jam |
| 16 | Responsive mobile | 🟡 Sedang | 3-5 jam |
| 17 | Catatan manual (rich notes) | 🟡 Sedang | 3-4 jam |

---

## Offline vs Online — Referensi

| Fitur | Mode | Keterangan |
|---|---|---|
| Transkripsi (Whisper) | 100% Offline | Berjalan lokal di GPU/CPU |
| Manajemen data (SQLite) | 100% Offline | File database lokal |
| Audio player dan navigasi | 100% Offline | File audio lokal |
| Rangkuman AI (Gemini) | ⚡ Online | Butuh internet → Gemini API |
| Tanya Jawab AI (Chat) | ⚡ Online | Butuh internet → Gemini API |
| Quiz Generator | ⚡ Online | Butuh internet → Gemini API |

