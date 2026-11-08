import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Minus, Plus, X, Rotate3d, Play, Pause, Box } from 'lucide-preact';
import { isDark } from '../data/store';
import type { Muscle } from '../domain/types';
import { MUSCLE_LABEL } from '../domain/exercises';
import type { Viewer } from '../anim/viewer';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(props.onClose);
  close.current = props.onClose;
  useLayoutEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // Focus the first control in the body (not the close button) so the sheet is immediately usable.
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    (items()[1] ?? items()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      else if (!ref.current?.contains(document.activeElement)) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; if (prev?.isConnected) prev.focus(); };
  }, []);
  return (
    <div class="scrim" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={props.label ? undefined : titleId} aria-label={props.label} ref={ref}>
        <div class="grabber" aria-hidden="true" />
        <div class="sheet-head">
          <h2 id={titleId}>{props.title}</h2>
          <button class="icon-btn plain" onClick={props.onClose} aria-label="Close"><X size={22} aria-hidden="true" /></button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Confirm(props: { title: string; body: string; confirm: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title={props.title} onClose={props.onClose}>
      <p class="muted" style={{ margin: 0 }}>{props.body}</p>
      <div class="grid2">
        <button class="btn secondary" onClick={props.onClose}>Cancel</button>
        <button class={`btn ${props.danger ? 'danger' : 'primary'}`} onClick={() => { props.onConfirm(); props.onClose(); }}>{props.confirm}</button>
      </div>
    </Sheet>
  );
}

export function Stepper(props: { label: string; value: string; onDec: () => void; onInc: () => void; unit?: string; testid?: string }) {
  return (
    <div class="stepper" data-testid={props.testid}>
      <button type="button" onClick={props.onDec} aria-label={`Decrease ${props.label}`}><Minus size={26} aria-hidden="true" /></button>
      <div class="val" aria-live="polite" aria-atomic="true">
        <strong class="num">{props.value}{props.unit ? <span class="small muted"> {props.unit}</span> : null}</strong>
        <small>{props.label}</small>
      </div>
      <button type="button" onClick={props.onInc} aria-label={`Increase ${props.label}`}><Plus size={26} aria-hidden="true" /></button>
    </div>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; testid?: string }) {
  return (
    <label class="list-row" style={{ cursor: 'pointer' }}>
      <div class="grow">
        <div style={{ fontWeight: 600 }}>{props.label}</div>
        {props.hint ? <div class="xs muted">{props.hint}</div> : null}
      </div>
      <span class="switch">
        <input type="checkbox" role="switch" checked={props.checked} data-testid={props.testid} onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)} />
        <span />
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; testid?: string }) {
  return (
    <div class="seg" role="group" aria-label={props.label} data-testid={props.testid}>
      {props.options.map((o) => (
        <button type="button" key={String(o.value)} aria-pressed={o.value === props.value} onClick={() => props.onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Empty(props: { icon: JSX.Element; title: string; body?: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="ico">{props.icon}</div>
      <strong>{props.title}</strong>
      {props.body ? <span class="small">{props.body}</span> : null}
      {props.children}
    </div>
  );
}

export function MuscleChips(props: { primary: Muscle[]; secondary?: Muscle[] }) {
  return (
    <div class="row wrap" style={{ gap: '6px' }}>
      {props.primary.map((m) => <span key={m} class="chip accent">{MUSCLE_LABEL[m]}</span>)}
      {(props.secondary ?? []).map((m) => <span key={m} class="chip">{MUSCLE_LABEL[m]}</span>)}
    </div>
  );
}

export const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lazy-loaded 3D mannequin. Pauses off-screen and when the tab is hidden.
 * Has a pause control (WCAG 2.2.2); starts paused when the OS asks for reduced motion.
 * Keyboard: focus the figure and use the arrow keys to rotate it.
 */
export function AnimStage(props: { anim: string; primary: Muscle[]; secondary?: Muscle[]; aspect?: string; fit?: boolean; tags?: ComponentChildren; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [paused, setPaused] = useState(prefersReducedMotion);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const visible = useRef(true);
  // Latest props for the async viewer start-up (the user may have moved on before the chunk loaded).
  const latest = useRef(props);
  latest.current = props;
  const sync = () => viewerRef.current?.setPlaying(visible.current && !pausedRef.current && document.visibilityState === 'visible');

  useEffect(() => {
    let cancelled = false;
    let io: IntersectionObserver | null = null;
    let motionQuery: MediaQueryList | null = null;
    const onMotionPref = (e: MediaQueryListEvent) => viewerRef.current?.setReducedMotion(e.matches);
    import('../anim/viewer').then(({ createViewer }) => {
      if (cancelled || !canvasRef.current) return;
      try {
        const v = createViewer(canvasRef.current, { dark: isDark.value, reducedMotion: prefersReducedMotion() });
        viewerRef.current = v;
        const p = latest.current;
        v.setAnim(p.anim, p.primary, p.secondary);
        if (pausedRef.current) v.renderAt(0.3);
        setState('ok');
        io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; sync(); });
        io.observe(canvasRef.current);
        document.addEventListener('visibilitychange', sync);
        sync();
        if (typeof matchMedia === 'function') {
          motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
          motionQuery.addEventListener?.('change', onMotionPref);
        }
      } catch {
        viewerRef.current?.dispose();
        viewerRef.current = null;
        setState('error');
      }
    }).catch(() => setState('error'));
    return () => { cancelled = true; io?.disconnect(); motionQuery?.removeEventListener?.('change', onMotionPref); document.removeEventListener('visibilitychange', sync); viewerRef.current?.dispose(); viewerRef.current = null; };
  }, []);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    v.setAnim(props.anim, props.primary, props.secondary);
    if (pausedRef.current) v.renderAt(0.3); else sync();
  }, [props.anim, props.primary.join(), (props.secondary ?? []).join()]);
  useEffect(() => { sync(); }, [paused]);
  const dark = isDark.value;
  useEffect(() => { viewerRef.current?.setDark(dark); }, [dark]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); viewerRef.current?.orbit(e.key === 'ArrowLeft' ? -20 : 20); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPaused((p) => !p); }
  };

  return (
    <div class={`stage ${props.fit ? 'fit' : ''}`} style={props.fit ? undefined : { aspectRatio: props.aspect ?? '4 / 3' }} data-anim={props.anim} data-state={state}>
      <canvas ref={canvasRef} role="img" tabIndex={state === 'ok' ? 0 : -1} onKeyDown={onKey}
        aria-label={`${props.label}: animated demonstration. Arrow keys rotate, Space pauses.`} />
      {props.tags ? <div class="stage-tag">{props.tags}</div> : null}
      {state === 'ok' ? (
        <>
          <div class="stage-ctrl">
            <button type="button" class="icon-btn sm" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? 'Play demonstration' : 'Pause demonstration'} data-testid="anim-toggle">
              {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
            </button>
          </div>
          <div class="stage-hint" aria-hidden="true"><Rotate3d size={14} /> drag to rotate</div>
        </>
      ) : null}
      {state === 'loading' ? <div class="stage-fallback skeleton" aria-live="polite" style={{ borderRadius: 0 }}>Loading the demonstration</div> : null}
      {state === 'error' ? (
        <div class="stage-fallback" role="note">
          <Box size={28} aria-hidden="true" />
          <strong style={{ color: 'var(--text)' }}>3D preview unavailable</strong>
          <span>This device couldn’t start WebGL. The form cues below cover every step.</span>
        </div>
      ) : null}
    </div>
  );
}

/** Track an element's rendered width so SVG charts draw at real pixel size (text stays 11px). */
function useWidth<T extends Element>(fallback: number): [preact.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const cw = Math.round(e.contentRect.width); if (cw > 0) setW(cw); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Minimal responsive SVG line chart (no dependencies). */
export function LineChart(props: { points: { x: number; y: number }[]; secondary?: { x: number; y: number }[]; unit?: string; height?: number; fmtX?: (x: number) => string; decimals?: number; testid?: string; label: string; average?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>(340);
  const H = props.height ?? 160;
  const pts = props.points;
  const dec = props.decimals ?? 1;
  const all = [...pts, ...(props.secondary ?? [])];
  const ys = all.map((p) => p.y);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.05);
  y0 -= span * 0.12;
  y1 += span * 0.12;
  const fmtY = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(dec));
  const pad = { l: 12 + 7 * Math.max(fmtY(y0).length, fmtY(y1).length), r: 10, t: 12, b: 24 };
  if (pts.length < 2) return <div ref={ref} style={{ width: '100%' }} />;
  const xs = all.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const path = (p: { x: number; y: number }[]) => p.map((q, i) => `${i ? 'L' : 'M'}${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ');
  const d = path(pts);
  const area = `${d} L${sx(pts[pts.length - 1].x).toFixed(1)},${H - pad.b} L${sx(pts[0].x).toFixed(1)},${H - pad.b} Z`;
  const ticks = [y0 + (y1 - y0) * 0.15, y0 + (y1 - y0) * 0.5, y0 + (y1 - y0) * 0.85];
  const fx = props.fmtX ?? ((x: number) => new Date(x).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
  // Dots only while they stay readable; always mark the latest value.
  const dots = pts.length <= Math.max(8, W / 22);
  const lastP = pts[pts.length - 1];
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg class="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${props.label}. Latest ${fmtY(lastP.y)}${props.unit ? ` ${props.unit}` : ''} on ${fx(lastP.x)}, from ${fmtY(pts[0].y)} on ${fx(pts[0].x)}.`} data-testid={props.testid}>
        <g class="grid">{ticks.map((t) => <line key={t} x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} />)}</g>
        <g class="axis" aria-hidden="true">
          {ticks.map((t) => <text key={t} x={pad.l - 8} y={sy(t) + 4} text-anchor="end">{fmtY(t)}</text>)}
          <text x={pad.l} y={H - 6}>{fx(x0)}</text>
          <text x={W - pad.r} y={H - 6} text-anchor="end">{fx(x1)}</text>
        </g>
        <path class="area" d={area} />
        {props.average != null ? <line class="avg" x1={pad.l} x2={W - pad.r} y1={sy(props.average)} y2={sy(props.average)} /> : null}
        {props.secondary && props.secondary.length > 1 ? <path class="line2" d={path(props.secondary)} /> : null}
        <path class="line" d={d} />
        {dots ? pts.slice(0, -1).map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} />) : null}
        <circle class="last" cx={sx(lastP.x)} cy={sy(lastP.y)} r={4.5} />
      </svg>
    </div>
  );
}
