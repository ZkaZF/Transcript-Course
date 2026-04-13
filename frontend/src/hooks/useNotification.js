/**
 * useNotification — Hook untuk browser notification + Web Audio ding sound.
 * Tidak perlu file audio eksternal: sound dibuat via Web Audio API.
 */
import { useCallback, useRef } from 'react';

// Buat suara "ding" sederhana via Web Audio API
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Nada 1: G5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, ctx.currentTime);         // G5
    osc1.frequency.setValueAtTime(1047, ctx.currentTime + 0.1);  // C6
    gain1.gain.setValueAtTime(0.5, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.8);

    // Slight reverb feel via second oscillator
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1047, ctx.currentTime + 0.05); // C6
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.05);
    osc2.stop(ctx.currentTime + 1.0);
  } catch {
    // Silently fail if AudioContext not supported
  }
}

export function useNotification() {
  const permissionRef = useRef(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  /**
   * Request permission jika belum granted.
   * Dipanggil saat user memulai transkripsi.
   */
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (permissionRef.current === 'granted') return;
    if (permissionRef.current === 'denied') return;

    const result = await Notification.requestPermission();
    permissionRef.current = result;
  }, []);

  /**
   * Tampilkan notifikasi + mainkan suara.
   * @param {string} title  - Judul notifikasi
   * @param {string} body   - Isi teks notifikasi
   */
  const notify = useCallback((title, body) => {
    // Selalu mainkan suara (baik tab aktif / tidak)
    playDing();

    // Browser notification hanya jika tab tidak sedang aktif di foreground
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.visibilityState !== 'visible'
    ) {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'transcript-done',  // replace notif sebelumnya jika ada
        });
        // Auto-close setelah 6 detik
        setTimeout(() => notif.close(), 6000);
      } catch {
        // Beberapa browser block notif dari localhost, diam saja
      }
    }
  }, []);

  return { requestPermission, notify };
}
