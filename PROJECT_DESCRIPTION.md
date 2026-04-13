# 🎓 Transcript Online Course — Project Description

> **Tujuan dokumen ini**: Memberikan gambaran lengkap tentang project ini agar AI agent lain bisa memahami seluruh fitur, arsitektur, dan teknologi yang digunakan — untuk membuat UI yang lebih fresh dan proper.

---

## 📋 Ringkasan Project

**Transcript Online Course** adalah web app personal untuk **merekam & mentranskrip kuliah online**, menghasilkan **rangkuman AI**, **quiz AI**, dan **tanya jawab** tentang materi — 100% gratis, berjalan di lokal. Bahasa UI: **Bahasa Indonesia**.

---

## 🛠 Tech Stack

### Frontend
| Teknologi | Versi | Keterangan |
|---|---|---|
| **Vite** | 8.x | Build tool & dev server |
| **React** | 19.x | UI library |
| **Tailwind CSS** | 4.x | Utility-first CSS (via `@tailwindcss/vite` plugin) |
| **React Router DOM** | 7.x | Client-side routing |
| **Lucide React** | 0.577+ | Icon library |
| **Google Fonts** | Plus Jakarta Sans | Typography |

### Backend
| Teknologi | Versi | Keterangan |
|---|---|---|
| **Python** | 3.10+ | Bahasa backend |
| **FastAPI** | 0.115 | REST API framework |
| **Uvicorn** | 0.30 | ASGI server |
| **SQLAlchemy** | 2.0 | ORM + database |
| **SQLite** | - | File-based database (tanpa server) |
| **Pydantic** | 2.9 | Request/response validation |
| **OpenAI Whisper** | latest | Speech-to-text (lokal, GPU accelerated) |
| **Google Generative AI** | 0.8 | Gemini API — rangkuman, chat, quiz |
| **FFmpeg** | system | Konversi format audio/video |
| **fpdf2** | latest | Export ke PDF |
| **python-docx** | latest | Export ke DOCX |
| **PyPDF2** | latest | Extract teks dari PDF materi |

---

## 🔧 Arsitektur & Folder Structure

```
transcript-online-course/
├── frontend/                         # Vite + React + Tailwind CSS v4
│   ├── src/
│   │   ├── App.jsx                   # Router setup (ThemeProvider → ToastProvider → Routes)
│   │   ├── main.jsx                  # Entry point (BrowserRouter → App)
│   │   ├── index.css                 # Design system: theme colors, light mode, animations
│   │   ├── components/
│   │   │   ├── Layout.jsx            # Main layout: sidebar + header + content (Outlet)
│   │   │   ├── Modal.jsx             # Reusable modal dialog
│   │   │   ├── Toast.jsx             # Toast notification system (context-based)
│   │   │   ├── ThemeToggle.jsx       # Dark/Light mode toggle (context-based)
│   │   │   └── AudioRecorder.jsx     # Browser tab audio capture (getDisplayMedia)
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         # Homepage: subject cards, stats, activity feed
│   │   │   ├── SubjectDetail.jsx     # Subject page: session list, create session modal
│   │   │   └── SessionDetail.jsx     # Session page: audio player + 6 tabs
│   │   ├── services/
│   │   │   └── api.js                # Semua HTTP calls ke backend (fetch-based)
│   │   └── hooks/
│   │       └── useNotification.js    # Browser push notification hook
│   └── package.json
│
├── backend/                          # Python FastAPI
│   ├── app/
│   │   ├── main.py                   # FastAPI entry point, CORS, router registration
│   │   ├── database.py               # SQLite + SQLAlchemy engine + session
│   │   ├── models.py                 # 4 database models
│   │   ├── schemas.py                # Pydantic schemas (request/response)
│   │   ├── routers/
│   │   │   ├── subjects.py           # CRUD mata kuliah
│   │   │   ├── sessions.py           # CRUD sesi + upload audio + upload material + notes
│   │   │   ├── transcribe.py         # Start transcription (background task)
│   │   │   ├── ai.py                 # Summarize + Chat endpoints
│   │   │   ├── search.py             # Global transcript search
│   │   │   ├── export.py             # Export PDF/DOCX
│   │   │   └── quiz.py               # Quiz CRUD + generate + answer
│   │   └── services/
│   │       ├── whisper_service.py    # Whisper model loading & transcription
│   │       ├── gemini_service.py     # Gemini API calls (summarize, chat)
│   │       ├── quiz_service.py       # Gemini quiz generation
│   │       ├── audio_service.py      # FFmpeg audio conversion
│   │       └── material_service.py   # PDF text extraction
│   ├── uploads/                      # Audio & material files stored here
│   ├── requirements.txt
│   └── .env                          # GEMINI_API_KEY, WHISPER_MODEL
│
├── PROJECT_DESCRIPTION.md            # File ini
├── PLANNING.md
└── README.md
```

---

## 🚀 Semua Fitur (V1 — V3+)

### V1: Core Features ✅
1. **Organisasi per Mata Kuliah & Sesi** — CRUD subjects & sessions dengan hierarki
2. **Upload Audio/Video** — Support MP3, MP4, WAV, M4A, WebM, OGG
3. **Record Audio dari Browser** — Capture tab audio (Zoom/Meet) via `getDisplayMedia` API
4. **Transkripsi Otomatis** — OpenAI Whisper lokal, GPU accelerated (background task + polling setiap 3 detik)
5. **Rangkuman AI** — Google Gemini membuat rangkuman terstruktur dari transkrip
6. **Tanya Jawab AI** — Chat contextual tentang materi kuliah, riwayat tersimpan di database
7. **Dark/Light Mode** — Toggle dengan CSS class-based theming (class `.light` pada `<html>`)
8. **Responsive Layout** — Desktop & tablet friendly

### V2: Enhanced Features ✅
9. **Cari Keyword di Transkrip** — Global search di header (debounced 300ms, dropdown) + in-transcript search + highlight yellow
10. **Export ke PDF/Word** — Download transkrip + rangkuman sebagai file
11. **Upload PDF Materi** — Upload materi kuliah agar AI punya konteks lebih lengkap saat rangkum/chat
12. **Multi-bahasa Support** — Pilih bahasa saat transkripsi: ID, EN, JA, ZH, KO, MS, AR, DE, FR, ES + auto-detect

### V3: Advanced Features ✅
13. **Quiz / Flashcard Generator** — AI generate soal pilihan ganda & esai dari transkrip + materi
    - Configurable: jumlah soal (5–20), include/exclude tipe esai
    - Navigasi prev/next, feedback benar/salah + explanation, skor akhir
    - Quiz data persisted di database
14. **Timestamp Sync** — Transkrip per-segment dengan timestamp, klik → audio seek ke waktu tersebut
    - Auto-scroll ke segment aktif saat audio playing
    - Highlight segment yang sedang diputar
    - Toggle mode: timestamp vs teks biasa (fallback untuk sesi lama)

### V5: Additional Features ✅
15. **Catatan Manual (Notes)** — Markdown notes per sesi, auto-save debounce 1.5 detik
16. **Browser Notification** — Push notification + suara saat transkripsi selesai (Web Notifications API)

---

## 🗄 Database Schema (SQLite)

### `subjects` — Mata Kuliah
| Column | Type | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `name` | VARCHAR(200) | Nama mata kuliah |
| `description` | TEXT | Deskripsi (opsional) |
| `created_at` | DATETIME | Timestamp dibuat |

### `sessions` — Sesi Pertemuan
| Column | Type | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `subject_id` | INTEGER FK | → subjects |
| `session_number` | INTEGER | Pertemuan ke-berapa |
| `title` | VARCHAR(300) | Judul/topik |
| `audio_path` | TEXT | Path file di `uploads/` |
| `transcript` | TEXT | Teks hasil transkripsi |
| `transcript_segments` | TEXT | JSON array `[{start, end, text}]` — timestamp sync |
| `summary` | TEXT | Rangkuman AI (markdown) |
| `status` | VARCHAR(50) | `pending` / `transcribing` / `summarizing` / `done` |
| `language` | VARCHAR(10) | Bahasa transkripsi |
| `duration_minutes` | FLOAT | Durasi audio dalam menit |
| `material_path` | TEXT | Path file PDF materi |
| `material_text` | TEXT | Teks hasil extract dari PDF |
| `notes` | TEXT | Catatan manual user (markdown) |
| `created_at` | DATETIME | Timestamp dibuat |

### `chat_messages` — Riwayat Chat AI
| Column | Type | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `session_id` | INTEGER FK | → sessions |
| `role` | VARCHAR(20) | `user` / `assistant` |
| `message` | TEXT | Isi pesan |
| `created_at` | DATETIME | Timestamp |

### `quiz_questions` — Soal Quiz AI
| Column | Type | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `session_id` | INTEGER FK | → sessions |
| `question_type` | VARCHAR(20) | `multiple_choice` / `essay` |
| `question` | TEXT | Teks soal |
| `options` | TEXT | JSON array `["A. ...", "B. ...", "C. ...", "D. ..."]` |
| `correct_answer` | TEXT | Jawaban benar |
| `explanation` | TEXT | Penjelasan jawaban |
| `user_answer` | TEXT | Jawaban user |
| `is_correct` | INTEGER | -1=belum, 0=salah, 1=benar |
| `created_at` | DATETIME | Timestamp |

---

## 🌐 API Endpoints Lengkap

**Base URL**: `http://localhost:8000/api`

### Subjects
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/subjects` | List semua mata kuliah (dengan `session_count`) |
| `POST` | `/subjects` | Buat mata kuliah baru |
| `PUT` | `/subjects/{id}` | Update mata kuliah |
| `DELETE` | `/subjects/{id}` | Hapus (cascade hapus sesi) |

### Sessions
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/subjects/{id}/sessions` | List sesi per mata kuliah |
| `POST` | `/sessions` | Buat sesi baru (FormData, bisa include audio) |
| `GET` | `/sessions/{id}` | Detail sesi |
| `DELETE` | `/sessions/{id}` | Hapus sesi |
| `POST` | `/sessions/{id}/upload-audio` | Upload/replace file audio |
| `POST` | `/sessions/{id}/upload-material` | Upload PDF materi |
| `PUT` | `/sessions/{id}/notes` | Update catatan manual |

### Transcription
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/sessions/{id}/transcribe` | Mulai transkripsi (background task) |
| `GET` | `/sessions/{id}/status` | Cek status transkripsi |

### AI
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/sessions/{id}/summarize` | Generate rangkuman AI |
| `POST` | `/sessions/{id}/chat` | Kirim pertanyaan (body: `{message}`) |
| `GET` | `/sessions/{id}/chat` | Get riwayat chat |

### Search
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/search?q=keyword` | Cari di semua transkrip |

### Export
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/sessions/{id}/export/pdf` | Download PDF |
| `GET` | `/sessions/{id}/export/docx` | Download DOCX |

### Quiz
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/sessions/{id}/quiz/generate` | Generate soal (body: `{num_questions, include_essay}`) |
| `GET` | `/sessions/{id}/quiz` | List semua soal |
| `POST` | `/sessions/{id}/quiz/answer` | Jawab soal (body: `{question_id, answer}`) |
| `DELETE` | `/sessions/{id}/quiz` | Reset semua quiz |

### Static Files
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/uploads/{filename}` | Serve audio & PDF files (FastAPI StaticFiles) |

---

## 🗺 Frontend: Routing & Pages

### Routes
```
/                   → Dashboard.jsx       (homepage)
/subjects/:id       → SubjectDetail.jsx   (detail mata kuliah)
/sessions/:id       → SessionDetail.jsx   (detail sesi — halaman utama)
```
Semua route dibungkus `<Layout />` yang menyediakan **sidebar navigasi + header**.

---

### 📄 Dashboard (`/`)

**Kiri (65%)**:
- **Featured card**: Mata kuliah pertama — hero card besar dengan mesh gradient background + animated shimmer
- **Small cards**: 2 mata kuliah berikutnya — glassmorphism, animated gradient border on hover
- **All subjects list**: Horizontal cards dengan icon gradient, left accent strip, session count badge

**Kanan (35%)**:
- **Stats panel**: Jumlah matkul, total sesi, jumlah ditranskripsi, jumlah dirangkum, mini progress bar
- **Activity feed**: Timeline sesi terbaru dengan icon per status + relative time

**Interaksi**:
- FAB (+) untuk tambah mata kuliah
- Modal create/edit dengan form (nama + deskripsi)
- Toast notification untuk aksi berhasil/gagal
- Hover reveal edit/delete buttons

---

### 📄 SubjectDetail (`/subjects/:id`)

- Header: nama & deskripsi mata kuliah, tombol "Sesi Baru"
- **Session list**: Tiap sesi = horizontal card dengan:
  - Number badge, title, audio indicator, durasi, tanggal
  - Status badge: Menunggu / Transkripsi... / Selesai
  - Delete button (reveal on hover)
  - Klik → navigasi ke `/sessions/:id`
- **Modal buat sesi baru**:
  - Input: nomor pertemuan (auto-increment), judul/topik
  - Dropdown bahasa transkripsi (11 opsi)
  - Upload file audio (drag area) + AudioRecorder (record dari browser tab)
- Empty state jika belum ada sesi

---

### 📄 SessionDetail (`/sessions/:id`) — Halaman Utama

> File ini 55KB / 1205 baris. Paling kompleks.

**Header Section**:
- Back button → ke `/subjects/:id`
- Title + badges: (Pertemuan N, Status, Bahasa, Segment count, Materi indicator)
- Export buttons: PDF + Word (visible jika ada transkrip/rangkuman)
- **Custom Audio Player**:
  - Play/Pause button
  - Seekable progress bar (input range overlay)
  - Current time / total duration (format MM:SS atau H:MM:SS)
  - Volume slider (desktop only)

**Tab Navigation (6 tab)**:

| Tab | Icon | Kondisi Aktif |
|-----|------|--------------|
| Transkrip | FileText | Selalu |
| Rangkuman | Sparkles | Selalu |
| Tanya Jawab | MessageSquare | Selalu |
| Materi | BookOpen | Selalu |
| Quiz | HelpCircle | Selalu |
| Catatan | PenLine | Selalu |

**Tab: Transkrip**
- Search bar + match count
- Toggle button "Timestamp" (visible jika ada segments)
- **Timestamp mode**: List segments, tiap segment = `[MM:SS] teks`, klik → seek audio, active segment highlight + borderLeft + auto-scroll
- **Normal mode**: Plain text block, pre-wrap
- Empty state (jika belum ada audio): Upload file + AudioRecorder + "Mulai Transkripsi" button

**Tab: Rangkuman**
- Custom markdown renderer (tanpa library eksternal):
  - `#`, `##`, `###` headings
  - `- ` / `* ` bullet, `1.` numbered list
  - `**bold**`, `*italic*`, `` `code` ``
  - `---` horizontal rule
- "Generate Rangkuman" button (jika belum ada)
- Loading state saat generate

**Tab: Tanya Jawab**
- Chat bubble UI: user (right) vs assistant (left)
- AI responses di-render dengan markdown renderer yang sama
- Input box + Send button (Enter / click)
- Riwayat chat di-load saat tab aktif

**Tab: Materi**
- Upload PDF button
- Preview teks hasil extract dari PDF
- Empty state jika belum ada materi

**Tab: Quiz**
- **State: Belum ada quiz** → Config panel (jumlah soal 5-20, toggle sertakan esai) + "Generate Quiz" button
- **State: Generating** → Spinner + pesan progress
- **State: Quiz aktif** (satu soal per view):
  - Progress: "Soal X / Y" + progress bar
  - Badge tipe (Pilihan Ganda / Esai)
  - Teks soal
  - Pilihan ganda: 4 tombol A-D → hijau/merah setelah jawab + penjelasan
  - Esai: textarea + submit button
  - Feedback: is_correct + explanation
  - Navigasi: ← Sebelumnya / Selanjutnya →
- **State: Selesai** → Skor (X/Y = Z%), tombol "Ulangi" + "Generate Baru"

**Tab: Catatan**
- Textarea untuk markdown notes
- Auto-save debounce 1.5 detik
- Status: "Menyimpan..." / "Tersimpan ✓" / idle

---

## 🎨 Design System Saat Ini

### Color Palette (`index.css`)
```css
/* Primary: Teal */
--color-primary-500: #14b8a6;   /* Main brand color */

/* Accent: Orange */
--color-accent-500: #f97316;    /* CTA, highlights */

/* Surface: Cool Dark (slate-teal tint) */
--color-surface-950: #070e0e;   /* Darkest background */
--color-surface-900: #0f1e1d;   /* Card backgrounds */
--color-surface-800: #1a2a29;   /* Input backgrounds */
--color-surface-700: #2a3f3e;   /* Borders */
--color-surface-500: #5a7a78;   /* Muted text */
--color-surface-200: #b2dfdb;   /* Body text (dark mode) */
--color-surface-100: #e0f2f1;   /* Headings (dark mode) */
```

### Typography
- **Font**: `Plus Jakarta Sans` (Google Fonts, weights 400/500/600/700/800)
- **Base**: Antialiased, smooth

### Dark/Light Mode
- Default: **Dark mode**
- Light mode: Class `.light` pada `<html>`, override semua surface & text colors ke neutral (bukan teal)
- Persisted di `localStorage`

### Animations
- `fadeIn` — enter halaman (opacity + translateY 10px)
- `slideIn` — sidebar items
- `staggerIn` — card entrance dengan nth-child delay (0.05s steps)
- `card-glow` — animated conic-gradient border on hover
- `card-shimmer` — shimmer sweep effect
- `mesh-blob` — floating blur blobs (hero card)
- `pulse-soft` — status indicator pulse
- Custom scrollbar: 6px, rounded, surface-colored

---

## 🧩 State Management Patterns

- **React Hooks** only: `useState`, `useEffect`, `useRef`, `useCallback`
- **Context API**: `ThemeContext` (dark/light), `ToastContext` (notifications)
- **URL params**: `useParams()` untuk `:id`, `useSearchParams()` untuk `?q=keyword`
- **Polling**: `setInterval` 3000ms untuk transcription status check
- **Debounce**: `setTimeout` untuk global search (300ms) dan notes auto-save (1500ms)
- **Ref controls**: `audioRef` untuk custom audio player (play, pause, seek, volume)
- **Event listeners**: `timeupdate`, `loadedmetadata` untuk audio progress tracking

---

## ⚠️ Catatan Penting untuk UI Redesign

### Yang HARUS Dipertahankan (tidak boleh diubah)
- Semua **API endpoint** dan **request/response format** di `api.js`
- **3 route paths**: `/`, `/subjects/:id`, `/sessions/:id`
- **ThemeProvider** dan **ToastProvider** context
- **AudioRecorder** logic (`getDisplayMedia`)
- **useNotification** hook
- **Custom audio player** logic (`audioRef`, seekAudio, currentAudioTime)
- **Timestamp sync** logic (segments parsing, activeSegIdx detection)
- **Quiz answer** flow (state machine: unanswered → answered → result)
- **Notes auto-save** debounce logic

### Yang BEBAS Diubah
- Semua styling, warna, font, spacing, border radius
- Layout grid/flex, posisi sidebar, ukuran panel
- Animasi dan transitions
- Komponen structure (bisa dipecah/digabung)
- Icon library (bisa ganti dari Lucide)
- Design tokens / CSS variables

### Rekomendasi Refactor
- **Pecah `SessionDetail.jsx`** (55KB, 1205 baris) menjadi tab components terpisah:
  - `tabs/TranscriptTab.jsx`
  - `tabs/SummaryTab.jsx`
  - `tabs/ChatTab.jsx`
  - `tabs/MaterialTab.jsx`
  - `tabs/QuizTab.jsx`
  - `tabs/NotesTab.jsx`

---

## 🏃 Cara Menjalankan (Development)

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate       # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
# Berjalan di: http://localhost:8000
# Swagger docs: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Berjalan di: http://localhost:5173
```

### Environment (`backend/.env`)
```env
GEMINI_API_KEY=your_key_here
WHISPER_MODEL=medium
```
