# Transcript Online Course

Web app personal untuk **merekam & mentranskrip kuliah online**, menghasilkan **rangkuman AI**, dan **tanya jawab** tentang materi — **100% gratis**.

## Fitur

- **Organisasi** per mata kuliah & per pertemuan
- **Upload** file audio/video (MP3, MP4, WAV, M4A, WebM)
- **Record** audio langsung dari tab browser (Zoom/Google Meet)
- **Transkripsi otomatis** menggunakan Whisper AI (lokal, GPU accelerated)
- **Rangkuman AI** terstruktur menggunakan Google Gemini
- **Tanya jawab AI** tentang materi kuliah
- **Dark / Light mode** toggle
- **Responsive** — Desktop & tablet

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Frontend | Vite + React + Tailwind CSS v4 |
| Backend | Python + FastAPI |
| Speech-to-Text | OpenAI Whisper (lokal, GPU) |
| AI | Google Gemini API (free tier) |
| Database | SQLite |
| Audio Tool | FFmpeg |

## Prerequisites

Pastikan sudah terinstall:

- **Python 3.10+** → [python.org](https://python.org)
- **Node.js 18+** → [nodejs.org](https://nodejs.org)
- **FFmpeg** → [ffmpeg.org](https://ffmpeg.org) (pastikan ada di PATH)
- **Google Gemini API Key** (gratis) → [aistudio.google.com](https://aistudio.google.com)

### Cek Instalasi
```bash
python --version    # Python 3.10+
node --version      # v18+
ffmpeg -version     # FFmpeg installed
```

## Setup & Jalankan

### 1. Clone / Download Project
```bash
cd transcript-online-course
```

### 2. Setup Backend
```bash
cd backend

# Buat virtual environment
python -m venv venv

# Aktifkan venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Whisper (pilih salah satu):
pip install openai-whisper              # CPU only
pip install openai-whisper torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121  # GPU (CUDA 12.1)
```

### 3. Konfigurasi API Key
Edit file `backend/.env`:
```env
GEMINI_API_KEY=your_api_key_here
WHISPER_MODEL=medium
```

> **Cara dapat Gemini API Key (gratis):**
> 1. Buka [aistudio.google.com](https://aistudio.google.com)
> 2. Login dengan Google account
> 3. Klik "Get API Key" → "Create API key"
> 4. Copy key ke file `.env`

### 4. Setup Frontend
```bash
cd frontend
npm install
```

### 5. Jalankan!
Buka **2 terminal**:

**Terminal 1 — Backend:**
```bash
cd backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --reload
```
Backend jalan di: `http://localhost:8000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Frontend jalan di: `http://localhost:5173`

## Cara Pakai

1. **Buat Mata Kuliah** — Klik "Tambah Mata Kuliah" di Dashboard
2. **Buat Sesi** — Masuk ke mata kuliah, klik "Sesi Baru"
3. **Upload/Record Audio** — Pilih file audio atau record dari tab browser
4. **Transkripsi** — Di halaman sesi, klik "Mulai Transkripsi"
5. **Rangkuman** — Setelah transkrip selesai, buka tab "Rangkuman" → "Generate Rangkuman"
6. **Tanya Jawab** — Buka tab "Tanya Jawab", ketik pertanyaan tentang materi

## Struktur Project

```
transcript-online-course/
├── frontend/                    # Vite + React + Tailwind
│   └── src/
│       ├── components/          # Layout, Modal, Toast, ThemeToggle, AudioRecorder
│       ├── pages/               # Dashboard, SubjectDetail, SessionDetail
│       └── services/            # API calls ke backend
│
├── backend/                     # Python FastAPI
│   ├── app/
│   │   ├── main.py              # Entry point
│   │   ├── database.py          # SQLite connection
│   │   ├── models.py            # Database models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── routers/             # API endpoints
│   │   │   ├── subjects.py      # CRUD mata kuliah
│   │   │   ├── sessions.py      # CRUD sesi
│   │   │   ├── transcribe.py    # Transkripsi Whisper
│   │   │   └── ai.py            # Rangkuman + Chat Gemini
│   │   └── services/
│   │       ├── audio_service.py # FFmpeg konversi
│   │       ├── whisper_service.py
│   │       └── gemini_service.py
│   ├── uploads/                 # File audio tersimpan di sini
│   ├── requirements.txt
│   └── .env                     # API keys
│
├── PLANNING.md
└── README.md
```

## Troubleshooting

### Whisper lambat?
- Pastikan GPU CUDA terdeteksi: `python -c "import torch; print(torch.cuda.is_available())"`
- Gunakan model lebih kecil: ubah `WHISPER_MODEL=small` di `.env`
- Model `medium` butuh ~4GB VRAM (cocok untuk RTX 3050+)

### Gemini error "quota exceeded"?
- Free tier: 15 RPM (request per menit), 1M TPM (tokens per menit)
- Tunggu beberapa menit lalu coba lagi
- Cek quota di [aistudio.google.com](https://aistudio.google.com)

### FFmpeg not found?
- Download dari [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
- Pastikan `ffmpeg.exe` ada di System PATH
- Test: `ffmpeg -version`

### Database error?
- Hapus file `backend/transcript.db` dan restart backend
- Database akan dibuat ulang otomatis (data sebelumnya hilang)

## Fitur V2 (Roadmap)

- Cari keyword di transkrip
- Export ke PDF/Word
- Multi-bahasa support
- Timestamp pada transkrip
- Statistik penggunaan

## Lisensi

Project personal untuk kegunaan sendiri. Gunakan & modifikasi sesuka hati.
