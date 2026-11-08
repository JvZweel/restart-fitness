import type { Muscle } from '../domain/types';

export type Pin = [number, number, number, number?];

/** Joint angles in degrees. Limb tuples are [flex, abduct, twist]; spine/chest are [pitch, roll, yaw]. */
export interface Pose {
  root?: { x?: number; y?: number; z?: number; pitch?: number; roll?: number; yaw?: number };
  /** Lumbar + lower thoracic; split across two vertebral segments by the rig. */
  spine?: [number, number?, number?];
  chest?: [number, number?, number?];
  /** Head pitch (+ = chin down). */
  neck?: number;
  /** Head turn (+ = toward the figure's left). */
  headYaw?: number;
  /** Shoulder girdle [elevation, protraction] in degrees. Added on top of automatic scapulohumeral rhythm. */
  lClav?: [number, number?];
  rClav?: [number, number?];
  lSh?: [number, number?, number?];
  rSh?: [number, number?, number?];
  lEl?: number;
  rEl?: number;
  /** Wrist flexion (+ = palm side). Neutral is 0. */
  lWr?: number;
  rWr?: number;
  lHip?: [number, number?, number?];
  rHip?: [number, number?, number?];
  lKn?: number;
  rKn?: number;
  /** Local ankle angle (deg). When set it wins over the world foot pitch. */
  lAnk?: number;
  rAnk?: number;
  /** World foot pitch (deg; 0 = flat on the floor, + = toes down). Default 0 (auto-flat). */
  lFoot?: number;
  rFoot?: number;
  /** Pin the ankle to a world point [x, y, z, weight] with two-bone IK (weight 0..1 blends with FK). */
  pinL?: Pin;
  pinR?: Pin;
  /** Pin the wrist to a world point [x, y, z, weight] with two-bone IK. */
  pinLH?: Pin;
  pinRH?: Pin;
}

export type Ground = 'stand' | 'floor' | 'fixed';
export type BenchKind = 'flat' | 'incline' | 'decline' | 'upright';
/** Movement phase of the motion that arrives at a keyframe. */
export type Phase = 'ecc' | 'con' | 'flow';
export type Limb = 'lh' | 'rh' | 'lf' | 'rf';

export interface Keyframe {
  pose: Pose;
  /** Hold time at this pose (s). */
  hold?: number;
  /** Duration of the motion that arrives at this pose (s). */
  move?: number;
  /** Lowering (eccentric), lifting (concentric) or free flow. Drives breathing and labels. */
  phase?: Phase;
  /** Muscle tension at this pose 0..1 (drives the muscle glow). */
  tension?: number;
}

export interface AnimSpec {
  frames: Keyframe[];
  ground: Ground;
  /** For 'stand': which foot is planted horizontally at x/z = 0 (default: both feet averaged). */
  anchor?: 'feet' | 'l' | 'r' | 'none';
  bench?: { kind: BenchKind; angle?: number; x?: number; z?: number; yaw?: number };
  /** Dumbbells: one per hand, held at the chest (goblet), held by both hands, or across the hips. */
  dumbbells?: 'both' | 'l' | 'r' | 'goblet' | 'twoHand' | 'hips' | 'none';
  grip?: 'pronated' | 'neutral' | 'supinated';
  /** Limbs whose end point stays planted where it is in `plantFrame` (two-bone IK every frame). */
  plant?: Limb[];
  plantFrame?: number;
  /** Planted hands lie palm-down on the support (default true for planted hands). */
  flatHands?: boolean;
  /** Camera: azimuth/elevation (deg), zoom (>1 = closer), orbit amplitude (deg) for the gentle auto-orbit. */
  view?: { az?: number; el?: number; zoom?: number; orbit?: number };
  /** Breathing: tied to the lift phases (exhale on the effort) or free relaxed breathing. */
  breath?: 'phase' | 'free';
  /** Subtle idle sway/gaze. Default on for standing moves. */
  idle?: boolean;
  muscles?: { primary: Muscle[]; secondary?: Muscle[] };
}
