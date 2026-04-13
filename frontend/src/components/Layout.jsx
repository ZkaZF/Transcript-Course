import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap, LayoutDashboard, ChevronRight, Menu, X,
  Search, FileText, BookOpen, ChevronDown, Plus, Loader2,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { getSubjects, getSessions, searchTranscripts } from '../services/api';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sidebar subject tree
  const [subjects, setSubjects] = useState([]);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [subjectSessions, setSubjectSessions] = useState({});
  const [loadingSessions, setLoadingSessions] = useState({});
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Global search (header)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false); // mobile: toggle search bar
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeout = useRef(null);

  // ─── Load subjects on mount ───────────────────────────────────────
  useEffect(() => { loadSubjects(); }, []);

  // ─── Auto-expand subject when URL changes ─────────────────────────
  useEffect(() => {
    const subjectMatch = location.pathname.match(/\/subjects\/(\d+)/);
    if (subjectMatch) {
      const subjectId = parseInt(subjectMatch[1]);
      setExpandedSubjects(prev => ({ ...prev, [subjectId]: true }));
      if (!subjectSessions[subjectId]) loadSubjectSessions(subjectId);
    }
    // Also expand when in a session — find parent subject
    const sessionMatch = location.pathname.match(/\/sessions\/(\d+)/);
    if (sessionMatch) {
      // Try to find parent from existing sessions data
      for (const [subjectId, sessions] of Object.entries(subjectSessions)) {
        if (sessions.some(s => s.id === parseInt(sessionMatch[1]))) {
          setExpandedSubjects(prev => ({ ...prev, [subjectId]: true }));
          break;
        }
      }
    }
  }, [location.pathname]);

  // ─── Refresh sessions when navigating back (e.g. after creating session) ─
  useEffect(() => {
    // If we just came back to a subject page, refresh its sessions
    const subjectMatch = location.pathname.match(/\/subjects\/(\d+)/);
    if (subjectMatch) {
      const subjectId = parseInt(subjectMatch[1]);
      loadSubjectSessions(subjectId);
      loadSubjects(); // Also refresh session_count on subjects
    }
  }, [location.pathname]);

  // ─── Close search when navigating ────────────────────────────────
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSidebarOpen(false);
    setSearchExpanded(false);
  }, [location.pathname]);

  // ─── Click outside to close search ──────────────────────────────
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Debounced global search ──────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        setSearching(true);
        const data = await searchTranscripts(searchQuery);
        setSearchResults(data.results || []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  async function loadSubjects() {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch {}
  }

  async function loadSubjectSessions(subjectId) {
    try {
      setLoadingSessions(prev => ({ ...prev, [subjectId]: true }));
      const sessions = await getSessions(subjectId);
      setSubjectSessions(prev => ({ ...prev, [subjectId]: sessions }));
    } catch {}
    finally {
      setLoadingSessions(prev => ({ ...prev, [subjectId]: false }));
    }
  }

  function toggleSubject(subject) {
    const id = subject.id;
    const isExpanded = expandedSubjects[id];
    setExpandedSubjects(prev => ({ ...prev, [id]: !isExpanded }));
    if (!isExpanded && !subjectSessions[id]) {
      loadSubjectSessions(id);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  function statusDot(status) {
    if (status === 'done' || status === 'transcribed') return 'bg-green-400';
    if (status === 'transcribing') return 'bg-amber-400 animate-pulse';
    if (status === 'summarizing') return 'bg-blue-400 animate-pulse';
    return 'bg-surface-600';
  }

  function isSessionActive(sessionId) {
    return location.pathname === `/sessions/${sessionId}`;
  }

  function isSubjectActive(subjectId) {
    if (location.pathname.includes(`/subjects/${subjectId}`)) return true;
    const sessions = subjectSessions[subjectId] || [];
    return sessions.some(s => isSessionActive(s.id));
  }

  // Breadcrumb from URL
  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">

      {/* ── Mobile overlay ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════
          SIDEBAR — Wide Navigation Tree
      ══════════════════════════════════════════════════════════ */}
      <aside className={`
        fixed md:relative z-50 w-72 h-full flex-shrink-0
        bg-surface-900/70 border-r border-surface-700/40 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Logo / Brand */}
        <div className="px-4 py-3.5 border-b border-surface-700/40 flex-shrink-0 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-surface-100 text-sm leading-tight">Transcript</h1>
              <p className="text-[10px] text-surface-500 leading-tight">Online Course</p>
            </div>
          </NavLink>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 rounded-lg text-surface-500 hover:text-surface-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search inside sidebar */}
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-surface-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Filter mata kuliah..."
              className="w-full pl-8 pr-3 py-1.5 bg-surface-800/60 border border-surface-700/50 rounded-lg text-surface-200 text-xs placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-all"
            />
          </div>
        </div>

        {/* Dashboard nav item */}
        <div className="px-2 py-1 flex-shrink-0">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary-500/15 text-primary-400'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
              }`
            }
          >
            <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
            Dashboard
          </NavLink>
        </div>

        {/* ── Subject Tree ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {filteredSubjects.length > 0 && (
            <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider px-2.5 py-2">
              Mata Kuliah
            </p>
          )}

          {filteredSubjects.map(subject => {
            const isExpanded = expandedSubjects[subject.id];
            const isActive = isSubjectActive(subject.id);
            const sessions = subjectSessions[subject.id] || [];
            const isLoadingS = loadingSessions[subject.id];

            return (
              <div key={subject.id}>
                {/* Subject row */}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-150 group ${
                    isActive
                      ? 'text-primary-300'
                      : 'text-surface-300 hover:text-surface-100 hover:bg-surface-800/40'
                  }`}
                >
                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleSubject(subject)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                  >
                    <ChevronRight
                      className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${
                        isExpanded ? 'rotate-90 text-primary-400' : 'text-surface-500 group-hover:text-surface-400'
                      }`}
                    />
                    <BookOpen className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-primary-400' : 'text-surface-500 group-hover:text-surface-400'}`} />
                    <span className="text-xs font-medium truncate">{subject.name}</span>
                  </button>

                  {/* Session count badge */}
                  <span className="text-[10px] text-surface-500 bg-surface-800/60 px-1.5 py-0.5 rounded flex-shrink-0">
                    {subject.session_count}
                  </span>

                  {/* Go to subject page arrow */}
                  <button
                    onClick={() => navigate(`/subjects/${subject.id}`)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-surface-500 hover:text-primary-400 transition-all"
                    title="Buka halaman mata kuliah"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Sessions list under subject */}
                {isExpanded && (
                  <div className="ml-6 pl-2 border-l border-surface-700/40 space-y-0.5 mt-0.5 mb-1">
                    {isLoadingS ? (
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <Loader2 className="w-3 h-3 text-surface-500 animate-spin" />
                        <span className="text-[10px] text-surface-500">Memuat...</span>
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="text-[10px] text-surface-600 px-2 py-1.5 italic">Belum ada sesi</p>
                    ) : (
                      sessions.map(session => (
                        <button
                          key={session.id}
                          onClick={() => navigate(`/sessions/${session.id}`)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all duration-150 ${
                            isSessionActive(session.id)
                              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/20'
                              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
                          }`}
                        >
                          {/* Status indicator: spinner jika transcribing, dot jika lainnya */}
                          {session.status === 'transcribing' ? (
                            <Loader2 className="w-3 h-3 flex-shrink-0 text-amber-400 animate-spin" />
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(session.status)}`} />
                          )}
                          <span className="text-[11px] leading-tight truncate flex-1">
                            {session.title || `Pertemuan ${session.session_number}`}
                          </span>
                          {session.status === 'transcribing' && (
                            <span className="text-[9px] text-amber-400/80 flex-shrink-0">AI...</span>
                          )}
                        </button>
                      ))
                    )}

                    {/* Quick new session link */}
                    <button
                      onClick={() => navigate(`/subjects/${subject.id}`)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-surface-600 hover:text-primary-400 hover:bg-surface-800/30 transition-all"
                    >
                      <Plus className="w-3 h-3 flex-shrink-0" />
                      <span className="text-[11px]">Sesi baru...</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {subjects.length === 0 && (
            <div className="px-2 py-4 text-center">
              <p className="text-[11px] text-surface-600">Belum ada mata kuliah.</p>
              <p className="text-[11px] text-surface-600">Buka Dashboard untuk menambah.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2.5 border-t border-surface-700/40 flex-shrink-0">
          <p className="text-[10px] text-surface-600">v2.0 — 100% Free & Local</p>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Slim Header ─────────────────────────────────────── */}
        <header className="h-12 flex items-center justify-between px-4 md:px-5 border-b border-surface-700/40 bg-surface-900/20 flex-shrink-0 gap-3">

          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-2 text-sm min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all flex-shrink-0"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            <NavLink to="/" className="text-surface-500 hover:text-surface-300 transition-colors text-xs flex-shrink-0">
              Dashboard
            </NavLink>
            {pathSegments.length > 0 && pathSegments[0] !== '' && (
              <>
                <ChevronRight className="w-3 h-3 text-surface-600 flex-shrink-0" />
                <span className="text-surface-300 text-xs capitalize truncate">
                  {pathSegments[pathSegments.length - 1] === pathSegments[0]
                    ? pathSegments[0]
                    : pathSegments.join(' / ')}
                </span>
              </>
            )}
          </div>

          {/* Right: Global Search + Theme Toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Search — icon on mobile, expands; always visible on md+ */}
            <div className="relative" ref={searchRef}>

              {/* Mobile: icon button to toggle */}
              {!searchExpanded && (
                <button
                  onClick={() => {
                    setSearchExpanded(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="md:hidden p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-all"
                  aria-label="Buka pencarian"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {/* Input: always shown on md+, conditionally on mobile */}
              <div className={`relative ${searchExpanded ? 'flex' : 'hidden md:flex'}`}>
                <Search className="w-3.5 h-3.5 text-surface-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                  onBlur={() => {
                    // collapse on mobile if empty
                    if (!searchQuery.trim()) {
                      setTimeout(() => setSearchExpanded(false), 150);
                    }
                  }}
                  placeholder="Cari di transkrip..."
                  className="w-44 sm:w-52 pl-8 pr-3 py-1.5 bg-surface-800/60 border border-surface-700/50 rounded-lg text-surface-200 text-xs placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:w-56 transition-all duration-200"
                />
                {searching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Search results dropdown */}
              {searchOpen && searchResults.length > 0 && (
                <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 max-h-72 overflow-y-auto bg-surface-900 border border-surface-700/50 rounded-xl shadow-2xl shadow-black/50 z-50">
                  <div className="p-2">
                    <p className="text-[10px] text-surface-500 px-2 mb-1.5">
                      {searchResults.length} hasil ditemukan
                    </p>
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          navigate(`/sessions/${result.session_id}?q=${encodeURIComponent(searchQuery)}`);
                          setSearchOpen(false);
                          setSearchQuery('');
                          setSearchExpanded(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-800/70 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <FileText className="w-3 h-3 text-primary-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-surface-200 truncate">
                            {result.session_title}
                          </span>
                        </div>
                        <p className="text-[10px] text-surface-500 mb-1 ml-5">
                          {result.subject_name} — Pertemuan {result.session_number}
                        </p>
                        <p className="text-[11px] text-surface-400 ml-5 line-clamp-2 leading-relaxed">
                          {result.snippet}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchOpen && searchResults.length === 0 && searchQuery.trim() && !searching && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-surface-900 border border-surface-700/50 rounded-xl shadow-2xl z-50 p-4 text-center">
                  <p className="text-xs text-surface-400">Tidak ada hasil untuk "{searchQuery}"</p>
                </div>
              )}
            </div>

            {/* Theme toggle — top right */}
            <ThemeToggle />
          </div>
        </header>

        {/* ── Page content ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
