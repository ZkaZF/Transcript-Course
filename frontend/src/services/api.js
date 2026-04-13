/**
 * API Service — Semua HTTP calls ke backend FastAPI.
 * Base URL: http://localhost:8000/api
 */

const BASE_URL = 'http://localhost:8000/api';
const BACKEND_URL = 'http://localhost:8000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  // Jangan set Content-Type untuk FormData (browser set otomatis + boundary)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Terjadi kesalahan' }));
    throw new Error(error.detail || `HTTP Error ${response.status}`);
  }

  return response.json();
}


// ============ SUBJECTS (Mata Kuliah) ============

export function getSubjects() {
  return request('/subjects');
}

export function createSubject(data) {
  return request('/subjects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSubject(id, data) {
  return request(`/subjects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteSubject(id) {
  return request(`/subjects/${id}`, { method: 'DELETE' });
}


// ============ SESSIONS (Sesi Pertemuan) ============

export function getSessions(subjectId) {
  return request(`/subjects/${subjectId}/sessions`);
}

export function getSession(sessionId) {
  return request(`/sessions/${sessionId}`);
}

export function createSession(formData) {
  // formData is FormData (karena bisa include file audio)
  return request('/sessions', {
    method: 'POST',
    body: formData,
  });
}

export function deleteSession(sessionId) {
  return request(`/sessions/${sessionId}`, { method: 'DELETE' });
}

export function uploadAudio(sessionId, file) {
  const formData = new FormData();
  formData.append('audio', file);
  return request(`/sessions/${sessionId}/upload-audio`, {
    method: 'POST',
    body: formData,
  });
}


// ============ TRANSCRIPTION ============

export function startTranscription(sessionId) {
  return request(`/sessions/${sessionId}/transcribe`, { method: 'POST' });
}

export function getTranscriptionStatus(sessionId) {
  return request(`/sessions/${sessionId}/status`);
}


// ============ AI (Rangkuman & Chat) ============

export function generateSummary(sessionId) {
  return request(`/sessions/${sessionId}/summarize`, { method: 'POST' });
}

export function sendChatMessage(sessionId, message) {
  return request(`/sessions/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function getChatHistory(sessionId) {
  return request(`/sessions/${sessionId}/chat`);
}


// ============ HELPERS ============

export function getAudioUrl(audioPath) {
  if (!audioPath) return null;
  return `${BACKEND_URL}/uploads/${audioPath}`;
}


// ============ SEARCH (V2) ============

export function searchTranscripts(query) {
  return request(`/search?q=${encodeURIComponent(query)}`);
}


// ============ EXPORT (V2) ============

export async function exportPDF(sessionId) {
  const url = `${BASE_URL}/sessions/${sessionId}/export/pdf`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export gagal' }));
    throw new Error(error.detail || `HTTP Error ${response.status}`);
  }
  return response.blob();
}

export async function exportDOCX(sessionId) {
  const url = `${BASE_URL}/sessions/${sessionId}/export/docx`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export gagal' }));
    throw new Error(error.detail || `HTTP Error ${response.status}`);
  }
  return response.blob();
}


// ============ MATERIAL (V2) ============

export function uploadMaterial(sessionId, file) {
  const formData = new FormData();
  formData.append('material', file);
  return request(`/sessions/${sessionId}/upload-material`, {
    method: 'POST',
    body: formData,
  });
}


// ============ QUIZ (V3) ============

export function generateQuiz(sessionId, numQuestions = 10, includeEssay = true) {
  return request(`/sessions/${sessionId}/quiz/generate`, {
    method: 'POST',
    body: JSON.stringify({ num_questions: numQuestions, include_essay: includeEssay }),
  });
}

export function getQuiz(sessionId) {
  return request(`/sessions/${sessionId}/quiz`);
}

export function answerQuiz(sessionId, questionId, answer) {
  return request(`/sessions/${sessionId}/quiz/answer`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, answer }),
  });
}

export function getQuizResult(sessionId) {
  return request(`/sessions/${sessionId}/quiz/result`);
}

export function deleteQuiz(sessionId) {
  return request(`/sessions/${sessionId}/quiz`, { method: 'DELETE' });
}


// ============ NOTES (V5) ============

export function saveNotes(sessionId, notes) {
  return request(`/sessions/${sessionId}/notes`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
}
