import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Music, FileText, MessageSquare,
  Sparkles, Play, Pause, Upload, Mic, Send,
  Clock, Calendar, CheckCircle,
  Download, Search, Globe, BookOpen, FileUp,
  HelpCircle, ChevronLeft, ChevronRight as ChevronRightIcon,
  RotateCcw, Trophy, CheckSquare, XSquare, AlignLeft, Timer, PenLine, Save,
} from 'lucide-react';
import {
  getSession, getAudioUrl, startTranscription, generateSummary,
  sendChatMessage, getChatHistory, uploadAudio,
  exportPDF, exportDOCX, uploadMaterial,
  generateQuiz, getQuiz, answerQuiz, deleteQuiz, saveNotes,
} from '../services/api';
import AudioRecorder from '../components/AudioRecorder';
import { useToast } from '../components/Toast';
import { useNotification } from '../hooks/useNotification';

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'id', label: 'Indonesia' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ms', label: 'Malay' },
  { code: 'ar', label: 'Arabic' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
];

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '--:--';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { requestPermission, notify } = useNotification();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transcript');

  const [uploading, setUploading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef(null);

  // V2: Search + Export + Material
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [exporting, setExporting] = useState('');
  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  // V3: Timestamp Sync
  const [segments, setSegments] = useState([]);
  const [timestampMode, setTimestampMode] = useState(false);
  const activeSegmentRef = useRef(null);

  // V3: Quiz
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answering, setAnswering] = useState(false);
  const [quizNumQ, setQuizNumQ] = useState(10);
  const [quizIncludeEssay, setQuizIncludeEssay] = useState(true);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // V5: Notes
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false); // 'saving' | 'saved' | false
  const notesSaveTimeout = useRef(null);
  const notesInitialized = useRef(false);

  useEffect(() => { loadSession(); }, [id]);

  // Sinkronisasi notes dari session data saat pertama load
  useEffect(() => {
    if (session && !notesInitialized.current) {
      setNotes(session.notes || '');
      notesInitialized.current = true;
    }
  }, [session]);

  // Auto-save notes dengan debounce 1.5 detik
  useEffect(() => {
    if (!notesInitialized.current) return;
    if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
    setNotesSaving('saving');
    notesSaveTimeout.current = setTimeout(async () => {
      try {
        await saveNotes(id, notes);
        setNotesSaving('saved');
        setTimeout(() => setNotesSaving(false), 2000);
      } catch {
        setNotesSaving(false);
      }
    }, 1500);
    return () => clearTimeout(notesSaveTimeout.current);
  }, [notes]);

  // Read ?q= from URL and auto-fill transcript search
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && session) {
      setTranscriptSearch(q);
      setActiveTab('transcript');
      // Clear the query param from URL without navigation
      setSearchParams({}, { replace: true });
      // Scroll to first highlight after render
      setTimeout(() => {
        const firstMark = document.querySelector('mark');
        if (firstMark) {
          firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a pulse animation to draw attention
          firstMark.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-1');
          setTimeout(() => firstMark.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-1'), 2000);
        }
      }, 300);
    }
  }, [searchParams, session]);

  useEffect(() => {
    if (activeTab === 'chat') loadChat();
    if (activeTab === 'quiz') loadQuiz();
  }, [activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Parse segments whenever session changes
  useEffect(() => {
    if (session?.transcript_segments) {
      try {
        const parsed = JSON.parse(session.transcript_segments);
        setSegments(Array.isArray(parsed) ? parsed : []);
        if (parsed.length > 0) setTimestampMode(true);
      } catch {
        setSegments([]);
      }
    }
  }, [session?.transcript_segments]);

  // Track audio time + duration for custom player
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentAudioTime(audio.currentTime);
    const onMeta = () => setAudioDuration(audio.duration || 0);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
    };
  }, [session?.audio_path]);

  // Auto-scroll active segment
  useEffect(() => {
    activeSegmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentAudioTime]);

  // Detect current active segment index
  const activeSegIdx = segments.findIndex(
    seg => currentAudioTime >= seg.start && currentAudioTime < seg.end
  );

  async function loadSession() {
    try {
      setLoading(true);
      const data = await getSession(id);
      setSession(data);
    } catch (err) {
      toast.error(err.message);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadAudio(file) {
    try {
      setUploading(true);
      toast.info('Mengupload audio...');
      await uploadAudio(id, file);
      toast.success('Audio berhasil diupload!');
      await loadSession();
      handleTranscribe();
    } catch (err) {
      toast.error('Gagal upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleTranscribe() {
    try {
      setTranscribing(true);
      toast.info('Memulai transkripsi...');

      // Minta izin browser notification sebelum mulai
      await requestPermission();

      await startTranscription(id);
      const poll = setInterval(async () => {
        const updated = await getSession(id);
        setSession(updated);
        if (updated.status !== 'transcribing') {
          clearInterval(poll);
          setTranscribing(false);
          if (updated.transcript) {
            toast.success('Transkripsi selesai!');
            // Notifikasi browser + suara
            notify(
              '✅ Transkripsi Selesai!',
              `"${updated.title || 'Sesi ini'}" sudah selesai ditranskripsi.`
            );
          }
        }
      }, 3000);
    } catch (err) {
      setTranscribing(false);
      toast.error('Gagal transkripsi: ' + err.message);
    }
  }

  async function handleSummarize() {
    try {
      setSummarizing(true);
      toast.info('Membuat rangkuman AI...');
      await generateSummary(id);
      const updated = await getSession(id);
      setSession(updated);
      toast.success('Rangkuman berhasil dibuat!');
    } catch (err) {
      toast.error('Gagal membuat rangkuman: ' + err.message);
    } finally {
      setSummarizing(false);
    }
  }

  async function loadChat() {
    try {
      const messages = await getChatHistory(id);
      setChatMessages(messages);
    } catch { /* empty chat is fine */ }
  }

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', message: userMsg, id: Date.now() }]);
    try {
      setChatLoading(true);
      const response = await sendChatMessage(id, userMsg);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        message: response.message || response.answer || 'No response.',
        id: Date.now() + 1,
      }]);
    } catch (err) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setChatLoading(false);
    }
  }

  function toggleAudio() {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  }

  function seekAudio(seconds) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    audioRef.current.play();
    setIsPlaying(true);
  }

  async function handleExport(format) {
    try {
      setExporting(format);
      const blob = format === 'pdf' ? await exportPDF(id) : await exportDOCX(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.title || `Pertemuan_${session.session_number}`}.${format === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${format.toUpperCase()} berhasil didownload!`);
    } catch (err) {
      toast.error(`Gagal export: ${err.message}`);
    } finally {
      setExporting('');
    }
  }

  async function handleUploadMaterial(file) {
    try {
      setUploadingMaterial(true);
      toast.info('Mengupload materi PDF...');
      await uploadMaterial(id, file);
      await loadSession();
      toast.success('Materi berhasil diupload!');
    } catch (err) {
      toast.error('Gagal upload materi: ' + err.message);
    } finally {
      setUploadingMaterial(false);
    }
  }

  // Highlight transcript search
  function highlightText(text, query) {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    let count = 0;
    const result = parts.map((part, i) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        count++;
        return <mark key={i} className="bg-yellow-400/40 text-yellow-200 px-0.5 rounded">{part}</mark>;
      }
      return part;
    });
    if (count !== matchCount) setTimeout(() => setMatchCount(count), 0);
    return result;
  }

  // Render AI markdown response into readable formatted elements
  function renderMarkdown(text) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Horizontal divider: --- or ***
      if (/^[-*]{3,}$/.test(line.trim())) {
        elements.push(<hr key={i} className="border-surface-700/50 my-3" />);
        i++;
        continue;
      }

      // Headings: ###, ##, #
      const h3Match = line.match(/^###\s+(.*)/);
      if (h3Match) {
        elements.push(
          <h3 key={i} className="text-sm font-bold text-primary-300 mt-4 mb-1 first:mt-0">
            {renderInline(h3Match[1])}
          </h3>
        );
        i++;
        continue;
      }
      const h2Match = line.match(/^##\s+(.*)/);
      if (h2Match) {
        elements.push(
          <h2 key={i} className="text-base font-bold text-surface-100 mt-5 mb-2 first:mt-0">
            {renderInline(h2Match[1])}
          </h2>
        );
        i++;
        continue;
      }
      const h1Match = line.match(/^#\s+(.*)/);
      if (h1Match) {
        elements.push(
          <h1 key={i} className="text-lg font-bold text-surface-50 mt-5 mb-2 first:mt-0">
            {renderInline(h1Match[1])}
          </h1>
        );
        i++;
        continue;
      }

      // Numbered list: "1. text"
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        elements.push(
          <div key={i} className="flex gap-2 mt-2.5 first:mt-0">
            <span className="text-primary-400 font-semibold text-sm flex-shrink-0 min-w-[20px]">
              {numberedMatch[1]}.
            </span>
            <p className="text-sm text-surface-200 leading-relaxed">
              {renderInline(numberedMatch[2])}
            </p>
          </div>
        );
        i++;
        continue;
      }

      // Bullet list: "* text" or "- text"
      const bulletMatch = line.match(/^[*\-]\s+(.*)/);
      if (bulletMatch) {
        elements.push(
          <div key={i} className="flex gap-2 mt-1.5">
            <span className="text-primary-400 flex-shrink-0 mt-0.5 text-sm">•</span>
            <p className="text-sm text-surface-200 leading-relaxed">{renderInline(bulletMatch[1])}</p>
          </div>
        );
        i++;
        continue;
      }

      // Normal paragraph
      elements.push(
        <p key={i} className="text-sm text-surface-200 leading-relaxed mt-2 first:mt-0">
          {renderInline(line)}
        </p>
      );
      i++;
    }

    return <div className="space-y-0.5">{elements}</div>;
  }

  // Render inline markdown: **bold**, *italic*, `code`
  function renderInline(text) {
    if (!text) return null;
    // Split on **bold**, *italic*, and `code`
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-surface-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={i} className="italic text-surface-300">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-surface-700 text-primary-300 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  // ===== QUIZ =====
  async function loadQuiz() {
    try {
      setQuizLoading(true);
      const questions = await getQuiz(id);
      setQuizQuestions(questions);
    } catch { /* no quiz yet */ }
    finally { setQuizLoading(false); }
  }

  async function handleGenerateQuiz() {
    try {
      setQuizGenerating(true);
      toast.info(`Generating ${quizNumQ} soal dengan AI...`);
      const questions = await generateQuiz(id, quizNumQ, quizIncludeEssay);
      setQuizQuestions(questions);
      setCurrentQIdx(0);
      setSelectedAnswer('');
      setShowQuizResult(false);
      setQuizResult(null);
      toast.success(`${questions.length} soal berhasil dibuat!`);
    } catch (err) {
      toast.error('Gagal generate quiz: ' + err.message);
    } finally {
      setQuizGenerating(false);
    }
  }

  async function handleAnswerQuiz(answer) {
    if (answering) return;
    const q = quizQuestions[currentQIdx];
    if (!q || q.is_correct !== -1) return;

    setSelectedAnswer(answer);
    try {
      setAnswering(true);
      const updated = await answerQuiz(id, q.id, answer);
      setQuizQuestions(prev => prev.map((qq, i) => i === currentQIdx ? updated : qq));
    } catch (err) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setAnswering(false);
    }
  }

  async function handleResetQuiz() {
    try {
      await deleteQuiz(id);
      setQuizQuestions([]);
      setCurrentQIdx(0);
      setSelectedAnswer('');
      setShowQuizResult(false);
      setQuizResult(null);
      toast.success('Quiz direset');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleShowResult() {
    try {
      const result = await getQuiz(id).then(qs => {
        const total = qs.length;
        const answered = qs.filter(q => q.is_correct !== -1).length;
        const correct = qs.filter(q => q.is_correct === 1).length;
        return { total, answered, correct, wrong: answered - correct, score_percent: total ? Math.round(correct / total * 100) : 0 };
      });
      setQuizResult(result);
      setShowQuizResult(true);
    } catch (err) {
      toast.error(err.message);
    }
  }

  const currentQ = quizQuestions[currentQIdx];
  const currentOpts = currentQ ? (() => { try { return JSON.parse(currentQ.options); } catch { return []; } })() : [];
  const isAnswered = currentQ?.is_correct !== -1;

  const tabs = [
    { id: 'transcript', label: 'Transkrip', icon: FileText },
    { id: 'summary', label: 'Rangkuman', icon: Sparkles },
    { id: 'chat', label: 'Tanya Jawab', icon: MessageSquare },
    { id: 'material', label: 'Materi', icon: BookOpen },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'notes', label: 'Catatan', icon: PenLine },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  const audioUrl = getAudioUrl(session.audio_path);
  const langLabel = LANGUAGES.find(l => l.code === session.language)?.label || 'Auto-detect';

  return (
    <div className="animate-fade-in w-full max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(`/subjects/${session.subject_id}`)}
        className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali
      </button>

      {/* Session Header */}
      <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-md">
                Pertemuan {session.session_number}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${session.status === 'done' || session.status === 'transcribed'
                  ? 'bg-green-500/10 text-green-400'
                  : session.status === 'transcribing'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-surface-700 text-surface-400'
                }`}>
                {session.status === 'done' || session.status === 'transcribed' ? 'Selesai' : session.status === 'transcribing' ? 'Transkripsi...' : 'Menunggu'}
              </span>
              <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                <Globe className="w-3 h-3" />{langLabel}
              </span>
              {segments.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
                  <Timer className="w-3 h-3" />{segments.length} segments
                </span>
              )}
              {session.material_path && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  <BookOpen className="w-3 h-3" />Materi
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-surface-50">
              {session.title || `Pertemuan ${session.session_number}`}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              {session.duration_minutes > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {Math.round(session.duration_minutes)} menit
                </span>
              )}
            </div>
          </div>

          {/* Export buttons */}
          {(session.transcript || session.summary) && (
            <div className="flex items-center gap-1.5 sm:flex-shrink-0">
              <button onClick={() => handleExport('pdf')} disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50">
                {exporting === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}PDF
              </button>
              <button onClick={() => handleExport('docx')} disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50">
                {exporting === 'docx' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}Word
              </button>
            </div>
          )}
        </div>

        {/* Audio Player */}
        {audioUrl ? (
          <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl p-3 flex items-center gap-3">
            {/* Hidden native audio — handles actual playback */}
            <audio ref={audioRef} src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              preload="metadata"
            />

            {/* Play/Pause button */}
            <button onClick={toggleAudio}
              className="w-9 h-9 flex-shrink-0 bg-primary-600 hover:bg-primary-500 rounded-lg flex items-center justify-center text-white transition-all shadow-sm">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Time + Progress bar */}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              {/* Progress bar */}
              <div className="relative h-2 group cursor-pointer">
                <div className="absolute inset-0 bg-surface-600/50 rounded-full" />
                <div
                  className="absolute inset-y-0 left-0 bg-primary-500 rounded-full transition-all"
                  style={{ width: audioDuration > 0 ? `${(currentAudioTime / audioDuration) * 100}%` : '0%' }}
                />
                <input
                  type="range"
                  min={0}
                  max={audioDuration || 0}
                  step={0.1}
                  value={currentAudioTime}
                  onChange={e => {
                    const t = parseFloat(e.target.value);
                    if (audioRef.current) audioRef.current.currentTime = t;
                    setCurrentAudioTime(t);
                  }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                />
              </div>
              {/* Time labels */}
              <div className="flex justify-between text-[10px] text-surface-500 font-mono select-none">
                <span>{formatTime(currentAudioTime)}</span>
                <span>{audioDuration > 0 ? formatTime(audioDuration) : '--:--'}</span>
              </div>
            </div>

            {/* Volume — hidden on mobile to save space */}
            <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <span className="text-surface-500 text-xs">🔊</span>
              <input
                type="range"
                min={0} max={1} step={0.05}
                defaultValue={1}
                onChange={e => { if (audioRef.current) audioRef.current.volume = parseFloat(e.target.value); }}
                className="w-16 accent-primary-500 cursor-pointer h-1"
              />
            </div>
          </div>
        ) : (
          <div className="bg-surface-800/30 rounded-xl p-4">
            <p className="text-surface-400 text-sm mb-3 flex items-center gap-2"><Music className="w-4 h-4" />Belum ada file audio</p>
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface-800 border-2 border-dashed border-surface-600 hover:border-primary-500 rounded-xl text-sm text-surface-300 cursor-pointer transition-all">
              <Upload className="w-4 h-4" />{uploading ? 'Mengupload...' : 'Upload File Audio'}
              <input type="file" accept=".mp3,.mp4,.wav,.m4a,.webm,.ogg" className="hidden" disabled={uploading}
                onChange={(e) => { if (e.target.files[0]) handleUploadAudio(e.target.files[0]); }} />
            </label>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-surface-700" /><span className="text-xs text-surface-500">atau</span><div className="flex-1 h-px bg-surface-700" />
            </div>
            <AudioRecorder onRecorded={(blob) => handleUploadAudio(new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' }))} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-900/50 border border-surface-800 rounded-xl p-1 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${activeTab === tab.id ? 'bg-primary-600 text-white shadow-md' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                }`}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-4 sm:p-6 min-h-[300px]">

        {/* ====== TRANSCRIPT TAB ====== */}
        {activeTab === 'transcript' && (
          <div>
            {session.transcript ? (
              <>
                {/* Search + Toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-surface-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={transcriptSearch}
                      onChange={(e) => { setTranscriptSearch(e.target.value); setMatchCount(0); }}
                      placeholder="Cari di transkrip..."
                      className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-200 text-sm placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-all" />
                  </div>
                  {transcriptSearch && <span className="text-xs text-surface-400 whitespace-nowrap">{matchCount} hasil</span>}
                  {segments.length > 0 && (
                    <button onClick={() => setTimestampMode(!timestampMode)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${timestampMode ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                        }`}>
                      <Timer className="w-3.5 h-3.5" />
                      {timestampMode ? 'Timestamp ON' : 'Timestamp'}
                    </button>
                  )}
                </div>

                {/* Timestamp Mode */}
                {timestampMode && segments.length > 0 ? (
                  <div className="space-y-0.5">
                    {segments.map((seg, i) => {
                      const isActive = i === activeSegIdx;
                      return (
                        <div key={i} ref={isActive ? activeSegmentRef : null}
                          onClick={() => seekAudio(seg.start)}
                          className={`flex gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all hover:bg-surface-800/70 ${isActive ? 'bg-primary-500/10 border-l-2 border-primary-400' : ''
                            }`}>
                          <span className="text-xs text-primary-400 font-mono whitespace-nowrap pt-0.5 select-none min-w-[40px]">
                            {formatTime(seg.start)}
                          </span>
                          <p className="text-surface-200 text-sm leading-relaxed">
                            {transcriptSearch ? highlightText(seg.text, transcriptSearch) : seg.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Normal mode */
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="text-surface-200 whitespace-pre-wrap leading-relaxed">
                      {transcriptSearch ? highlightText(session.transcript, transcriptSearch) : session.transcript}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-surface-600 mb-4" />
                <h3 className="text-base font-semibold text-surface-300 mb-2">Belum ada transkrip</h3>
                <p className="text-surface-500 text-sm mb-5 max-w-sm">
                  {audioUrl ? 'Klik tombol di bawah untuk mulai transkripsi audio.' : 'Upload file audio terlebih dahulu.'}
                </p>
                {audioUrl && (
                  <button onClick={handleTranscribe} disabled={transcribing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-600/20">
                    {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {transcribing ? 'Memproses...' : 'Mulai Transkripsi'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====== SUMMARY TAB ====== */}
        {activeTab === 'summary' && (
          <div>
            {session.summary ? (
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-surface-200">Rangkuman AI</span>
                  </div>
                  {session.transcript && (
                    <button onClick={handleSummarize} disabled={summarizing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg text-xs text-surface-400 hover:text-surface-200 transition-all disabled:opacity-50">
                      {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {summarizing ? 'Merangkum...' : 'Generate ulang'}
                    </button>
                  )}
                </div>
                {/* Rendered content */}
                <div className="bg-surface-800/40 border border-surface-700/40 rounded-xl px-5 py-4">
                  {renderMarkdown(session.summary)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="w-12 h-12 text-surface-600 mb-4" />
                <h3 className="text-base font-semibold text-surface-300 mb-2">Belum ada rangkuman</h3>
                <p className="text-surface-500 text-sm mb-5 max-w-sm">
                  {session.transcript ? 'Klik tombol di bawah untuk membuat rangkuman AI.' : 'Lakukan transkripsi terlebih dahulu.'}
                </p>
                {session.transcript && (
                  <button onClick={handleSummarize} disabled={summarizing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-600/20">
                    {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {summarizing ? 'Merangkum...' : 'Generate Rangkuman'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====== CHAT TAB ====== */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[520px]">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-12 h-12 text-surface-600 mb-4" />
                  <h3 className="text-base font-semibold text-surface-300 mb-2">Tanya Jawab AI</h3>
                  <p className="text-surface-500 text-sm max-w-sm">
                    {session.transcript ? 'Tanyakan apa saja tentang materi kuliah ini.' : 'Lakukan transkripsi terlebih dahulu.'}
                  </p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role !== 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[82%] ${
                    msg.role === 'user'
                      ? 'px-4 py-2.5 bg-primary-600 text-white rounded-2xl rounded-br-md text-sm leading-relaxed'
                      : 'px-4 py-3 bg-surface-800/80 text-surface-200 rounded-2xl rounded-bl-md border border-surface-700/50'
                  }`}>
                    {msg.role === 'user'
                      ? <p className="text-sm leading-relaxed">{msg.message}</p>
                      : renderMarkdown(msg.message)
                    }
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface-800 border border-surface-700 rounded-2xl rounded-bl-md px-4 py-2.5">
                    <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                placeholder={session.transcript ? 'Ketik pertanyaan...' : 'Transkripsi diperlukan'}
                disabled={!session.transcript || chatLoading}
                className="flex-1 px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-surface-100 text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all disabled:opacity-50" />
              <button type="submit" disabled={!chatInput.trim() || !session.transcript || chatLoading}
                className="px-4 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl transition-all">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ====== MATERIAL TAB ====== */}
        {activeTab === 'material' && (
          <div>
            {session.material_text ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-surface-300">Materi PDF</span>
                    <span className="text-xs text-surface-500">({session.material_text.length.toLocaleString()} karakter)</span>
                  </div>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg text-xs text-surface-300 cursor-pointer transition-all">
                    <FileUp className="w-3 h-3" />Ganti PDF
                    <input type="file" accept=".pdf" className="hidden" disabled={uploadingMaterial}
                      onChange={(e) => { if (e.target.files[0]) handleUploadMaterial(e.target.files[0]); }} />
                  </label>
                </div>
                <p className="text-surface-200 whitespace-pre-wrap leading-relaxed text-xs">{session.material_text}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="w-12 h-12 text-surface-600 mb-4" />
                <h3 className="text-base font-semibold text-surface-300 mb-2">Belum ada materi</h3>
                <p className="text-surface-500 text-sm mb-5 max-w-sm">Upload PDF materi kuliah untuk memperkaya konteks AI.</p>
                <label className={`flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all cursor-pointer ${uploadingMaterial ? 'opacity-50' : ''}`}>
                  {uploadingMaterial ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                  {uploadingMaterial ? 'Mengupload...' : 'Upload PDF Materi'}
                  <input type="file" accept=".pdf" className="hidden" disabled={uploadingMaterial}
                    onChange={(e) => { if (e.target.files[0]) handleUploadMaterial(e.target.files[0]); }} />
                </label>
              </div>
            )}
          </div>
        )}

        {/* ====== QUIZ TAB (V3) ====== */}
        {activeTab === 'quiz' && (
          <div>
            {quizLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              </div>
            ) : quizQuestions.length === 0 ? (
              /* Generate Quiz UI */
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <HelpCircle className="w-14 h-14 text-surface-600 mb-4" />
                <h3 className="text-base font-semibold text-surface-300 mb-2">Generate Quiz AI</h3>
                <p className="text-surface-500 text-sm mb-6 max-w-sm">
                  {session.transcript ? 'AI akan membuat soal-soal dari materi kuliah ini untuk menguji pemahaman Anda.' : 'Lakukan transkripsi terlebih dahulu.'}
                </p>
                {session.transcript && (
                  <div className="w-full max-w-xs space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-surface-400 mb-2">
                        Jumlah soal: <span className="text-primary-400 font-bold">{quizNumQ}</span>
                      </label>
                      <input type="range" min={5} max={20} value={quizNumQ} onChange={(e) => setQuizNumQ(parseInt(e.target.value))}
                        className="w-full accent-primary-500" />
                      <div className="flex justify-between text-xs text-surface-600 mt-1"><span>5</span><span>20</span></div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={quizIncludeEssay} onChange={(e) => setQuizIncludeEssay(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary-500" />
                      <span className="text-sm text-surface-300">Sertakan soal esai</span>
                    </label>
                    <button onClick={handleGenerateQuiz} disabled={quizGenerating}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-600/20">
                      {quizGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />AI sedang membuat soal...</> : <><HelpCircle className="w-4 h-4" />Generate Quiz</>}
                    </button>
                  </div>
                )}
              </div>
            ) : showQuizResult && quizResult ? (
              /* Quiz Result */
              <div className="flex flex-col items-center py-8 text-center">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 text-3xl font-bold ${quizResult.score_percent >= 80 ? 'bg-green-500/20 text-green-400' :
                    quizResult.score_percent >= 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                  {quizResult.score_percent}%
                </div>
                <h3 className="text-xl font-bold text-surface-100 mb-1">
                  {quizResult.score_percent >= 80 ? '🎉 Luar Biasa!' : quizResult.score_percent >= 60 ? '👍 Lumayan!' : '📚 Belajar Lagi!'}
                </h3>
                <p className="text-surface-400 text-sm mb-6">
                  {quizResult.correct} dari {quizResult.total} soal benar
                </p>
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{quizResult.correct}</div>
                    <div className="text-xs text-surface-500">Benar</div>
                  </div>
                  <div className="w-px h-8 bg-surface-700" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{quizResult.wrong}</div>
                    <div className="text-xs text-surface-500">Salah</div>
                  </div>
                  <div className="w-px h-8 bg-surface-700" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-surface-300">{quizResult.total}</div>
                    <div className="text-xs text-surface-500">Total</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setCurrentQIdx(0); setShowQuizResult(false); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 text-surface-200 rounded-xl text-sm font-medium transition-all">
                    <AlignLeft className="w-4 h-4" />Review Soal
                  </button>
                  <button onClick={handleResetQuiz}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all">
                    <RotateCcw className="w-4 h-4" />Quiz Baru
                  </button>
                </div>
              </div>
            ) : (
              /* Quiz Question UI */
              <div>
                {/* Progress */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-surface-400">Soal {currentQIdx + 1} / {quizQuestions.length}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${currentQ?.question_type === 'multiple_choice'
                        ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
                      }`}>
                      {currentQ?.question_type === 'multiple_choice' ? 'Pilihan Ganda' : 'Esai'}
                    </span>
                    <button onClick={handleResetQuiz}
                      className="text-xs text-surface-500 hover:text-red-400 transition-colors">Reset</button>
                  </div>
                </div>
                <div className="w-full bg-surface-800 rounded-full h-1.5 mb-5">
                  <div className="bg-primary-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${((currentQIdx + 1) / quizQuestions.length) * 100}%` }} />
                </div>

                {/* Question */}
                <div className="bg-surface-800/50 rounded-xl p-4 mb-4">
                  <p className="text-surface-100 text-sm font-medium leading-relaxed">{currentQ?.question}</p>
                </div>

                {/* Multiple Choice */}
                {currentQ?.question_type === 'multiple_choice' && (
                  <div className="space-y-2 mb-4">
                    {currentOpts.map((opt, i) => {
                      const letter = opt[0]; // "A", "B", "C", "D"
                      const isSelected = selectedAnswer === letter || currentQ?.user_answer === letter;
                      const isCorrect = isAnswered && letter === currentQ?.correct_answer?.[0];
                      const isWrong = isAnswered && isSelected && !isCorrect;
                      return (
                        <button key={i} onClick={() => !isAnswered && handleAnswerQuiz(letter)}
                          disabled={isAnswered || answering}
                          className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${isCorrect ? 'bg-green-500/15 border-green-500/50 text-green-300' :
                              isWrong ? 'bg-red-500/15 border-red-500/50 text-red-300' :
                                isSelected ? 'bg-primary-500/15 border-primary-500/50 text-primary-300' :
                                  'bg-surface-800 border-surface-700 text-surface-200 hover:border-surface-600 hover:bg-surface-800/80'
                            } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}>
                          <div className="flex items-center gap-2">
                            {isAnswered && isCorrect && <CheckSquare className="w-4 h-4 flex-shrink-0" />}
                            {isAnswered && isWrong && <XSquare className="w-4 h-4 flex-shrink-0" />}
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Essay */}
                {currentQ?.question_type === 'essay' && !isAnswered && (
                  <div className="mb-4">
                    <textarea value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)}
                      rows={4} placeholder="Tulis jawaban Anda di sini..."
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-700 rounded-xl text-surface-200 text-sm placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-all resize-none" />
                    <button onClick={() => handleAnswerQuiz(selectedAnswer)} disabled={!selectedAnswer.trim() || answering}
                      className="mt-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
                      Submit Jawaban
                    </button>
                  </div>
                )}

                {/* Explanation */}
                {isAnswered && currentQ?.explanation && (
                  <div className={`rounded-xl p-4 mb-4 text-sm ${currentQ.is_correct === 1 ? 'bg-green-500/10 border border-green-500/30' : 'bg-amber-500/10 border border-amber-500/30'
                    }`}>
                    <p className="font-medium mb-1 text-surface-200">
                      {currentQ.is_correct === 1 ? '✅ Benar!' : `❌ Jawaban benar: ${currentQ.correct_answer}`}
                    </p>
                    <p className="text-surface-300 leading-relaxed">{currentQ.explanation}</p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button onClick={() => { setCurrentQIdx(prev => Math.max(0, prev - 1)); setSelectedAnswer(''); }}
                    disabled={currentQIdx === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-surface-800 hover:bg-surface-700 disabled:opacity-40 text-surface-300 rounded-lg text-sm transition-all">
                    <ChevronLeft className="w-4 h-4" />Sebelumnya
                  </button>

                  {currentQIdx === quizQuestions.length - 1 ? (
                    <button onClick={handleShowResult}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-all">
                      <Trophy className="w-4 h-4" />Lihat Hasil
                    </button>
                  ) : (
                    <button onClick={() => { setCurrentQIdx(prev => Math.min(quizQuestions.length - 1, prev + 1)); setSelectedAnswer(''); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-surface-800 hover:bg-surface-700 text-surface-300 rounded-lg text-sm transition-all">
                      Selanjutnya<ChevronRightIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== CATATAN TAB (V5) ====== */}
        {activeTab === 'notes' && (
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-primary-400" />
                <h3 className="text-sm font-semibold text-surface-200">Catatan Manual</h3>
                <span className="text-xs text-surface-500">Markdown didukung</span>
              </div>
              {/* Auto-save status */}
              <div className="flex items-center gap-1.5 text-xs">
                {notesSaving === 'saving' && (
                  <><div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-surface-500">Menyimpan...</span></>
                )}
                {notesSaving === 'saved' && (
                  <><div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-green-400">Tersimpan</span></>
                )}
                {!notesSaving && notes && (
                  <span className="text-surface-600 text-[10px]">Auto-save aktif</span>
                )}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '**Tebal**', insert: '**teks tebal**' },
                { label: '*Miring*', insert: '*teks miring*' },
                { label: '`Kode`', insert: '`kode`' },
                { label: '# Judul', insert: '\n## Judul\n' },
                { label: '• List', insert: '\n- item 1\n- item 2\n' },
                { label: '1. Urut', insert: '\n1. item pertama\n2. item kedua\n' },
              ].map(btn => (
                <button key={btn.label}
                  onClick={() => setNotes(prev => prev + btn.insert)}
                  className="px-2.5 py-1 bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-100 rounded-md text-xs font-mono transition-all border border-surface-700/50 hover:border-surface-600">
                  {btn.label}
                </button>
              ))}
              {/* Insert current timestamp */}
              <button
                onClick={() => {
                  const t = currentAudioTime > 0 ? `[${formatTime(currentAudioTime)}] ` : '';
                  const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  setNotes(prev => prev + `\n${t}*${now}* — `);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-md text-xs font-medium transition-all border border-primary-500/20"
              >
                <Clock className="w-3 h-3" />Timestamp
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`Tulis catatan untuk sesi ini...\n\nTips:\n• Gunakan **teks** untuk tebal, *teks* untuk miring\n• Klik Timestamp untuk menyisipkan waktu audio saat ini\n• Catatan disimpan otomatis`}
              className="w-full min-h-[320px] px-4 py-3 bg-surface-800/60 border border-surface-700/50 rounded-xl text-surface-200 text-sm leading-relaxed placeholder-surface-600 focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all resize-y font-mono"
            />

            {/* Empty state hint */}
            {!notes && (
              <p className="text-center text-xs text-surface-600 -mt-2">
                Catatan tersimpan otomatis setiap 1.5 detik saat kamu mengetik.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
