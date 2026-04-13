import { useState, useEffect } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  Plus, ArrowLeft, Trash2, Loader2, Music, Calendar,
  FileText, Clock, ChevronRight, Pencil, FolderOpen, Globe,
} from 'lucide-react';
import { getSubjects, getSessions, createSession, deleteSession } from '../services/api';
import Modal from '../components/Modal';
import AudioRecorder from '../components/AudioRecorder';
import { useToast } from '../components/Toast';

export default function SubjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [subject, setSubject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formNumber, setFormNumber] = useState(1);
  const [formAudio, setFormAudio] = useState(null);
  const [formLanguage, setFormLanguage] = useState('auto');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      // Load subject info
      const allSubjects = await getSubjects();
      const subj = allSubjects.find((s) => s.id === parseInt(id));
      if (!subj) {
        toast.error('Mata kuliah tidak ditemukan');
        navigate('/');
        return;
      }
      setSubject(subj);

      // Load sessions
      const sessData = await getSessions(id);
      setSessions(sessData);

      // Auto-set next session number
      const maxNum = sessData.reduce((max, s) => Math.max(max, s.session_number), 0);
      setFormNumber(maxNum + 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession(e) {
    e.preventDefault();

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('subject_id', id);
      formData.append('session_number', formNumber);
      formData.append('title', formTitle);
      formData.append('language', formLanguage);
      if (formAudio) {
        formData.append('audio', formAudio);
      }

      await createSession(formData);
      toast.success(`Sesi ${formNumber} berhasil dibuat`);
      setShowModal(false);
      setFormTitle('');
      setFormAudio(null);
      setFormLanguage('auto');
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSession(session, e) {
    e.stopPropagation();
    if (!confirm(`Hapus sesi "${session.title || 'Pertemuan ' + session.session_number}"?`)) return;

    try {
      await deleteSession(session.id);
      toast.success('Sesi berhasil dihapus');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const statusStyles = {
    pending: 'bg-surface-700 text-surface-300',
    transcribing: 'bg-amber-500/20 text-amber-300',
    summarizing: 'bg-blue-500/20 text-blue-300',
    done: 'bg-green-500/20 text-green-300',
  };

  const statusLabels = {
    pending: 'Menunggu',
    transcribing: 'Transkripsi...',
    summarizing: 'Merangkum...',
    done: 'Selesai',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Back + Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-surface-50">{subject?.name}</h1>
            {subject?.description && (
              <p className="text-surface-400 text-sm mt-1">{subject.description}</p>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-primary-600/20 hover:shadow-primary-500/30 hover:-translate-y-0.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Sesi Baru
          </button>
        </div>
      </div>

      {/* Empty State */}
      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-surface-800 rounded-2xl flex items-center justify-center mb-5">
            <FolderOpen className="w-10 h-10 text-surface-500" />
          </div>
          <h3 className="text-lg font-semibold text-surface-300 mb-2">Belum ada sesi</h3>
          <p className="text-surface-500 text-sm mb-6 max-w-sm">
            Buat sesi pertemuan pertama untuk mulai merekam dan mentranskrip kuliah.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            Buat Sesi Pertama
          </button>
        </div>
      )}

      {/* Sessions List */}
      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => navigate(`/sessions/${session.id}`)}
              className="group flex items-center gap-3 bg-surface-900/50 border border-surface-800 hover:border-surface-700 rounded-xl p-3.5 sm:p-4 cursor-pointer transition-all duration-200 hover:bg-surface-800/50"
            >
              {/* Number Badge */}
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-500/10 text-primary-400 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
                {session.session_number}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-surface-200 text-sm truncate">
                  {session.title || `Pertemuan ${session.session_number}`}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {session.audio_path && (
                    <span className="flex items-center gap-1 text-xs text-surface-400">
                      <Music className="w-3 h-3" />
                      <span className="hidden sm:inline">Audio</span>
                    </span>
                  )}
                  {session.duration_minutes > 0 && (
                    <span className="flex items-center gap-1 text-xs text-surface-400">
                      <Clock className="w-3 h-3" />
                      {Math.round(session.duration_minutes)} mnt
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-surface-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(session.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${statusStyles[session.status] || statusStyles.pending}`}>
                {statusLabels[session.status] || session.status}
              </span>

              {/* Actions */}
              <button
                onClick={(e) => handleDeleteSession(session, e)}
                className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Hapus sesi"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Modal Buat Sesi Baru */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Sesi Baru"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Pertemuan ke-
              </label>
              <input
                type="number"
                value={formNumber}
                onChange={(e) => setFormNumber(parseInt(e.target.value))}
                min={1}
                className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Judul / Topik
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="contoh: Sorting Algorithm"
                className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-surface-100 text-sm placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Bahasa Transkripsi
              </span>
            </label>
            <select
              value={formLanguage}
              onChange={(e) => setFormLanguage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
            >
              <option value="auto">Auto-detect</option>
              <option value="id">Indonesia</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
              <option value="ko">Korean</option>
              <option value="ms">Malay</option>
              <option value="ar">Arabic</option>
              <option value="de">German</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              File Audio / Video <span className="text-surface-500">(opsional, bisa upload nanti)</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".mp3,.mp4,.wav,.m4a,.webm,.ogg"
                onChange={(e) => setFormAudio(e.target.files[0])}
                className="w-full px-3.5 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-surface-300 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-surface-700 file:text-surface-300 hover:file:bg-surface-600 cursor-pointer transition-all"
              />
            </div>
            {formAudio && (
              <p className="mt-1.5 text-xs text-primary-400">
                {formAudio.name} ({(formAudio.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-px bg-surface-700" />
              <span className="text-xs text-surface-500">atau</span>
              <div className="flex-1 h-px bg-surface-700" />
            </div>

            {/* Record dari browser */}
            <div className="mt-3">
              <AudioRecorder
                onRecorded={(blob) => {
                  const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
                  setFormAudio(file);
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Buat Sesi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
