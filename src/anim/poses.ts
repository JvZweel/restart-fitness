import type { AnimSpec, Pose } from './types';

/*
 * Keyframed poses for every exercise, warm-up move, stretch and finisher.
 * Angles in degrees. Shoulder/hip tuples = [flex(+forward), abduct(+out), twist].
 * Spine/chest = [pitch(+forward), roll, yaw]. Root pitch: -90 = lying face up, +90 = face down.
 * Frames merge onto the previous frame, so later frames only list what changes.
 */

const ARMS_DOWN: Pose = { lSh: [0, 8], rSh: [0, 8], lEl: 8, rEl: 8 };
const STAND: Pose = { ...ARMS_DOWN, spine: [0], chest: [0], lHip: [0, 4], rHip: [0, 4], lKn: 0, rKn: 0, neck: 0 };
const GOBLET_ARMS: Pose = { lSh: [28, -6], rSh: [28, -6], lEl: 150, rEl: 150 };
const SUPINE = { pitch: -90 };
/** Feet planted on the floor in front of a flat bench (bench origin z ≈ 0). */
const BENCH_FEET: Pose = { pinL: [0.2, 0.085, 0.7], pinR: [-0.2, 0.085, 0.7] };
const SEAT_FEET: Pose = { pinL: [0.2, 0.085, 0.62], pinR: [-0.2, 0.085, 0.62] };
const PRONE = { pitch: 90 };

export const ANIMS: Record<string, AnimSpec> = {
  // ── Knee dominant ─────────────────────────────────────────
  'goblet-squat': {
    ground: 'stand', dumbbells: 'goblet', view: { az: 40 },
    frames: [
      { pose: { ...STAND, ...GOBLET_ARMS, lHip: [0, 12, 0], rHip: [0, 12, 0] }, hold: 0.4 },
      { pose: { spine: [28], chest: [6], lHip: [100, 18], rHip: [100, 18], lKn: 122, rKn: 122, neck: -18 }, move: 1.4, hold: 0.35 },
    ],
  },
  'bw-squat': {
    ground: 'stand', view: { az: 40 },
    frames: [
      { pose: { ...STAND, lHip: [0, 12], rHip: [0, 12] }, hold: 0.3 },
      { pose: { spine: [28], chest: [6], lHip: [102, 18], rHip: [102, 18], lKn: 124, rKn: 124, lSh: [85, 8], rSh: [85, 8], lEl: 5, rEl: 5, neck: -18 }, move: 1.5, hold: 0.6 },
    ],
  },
  'bulgarian-split-squat': {
    ground: 'stand', anchor: 'l', dumbbells: 'both', grip: 'neutral', view: { az: 75 },
    bench: { kind: 'flat', z: -1.05 },
    frames: [
      { pose: { ...ARMS_DOWN, spine: [8], lHip: [16, 3], lKn: 10, rHip: [0, 4], pinR: [-0.1, 0.52, -0.66], rFoot: 160 }, hold: 0.3 },
      { pose: { spine: [16], lHip: [78, 3], lKn: 92 }, move: 1.4, hold: 0.3 },
    ],
  },
  'reverse-lunge': {
    ground: 'stand', anchor: 'l', dumbbells: 'both', grip: 'neutral', view: { az: 75 },
    frames: [
      { pose: { ...STAND, rAnk: undefined }, hold: 0.35 },
      { pose: { spine: [8], lHip: [80, 3], lKn: 92, rHip: [-22, 3], rKn: 100, rAnk: 62 }, move: 1.3, hold: 0.35 },
    ],
  },
  'step-up': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 70 },
    bench: { kind: 'flat', z: 0.42, yaw: 90 },
    frames: [
      { pose: { ...ARMS_DOWN, root: { y: 0.98, z: 0.0 }, spine: [14], lHip: [0, 3], rHip: [0, 3], pinL: [0.1, 0.53, 0.4, 1], pinR: [-0.1, 0.085, -0.04, 1] }, hold: 0.3 },
      { pose: { root: { y: 1.44, z: 0.36 }, spine: [4], rHip: [-6, 3], rKn: 50, pinR: [-0.1, 0.085, -0.04, 0], rFoot: 30 }, move: 1.3, hold: 0.35 },
    ],
  },

  // ── Hinge ─────────────────────────────────────────────────
  'db-rdl': {
    ground: 'stand', dumbbells: 'both', view: { az: 80 },
    frames: [
      { pose: { ...STAND, lSh: [0, 4], rSh: [0, 4], lEl: 4, rEl: 4, lKn: 8, rKn: 8 }, hold: 0.3 },
      { pose: { spine: [62], chest: [8], lHip: [16, 4], rHip: [16, 4], lKn: 20, rKn: 20, lSh: [68, 4], rSh: [68, 4], neck: -25 }, move: 1.5, hold: 0.35 },
    ],
  },
  'good-morning': {
    ground: 'stand', view: { az: 80 },
    frames: [
      { pose: { ...STAND, lSh: [-30, 38, 0], rSh: [-30, 38, 0], lEl: 110, rEl: 110, lKn: 8, rKn: 8 }, hold: 0.3 },
      { pose: { spine: [58], chest: [8], lHip: [16, 4], rHip: [16, 4], lKn: 18, rKn: 18, neck: -22 }, move: 1.4, hold: 0.4 },
    ],
  },
  'hip-thrust': {
    ground: 'fixed', dumbbells: 'hips', view: { az: 70, el: 14 },
    bench: { kind: 'flat', z: -0.56, yaw: 90 },
    frames: [
      { pose: { root: { y: 0.24, z: -0.08, pitch: -48 }, spine: [-6], chest: [-4], neck: 20, lHip: [0, 12], rHip: [0, 12], pinL: [0.17, 0.085, 0.44], pinR: [-0.17, 0.085, 0.44], lSh: [40, 16], rSh: [40, 16], lEl: 105, rEl: 105 }, hold: 0.3 },
      { pose: { root: { y: 0.5, z: 0.0, pitch: -90 }, spine: [0], chest: [0], neck: 38 }, move: 1.2, hold: 0.6 },
    ],
  },
  'sumo-deadlift': {
    ground: 'stand', dumbbells: 'twoHand', view: { az: 35 },
    frames: [
      { pose: { ...STAND, lHip: [0, 22, 30], rHip: [0, 22, 30], lSh: [0, -10], rSh: [0, -10], lEl: 2, rEl: 2 }, hold: 0.3 },
      { pose: { spine: [42], chest: [6], lHip: [72, 30, 30], rHip: [72, 30, 30], lKn: 82, rKn: 82, lSh: [40, -10], rSh: [40, -10], neck: -22 }, move: 1.4, hold: 0.35 },
    ],
  },
  'single-leg-rdl': {
    ground: 'stand', anchor: 'l', dumbbells: 'r', view: { az: 80 },
    frames: [
      { pose: { ...STAND, lKn: 10, rHip: [0, 4], rKn: 10 }, hold: 0.3 },
      { pose: { spine: [70], chest: [4], lHip: [12, 4], lKn: 18, rHip: [-60, 4], rKn: 6, rSh: [76, 4], lSh: [55, 30], lEl: 10, neck: -25 }, move: 1.6, hold: 0.4 },
    ],
  },

  // ── Push ──────────────────────────────────────────────────
  'flat-db-press': {
    ground: 'fixed', dumbbells: 'both', view: { az: 62, el: 20 }, bench: { kind: 'flat', z: 0.02 },
    frames: [
      { pose: { root: { y: 0.59, z: 0.1, ...SUPINE }, ...BENCH_FEET, lHip: [20, 14], rHip: [20, 14], lSh: [10, 70], rSh: [10, 70], lEl: 88, rEl: 88 }, hold: 0.25 },
      { pose: { lSh: [88, 6], rSh: [88, 6], lEl: 4, rEl: 4 }, move: 1.1, hold: 0.35 },
    ],
  },
  'close-grip-press': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 62, el: 20 }, bench: { kind: 'flat', z: 0.02 },
    frames: [
      { pose: { root: { y: 0.59, z: 0.1, ...SUPINE }, ...BENCH_FEET, lHip: [20, 14], rHip: [20, 14], lSh: [24, 14], rSh: [24, 14], lEl: 110, rEl: 110 }, hold: 0.25 },
      { pose: { lSh: [88, -4], rSh: [88, -4], lEl: 4, rEl: 4 }, move: 1.1, hold: 0.35 },
    ],
  },
  'incline-db-press': {
    ground: 'fixed', dumbbells: 'both', view: { az: 60, el: 14 }, bench: { kind: 'incline', angle: 38 },
    frames: [
      { pose: { root: { y: 0.6, z: 0.08, pitch: -52 }, ...SEAT_FEET, lHip: [50, 14], rHip: [50, 14], lSh: [-6, 72], rSh: [-6, 72], lEl: 92, rEl: 92 }, hold: 0.25 },
      { pose: { lSh: [96, 8], rSh: [96, 8], lEl: 4, rEl: 4 }, move: 1.1, hold: 0.35 },
    ],
  },
  'decline-db-press': {
    ground: 'fixed', dumbbells: 'both', view: { az: 62, el: 20 }, bench: { kind: 'decline', angle: -14 },
    frames: [
      { pose: { root: { y: 0.6, z: 0.1, pitch: -104 }, lHip: [100, 6], rHip: [100, 6], lKn: 110, rKn: 110, lFoot: 10, rFoot: 10, lSh: [18, 68], rSh: [18, 68], lEl: 86, rEl: 86 }, hold: 0.25 },
      { pose: { lSh: [82, 6], rSh: [82, 6], lEl: 4, rEl: 4 }, move: 1.1, hold: 0.35 },
    ],
  },
  'seated-shoulder-press': {
    ground: 'fixed', dumbbells: 'both', view: { az: 30, el: 10 }, bench: { kind: 'upright', angle: 80 },
    frames: [
      { pose: { root: { y: 0.6, z: 0.07, pitch: -6 }, ...SEAT_FEET, lHip: [80, 14], rHip: [80, 14], lSh: [10, 82], rSh: [10, 82], lEl: 100, rEl: 100 }, hold: 0.25 },
      { pose: { lSh: [10, 168], rSh: [10, 168], lEl: 6, rEl: 6 }, move: 1.1, hold: 0.35 },
    ],
  },
  'push-up': {
    ground: 'floor', view: { az: 72, el: 14 },
    frames: [
      { pose: { root: { ...PRONE, pitch: 74 }, lSh: [74, 12], rSh: [74, 12], lEl: 2, rEl: 2, lHip: [0, 3], rHip: [0, 3], lKn: 0, rKn: 0, lAnk: 70, rAnk: 70, neck: -6 }, hold: 0.3 },
      { pose: { root: { pitch: 86 }, lSh: [28, 36], rSh: [28, 36], lEl: 92, rEl: 92 }, move: 1.1, hold: 0.25 },
    ],
  },

  // ── Pull ──────────────────────────────────────────────────
  'one-arm-row': {
    ground: 'fixed', dumbbells: 'r', grip: 'neutral', view: { az: 300, el: 16 }, bench: { kind: 'flat', x: 0.1, z: 0.12 },
    frames: [
      { pose: { root: { y: 0.98, x: 0, z: 0, pitch: 78 }, spine: [4], neck: -8, lHip: [78, 2], lKn: 90, lFoot: 180, rHip: [0, 16], pinR: [-0.32, 0.085, 0.12], lSh: [84, 4], lEl: 8, rSh: [84, 4], rEl: 4 }, hold: 0.3 },
      { pose: { rSh: [10, 12], rEl: 100 }, move: 1.0, hold: 0.35 },
    ],
  },
  'chest-supported-row': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 62, el: 14 }, bench: { kind: 'incline', angle: 38, yaw: 180, z: 0.0 },
    frames: [
      { pose: { root: { y: 0.66, z: 0.06, pitch: 52 }, lHip: [40, 10], rHip: [40, 10], lKn: 30, rKn: 30, lSh: [56, 8], rSh: [56, 8], lEl: 4, rEl: 4, neck: -14 }, hold: 0.3 },
      { pose: { lSh: [-4, 22], rSh: [-4, 22], lEl: 94, rEl: 94 }, move: 1.0, hold: 0.4 },
    ],
  },
  'rear-delt-fly': {
    ground: 'fixed', dumbbells: 'both', view: { az: 20, el: 26 }, bench: { kind: 'incline', angle: 38, yaw: 180, z: 0.0 },
    frames: [
      { pose: { root: { y: 0.66, z: 0.06, pitch: 52 }, lHip: [40, 10], rHip: [40, 10], lKn: 30, rKn: 30, lSh: [52, 4], rSh: [52, 4], lEl: 16, rEl: 16, neck: -14 }, hold: 0.25 },
      { pose: { lSh: [50, 84], rSh: [50, 84] }, move: 1.0, hold: 0.4 },
    ],
  },
  'db-pullover': {
    ground: 'fixed', dumbbells: 'twoHand', view: { az: 64, el: 18 }, bench: { kind: 'flat', z: 0.02 },
    frames: [
      { pose: { root: { y: 0.59, z: 0.1, ...SUPINE }, ...BENCH_FEET, lHip: [20, 14], rHip: [20, 14], lSh: [88, -18], rSh: [88, -18], lEl: 18, rEl: 18 }, hold: 0.3 },
      { pose: { lSh: [168, -18], rSh: [168, -18], lEl: 24, rEl: 24 }, move: 1.4, hold: 0.35 },
    ],
  },
  'bent-over-row': {
    ground: 'stand', dumbbells: 'both', grip: 'neutral', view: { az: 75 },
    frames: [
      { pose: { ...STAND, spine: [52], chest: [4], lHip: [18, 6], rHip: [18, 6], lKn: 24, rKn: 24, lSh: [56, 8], rSh: [56, 8], lEl: 4, rEl: 4, neck: -24 }, hold: 0.3 },
      { pose: { lSh: [-6, 20], rSh: [-6, 20], lEl: 96, rEl: 96 }, move: 1.0, hold: 0.35 },
    ],
  },

  // ── Arms ──────────────────────────────────────────────────
  'hammer-curl': {
    ground: 'stand', dumbbells: 'both', grip: 'neutral', view: { az: 40 },
    frames: [
      { pose: { ...STAND, lSh: [0, 6], rSh: [0, 6], lEl: 4, rEl: 4 }, hold: 0.3 },
      { pose: { lSh: [12, 6], rSh: [12, 6], lEl: 138, rEl: 138 }, move: 1.0, hold: 0.35 },
    ],
  },
  'alt-curl': {
    ground: 'stand', dumbbells: 'both', view: { az: 35 },
    frames: [
      { pose: { ...STAND, lSh: [0, 6], rSh: [0, 6], lEl: 4, rEl: 4 }, hold: 0.25 },
      { pose: { lSh: [12, 6], lEl: 140 }, move: 0.9, hold: 0.3 },
      { pose: { lSh: [0, 6], lEl: 4 }, move: 0.9, hold: 0.2 },
      { pose: { rSh: [12, 6], rEl: 140 }, move: 0.9, hold: 0.3 },
    ],
  },
  'incline-curl': {
    ground: 'fixed', dumbbells: 'both', view: { az: 64, el: 10 }, bench: { kind: 'incline', angle: 55 },
    frames: [
      { pose: { root: { y: 0.6, z: 0.08, pitch: -35 }, ...SEAT_FEET, lHip: [50, 14], rHip: [50, 14], lSh: [-35, 10], rSh: [-35, 10], lEl: 4, rEl: 4 }, hold: 0.3 },
      { pose: { lSh: [-28, 10], rSh: [-28, 10], lEl: 135, rEl: 135 }, move: 1.1, hold: 0.35 },
    ],
  },
  'overhead-triceps': {
    ground: 'fixed', dumbbells: 'twoHand', view: { az: 70, el: 8 }, bench: { kind: 'upright', angle: 80 },
    frames: [
      { pose: { root: { y: 0.6, z: 0.07, pitch: -6 }, ...SEAT_FEET, lHip: [80, 14], rHip: [80, 14], lSh: [168, -16], rSh: [168, -16], lEl: 4, rEl: 4 }, hold: 0.3 },
      { pose: { lSh: [160, -16], rSh: [160, -16], lEl: 124, rEl: 124 }, move: 1.2, hold: 0.3 },
    ],
  },
  'skull-crusher': {
    ground: 'fixed', dumbbells: 'both', grip: 'neutral', view: { az: 64, el: 18 }, bench: { kind: 'flat', z: 0.02 },
    frames: [
      { pose: { root: { y: 0.59, z: 0.1, ...SUPINE }, ...BENCH_FEET, lHip: [20, 14], rHip: [20, 14], lSh: [95, 4], rSh: [95, 4], lEl: 4, rEl: 4 }, hold: 0.3 },
      { pose: { lSh: [112, 4], rSh: [112, 4], lEl: 112, rEl: 112 }, move: 1.1, hold: 0.3 },
    ],
  },

  // ── Core ──────────────────────────────────────────────────
  'dead-bug': {
    ground: 'floor', view: { az: 60, el: 22 },
    frames: [
      { pose: { root: { ...SUPINE }, lSh: [90, 6], rSh: [90, 6], lEl: 4, rEl: 4, lHip: [90, 6], rHip: [90, 6], lKn: 90, rKn: 90, lAnk: 0, rAnk: 0 }, hold: 0.3 },
      { pose: { lSh: [172, 6], rHip: [10, 6], rKn: 8 }, move: 1.2, hold: 0.3 },
      { pose: { lSh: [90, 6], rHip: [90, 6], rKn: 90 }, move: 1.1, hold: 0.25 },
      { pose: { rSh: [172, 6], lHip: [10, 6], lKn: 8 }, move: 1.2, hold: 0.3 },
      { pose: { rSh: [90, 6], lHip: [90, 6], lKn: 90 }, move: 1.1, hold: 0.25 },
    ],
  },
  'side-plank': {
    ground: 'floor', view: { az: 8, el: 14 },
    frames: [
      { pose: { root: { roll: 72 }, spine: [0, -4], lSh: [0, 96], lEl: 4, rSh: [4, 74], rEl: 90, lHip: [0, 0], rHip: [0, 0], lAnk: 0, rAnk: 0 }, hold: 0.8 },
      { pose: { root: { roll: 66 }, spine: [0, 6] }, move: 1.6, hold: 0.8 },
    ],
  },
  plank: {
    ground: 'floor', view: { az: 70, el: 14 },
    frames: [
      { pose: { root: { pitch: 80 }, lSh: [80, 10], rSh: [80, 10], lEl: 92, rEl: 92, lHip: [0, 3], rHip: [0, 3], lAnk: 70, rAnk: 70, neck: -4 }, hold: 1.2 },
      { pose: { root: { pitch: 78 }, lHip: [4, 3], rHip: [4, 3] }, move: 2, hold: 1.2 },
    ],
  },
  'reverse-crunch': {
    ground: 'fixed', view: { az: 62, el: 18 }, bench: { kind: 'flat', z: 0.1 },
    frames: [
      { pose: { root: { y: 0.57, z: 0.22, ...SUPINE }, lSh: [150, 22], rSh: [150, 22], lEl: 100, rEl: 100, lHip: [62, 4], rHip: [62, 4], lKn: 90, rKn: 90, lAnk: 20, rAnk: 20 }, hold: 0.3 },
      { pose: { root: { y: 0.62, z: 0.18, pitch: -112 }, lHip: [118, 4], rHip: [118, 4], lKn: 96, rKn: 96 }, move: 1.1, hold: 0.35 },
    ],
  },

  // ── Warm-up ───────────────────────────────────────────────
  march: {
    ground: 'stand', anchor: 'none', view: { az: 40 },
    frames: [
      { pose: { ...STAND, lHip: [62, 3], lKn: 75, lAnk: 10, rSh: [32, 8], rEl: 75, lSh: [-18, 8], lEl: 40 }, move: 0.5, hold: 0.05 },
      { pose: { lHip: [0, 3], lKn: 0, lAnk: undefined, rSh: [0, 8], rEl: 20, lSh: [0, 8], lEl: 20 }, move: 0.4, hold: 0 },
      { pose: { rHip: [62, 3], rKn: 75, rAnk: 10, lSh: [32, 8], lEl: 75, rSh: [-18, 8], rEl: 40 }, move: 0.5, hold: 0.05 },
      { pose: { rHip: [0, 3], rKn: 0, rAnk: undefined, rSh: [0, 8], rEl: 20, lSh: [0, 8], lEl: 20 }, move: 0.4, hold: 0 },
    ],
  },
  'arm-circles': {
    ground: 'stand', view: { az: 25 },
    frames: [
      { pose: { ...STAND, lSh: [0, 20], rSh: [0, 20], lEl: 4, rEl: 4 }, move: 0.6, hold: 0 },
      { pose: { lSh: [90, 30], rSh: [90, 30] }, move: 0.6, hold: 0 },
      { pose: { lSh: [170, 20], rSh: [170, 20] }, move: 0.6, hold: 0 },
      { pose: { lSh: [10, 100], rSh: [10, 100] }, move: 0.6, hold: 0 },
    ],
  },
  'cat-cow': {
    ground: 'floor', view: { az: 80, el: 12 },
    frames: [
      { pose: { root: { pitch: 80 }, spine: [-12], chest: [-10], neck: -26, lSh: [58, 4], rSh: [58, 4], lEl: 0, rEl: 0, lHip: [80, 6], rHip: [80, 6], lKn: 90, rKn: 90, lFoot: 175, rFoot: 175 }, move: 1.6, hold: 0.6 },
      { pose: { spine: [16], chest: [16], neck: 30, lSh: [112, 4], rSh: [112, 4] }, move: 1.6, hold: 0.6 },
    ],
  },
  'worlds-greatest': {
    ground: 'stand', anchor: 'l', view: { az: 55, el: 14 },
    frames: [
      { pose: { ...STAND, spine: [45], lHip: [100, 6], lKn: 100, rHip: [-30, 4], rKn: 20, rAnk: 40, lSh: [70, 4], rSh: [85, 4], lEl: 40, rEl: 4, neck: -10 }, move: 1.2, hold: 0.6 },
      { pose: { spine: [40, 0, 50], chest: [0, 0, 30], lSh: [170, 10], lEl: 4, neck: 0 }, move: 1.4, hold: 0.8 },
    ],
  },
  'wall-angel': {
    ground: 'stand', view: { az: 25 },
    frames: [
      { pose: { ...STAND, lSh: [10, 168], rSh: [10, 168], lEl: 6, rEl: 6, chest: [-4] }, move: 1.2, hold: 0.4 },
      { pose: { lSh: [10, 80], rSh: [10, 80], lEl: 95, rEl: 95 }, move: 1.2, hold: 0.4 },
    ],
  },

  // ── Cool-down ─────────────────────────────────────────────
  'hip-flexor-stretch': {
    ground: 'floor', view: { az: 80, el: 10 },
    frames: [
      { pose: { root: { pitch: 0 }, spine: [0], lHip: [88, 4], lKn: 88, rHip: [-12, 4], rKn: 92, rAnk: 70, lSh: [0, 8], rSh: [0, 8], lEl: 8, rEl: 8 }, move: 1.2, hold: 1.2 },
      { pose: { spine: [-6], lHip: [96, 4], lKn: 80, rHip: [-24, 4], lSh: [170, 8], rSh: [8, 8] }, move: 1.6, hold: 1.6 },
    ],
  },
  'hamstring-stretch': {
    ground: 'stand', anchor: 'r', view: { az: 80, el: 10 }, bench: { kind: 'flat', yaw: 90, z: 0.72 },
    frames: [
      { pose: { ...STAND, lHip: [80, 4], lKn: 6, lAnk: -12, spine: [10], lSh: [30, 10], rSh: [30, 10] }, move: 1.2, hold: 0.8 },
      { pose: { spine: [42], chest: [6], lSh: [70, 10], rSh: [70, 10], neck: -14 }, move: 1.6, hold: 1.6 },
    ],
  },
  'figure-four': {
    ground: 'floor', view: { az: 40, el: 30 },
    frames: [
      { pose: { root: { pitch: -90 }, rHip: [50, 4], rKn: 100, lHip: [62, 50, 70], lKn: 95, lAnk: 0, lSh: [8, 22], rSh: [8, 22], lEl: 10, rEl: 10 }, move: 1.2, hold: 1.4 },
      { pose: { rHip: [92, 4], rKn: 96, rAnk: 0, lHip: [100, 50, 70], lSh: [50, 12], rSh: [58, 8], lEl: 60, rEl: 60 }, move: 1.6, hold: 1.6 },
    ],
  },
  'childs-pose': {
    ground: 'floor', view: { az: 75, el: 16 },
    frames: [
      { pose: { root: { pitch: 82 }, spine: [0], neck: 0, lSh: [82, 6], rSh: [82, 6], lEl: 0, rEl: 0, lHip: [82, 8], rHip: [82, 8], lKn: 90, rKn: 90, lFoot: 175, rFoot: 175 }, move: 1.4, hold: 0.6 },
      { pose: { root: { pitch: 100 }, spine: [6], neck: 6, lSh: [194, 10], rSh: [194, 10], lHip: [136, 12], rHip: [136, 12], lKn: 128, rKn: 128 }, move: 1.8, hold: 1.8 },
    ],
  },
  'chest-opener': {
    ground: 'stand', view: { az: 120, el: 10 },
    frames: [
      { pose: { ...STAND, lSh: [-10, 12], rSh: [-10, 12], lEl: 10, rEl: 10 }, move: 1.2, hold: 0.6 },
      { pose: { chest: [-12], neck: -14, lSh: [-48, -8], rSh: [-48, -8], lEl: 6, rEl: 6 }, move: 1.6, hold: 1.8 },
    ],
  },
  breathing: {
    ground: 'floor', view: { az: 60, el: 24 },
    frames: [
      { pose: { root: { pitch: -90 }, neck: 0, lHip: [45, 8], rHip: [45, 8], lKn: 95, rKn: 95, lSh: [6, 18], rSh: [6, 18], lEl: 10, rEl: 10, chest: [0] }, move: 2, hold: 2 },
      { pose: { chest: [-5], spine: [-3], lSh: [6, 22], rSh: [6, 22] }, move: 2, hold: 2 },
    ],
  },

  // ── Finishers ─────────────────────────────────────────────
  thruster: {
    ground: 'stand', dumbbells: 'both', grip: 'neutral', view: { az: 40 },
    frames: [
      { pose: { ...STAND, lHip: [0, 12], rHip: [0, 12], lSh: [30, 30], rSh: [30, 30], lEl: 140, rEl: 140 }, move: 0.6, hold: 0.1 },
      { pose: { spine: [24], lHip: [96, 18], rHip: [96, 18], lKn: 112, rKn: 112, neck: -14 }, move: 0.8, hold: 0.1 },
      { pose: { spine: [0], lHip: [0, 12], rHip: [0, 12], lKn: 0, rKn: 0, lSh: [170, 14], rSh: [170, 14], lEl: 6, rEl: 6, neck: 0 }, move: 0.7, hold: 0.25 },
    ],
  },
  'farmer-march': {
    ground: 'stand', anchor: 'none', dumbbells: 'both', grip: 'neutral', view: { az: 40 },
    frames: [
      { pose: { ...STAND, lSh: [0, 10], rSh: [0, 10], lEl: 4, rEl: 4, lHip: [60, 3], lKn: 70, lAnk: 10 }, move: 0.55, hold: 0.05 },
      { pose: { lHip: [0, 3], lKn: 0, lAnk: undefined }, move: 0.45, hold: 0 },
      { pose: { rHip: [60, 3], rKn: 70, rAnk: 10 }, move: 0.55, hold: 0.05 },
      { pose: { rHip: [0, 3], rKn: 0, rAnk: undefined }, move: 0.45, hold: 0 },
    ],
  },
  'mountain-climber': {
    ground: 'fixed', view: { az: 72, el: 12 }, bench: { kind: 'flat', yaw: 90, z: 0.95 },
    frames: [
      { pose: { root: { y: 0.74, z: 0, pitch: 64 }, lSh: [100, 10], rSh: [100, 10], lEl: 2, rEl: 2, neck: -10, lHip: [80, 4], lKn: 95, lFoot: 40, pinL: [0.1, 0.085, -0.82, 0], pinR: [-0.1, 0.085, -0.82, 1], rFoot: 40 }, move: 0.45, hold: 0.05 },
      { pose: { rHip: [80, 4], rKn: 95, pinL: [0.1, 0.085, -0.82, 1], pinR: [-0.1, 0.085, -0.82, 0] }, move: 0.45, hold: 0.05 },
    ],
  },
};
