import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Upload, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

/**
 * AudioRecorder — Rekam audio dari tab browser menggunakan getDisplayMedia.
 * Props: onRecorded(blob) — callback setelah rekaman selesai
 */
export default function AudioRecorder({ onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const toast = useToast();

  const startRecording = useCallback(async () => {
    try {
      // Constraint getDisplayMedia — kompatibel Chrome, Edge, Firefox, Zen
      const displayMediaOptions = {
        video: {
          displaySurface: 'browser',  // Prefer tab (bukan window/screen)
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        },
        // Chrome 107+: langsung tampilkan tab saat ini
        preferCurrentTab: false,
        // Chrome 107+: izinkan pindah tab saat recording
        surfaceSwitching: 'include',
        // Chrome 105+: capture system audio juga
        systemAudio: 'include',
      };

      // Minta user pilih tab untuk di-record audionya
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      // Ambil hanya audio track
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        toast.error(
          'Tidak ada audio terekam. Tips:\n' +
          '• Chrome/Edge: Centang "Also share tab audio"\n' +
          '• Firefox/Zen: Pilih tab/window yang ada audio-nya'
        );
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Buat stream audio-only
      const audioStream = new MediaStream(audioTracks);

      // Stop video track (kita hanya butuh audio)
      stream.getVideoTracks().forEach(t => t.stop());

      // Pilih mimeType yang didukung browser
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(audioStream, { mimeType });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunksRef.current, { type: `audio/${ext}` });
        onRecorded(blob);
        clearInterval(timerRef.current);
        setDuration(0);
        setRecording(false);
        toast.success('Rekaman selesai!');
      };

      // Handle saat user stop share dari browser
      audioTracks[0].onended = () => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      };

      mediaRecorder.start(1000); // Collect data setiap 1 detik
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);

      // Timer
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        toast.info('Rekaman dibatalkan');
      } else {
        toast.error('Gagal merekam: ' + err.message);
      }
    }
  }, [onRecorded, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <div className="flex items-center gap-3">
      {!recording ? (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-red-600/20"
        >
          <Mic className="w-4 h-4" />
          Record dari Tab
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse-soft" />
            <span className="text-sm font-mono text-red-400">{formatDuration(duration)}</span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-700 hover:bg-surface-600 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
