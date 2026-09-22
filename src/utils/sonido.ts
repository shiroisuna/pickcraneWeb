let audioCtx: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  return audioCtx;
}

/**
 * Beep corto sintetizado (sin depender de ningún archivo de audio externo).
 * Los navegadores bloquean sonido sin interacción previa del usuario; como
 * esta app siempre requiere clics antes (login, registro, etc.), el contexto
 * ya está "desbloqueado" para cuando llega la primera notificación en vivo.
 */
export function reproducirNotificacion() {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // el sonido nunca debe romper la app si el navegador lo bloquea
  }
}
