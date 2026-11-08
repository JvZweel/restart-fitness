import type { AnimSpec, Phase, Pin, Pose } from './types';

/*
 * Timeline: keyframed poses → flat numeric channels → cyclic monotone cubic Hermite splines
 * (Fritsch–Carlson). Holds become two equal knots, so the motion eases to a stop and starts
 * again with zero velocity; frames without a hold are passed through smoothly. Monotone
 * tangents never overshoot a keyframe, so a squat never dips below its bottom position.
 */

const TRI = ['0', '1', '2'];
const PIN = ['X', 'Y', 'Z', 'W'];
export const CHANNELS: string[] = [
  'rootX', 'rootY', 'rootZ', 'rootPitch', 'rootRoll', 'rootYaw',
  ...TRI.map((i) => 'spine' + i), ...TRI.map((i) => 'chest' + i), 'neck', 'headYaw',
  'lClav0', 'lClav1', 'rClav0', 'rClav1',
  ...TRI.map((i) => 'lSh' + i), ...TRI.map((i) => 'rSh' + i), 'lEl', 'rEl', 'lWr', 'rWr',
  ...TRI.map((i) => 'lHip' + i), ...TRI.map((i) => 'rHip' + i), 'lKn', 'rKn',
  'lAnk', 'lAnkW', 'rAnk', 'rAnkW', 'lFoot', 'rFoot',
  ...PIN.map((c) => 'pinL' + c), ...PIN.map((c) => 'pinR' + c), ...PIN.map((c) => 'pinLH' + c), ...PIN.map((c) => 'pinRH' + c),
  'tension', 'breath',
];
const IDX: Record<string, number> = Object.fromEntries(CHANNELS.map((c, i) => [c, i]));
const N = CHANNELS.length;

/** Pose → channel vector. Optional values that are absent become NaN (filled from neighbours later). */
export function flattenPose(p: Pose): Float64Array {
  const v = new Float64Array(N);
  const r = p.root ?? {};
  v[IDX.rootX] = r.x ?? 0; v[IDX.rootY] = r.y ?? 1; v[IDX.rootZ] = r.z ?? 0;
  v[IDX.rootPitch] = r.pitch ?? 0; v[IDX.rootRoll] = r.roll ?? 0; v[IDX.rootYaw] = r.yaw ?? 0;
  const tri = (k: 'spine' | 'chest' | 'lSh' | 'rSh' | 'lHip' | 'rHip') => { const t = p[k]; for (let i = 0; i < 3; i++) v[IDX[k + i]] = t?.[i] ?? 0; };
  tri('spine'); tri('chest'); tri('lSh'); tri('rSh'); tri('lHip'); tri('rHip');
  v[IDX.neck] = p.neck ?? 0; v[IDX.headYaw] = p.headYaw ?? 0;
  for (const s of ['l', 'r'] as const) {
    const c = p[`${s}Clav`];
    v[IDX[s + 'Clav0']] = c?.[0] ?? 0; v[IDX[s + 'Clav1']] = c?.[1] ?? 0;
    v[IDX[s + 'El']] = p[`${s}El`] ?? 0; v[IDX[s + 'Wr']] = p[`${s}Wr`] ?? 0; v[IDX[s + 'Kn']] = p[`${s}Kn`] ?? 0;
    const ank = p[`${s}Ank`];
    v[IDX[s + 'Ank']] = ank ?? NaN; v[IDX[s + 'AnkW']] = ank == null ? 0 : 1;
    v[IDX[s + 'Foot']] = p[`${s}Foot`] ?? 0;
  }
  for (const k of ['pinL', 'pinR', 'pinLH', 'pinRH'] as const) {
    const pin = p[k];
    v[IDX[k + 'X']] = pin ? pin[0] : NaN; v[IDX[k + 'Y']] = pin ? pin[1] : NaN; v[IDX[k + 'Z']] = pin ? pin[2] : NaN;
    v[IDX[k + 'W']] = pin ? (pin[3] ?? 1) : 0;
  }
  return v;
}

/** Internal: blend weight of the local ankle angle against the world foot pitch. */
export interface PoseExt extends Pose { lAnkW?: number; rAnkW?: number }

/** Channel vector → Pose (pins with zero weight are dropped). */
export function unflatten(v: ArrayLike<number>): PoseExt {
  const g = (k: string) => v[IDX[k]];
  const tri = (k: string): [number, number, number] => [g(k + '0'), g(k + '1'), g(k + '2')];
  const pin = (k: string): Pin | undefined => (g(k + 'W') > 1e-4 ? [g(k + 'X'), g(k + 'Y'), g(k + 'Z'), Math.min(1, g(k + 'W'))] : undefined);
  const p: PoseExt = {
    root: { x: g('rootX'), y: g('rootY'), z: g('rootZ'), pitch: g('rootPitch'), roll: g('rootRoll'), yaw: g('rootYaw') },
    spine: tri('spine'), chest: tri('chest'), neck: g('neck'), headYaw: g('headYaw'),
    lClav: [g('lClav0'), g('lClav1')], rClav: [g('rClav0'), g('rClav1')],
    lSh: tri('lSh'), rSh: tri('rSh'), lEl: g('lEl'), rEl: g('rEl'), lWr: g('lWr'), rWr: g('rWr'),
    lHip: tri('lHip'), rHip: tri('rHip'), lKn: g('lKn'), rKn: g('rKn'),
    lFoot: g('lFoot'), rFoot: g('rFoot'),
    pinL: pin('pinL'), pinR: pin('pinR'), pinLH: pin('pinLH'), pinRH: pin('pinRH'),
  };
  const lw = g('lAnkW');
  const rw = g('rAnkW');
  if (lw > 1e-4) { p.lAnk = g('lAnk'); p.lAnkW = Math.min(1, lw); }
  if (rw > 1e-4) { p.rAnk = g('rAnk'); p.rAnkW = Math.min(1, rw); }
  return p;
}

export interface Sample {
  pose: PoseExt;
  values: Float64Array;
  /** Muscle tension 0..1. */
  tension: number;
  /** Breath 0 (exhaled) .. 1 (inhaled, braced). */
  breath: number;
  /** Phase of the current motion, or 'hold' during a pause. */
  phase: Phase | 'hold';
  /** Index of the keyframe being approached or held. */
  frame: number;
}

export interface Timeline {
  total: number;
  /** Time at which each keyframe is reached (start of its hold). */
  keyTimes: number[];
  sample(t: number): Sample;
}

const NEUTRAL: Pose = { lSh: [0, 7], rSh: [0, 7], lEl: 10, rEl: 10, lHip: [0, 3], rHip: [0, 3] };

/** Fritsch–Butland monotone tangent for a knot between secants d0 (span h0) and d1 (span h1). */
function tangent(d0: number, d1: number, h0: number, h1: number): number {
  if (d0 * d1 <= 0) return 0;
  return (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
}

export function buildTimeline(spec: AnimSpec): Timeline {
  const frames = spec.frames;
  const n = frames.length;
  // Merge each frame onto the previous one so later frames list only what changes.
  const poses: Pose[] = [];
  let prev: Pose = NEUTRAL;
  for (const f of frames) {
    const merged: Pose = { ...prev, ...f.pose, root: { ...(prev.root ?? {}), ...(f.pose.root ?? {}) } };
    poses.push(merged);
    prev = merged;
  }
  const vecs = poses.map(flattenPose);
  // Breath per pose: inhale and brace arriving by the eccentric, exhale through the concentric.
  const breathOf: number[] = new Array(n).fill(0.5);
  let br = 0.5;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const ph = frames[i].phase ?? 'flow';
      br = ph === 'ecc' ? 1 : ph === 'con' ? 0 : br;
      breathOf[i] = br;
    }
  }
  vecs.forEach((v, i) => {
    v[IDX.tension] = frames[i].tension ?? 0.5;
    v[IDX.breath] = breathOf[i];
  });
  // Fill NaN optional values from the nearest defined pose (cyclic), else 0.
  for (let c = 0; c < N; c++) {
    for (let i = 0; i < n; i++) {
      if (!Number.isNaN(vecs[i][c])) continue;
      let val = 0;
      for (let k = 1; k <= n; k++) {
        const a = vecs[(i - k + n) % n][c];
        const b = vecs[(i + k) % n][c];
        if (!Number.isNaN(a)) { val = a; break; }
        if (!Number.isNaN(b)) { val = b; break; }
      }
      vecs[i][c] = val;
    }
  }

  // Knots: pose i is reached at S_i and left at S_i + hold_i.
  const keyTimes: number[] = [];
  const knotT: number[] = [];
  const knotV: Float64Array[] = [];
  const knotFrame: number[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) t += frames[i].move ?? 0.9;
    keyTimes.push(t);
    knotT.push(t); knotV.push(vecs[i]); knotFrame.push(i);
    const hold = frames[i].hold ?? 0.25;
    if (hold > 1e-6 && n > 1) { t += hold; knotT.push(t); knotV.push(vecs[i]); knotFrame.push(i); }
  }
  const total = n > 1 ? t + (frames[0].move ?? 0.9) : Math.max(1, frames[0].hold ?? 1);
  const K = knotT.length;

  // Monotone tangents per knot and channel (cyclic).
  const tang = knotV.map(() => new Float64Array(N));
  if (n > 1) {
    for (let k = 0; k < K; k++) {
      const kp = (k - 1 + K) % K;
      const kn = (k + 1) % K;
      const h0 = k === 0 ? total - knotT[K - 1] : knotT[k] - knotT[kp];
      const h1 = k === K - 1 ? total - knotT[k] : knotT[kn] - knotT[k];
      for (let c = 0; c < N; c++) {
        const d0 = (knotV[k][c] - knotV[kp][c]) / h0;
        const d1 = (knotV[kn][c] - knotV[k][c]) / h1;
        tang[k][c] = tangent(d0, d1, h0, h1);
      }
    }
  }

  return {
    total,
    keyTimes,
    sample(time: number): Sample {
      const out = new Float64Array(N);
      const tt = ((time % total) + total) % total;
      if (n === 1) {
        out.set(vecs[0]);
        return { pose: unflatten(out), values: out, tension: out[IDX.tension], breath: out[IDX.breath], phase: 'hold', frame: 0 };
      }
      let k = K - 1;
      for (let i = 0; i < K - 1; i++) if (tt < knotT[i + 1]) { k = i; break; }
      const k1 = (k + 1) % K;
      const t0 = knotT[k];
      const h = (k === K - 1 ? total : knotT[k1]) - t0;
      const u = h > 0 ? (tt - t0) / h : 0;
      const u2 = u * u;
      const u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1;
      const h10 = u3 - 2 * u2 + u;
      const h01 = -2 * u3 + 3 * u2;
      const h11 = u3 - u2;
      const a = knotV[k];
      const b = knotV[k1];
      const ma = tang[k];
      const mb = tang[k1];
      for (let c = 0; c < N; c++) out[c] = h00 * a[c] + h10 * h * ma[c] + h01 * b[c] + h11 * h * mb[c];
      const holding = knotFrame[k] === knotFrame[k1];
      const target = knotFrame[k1];
      return {
        pose: unflatten(out), values: out,
        tension: Math.min(1, Math.max(0, out[IDX.tension])),
        breath: Math.min(1, Math.max(0, out[IDX.breath])),
        phase: holding ? 'hold' : (frames[target].phase ?? 'flow'),
        frame: holding ? knotFrame[k] : target,
      };
    },
  };
}
