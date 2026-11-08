import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Minus, Plus, X, Rotate3d } from 'lucide-preact';
import { isDark } from '../data/store';
import type { Muscle } from '../domain/types';
import { MUSCLE_LABEL } from '../domain/exercises';
import type { Viewer } from '../anim/viewer';

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, []);
  return (
    <div class="scrim" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.label ?? props.title} ref={ref}>
        <div class="grabber" aria-hidden="true" />
        <div class="sheet-head">
          <h2>{props.title}</h2>
          <button class="icon-btn plain" onClick={props.onClose} aria-label="Close"><X size={22} /></button>
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
      <button type="button" onClick={props.onDec} aria-label={`Decrease ${props.label}`}><Minus size={26} /></button>
      <div class="val" aria-live="polite">
        <strong class="num">{props.value}{props.unit ? <span class="small muted"> {props.unit}</span> : null}</strong>
        <small>{props.label}</small>
      </div>
      <button type="button" onClick={props.onInc} aria-label={`Increase ${props.label}`}><Plus size={26} /></button>
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

/** Lazy-loaded 3D mannequin. Pauses off-screen and when the tab is hidden. */
export function AnimStage(props: { anim: string; primary: Muscle[]; secondary?: Muscle[]; aspect?: string; tags?: ComponentChildren; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let io: IntersectionObserver | null = null;
    const onVis = () => viewerRef.current?.setPlaying(document.visibilityState === 'visible');
    import('../anim/viewer').then(({ createViewer }) => {
      if (cancelled || !canvasRef.current) return;
      try {
        const v = createViewer(canvasRef.current, { dark: isDark.value });
        viewerRef.current = v;
        v.setAnim(props.anim, props.primary, props.secondary);
        setState('ok');
        io = new IntersectionObserver(([e]) => v.setPlaying(e.isIntersecting && document.visibilityState === 'visible'));
        io.observe(canvasRef.current);
        document.addEventListener('visibilitychange', onVis);
      } catch {
        setState('error');
      }
    }).catch(() => setState('error'));
    return () => { cancelled = true; io?.disconnect(); document.removeEventListener('visibilitychange', onVis); viewerRef.current?.dispose(); viewerRef.current = null; };
  }, []);

  useEffect(() => { viewerRef.current?.setAnim(props.anim, props.primary, props.secondary); }, [props.anim, props.primary.join(), (props.secondary ?? []).join()]);
  const dark = isDark.value;
  useEffect(() => { viewerRef.current?.setDark(dark); }, [dark]);

  return (
    <div class="stage" style={{ aspectRatio: props.aspect ?? '4 / 3' }} data-anim={props.anim} data-state={state}>
      <canvas ref={canvasRef} role="img" aria-label={`${props.label} — animated demonstration`} />
      {props.tags ? <div class="stage-tag">{props.tags}</div> : null}
      {state === 'ok' ? <div class="stage-hint"><Rotate3d size={14} /> drag to rotate</div> : null}
      {state === 'loading' ? <div class="stage-fallback">Loading animation…</div> : null}
      {state === 'error' ? <div class="stage-fallback">3D preview isn’t available on this device — follow the cues below.</div> : null}
    </div>
  );
}

/** Minimal responsive SVG line chart (no dependencies). */
export function LineChart(props: { points: { x: number; y: number }[]; secondary?: { x: number; y: number }[]; unit?: string; height?: number; fmtX?: (x: number) => string; decimals?: number; testid?: string; label: string }) {
  const W = 340;
  const H = props.height ?? 150;
  const pad = { l: 40, r: 10, t: 12, b: 22 };
  const pts = props.points;
  if (pts.length < 2) return null;
  const all = [...pts, ...(props.secondary ?? [])];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const span = y1 - y0 || Math.max(1, Math.abs(y1) * 0.05);
  y0 -= span * 0.12;
  y1 += span * 0.12;
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const path = (p: { x: number; y: number }[]) => p.map((q, i) => `${i ? 'L' : 'M'}${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ');
  const d = path(pts);
  const area = `${d} L${sx(pts[pts.length - 1].x).toFixed(1)},${H - pad.b} L${sx(pts[0].x).toFixed(1)},${H - pad.b} Z`;
  const ticks = [y0 + (y1 - y0) * 0.15, y0 + (y1 - y0) * 0.5, y0 + (y1 - y0) * 0.85];
  const dec = props.decimals ?? 1;
  const fx = props.fmtX ?? ((x: number) => new Date(x).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.label} data-testid={props.testid}>
      <g class="grid">{ticks.map((t) => <line key={t} x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} />)}</g>
      <g class="axis">
        {ticks.map((t) => <text key={t} x={pad.l - 6} y={sy(t) + 4} text-anchor="end">{t.toFixed(t > 1000 ? 0 : dec)}</text>)}
        <text x={pad.l} y={H - 4}>{fx(x0)}</text>
        <text x={W - pad.r} y={H - 4} text-anchor="end">{fx(x1)}</text>
      </g>
      <path class="area" d={area} />
      {props.secondary && props.secondary.length > 1 ? <path class="line2" d={path(props.secondary)} /> : null}
      <path class="line" d={d} />
      {pts.map((p, i) => <circle key={i} class={i === pts.length - 1 ? 'last' : ''} cx={sx(p.x)} cy={sy(p.y)} r={i === pts.length - 1 ? 4.5 : 3} />)}
    </svg>
  );
}
