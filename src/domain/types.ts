/** Core domain model. All loads are kg per dumbbell unless an exercise says otherwise. */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday … 6 = Sunday
export type ThemePref = 'system' | 'light' | 'dark';

export type Muscle =
  | 'chest' | 'shoulders' | 'rearDelts' | 'triceps' | 'biceps' | 'forearms'
  | 'lats' | 'upperBack' | 'traps' | 'abs' | 'obliques' | 'lowerBack'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves' | 'hipFlexors';

/** Movement pattern = the slot an exercise fills in a full-body session. Swaps stay within a pattern. */
export type Pattern = 'knee' | 'hinge' | 'push' | 'pull' | 'biceps' | 'triceps' | 'core';

export type Load = 'pair' | 'single' | 'goblet' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  load: Load;
  /** Reps are per side for unilateral moves. */
  perSide?: boolean;
  /** Hold exercises log seconds instead of reps. */
  timed?: boolean;
  repMin: number;
  repMax: number;
  /** Conservative first-session load (kg per dumbbell) for a detrained adult. */
  startKg: number;
  equipment: string;
  cues: [string, string] | [string, string, string];
  anim: string; // animation id in src/anim/poses.ts
}

export interface GuidedMove {
  id: string;
  name: string;
  seconds: number;
  cue: string;
  anim: string;
  perSide?: boolean;
}

export interface Finisher {
  id: string;
  name: string;
  description: string;
  rounds: number;
  workSec: number;
  restSec: number;
  moves: string[];
  anim: string;
}

export interface SlotPrescription {
  /** Stable key `${pattern}:${variant}` so swaps and edits survive re-balancing. */
  key: string;
  pattern: Pattern;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetRpe: number;
  restSec: number;
}

export interface SessionPlan {
  index: number;
  name: string; // "Full Body A"
  weekday: Weekday;
  slots: SlotPrescription[];
  finisherId: string;
}

export interface SlotEdit { sets?: number; repMin?: number; repMax?: number }

export interface ProgramSettings {
  weekdays: Weekday[]; // sorted, length 2–5 = days per week
  swaps: Record<string, string>; // slot key -> exercise id
  edits: Record<string, SlotEdit>;
}

export interface Settings {
  theme: ThemePref;
  units: 'kg';
  weights: number[]; // available dumbbell loads, ascending
  restCompoundSec: number;
  restAccessorySec: number;
  autoRest: boolean;
  sound: boolean;
  vibrate: boolean;
  warmupSec: number; // seconds per warm-up move
  cooldownSec: number; // seconds per stretch
  showFinisher: boolean;
}

export interface SetLog {
  weight: number;
  reps: number;
  rpe: number | null;
  done: boolean;
}

export interface ExerciseLog {
  key: string;
  exerciseId: string;
  sets: SetLog[];
}

export type Phase = 'warmup' | 'lift' | 'finisher' | 'cooldown' | 'summary';

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD local
  startedAt: number;
  finishedAt: number | null;
  sessionIndex: number;
  sessionName: string;
  phase: Phase;
  cursor: number; // index within the current phase
  exercises: ExerciseLog[];
  warmupDone: boolean;
  finisherDone: boolean | null; // null = skipped
  cooldownDone: boolean;
  restEndsAt: number | null;
  notes: string;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  weight?: number;
  waist?: number;
  steps?: number;
  sleepH?: number;
  source?: 'manual' | 'garmin';
}

export interface ProgressPhoto {
  id: string;
  date: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface Backup {
  app: 'restart-fitness';
  version: 1;
  exportedAt: string;
  settings: Settings;
  program: ProgramSettings;
  workouts: WorkoutLog[];
  daily: DailyLog[];
  photos?: { id: string; date: string; dataUrl: string; width: number; height: number }[];
}
