import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, BookOpen, Trash2, Pencil, GraduationCap,
  Loader2, FolderOpen, ArrowRight, FileText,
  Sparkles, CheckCircle2, Clock, BarChart3,
  Mic, FileQuestion, TrendingUp,
} from 'lucide-react';
import { getSubjects, getSessions, createSubject, updateSubject, deleteSubject } from '../services/api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useTheme } from '../components/ThemeToggle';

// Relative time helper
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// Left-border accent colors cycling
const accentBorders = [
  'border-l-primary-500',
  'border-l-accent-500',
  'border-l-primary-400',
  'border-l-accent-400',
  'border-l-primary-300',
  'border-l-accent-300',
];

const iconBgs = [
  'from-primary-600 to-primary-800',
  'from-accent-500 to-accent-700',
  'from-primary-500 to-primary-700',
  'from-accent-600 to-primary-700',
  'from-primary-400 to-primary-600',
  'from-accent-400 to-accent-600',
];

export default function Dashboard() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentSessions, setRecentSessions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const data = await getSubjects();
      setSubjects(data);
      // Fetch sessions for activity feed — up to first 3 subjects
      const sessionPromises = data.slice(0, 4).map(s =>
        getSessions(s.id).then(sessions => sessions.map(sess => ({ ...sess, subject_name: s.name }))).catch(() => [])
      );
      const allArrays = await Promise.all(sessionPromises);
      const all = allArrays.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentSessions(all.slice(0, 8));
    } catch (err) {
      toast.error('Gagal memuat: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingSubject(null); setFormName(''); setFormDesc(''); setShowModal(true);
  }
  function openEditModal(subject, e) {
    e.stopPropagation();
    setEditingSubject(subject); setFormName(subject.name); setFormDesc(subject.description || ''); setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formName.trim()) return;
    try {
      setSubmitting(true);
      if (editingSubject) {
        await updateSubject(editingSubject.id, { name: formName, description: formDesc });
        toast.success(`"${formName}" berhasil diupdate`);
      } else {
        await createSubject({ name: formName, description: formDesc });
        toast.success(`"${formName}" berhasil ditambahkan`);
      }
      setShowModal(false);
      loadAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(subject, e) {
    e.stopPropagation();
    if (!confirm(`Hapus "${subject.name}"?\nSemua sesi di dalamnya juga akan dihapus.`)) return;
    try {
      await deleteSubject(subject.id);
      toast.success(`"${subject.name}" berhasil dihapus`);
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Stats derived from subjects
  const totalSessions = subjects.reduce((s, sub) => s + (sub.session_count || 0), 0);
  const completedSessions = recentSessions.filter(s => s.status === 'done').length;
  const transcribedSessions = recentSessions.filter(s => s.transcript).length;
  const summarizedSessions = recentSessions.filter(s => s.summary).length;

  const featuredSubject = subjects[0] || null;
  const otherSubjects = subjects.slice(1);

  // Activity feed items derived from sessions
  function activityIcon(session) {
    if (session.summary) return { icon: Sparkles, color: 'text-accent-400', bg: 'bg-accent-500/10', label: 'Rangkuman dibuat' };
    if (session.transcript) return { icon: FileText, color: 'text-primary-400', bg: 'bg-primary-500/10', label: 'Transkripsi selesai' };
    if (session.status === 'transcribing') return { icon: Mic, color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Sedang transkripsi' };
    return { icon: Clock, color: 'text-surface-500', bg: 'bg-surface-800', label: 'Sesi dibuat' };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-20 h-20 bg-surface-800 rounded-2xl flex items-center justify-center mb-5">
          <FolderOpen className="w-10 h-10 text-surface-500" />
        </div>
        <h3 className="text-lg font-semibold text-surface-300 mb-2">Belum ada mata kuliah</h3>
        <p className="text-surface-500 text-sm mb-6 max-w-sm">
          Mulai dengan menambahkan mata kuliah pertama.
        </p>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all">
          <Plus className="w-4 h-4" /> Tambah Mata Kuliah
        </button>
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Tambah Mata Kuliah">
          <SubjectForm formName={formName} setFormName={setFormName} formDesc={formDesc} setFormDesc={setFormDesc}
            submitting={submitting} onSubmit={handleSubmit} onClose={() => setShowModal(false)} editingSubject={editingSubject} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">

      {/* ══════════════════════════════════════════════
          MAIN LAYOUT — Left 65% | Right 35% (stacks on mobile)
      ══════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-100px)]">

        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">

          {/* Featured + small cards row */}
          <div className="flex flex-col sm:flex-row gap-4" style={{ minHeight: '220px' }}>

            {/* Featured card — adapts to light/dark */}
            {featuredSubject && (
              <div
                onClick={() => navigate(`/subjects/${featuredSubject.id}`)}
                className="group relative flex-[3] rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-300 card-shimmer"
              >
                {/* Background — dark: mesh dark, light: teal gradient */}
                {isLight ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0a1f1d] to-[#0d1a17]" />
                    <div className="mesh-blob w-40 h-40 bg-primary-600/40 top-[-20%] right-[-5%]" style={{ animationDelay: '0s' }} />
                    <div className="mesh-blob w-52 h-52 bg-accent-500/20 bottom-[-20%] left-[-10%]" style={{ animationDelay: '3s' }} />
                    <div className="mesh-blob w-32 h-32 bg-primary-400/15 top-[30%] left-[50%]" style={{ animationDelay: '5s' }} />
                  </>
                )}

                {/* Dot pattern overlay */}
                <div className="absolute inset-0 opacity-[0.04]"
                  style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                {/* Edit/Delete overlay */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button onClick={e => openEditModal(featuredSubject, e)}
                    className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={e => handleDelete(featuredSubject, e)}
                    className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-red-500/60 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between p-6">
                  {/* Top badge */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
                      <BookOpen className="w-3 h-3 text-primary-300" />
                      <span className="text-[10px] text-white/80 font-medium tracking-wide uppercase">Mata Kuliah Utama</span>
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div>
                    <h2 className="text-2xl font-bold text-white leading-tight mb-1.5 drop-shadow-lg">
                      {featuredSubject.name}
                    </h2>
                    {featuredSubject.description && (
                      <p className="text-sm text-white/50 mb-4 line-clamp-1">{featuredSubject.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/50 flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
                          <GraduationCap className="w-3.5 h-3.5 text-primary-300" />
                          {featuredSubject.session_count} sesi
                        </span>
                      </div>
                      <span className="flex items-center gap-1.5 text-xs text-white/80 font-medium bg-primary-500/20 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-primary-500/20 group-hover:bg-primary-500/30 group-hover:gap-2.5 transition-all">
                        Buka <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Small cards stack — up to 2 with glassmorphism */}
            <div className="flex sm:flex-col flex-row gap-3 sm:flex-[2]">
              {subjects.slice(1, 3).map((subject, idx) => (
                <div key={subject.id}
                  onClick={() => navigate(`/subjects/${subject.id}`)}
                  className="card-glow group relative flex-1 rounded-xl bg-surface-800/40 backdrop-blur-sm border border-surface-700/30 px-4 py-3.5 cursor-pointer hover:bg-surface-800/70 hover:-translate-y-0.5 transition-all duration-300"
                >
                  {/* Accent gradient strip */}
                  <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b ${idx === 0 ? 'from-accent-400 to-accent-600' : 'from-primary-400 to-primary-600'}`} />

                  <div className="flex items-start justify-between pl-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-100 text-sm leading-tight truncate mb-1">
                        {subject.name}
                      </h3>
                      {subject.description && (
                        <p className="text-surface-500 text-xs line-clamp-1 mb-2">{subject.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${idx === 0 ? 'bg-accent-500/15 text-accent-400' : 'bg-primary-500/15 text-primary-400'}`}>
                          {subject.session_count} sesi
                        </span>
                        <ArrowRight className="w-3 h-3 text-surface-600 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                      <button onClick={e => openEditModal(subject, e)}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-all">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={e => handleDelete(subject, e)}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {subjects.slice(1, 3).length < 2 && (
                <button onClick={openCreateModal}
                  className="flex-1 rounded-xl border-2 border-dashed border-surface-700 hover:border-primary-500/50 flex items-center justify-center gap-2 text-surface-500 hover:text-primary-400 transition-all duration-200">
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-medium">Tambah Mata Kuliah</span>
                </button>
              )}
            </div>
          </div>

          {/* ── All Subjects — Horizontal card list (Opsi E style) ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-surface-300">Semua Mata Kuliah</h2>
              <span className="text-xs text-surface-500">{subjects.length} mata kuliah</span>
            </div>
            <div className="space-y-2">
              {otherSubjects.slice(2).map((subject, idx) => (
                <div key={subject.id}
                  onClick={() => navigate(`/subjects/${subject.id}`)}
                  className={`card-glow stagger-item group relative flex items-center gap-4 p-3.5 rounded-xl bg-surface-800/40 border border-surface-700/30 cursor-pointer hover:bg-surface-800/60 hover:-translate-y-0.5 transition-all duration-300`}
                >
                  {/* Accent left strip */}
                  <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b ${(idx + 3) % 2 === 0 ? 'from-primary-400 to-primary-600' : 'from-accent-400 to-accent-600'}`} />

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${iconBgs[(idx + 3) % iconBgs.length]} flex items-center justify-center flex-shrink-0 ml-2 shadow-lg`}>
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-100 text-sm leading-tight">{subject.name}</h3>
                    {subject.description && (
                      <p className="text-surface-500 text-xs mt-0.5 truncate">{subject.description}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                      (idx + 3) % 2 === 0 ? 'bg-primary-500/10 text-primary-400' : 'bg-accent-500/10 text-accent-400'
                    }`}>
                      {subject.session_count} sesi
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => openEditModal(subject, e)}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-all">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={e => handleDelete(subject, e)}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}

              {/* Subjects 1 and 2 also in list */}
              {subjects.slice(1, 3).length > 0 && subjects.length > 3 && null}

              {/* Show all subjects if <=3 total in horizontal list */}
              {subjects.length <= 3 && subjects.map((subject, idx) => (
                <div key={`all-${subject.id}`}
                  onClick={() => navigate(`/subjects/${subject.id}`)}
                  className={`card-glow stagger-item group relative flex items-center gap-4 p-3.5 rounded-xl bg-surface-800/40 border border-surface-700/30 cursor-pointer hover:bg-surface-800/60 hover:-translate-y-0.5 transition-all duration-300`}
                >
                  {/* Accent left strip */}
                  <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b ${idx % 2 === 0 ? 'from-primary-400 to-primary-600' : 'from-accent-400 to-accent-600'}`} />

                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${iconBgs[idx % iconBgs.length]} flex items-center justify-center flex-shrink-0 ml-2 shadow-lg`}>
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-100 text-sm">{subject.name}</h3>
                    {subject.description && <p className="text-surface-500 text-xs mt-0.5 truncate">{subject.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${idx % 2 === 0 ? 'bg-primary-500/10 text-primary-400' : 'bg-accent-500/10 text-accent-400'}`}>
                      {subject.session_count} sesi
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => openEditModal(subject, e)} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-all">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={e => handleDelete(subject, e)} className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN — Opsi F: Activity Feed + Stats ── */}
        <div className="w-full lg:w-72 lg:flex-shrink-0 flex flex-col gap-4">

          {/* Stats card */}
          <div className="bg-surface-800/50 border border-surface-700/40 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary-400" />
              <h3 className="text-sm font-semibold text-surface-200">Statistik</h3>
            </div>
            <div className="space-y-3">
              {/* Total Mata Kuliah */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-primary-400" />
                  </div>
                  <span className="text-xs text-surface-400">Mata Kuliah</span>
                </div>
                <span className="text-sm font-bold text-surface-100">{subjects.length}</span>
              </div>
              {/* Total Sesi */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent-500/15 flex items-center justify-center">
                    <GraduationCap className="w-3.5 h-3.5 text-accent-400" />
                  </div>
                  <span className="text-xs text-surface-400">Total Sesi</span>
                </div>
                <span className="text-sm font-bold text-surface-100">{totalSessions}</span>
              </div>
              {/* Transkripsi */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-primary-300" />
                  </div>
                  <span className="text-xs text-surface-400">Ditranskripsi</span>
                </div>
                <span className="text-sm font-bold text-surface-100">{transcribedSessions}</span>
              </div>
              {/* Rangkuman */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent-500/15 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-accent-400" />
                  </div>
                  <span className="text-xs text-surface-400">Dirangkum</span>
                </div>
                <span className="text-sm font-bold text-surface-100">{summarizedSessions}</span>
              </div>

              {/* Mini progress bar */}
              {totalSessions > 0 && (
                <div className="pt-2 border-t border-surface-700/40">
                  <div className="flex justify-between text-[10px] text-surface-500 mb-1.5">
                    <span>Progress Transkripsi</span>
                    <span>{totalSessions > 0 ? Math.round((transcribedSessions / Math.max(totalSessions, recentSessions.length)) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-700"
                      style={{ width: `${totalSessions > 0 ? Math.min(100, Math.round((transcribedSessions / Math.max(totalSessions, recentSessions.length)) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-surface-800/50 border border-surface-700/40 rounded-2xl p-4 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              <h3 className="text-sm font-semibold text-surface-200">Aktivitas Terbaru</h3>
            </div>

            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="w-8 h-8 text-surface-600 mb-2" />
                <p className="text-xs text-surface-500">Belum ada aktivitas</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-surface-700/50" />

                <div className="space-y-4">
                  {recentSessions.map((session, idx) => {
                    const { icon: Icon, color, bg, label } = activityIcon(session);
                    return (
                      <button
                        key={session.id}
                        onClick={() => navigate(`/sessions/${session.id}`)}
                        className="relative flex items-start gap-3 w-full text-left group"
                      >
                        {/* Dot */}
                        <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center flex-shrink-0 z-10 ring-2 ring-surface-900`}>
                          <Icon className={`w-3 h-3 ${color}`} />
                        </div>
                        {/* Text */}
                        <div className="flex-1 min-w-0 pb-1">
                          <p className="text-xs font-medium text-surface-300 group-hover:text-surface-100 transition-colors leading-tight truncate">
                            {session.title || `Pertemuan ${session.session_number}`}
                          </p>
                          <p className="text-[10px] text-surface-500 mt-0.5">{label}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-surface-600 truncate">{session.subject_name}</span>
                            <span className="text-surface-700">·</span>
                            <span className="text-[10px] text-surface-600 flex-shrink-0">{relativeTime(session.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <button
        onClick={openCreateModal}
        title="Tambah Mata Kuliah"
        className="fixed bottom-6 right-6 w-12 h-12 bg-primary-600 hover:bg-primary-500 text-white rounded-full shadow-lg shadow-primary-600/40 hover:shadow-primary-500/50 flex items-center justify-center transition-all duration-200 hover:-translate-y-1 hover:scale-105 z-40"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingSubject ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah'}>
        <SubjectForm
          formName={formName} setFormName={setFormName}
          formDesc={formDesc} setFormDesc={setFormDesc}
          submitting={submitting} onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
          editingSubject={editingSubject}
        />
      </Modal>
    </div>
  );
}

function SubjectForm({ formName, setFormName, formDesc, setFormDesc, submitting, onSubmit, onClose, editingSubject }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-surface-300 mb-1.5">
          Nama Mata Kuliah <span className="text-red-400">*</span>
        </label>
        <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
          placeholder="contoh: Algoritma & Pemrograman"
          className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-surface-100 text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
          autoFocus required />
      </div>
      <div>
        <label className="block text-sm font-medium text-surface-300 mb-1.5">
          Deskripsi <span className="text-surface-500">(opsional)</span>
        </label>
        <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
          placeholder="Deskripsi singkat tentang mata kuliah ini..."
          rows={3}
          className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-surface-100 text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">
          Batal
        </button>
        <button type="submit" disabled={submitting || !formName.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all">
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {editingSubject ? 'Simpan' : 'Tambah'}
        </button>
      </div>
    </form>
  );
}
