import { describe, expect, it } from 'vitest';
import { applyLogSet, nextOpenSet, allSetsDone } from '../src/domain/session';
import { weeklyAverages } from '../src/domain/stats';
import type { WorkoutLog } from '../src/domain/types';

const mk = (sets: boolean[][]): WorkoutLog => ({
  id: 'a', date: '2026-11-02', startedAt: 0, finishedAt: null, sessionIndex: 0, sessionName: 'A', phase: 'lift', cursor: 0, warmupDone: true,
  finisherDone: null, cooldownDone: false, restEndsAt: null, notes: '',
  exercises: sets.map((ex, i) => ({ key: `k${i}`, exerciseId: 'goblet-squat', sets: ex.map((done) => ({ weight: 10, reps: 10, rpe: null, done })) })),
});

describe('logging a set', () => {
  it('marks the set done, carries weight forward to open sets and starts rest', () => {
    const w = mk([[false, false, false], [false]]);
    w.exercises[0].sets[0].weight = 12.5;
    const out = applyLogSet(w, 0, 0, { now: 1000, restSec: 90, autoRest: true });
    expect(out.exercises[0].sets[0].done).toBe(true);
    expect(out.exercises[0].sets.map((s) => s.weight)).toEqual([12.5, 12.5, 12.5]);
    expect(out.restEndsAt).toBe(1000 + 90_000);
    expect(w.exercises[0].sets[0].done).toBe(false); // input not mutated
  });
  it('does not overwrite weights of sets already logged', () => {
    const w = mk([[false, true, false]]);
    w.exercises[0].sets[1].weight = 7.5;
    w.exercises[0].sets[0].weight = 15;
    const out = applyLogSet(w, 0, 0, { now: 0, restSec: 60, autoRest: true });
    expect(out.exercises[0].sets.map((s) => s.weight)).toEqual([15, 7.5, 15]);
  });
  it('re-logging (editing) a done set does not restart the rest timer', () => {
    const w = mk([[true, false]]);
    w.restEndsAt = 5;
    expect(applyLogSet(w, 0, 0, { now: 1000, restSec: 60, autoRest: true }).restEndsAt).toBe(5);
  });
  it('no rest after the very last open set of the whole session, even when it is not the last exercise', () => {
    const w = mk([[false], [true, true]]);
    expect(applyLogSet(w, 0, 0, { now: 1000, restSec: 60, autoRest: true }).restEndsAt).toBeNull();
  });
  it('respects auto-rest off', () => {
    expect(applyLogSet(mk([[false, false]]), 0, 0, { now: 1000, restSec: 60, autoRest: false }).restEndsAt).toBeNull();
  });
});

describe('next open set', () => {
  it('prefers the next open set after the one just logged, then wraps to earlier open sets', () => {
    const sets = [false, true, true, false].map((done) => ({ weight: 0, reps: 0, rpe: null, done }));
    expect(nextOpenSet(sets, 1)).toBe(3);
    expect(nextOpenSet(sets, 3)).toBe(0);
    expect(nextOpenSet(sets.map((s) => ({ ...s, done: true })), 0)).toBe(-1);
  });
  it('allSetsDone covers every exercise', () => {
    expect(allSetsDone(mk([[true], [true, true]]))).toBe(true);
    expect(allSetsDone(mk([[true], [true, false]]))).toBe(false);
  });
});

describe('weekly averages for noisy daily series', () => {
  it('groups by Monday-start week and averages', () => {
    const d = (s: string) => new Date(`${s}T00:00:00`).getTime();
    const pts = [{ x: d('2026-11-02'), y: 6000 }, { x: d('2026-11-04'), y: 8000 }, { x: d('2026-11-09'), y: 10000 }];
    const out = weeklyAverages(pts);
    expect(out).toEqual([{ x: d('2026-11-02'), y: 7000 }, { x: d('2026-11-09'), y: 10000 }]);
  });
});
