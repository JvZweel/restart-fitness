import { nextDown, nextUp, snapWeight } from './weights';
import type { Exercise, SetLog } from './types';

export interface Suggestion {
  weight: number;
  reps: number;
  reason: 'first' | 'increase-weight' | 'add-reps' | 'hold' | 'reduce';
  note: string;
}

/**
 * Double progression driven by the last session's working sets and RPE.
 *  - RPE ≤ 7: all sets at top of range → next dumbbell, reps back to the bottom; otherwise +2 reps (capped).
 *  - RPE 8:   all sets at top of range → next dumbbell; otherwise +1 rep (capped).
 *  - RPE ≥ 9: missed the bottom of the range → next lighter dumbbell; otherwise hold weight and reps.
 * RPE is taken from the hardest logged set; missing RPE counts as 8. Always snapped to owned weights.
 */
export function suggestNext(ex: Pick<Exercise, 'repMin' | 'repMax' | 'startKg' | 'load'>, repMin: number, repMax: number, last: SetLog[] | null, weights: number[]): Suggestion {
  const bodyweight = ex.load === 'bodyweight';
  const done = (last ?? []).filter((s) => s.done && s.reps > 0);
  if (!done.length) {
    return { weight: bodyweight ? 0 : snapWeight(ex.startKg, weights), reps: repMin, reason: 'first', note: 'Starting point — find a weight that feels like RPE 7' };
  }
  const weight = Math.max(...done.map((s) => s.weight));
  const working = done.filter((s) => s.weight === weight);
  const minReps = Math.min(...working.map((s) => s.reps));
  const rpes = working.map((s) => s.rpe).filter((r): r is number => r != null);
  const rpe = rpes.length ? Math.max(...rpes) : 8;
  const allTop = working.every((s) => s.reps >= repMax);

  if (rpe >= 9) {
    if (minReps < repMin && !bodyweight) {
      return { weight: nextDown(weight, weights), reps: repMin, reason: 'reduce', note: `Last time was a grind (RPE ${rpe}) — drop one step` };
    }
    return { weight, reps: Math.max(repMin, Math.min(minReps, repMax)), reason: 'hold', note: `RPE ${rpe} last time — repeat and own it` };
  }
  if (allTop) {
    if (bodyweight) return { weight: 0, reps: repMax, reason: 'hold', note: 'Top of the range — slow the tempo or swap to a harder variation' };
    const up = nextUp(weight, weights);
    if (up === weight) return { weight, reps: repMax, reason: 'hold', note: 'Heaviest dumbbell reached — slow the tempo' };
    return { weight: up, reps: repMin, reason: 'increase-weight', note: `Hit ${repMax} on every set — go up to ${up} kg` };
  }
  const step = rpe <= 7 ? 2 : 1;
  return { weight, reps: Math.min(repMax, Math.max(repMin, minReps + step)), reason: 'add-reps', note: `RPE ${rpe} — add ${step === 2 ? 'two reps' : 'a rep'} this time` };
}

/** Epley estimated 1-rep max per dumbbell (kg). */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
