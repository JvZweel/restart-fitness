import type { SetLog, WorkoutLog } from './types';

/** True when every set of every exercise in the workout is logged. */
export function allSetsDone(w: WorkoutLog): boolean {
  return w.exercises.every((e) => e.sets.every((s) => s.done));
}

/** Next open set after `after`, wrapping to earlier open sets; -1 when all are logged. */
export function nextOpenSet(sets: SetLog[], after: number): number {
  const later = sets.findIndex((s, k) => k > after && !s.done);
  return later >= 0 ? later : sets.findIndex((s) => !s.done);
}

/**
 * Log (or re-log) set `i` of exercise `cursor`. Pure: returns a new workout.
 *  - carries the logged weight forward to the remaining open sets of that exercise
 *  - starts the rest timer for a newly logged set, unless it was the last open set of the session
 */
export function applyLogSet(w: WorkoutLog, cursor: number, i: number, opts: { now: number; restSec: number; autoRest: boolean }): WorkoutLog {
  const x = structuredClone(w);
  const e = x.exercises[cursor];
  const wasDone = e.sets[i].done;
  e.sets[i] = { ...e.sets[i], done: true };
  for (let k = i + 1; k < e.sets.length; k++) if (!e.sets[k].done) e.sets[k] = { ...e.sets[k], weight: e.sets[i].weight };
  if (!wasDone) x.restEndsAt = opts.autoRest && !allSetsDone(x) ? opts.now + opts.restSec * 1000 : null;
  return x;
}
