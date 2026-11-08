import type { AnimSpec, Keyframe, Pose } from './types';

/*
 * Keyframed poses for every exercise, warm-up move, stretch and finisher.
 * Angles in degrees. Shoulder/hip tuples = [flex(+forward), abduct(+out), twist].
 *   Shoulder recipes: arms hanging [0, 8]; arm vertical when the torso is pitched p: [p, 6];
 *   press "goal post" (upper arm out, forearm up) [f, 90, 0] + elbow ~95, straight up overhead
 *   in the scapular plane [f, 90, -75]; supine press bottom [0, 75, 0] + elbow ~85, lockout [0, 90, -90].
 * Spine/chest = [pitch(+forward), roll, yaw]. Root pitch: -90 = lying face up, +90 = face down.
 * Frames merge onto the previous frame, so later frames list only what changes.
 * Timing: `move` is the time to arrive at a frame, `hold` the pause there; frame 0 is the start.
 * Tempo for lifts: controlled ~2 s eccentric, short pause, ~1.1 s concentric.
 */

const ARMS_DOWN: Pose = { lSh: [0, 8], rSh: [0, 8], lEl: 8, rEl: 8 };
const STAND: Pose = { ...ARMS_DOWN, spine: [0], chest: [0], lHip: [0, 4], rHip: [0, 4], lKn: 0, rKn: 0, neck: 0 };
const SIDES: Pose = { lSh: [0, 10], rSh: [0, 10], lEl: 6, rEl: 6 };
const SUPINE = { pitch: -90 };
/** Feet planted on the floor in front of a flat bench (bench origin z ≈ 0). */
const BENCH_FEET: Pose = { pinL: [0.22, 0.085, 0.6], pinR: [-0.22, 0.085, 0.6], lHip: [40, 14], rHip: [40, 14], lKn: 90, rKn: 90 };
const SEAT_FEET: Pose = { pinL: [0.22, 0.085, 0.6], pinR: [-0.22, 0.085, 0.6], lHip: [80, 14], rHip: [80, 14], lKn: 90, rKn: 90 };
const PRESS_BOTTOM: Pose = { lSh: [0, 75, 0], rSh: [0, 75, 0], lEl: 86, rEl: 86 };
const PRESS_TOP: Pose = { lSh: [0, 90, -88], rSh: [0, 90, -88], lEl: 4, rEl: 4 };

interface RepOpts { ecc?: number; con?: number; holdA?: number; holdB?: number; tA?: number; tB?: number }
/** Lowering first: frame 1 (the stretched bottom) is reached by the eccentric. */
function lowerFirst(a: Pose, b: Pose, o: RepOpts = {}): Keyframe[] {
  return [
    { pose: a, hold: o.holdA ?? 0.45, move: o.con ?? 1.1, phase: 'con', tension: o.tA ?? 0.3 },
    { pose: b, hold: o.holdB ?? 0.35, move: o.ecc ?? 2.0, phase: 'ecc', tension: o.tB ?? 1 },
  ];
}
/** Lifting first: frame 1 (the contracted top) is reached by the concentric. */
function liftFirst(a: Pose, b: Pose, o: RepOpts = {}): Keyframe[] {
  return [
    { pose: a, hold: o.holdA ?? 0.35, move: o.ecc ?? 2.0, phase: 'ecc', tension: o.tA ?? 0.3 },
    { pose: b, hold: o.holdB ?? 0.4, move: o.con ?? 1.1, phase: 'con', tension: o.tB ?? 1 },
  ];
}

/**
 * Squat pattern: knees and hips break together and the torso lean leads, so the centre of mass
 * stays over mid-foot. A mid-depth key (no pause) is passed through on the way down and up.
 */
function squat(top: Pose, mid: Pose, bottom: Pose, o: RepOpts = {}): Keyframe[] {
  const ecc = o.ecc ?? 2.1;
  const con = o.con ?? 1.1;
  return [
    { pose: top, hold: o.holdA ?? 0.45, move: con * 0.5, phase: 'con', tension: o.tA ?? 0.3 },
    { pose: mid, hold: 0, move: ecc * 0.48, phase: 'ecc', tension: 0.7 },
    { pose: bottom, hold: o.holdB ?? 0.4, move: ecc * 0.52, phase: 'ecc', tension: o.tB ?? 1 },
    { pose: mid, hold: 0, move: con * 0.5, phase: 'con', tension: 0.8 },
  ];
}

export const ANIMS: Record<string, AnimSpec> = {
  // ── Knee dominant ─────────────────────────────────────────
  'goblet-squat': {
    ground: 'stand', plant: ['lf', 'rf'], dumbbells: 'goblet', view: { az: 38, el: 10 },
    frames: squat(
      { ...STAND, root: { pitch: 0 }, lSh: [14, 8], rSh: [14, 8], lEl: 140, rEl: 140, lHip: [0, 10, 8], rHip: [0, 10, 8], spine: [2] },
      { root: { pitch: 18 }, spine: [8], chest: [1], lHip: [70, 12, 9], rHip: [70, 12, 9], lKn: 78, rKn: 78, neck: -18 },
      { root: { pitch: 24 }, spine: [12], chest: [2], lHip: [124, 15, 10], rHip: [124, 15, 10], lKn: 126, rKn: 126, neck: -30 },
      { holdB: 0.45 },
    ),
  },
  'bw-squat': {
    ground: 'stand', plant: ['lf', 'rf'], view: { az: 38, el: 10 },
    frames: squat(
      { ...STAND, root: { pitch: 0 }, lSh: [12, 8], rSh: [12, 8], lHip: [0, 10, 8], rHip: [0, 10, 8] },
      { root: { pitch: 18 }, spine: [8], chest: [1], lHip: [70, 12, 9], rHip: [70, 12, 9], lKn: 78, rKn: 78, lSh: [52, 8], rSh: [52, 8], lEl: 5, rEl: 5, neck: -16 },
      { root: { pitch: 22 }, spine: [12], chest: [2], lHip: [122, 15, 10], rHip: [122, 15, 10], lKn: 126, rKn: 126, lSh: [72, 8], rSh: [72, 8], lEl: 4, rEl: 4, neck: -24 },
      { ecc: 2.4, holdB: 0.8, tA: 0.2, tB: 0.9 },
    ),
  },
  'bulgarian-split-squat': {
    ground: 'stand', anchor: 'l', dumbbells: 'both', grip: 'neutral', view: { az: 78, el: 8 },
    bench: { kind: 'flat', z: -1.0 },
    frames: lowerFirst(
      { ...SIDES, spine: [5], lSh: [5, 10], rSh: [5, 10], lHip: [14, 3], lKn: 10, rHip: [-12, 4], rKn: 40, pinR: [-0.11, 0.51, -0.68], rFoot: 160, neck: -4 },
      { spine: [14], lSh: [14, 10], rSh: [14, 10], lHip: [84, 3], lKn: 96, neck: -10 },
      { ecc: 2.1, holdB: 0.4 },
    ),
  },
  'reverse-lunge': {
    ground: 'stand', anchor: 'l', dumbbells: 'both', grip: 'neutral', view: { az: 80, el: 8 },
    frames: [
      { pose: { ...STAND, ...SIDES, pinR: [-0.1, 0.085, 0, 0], rHip: [0, 4], rKn: 0 }, hold: 0.45, move: 1.2, phase: 'con', tension: 0.3 },
      { pose: { spine: [6], lHip: [84, 3], lKn: 94, rHip: [-6, 4], rKn: 96, pinR: [-0.1, 0.17, -0.84, 1], rFoot: 26, neck: -6 }, hold: 0.4, move: 2.0, phase: 'ecc', tension: 1 },
    ],
  },
  'step-up': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 72, el: 10 },
    bench: { kind: 'flat', z: 0.42, yaw: 90 },
    frames: [
      { pose: { ...SIDES, root: { y: 0.96, z: 0.02 }, spine: [12], lSh: [12, 10], rSh: [12, 10], lHip: [70, 3], rHip: [4, 3], lKn: 80, rKn: 6, pinL: [0.1, 0.53, 0.42, 1], pinR: [-0.1, 0.085, -0.02, 1], neck: -6 }, hold: 0.35, move: 1.9, phase: 'ecc', tension: 0.45 },
      { pose: { root: { y: 1.45, z: 0.38 }, spine: [3], lSh: [3, 10], rSh: [3, 10], lHip: [2, 3], lKn: 2, rHip: [-4, 3], rKn: 40, pinR: [-0.1, 0.085, -0.02, 0], rFoot: 20, neck: 0 }, hold: 0.35, move: 1.4, phase: 'con', tension: 1 },
    ],
  },

  // ── Hinge ─────────────────────────────────────────────────
  'db-rdl': {
    ground: 'stand', plant: ['lf', 'rf'], dumbbells: 'both', grip: 'pronated', view: { az: 82, el: 8 },
    frames: lowerFirst(
      { ...STAND, root: { pitch: 0 }, lSh: [4, 5], rSh: [4, 5], lEl: 3, rEl: 3, lKn: 8, rKn: 8, lHip: [0, 5], rHip: [0, 5] },
      { root: { pitch: 70 }, spine: [2], chest: [-2], lHip: [90, 5], rHip: [90, 5], lKn: 24, rKn: 24, lSh: [70, 5], rSh: [70, 5], neck: -30 },
      { ecc: 2.2, con: 1.2, holdB: 0.35 },
    ),
  },
  'good-morning': {
    ground: 'stand', plant: ['lf', 'rf'], view: { az: 82, el: 8 },
    handsAt: { l: { bone: 'root', at: [0.155, 0.03, 0.015] }, r: { bone: 'root', at: [-0.155, 0.03, 0.015] } },
    frames: lowerFirst(
      { ...STAND, lSh: [-10, 28], rSh: [-10, 28], lEl: 100, rEl: 100, lKn: 8, rKn: 8, lHip: [0, 6], rHip: [0, 6] },
      { root: { pitch: 64 }, spine: [2], lHip: [84, 6], rHip: [84, 6], lKn: 20, rKn: 20, neck: -28 },
      { ecc: 2.0, con: 1.2, holdB: 0.4, tA: 0.2, tB: 0.85 },
    ),
  },
  'hip-thrust': {
    ground: 'fixed', dumbbells: 'hips', view: { az: 72, el: 12 },
    bench: { kind: 'flat', z: -0.58, yaw: 90 },
    frames: [
      { pose: { root: { y: 0.3, z: -0.04, pitch: -40 }, spine: [-4], chest: [6], neck: 24, lHip: [44, 12], rHip: [44, 12], lKn: 100, rKn: 100, pinL: [0.17, 0.085, 0.44], pinR: [-0.17, 0.085, 0.44], lSh: [40, 16], rSh: [40, 16], lEl: 100, rEl: 100 }, hold: 0.35, move: 1.9, phase: 'ecc', tension: 0.35 },
      { pose: { root: { y: 0.56, z: 0.02, pitch: -88 }, spine: [0], chest: [2], neck: 38, lHip: [2, 12], rHip: [2, 12] }, hold: 0.8, move: 1.1, phase: 'con', tension: 1 },
    ],
  },
  'sumo-deadlift': {
    ground: 'stand', plant: ['lf', 'rf'], dumbbells: 'twoHand', view: { az: 30, el: 10 },
    frames: lowerFirst(
      { ...STAND, lHip: [0, 22, 28], rHip: [0, 22, 28], lSh: [2, -12], rSh: [2, -12], lEl: 4, rEl: 4 },
      { root: { pitch: 32 }, spine: [4], chest: [-2], lHip: [96, 28, 30], rHip: [96, 28, 30], lKn: 92, rKn: 92, lSh: [36, -12], rSh: [36, -12], neck: -24 },
      { ecc: 2.1, con: 1.2 },
    ),
  },
  'single-leg-rdl': {
    ground: 'stand', anchor: 'l', dumbbells: 'r', grip: 'neutral', view: { az: 84, el: 8 },
    frames: lowerFirst(
      { ...STAND, lKn: 8, rHip: [-4, 4], rKn: 14, rAnk: 12, lSh: [8, 22], lEl: 12, rSh: [2, 6], rEl: 4 },
      { root: { pitch: 72, roll: -2 }, spine: [2], lHip: [66, 4, -4], lKn: 18, rHip: [2, 3], rKn: 6, rAnk: 4, rSh: [74, 6], lSh: [56, 34], lEl: 18, neck: -30 },
      { ecc: 2.3, con: 1.4, holdB: 0.4 },
    ),
  },

  // ── Push ──────────────────────────────────────────────────
  'flat-db-press': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 64, el: 20 }, bench: { kind: 'flat', z: 0.02 },
    frames: lowerFirst(
      { root: { y: 0.575, z: 0.1, ...SUPINE }, ...BENCH_FEET, ...PRESS_TOP, neck: -4 },
      { ...PRESS_BOTTOM },
      { ecc: 2.0, con: 1.0 },
    ),
  },
  'close-grip-press': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 64, el: 20 }, bench: { kind: 'flat', z: 0.02 },
    frames: lowerFirst(
      { root: { y: 0.575, z: 0.1, ...SUPINE }, ...BENCH_FEET, lSh: [88, -5], rSh: [88, -5], lEl: 4, rEl: 4, neck: -4 },
      { lSh: [28, 12], rSh: [28, 12], lEl: 112, rEl: 112 },
      { ecc: 2.0, con: 1.0 },
    ),
  },
  'incline-db-press': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 62, el: 14 }, bench: { kind: 'incline', angle: 38 },
    frames: lowerFirst(
      { root: { y: 0.57, z: 0.09, pitch: -52 }, ...SEAT_FEET, lHip: [52, 14], rHip: [52, 14], lSh: [38, 90, -88], rSh: [38, 90, -88], lEl: 4, rEl: 4, neck: -6 },
      { lSh: [26, 74, 0], rSh: [26, 74, 0], lEl: 88, rEl: 88 },
      { ecc: 2.0, con: 1.0 },
    ),
  },
  'decline-db-press': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 64, el: 20 }, bench: { kind: 'decline', angle: -14 },
    frames: lowerFirst(
      { root: { y: 0.6, z: 0.12, pitch: -100 }, lHip: [96, 6], rHip: [96, 6], lKn: 112, rKn: 112, lFoot: 20, rFoot: 20, lSh: [-10, 90, -88], rSh: [-10, 90, -88], lEl: 4, rEl: 4, neck: -8 },
      { lSh: [-8, 74, 0], rSh: [-8, 74, 0], lEl: 86, rEl: 86 },
      { ecc: 2.0, con: 1.0 },
    ),
  },
  'seated-shoulder-press': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 28, el: 8 }, bench: { kind: 'upright', angle: 80 },
    frames: lowerFirst(
      { root: { y: 0.575, z: 0.07, pitch: -8 }, ...SEAT_FEET, spine: [2], lSh: [78, 90, -76], rSh: [78, 90, -76], lEl: 6, rEl: 6, neck: 2 },
      { lSh: [78, 90, 2], rSh: [78, 90, 2], lEl: 98, rEl: 98 },
      { ecc: 2.0, con: 1.1 },
    ),
  },
  'push-up': {
    ground: 'floor', plant: ['lh', 'rh', 'lf', 'rf'], view: { az: 74, el: 14 },
    frames: lowerFirst(
      { root: { y: 1, z: 0, pitch: 73 }, spine: [0], lSh: [73, 10], rSh: [73, 10], lEl: 0, rEl: 0, lHip: [0, 3], rHip: [0, 3], lKn: 0, rKn: 0, lAnk: 78, rAnk: 78, neck: -8 },
      { root: { y: 0.8, z: 0.04, pitch: 85 } },
      { ecc: 1.9, con: 1.0, holdB: 0.3 },
    ),
  },

  // ── Pull ──────────────────────────────────────────────────
  'one-arm-row': {
    ground: 'fixed', dumbbells: 'r', grip: 'neutral', view: { az: 300, el: 14 }, bench: { kind: 'flat', x: 0.1, z: 0.14 },
    frames: liftFirst(
      { root: { y: 0.95, x: 0, z: 0, pitch: 80 }, spine: [2], neck: -10, lHip: [86, 2], lKn: 92, lFoot: 178, rHip: [70, 14], rKn: 4, pinR: [-0.27, 0.085, 0.02], pinLH: [0.11, 0.5, 0.5], lSh: [80, 4], lEl: 4, rSh: [80, 6], rEl: 4 },
      { rSh: [-6, 16], rEl: 98, chest: [0, 0, -8] },
      { ecc: 2.0, con: 1.0 },
    ),
  },
  'chest-supported-row': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 64, el: 14 }, bench: { kind: 'incline', angle: 38, yaw: 180 },
    frames: liftFirst(
      { root: { y: 0.62, z: 0.04, pitch: 52 }, lHip: [40, 10], rHip: [40, 10], lKn: 30, rKn: 30, pinL: [0.14, 0.085, -0.44], pinR: [-0.14, 0.085, -0.44], lSh: [52, 6], rSh: [52, 6], lEl: 4, rEl: 4, neck: -18 },
      { lSh: [-8, 20], rSh: [-8, 20], lEl: 96, rEl: 96 },
      { ecc: 2.0, con: 1.0 },
    ),
  },
  'rear-delt-fly': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 18, el: 26 }, bench: { kind: 'incline', angle: 38, yaw: 180 },
    frames: liftFirst(
      { root: { y: 0.62, z: 0.04, pitch: 52 }, lHip: [40, 10], rHip: [40, 10], lKn: 30, rKn: 30, pinL: [0.14, 0.085, -0.44], pinR: [-0.14, 0.085, -0.44], lSh: [52, 6], rSh: [52, 6], lEl: 16, rEl: 16, neck: -18 },
      { lSh: [52, 82], rSh: [52, 82], lEl: 18, rEl: 18 },
      { ecc: 2.0, con: 1.1 },
    ),
  },
  'db-pullover': {
    ground: 'fixed', dumbbells: 'twoHand', view: { az: 66, el: 18 }, bench: { kind: 'flat', z: 0.02 },
    frames: lowerFirst(
      { root: { y: 0.575, z: 0.1, ...SUPINE }, ...BENCH_FEET, lSh: [90, -8], rSh: [90, -8], lEl: 16, rEl: 16, neck: -4 },
      { lSh: [168, -8], rSh: [168, -8], lEl: 22, rEl: 22, chest: [-4] },
      { ecc: 2.3, con: 1.3, holdB: 0.4 },
    ),
  },
  'bent-over-row': {
    ground: 'stand', plant: ['lf', 'rf'], dumbbells: 'both', grip: 'neutral', view: { az: 78, el: 8 },
    frames: liftFirst(
      { ...STAND, root: { pitch: 48 }, spine: [2], lHip: [74, 6], rHip: [74, 6], lKn: 32, rKn: 32, lSh: [50, 6], rSh: [50, 6], lEl: 4, rEl: 4, neck: -28 },
      { lSh: [-8, 18], rSh: [-8, 18], lEl: 98, rEl: 98 },
      { ecc: 2.0, con: 1.0 },
    ),
  },

  // ── Arms ──────────────────────────────────────────────────
  'hammer-curl': {
    ground: 'stand', plant: ['lf', 'rf'], dumbbells: 'both', grip: 'neutral', view: { az: 40, el: 8 },
    frames: liftFirst(
      { ...STAND, lSh: [0, 7], rSh: [0, 7], lEl: 4, rEl: 4 },
      { lSh: [10, 7], rSh: [10, 7], lEl: 136, rEl: 136 },
      { ecc: 2.0, con: 1.0, holdB: 0.35 },
    ),
  },
  'alt-curl': {
    ground: 'stand', plant: ['lf', 'rf'], dumbbells: 'both', grip: 'supinated', view: { az: 34, el: 8 },
    frames: [
      { pose: { ...STAND, lSh: [0, 7], rSh: [0, 7], lEl: 4, rEl: 4 }, hold: 0.25, move: 1.8, phase: 'ecc', tension: 0.3 },
      { pose: { lSh: [10, 7], lEl: 138 }, move: 1.0, hold: 0.3, phase: 'con', tension: 1 },
      { pose: { lSh: [0, 7], lEl: 4 }, move: 1.8, hold: 0.25, phase: 'ecc', tension: 0.3 },
      { pose: { rSh: [10, 7], rEl: 138 }, move: 1.0, hold: 0.3, phase: 'con', tension: 1 },
    ],
  },
  'incline-curl': {
    ground: 'fixed', dumbbells: 'both', grip: 'supinated', view: { az: 66, el: 10 }, bench: { kind: 'incline', angle: 55 },
    frames: liftFirst(
      { root: { y: 0.57, z: 0.09, pitch: -35 }, ...SEAT_FEET, lHip: [58, 14], rHip: [58, 14], lSh: [-34, 8], rSh: [-34, 8], lEl: 4, rEl: 4, neck: -4 },
      { lSh: [-28, 8], rSh: [-28, 8], lEl: 132, rEl: 132 },
      { ecc: 2.2, con: 1.0 },
    ),
  },
  'overhead-triceps': {
    ground: 'fixed', dumbbells: 'twoHand', view: { az: 72, el: 8 }, bench: { kind: 'upright', angle: 80 },
    frames: lowerFirst(
      { root: { y: 0.575, z: 0.07, pitch: -8 }, ...SEAT_FEET, spine: [2], lSh: [170, -8], rSh: [170, -8], lEl: 6, rEl: 6, neck: 0 },
      { lSh: [164, -10], rSh: [164, -10], lEl: 122, rEl: 122 },
      { ecc: 2.0, con: 1.1 },
    ),
  },
  'skull-crusher': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 66, el: 18 }, bench: { kind: 'flat', z: 0.02 },
    frames: lowerFirst(
      { root: { y: 0.575, z: 0.1, ...SUPINE }, ...BENCH_FEET, lSh: [98, 3], rSh: [98, 3], lEl: 4, rEl: 4, neck: -4 },
      { lSh: [110, 3], rSh: [110, 3], lEl: 112, rEl: 112 },
      { ecc: 2.0, con: 1.0 },
    ),
  },

  // ── Core ──────────────────────────────────────────────────
  'dead-bug': {
    ground: 'floor', view: { az: 58, el: 24 }, idle: false,
    frames: [
      { pose: { root: { ...SUPINE }, lSh: [90, 6], rSh: [90, 6], lEl: 4, rEl: 4, lHip: [90, 6], rHip: [90, 6], lKn: 90, rKn: 90, lAnk: 8, rAnk: 8, neck: 10 }, hold: 0.3, move: 1.1, phase: 'con', tension: 0.5 },
      { pose: { lSh: [172, 6], rHip: [14, 6], rKn: 8 }, move: 1.6, hold: 0.4, phase: 'ecc', tension: 1 },
      { pose: { lSh: [90, 6], rHip: [90, 6], rKn: 90 }, move: 1.1, hold: 0.3, phase: 'con', tension: 0.5 },
      { pose: { rSh: [172, 6], lHip: [14, 6], lKn: 8 }, move: 1.6, hold: 0.4, phase: 'ecc', tension: 1 },
    ],
  },
  'side-plank': {
    ground: 'floor', view: { az: 6, el: 14 }, breath: 'free', idle: false,
    frames: [
      { pose: { root: { roll: 70 }, spine: [0, -4], lSh: [0, 92], lEl: 6, rSh: [6, 72], rEl: 92, lHip: [0, 0], rHip: [0, 0], lAnk: 0, rAnk: 0, neck: 0, headYaw: 0 }, hold: 1.2, move: 1.6, tension: 0.85 },
      { pose: { root: { roll: 66 }, spine: [0, 4] }, move: 1.8, hold: 1.2, tension: 1 },
    ],
  },
  plank: {
    ground: 'floor', view: { az: 72, el: 14 }, breath: 'free', idle: false,
    frames: [
      { pose: { root: { pitch: 81 }, lSh: [81, 9], rSh: [81, 9], lEl: 90, rEl: 90, lHip: [0, 3], rHip: [0, 3], lAnk: 72, rAnk: 72, neck: -6 }, hold: 1.4, move: 2, tension: 0.9 },
      { pose: { root: { pitch: 80 }, spine: [-1], lHip: [2, 3], rHip: [2, 3] }, move: 2, hold: 1.4, tension: 1 },
    ],
  },
  'reverse-crunch': {
    ground: 'fixed', view: { az: 64, el: 18 }, bench: { kind: 'flat', z: 0.1 },
    frames: [
      { pose: { root: { y: 0.575, z: 0.22, ...SUPINE }, lSh: [152, 20], rSh: [152, 20], lEl: 96, rEl: 96, lHip: [66, 4], rHip: [66, 4], lKn: 92, rKn: 92, lAnk: 20, rAnk: 20, neck: -4 }, hold: 0.4, move: 1.9, phase: 'ecc', tension: 0.4 },
      { pose: { root: { y: 0.66, z: 0.17, pitch: -112 }, spine: [20], chest: [2], lHip: [120, 4], rHip: [120, 4], lKn: 96, rKn: 96 }, hold: 0.35, move: 1.0, phase: 'con', tension: 1 },
    ],
  },

  // ── Warm-up ───────────────────────────────────────────────
  march: {
    ground: 'stand', anchor: 'none', view: { az: 40, el: 8 }, breath: 'free',
    frames: [
      { pose: { ...STAND, lHip: [62, 3], lKn: 76, lAnk: 12, rSh: [34, 8], rEl: 75, lSh: [-18, 8], lEl: 40 }, move: 0.5, hold: 0.06, tension: 0.6 },
      { pose: { lHip: [0, 3], lKn: 0, lAnk: undefined, rSh: [0, 8], rEl: 22, lSh: [0, 8], lEl: 22 }, move: 0.42, hold: 0, tension: 0.3 },
      { pose: { rHip: [62, 3], rKn: 76, rAnk: 12, lSh: [34, 8], lEl: 75, rSh: [-18, 8], rEl: 40 }, move: 0.5, hold: 0.06, tension: 0.6 },
      { pose: { rHip: [0, 3], rKn: 0, rAnk: undefined, rSh: [0, 8], rEl: 22, lSh: [0, 8], lEl: 22 }, move: 0.42, hold: 0, tension: 0.3 },
    ],
  },
  'arm-circles': {
    ground: 'stand', plant: ['lf', 'rf'], view: { az: 30, el: 8 }, breath: 'free',
    frames: [
      { pose: { ...STAND, lSh: [0, 150, 0], rSh: [0, 150, 0], lEl: 6, rEl: 6 }, move: 0.75, hold: 0, tension: 0.7 },
      { pose: { lSh: [0, 90, -55], rSh: [0, 90, -55] }, move: 0.75, hold: 0, tension: 0.5 },
      { pose: { lSh: [0, 32, 0], rSh: [0, 32, 0] }, move: 0.75, hold: 0, tension: 0.3 },
      { pose: { lSh: [0, 90, 55], rSh: [0, 90, 55] }, move: 0.75, hold: 0, tension: 0.6 },
    ],
  },
  'cat-cow': {
    ground: 'floor', plant: ['lh', 'rh'], view: { az: 82, el: 12 }, idle: false,
    frames: [
      { pose: { root: { pitch: 94 }, spine: [-14], chest: [-8], neck: -28, lSh: [84, 4], rSh: [84, 4], lEl: 0, rEl: 0, lHip: [94, 6], rHip: [94, 6], lKn: 90, rKn: 90, lFoot: 172, rFoot: 172 }, move: 2.0, hold: 0.7, phase: 'ecc', tension: 0.5 },
      { pose: { root: { pitch: 74, y: 1.04 }, spine: [20], chest: [16], neck: 26, lHip: [74, 6], rHip: [74, 6], lSh: [74, 4], rSh: [74, 4] }, move: 2.0, hold: 0.7, phase: 'con', tension: 1 },
    ],
  },
  'worlds-greatest': {
    ground: 'stand', anchor: 'l', view: { az: 50, el: 16 }, breath: 'free',
    frames: [
      { pose: { ...STAND, root: { pitch: 30 }, spine: [24], chest: [6], lHip: [112, 8], lKn: 104, rHip: [-12, 4], rKn: 14, pinR: [-0.12, 0.15, -1.0], rFoot: 35, pinRH: [-0.12, 0.05, 0.2], rSh: [60, 4], rEl: 4, lSh: [96, -14], lEl: 104, neck: -16 }, move: 1.4, hold: 0.8, tension: 0.6 },
      { pose: { spine: [20, -4, 30], chest: [2, 0, 34], lSh: [70, 120, 0], lEl: 4, neck: -2, headYaw: 30 }, move: 1.8, hold: 1.0, tension: 1 },
    ],
  },
  'wall-angel': {
    ground: 'stand', plant: ['lf', 'rf'], view: { az: 26, el: 8 }, breath: 'free',
    frames: [
      { pose: { ...STAND, chest: [-3], lSh: [90, 90, -72], rSh: [90, 90, -72], lEl: 8, rEl: 8 }, move: 1.6, hold: 0.4, tension: 0.6 },
      { pose: { lSh: [90, 90, 0], rSh: [90, 90, 0], lEl: 98, rEl: 98, chest: [-4] }, move: 1.6, hold: 0.5, tension: 1 },
    ],
  },

  // ── Cool-down ─────────────────────────────────────────────
  'hip-flexor-stretch': {
    ground: 'floor', plant: ['lf', 'rf'], view: { az: 82, el: 10 }, breath: 'free',
    frames: [
      { pose: { root: { pitch: 0 }, spine: [0], lHip: [86, 4], lKn: 88, rHip: [-6, 4], rKn: 84, rFoot: 172, lSh: [0, 8], rSh: [0, 8], lEl: 8, rEl: 8 }, move: 1.4, hold: 1.2, tension: 0.4 },
      { pose: { root: { z: 0.1, pitch: -4 }, spine: [-4], rSh: [165, 10], rEl: 8 }, move: 1.8, hold: 1.8, tension: 1 },
    ],
  },
  'hamstring-stretch': {
    ground: 'stand', anchor: 'r', view: { az: 82, el: 10 }, bench: { kind: 'flat', yaw: 90, z: 0.78 }, breath: 'free',
    frames: [
      { pose: { ...STAND, root: { x: -0.1 }, lHip: [62, 4], lKn: 4, pinL: [0.1, 0.52, 0.76], lAnk: -14, spine: [6], lSh: [28, 10], rSh: [28, 10], lEl: 10, rEl: 10 }, move: 1.4, hold: 1.0, tension: 0.4 },
      { pose: { root: { pitch: 30 }, rHip: [28, 4], spine: [6], chest: [2], lSh: [62, 10], rSh: [62, 10], neck: -16 }, move: 2.0, hold: 1.8, tension: 1 },
    ],
  },
  'figure-four': {
    ground: 'floor', view: { az: 40, el: 30 }, breath: 'free', idle: false,
    frames: [
      { pose: { root: { pitch: -90 }, rHip: [52, 4], rKn: 104, lHip: [64, 48, 66], lKn: 96, lAnk: 0, lSh: [8, 22], rSh: [8, 22], lEl: 10, rEl: 10 }, move: 1.4, hold: 1.4, tension: 0.4 },
      { pose: { rHip: [94, 4], rKn: 96, rAnk: 0, lHip: [102, 48, 66], lSh: [52, 12], rSh: [60, 8], lEl: 64, rEl: 64, neck: 8 }, move: 1.8, hold: 1.8, tension: 1 },
    ],
  },
  'childs-pose': {
    ground: 'fixed', view: { az: 76, el: 16 }, breath: 'free',
    frames: [
      { pose: { root: { y: 0.535, z: 0.0, pitch: 84 }, spine: [0], neck: -12, lSh: [84, 8], rSh: [84, 8], lEl: 0, rEl: 0, lHip: [84, 8], rHip: [84, 8], lKn: 90, rKn: 90, lFoot: 176, rFoot: 176, pinL: [0.11, 0.075, -0.49], pinR: [-0.11, 0.075, -0.49], pinLH: [0.16, 0.045, 0.7], pinRH: [-0.16, 0.045, 0.7] }, move: 0.9, hold: 0.8, tension: 0.4 },
      { pose: { root: { y: 0.474, z: -0.263, pitch: 87 }, spine: [6], chest: [3], neck: 0, lSh: [128, 9], rSh: [128, 9], lHip: [117, 9], rHip: [117, 9], lKn: 125, rKn: 125 }, move: 1.0, hold: 0, tension: 0.7 },
      { pose: { root: { y: 0.28, z: -0.44, pitch: 90 }, spine: [12], chest: [5], neck: 2, lSh: [170, 10], rSh: [170, 10], lHip: [150, 10], rHip: [150, 10], lKn: 160, rKn: 160 }, move: 1.2, hold: 2.0, tension: 1 },
      { pose: { root: { y: 0.474, z: -0.263, pitch: 87 }, spine: [6], chest: [3], neck: 0, lSh: [128, 9], rSh: [128, 9], lHip: [117, 9], rHip: [117, 9], lKn: 125, rKn: 125 }, move: 1.0, hold: 0, tension: 0.7 },
    ],
  },
  'chest-opener': {
    ground: 'stand', plant: ['lf', 'rf'], view: { az: 118, el: 10 }, breath: 'free', flatHands: false,
    frames: [
      { pose: { ...STAND, lSh: [-14, 10], rSh: [-14, 10], lEl: 12, rEl: 12, pinLH: [0.035, 0.8, -0.2], pinRH: [-0.035, 0.8, -0.2] }, move: 1.4, hold: 0.6, tension: 0.4 },
      { pose: { chest: [-12], neck: -12, lSh: [-44, 6], rSh: [-44, 6], lEl: 6, rEl: 6, pinLH: [0.035, 0.86, -0.38], pinRH: [-0.035, 0.86, -0.38] }, move: 1.8, hold: 1.8, tension: 1 },
    ],
  },
  breathing: {
    ground: 'floor', view: { az: 58, el: 26 }, idle: false,
    handsAt: { l: { bone: 'chest', at: [0.04, 0.17, 0.15] }, r: { bone: 'spine', at: [-0.03, 0.08, 0.14] } },
    frames: [
      { pose: { root: { pitch: -90 }, neck: 2, lHip: [46, 8], rHip: [46, 8], lKn: 96, rKn: 96, lSh: [20, 18], rSh: [20, 18], lEl: 110, rEl: 110, chest: [0], spine: [0] }, move: 4, hold: 4, phase: 'con', tension: 0.15 },
      { pose: { chest: [-4], spine: [-2] }, move: 4, hold: 4, phase: 'ecc', tension: 0.35 },
    ],
  },

  // ── Finishers ─────────────────────────────────────────────
  thruster: {
    ground: 'stand', plant: ['lf', 'rf'], dumbbells: 'both', grip: 'neutral', view: { az: 38, el: 8 },
    frames: [
      { pose: { ...STAND, lHip: [0, 10, 8], rHip: [0, 10, 8], lSh: [42, 22], rSh: [42, 22], lEl: 142, rEl: 142 }, move: 0.6, hold: 0.15, phase: 'ecc', tension: 0.4 },
      { pose: { root: { pitch: 18 }, spine: [8], lHip: [70, 12, 9], rHip: [70, 12, 9], lKn: 78, rKn: 78, neck: -16 }, move: 0.5, hold: 0, phase: 'ecc', tension: 0.7 },
      { pose: { root: { pitch: 22 }, spine: [12], lHip: [120, 15, 10], rHip: [120, 15, 10], lKn: 124, rKn: 124, neck: -28 }, move: 0.55, hold: 0.1, phase: 'ecc', tension: 0.9 },
      { pose: { root: { pitch: 18 }, spine: [8], lHip: [70, 12, 9], rHip: [70, 12, 9], lKn: 78, rKn: 78, neck: -16, lSh: [70, 18], rSh: [70, 18], lEl: 120, rEl: 120 }, move: 0.45, hold: 0, phase: 'con', tension: 1 },
      { pose: { root: { pitch: 0 }, spine: [0], lHip: [0, 10, 8], rHip: [0, 10, 8], lKn: 0, rKn: 0, lSh: [174, 10], rSh: [174, 10], lEl: 6, rEl: 6, neck: 0 }, move: 1.0, hold: 0.3, phase: 'con', tension: 1 },
    ],
  },
  'farmer-march': {
    ground: 'stand', anchor: 'none', dumbbells: 'both', grip: 'neutral', view: { az: 40, el: 8 },
    frames: [
      { pose: { ...STAND, ...SIDES, lHip: [58, 3], lKn: 68, lAnk: 12 }, move: 0.55, hold: 0.06, phase: 'con', tension: 1 },
      { pose: { lHip: [0, 3], lKn: 0, lAnk: undefined }, move: 0.45, hold: 0, phase: 'ecc', tension: 0.75 },
      { pose: { rHip: [58, 3], rKn: 68, rAnk: 12 }, move: 0.55, hold: 0.06, phase: 'con', tension: 1 },
      { pose: { rHip: [0, 3], rKn: 0, rAnk: undefined }, move: 0.45, hold: 0, phase: 'ecc', tension: 0.75 },
    ],
  },
  'mountain-climber': {
    ground: 'fixed', view: { az: 74, el: 12 }, bench: { kind: 'flat', yaw: 90, z: 0.95 }, breath: 'free', idle: false,
    frames: [
      { pose: { root: { y: 0.76, z: 0, pitch: 64 }, lSh: [64, 10], rSh: [64, 10], lEl: 2, rEl: 2, pinLH: [0.2, 0.5, 0.92], pinRH: [-0.2, 0.5, 0.92], neck: -12, lHip: [86, 4], lKn: 110, lAnk: 4, pinL: [0.1, 0.17, -0.78, 0], rHip: [4, 4], rKn: 4, pinR: [-0.1, 0.17, -0.78, 1], rFoot: 20 }, move: 0.45, hold: 0.05, tension: 1 },
      { pose: { rHip: [86, 4], rKn: 110, rAnk: 4, rFoot: 0, pinR: [-0.1, 0.17, -0.78, 0], lHip: [4, 4], lKn: 4, lAnk: undefined, lFoot: 20, pinL: [0.1, 0.17, -0.78, 1] }, move: 0.45, hold: 0.05, tension: 1 },
    ],
  },
};
