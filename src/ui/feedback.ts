/** Audio + haptic cues. WebAudio beeps need no asset files and work offline. */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio */ }
}

export function beep(times = 3, freq = 880): void {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = i === times - 1 ? freq * 1.5 : freq;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.28);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.28 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.28);
      o.stop(t0 + i * 0.28 + 0.25);
    }
  } catch { /* no audio */ }
}

export function buzz(pattern: number | number[] = [200, 100, 200, 100, 400]): void {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

/** Keep the screen on while a session is open (Android Chrome). Re-acquires on return to the tab. */
export function holdWakeLock(): () => void {
  let lock: WakeLockSentinel | null = null;
  let released = false;
  const req = async () => {
    try { if (!released && document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch { /* denied / unsupported */ }
  };
  const onVis = () => { if (document.visibilityState === 'visible') void req(); };
  void req();
  document.addEventListener('visibilitychange', onVis);
  return () => { released = true; document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => undefined); };
}
