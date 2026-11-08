import type { Muscle } from '../domain/types';

/** Joint angles in degrees. Limb tuples are [flex, abduct, twist]; spine/chest are [pitch, roll, yaw]. */
export interface Pose {
  root?: { x?: number; y?: number; z?: number; pitch?: number; roll?: number; yaw?: number };
  spine?: [number, number?, number?];
  chest?: [number, number?, number?];
  neck?: number;
  lSh?: [number, number?, number?];
  rSh?: [number, number?, number?];
  lEl?: number;
  rEl?: number;
  lHip?: [number, number?, number?];
  rHip?: [number, number?, number?];
  lKn?: number;
  rKn?: number;
  lAnk?: number;
  rAnk?: number;
  /** World foot pitch (deg; 0 = flat on the floor). Overrides the local ankle angle. */
  lFoot?: number;
  rFoot?: number;
  /** Pin the ankle to a world point [x, y, z, weight] with 2-bone IK (weight 0..1 blends with FK). */
  pinL?: [number, number, number, number?];
  pinR?: [number, number, number, number?];
}

export type Ground = 'stand' | 'floor' | 'fixed';
export type BenchKind = 'flat' | 'incline' | 'decline' | 'upright';

export interface Keyframe { pose: Pose; hold?: number; move?: number }

export interface AnimSpec {
  frames: Keyframe[];
  ground: Ground;
  /** For 'stand': which foot is planted horizontally at x/z = 0 (default: both feet averaged). */
  anchor?: 'feet' | 'l' | 'r' | 'none';
  bench?: { kind: BenchKind; angle?: number; x?: number; z?: number; yaw?: number };
  /** Dumbbells: in each hand, one held at chest (goblet), one with both hands, or across the hips. */
  dumbbells?: 'both' | 'l' | 'r' | 'goblet' | 'twoHand' | 'hips' | 'none';
  grip?: 'pronated' | 'neutral';
  view?: { az?: number; el?: number };
  /** Mirror to show the other side halfway through (per-side moves). */
  muscles?: { primary: Muscle[]; secondary?: Muscle[] };
}
