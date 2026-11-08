import { describe, expect, it } from 'vitest';
import { suggestNext, e1rm } from '../src/domain/progression';
import { snapWeight, nextUp, nextDown, normalizeWeights, DEFAULT_WEIGHTS } from '../src/domain/weights';
import { buildSessions, weeklySetsByPattern, spreadIndices, validateWeekdays, DEFAULT_PROGRAM, PATTERNS } from '../src/domain/program';
import { EXERCISES, alternativesFor, getExercise } from '../src/domain/exercises';
import type { SetLog } from '../src/domain/types';

const W = [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25];
const ex = { repMin: 8, repMax: 12, startKg: 14, load: 'pair' as const };
const sets = (weight: number, reps: number[], rpe: number | null): SetLog[] => reps.map((r) => ({ weight, reps: r, rpe, done: true }));

describe('weight snapping', () => {
  it('snaps to the nearest owned weight, ties go lighter', () => {
    expect(snapWeight(14, W)).toBe(15);
    expect(snapWeight(11.25, W)).toBe(10);
    expect(snapWeight(100, W)).toBe(25);
    expect(snapWeight(1, W)).toBe(5);
    expect(snapWeight(0, W)).toBe(0);
  });
  it('falls back to 0.5 kg rounding with no weights', () => {
    expect(snapWeight(13.3, [])).toBe(13.5);
  });
  it('steps up and down through the list, clamped at the ends', () => {
    expect(nextUp(15, W)).toBe(17.5);
    expect(nextUp(25, W)).toBe(25);
    expect(nextDown(15, W)).toBe(12.5);
    expect(nextDown(5, W)).toBe(5);
    expect(nextUp(16, W)).toBe(17.5); // off-list current weight
  });
  it('normalises: dedupe, sort, drop junk', () => {
    expect(normalizeWeights([10, 5, 10, -1, NaN, 7.5])).toEqual([5, 7.5, 10]);
    expect(DEFAULT_WEIGHTS.at(-1)).toBe(41);
  });
});

describe('progression', () => {
  it('first session uses the start weight snapped, bottom of range', () => {
    expect(suggestNext(ex, 8, 12, null, W)).toMatchObject({ weight: 15, reps: 8, reason: 'first' });
  });
  it('RPE ≤ 7 not at top → +2 reps same weight', () => {
    expect(suggestNext(ex, 8, 12, sets(15, [9, 9, 8], 7), W)).toMatchObject({ weight: 15, reps: 10, reason: 'add-reps' });
  });
  it('RPE 8 not at top → +1 rep, capped at top', () => {
    expect(suggestNext(ex, 8, 12, sets(15, [10, 10, 10], 8), W)).toMatchObject({ weight: 15, reps: 11 });
    expect(suggestNext(ex, 8, 12, sets(15, [12, 12, 11], 7), W)).toMatchObject({ weight: 15, reps: 12 });
  });
  it('all sets at top with RPE ≤ 8 → next dumbbell, reps reset', () => {
    expect(suggestNext(ex, 8, 12, sets(15, [12, 12, 12], 8), W)).toMatchObject({ weight: 17.5, reps: 8, reason: 'increase-weight' });
    expect(suggestNext(ex, 8, 12, sets(15, [12, 12, 12], 6), W)).toMatchObject({ weight: 17.5, reps: 8 });
  });
  it('RPE ≥ 9 holds, or reduces when the bottom of the range was missed', () => {
    expect(suggestNext(ex, 8, 12, sets(15, [10, 9, 9], 9), W)).toMatchObject({ weight: 15, reps: 9, reason: 'hold' });
    expect(suggestNext(ex, 8, 12, sets(15, [12, 12, 12], 9.5), W)).toMatchObject({ weight: 15, reason: 'hold' });
    expect(suggestNext(ex, 8, 12, sets(15, [8, 7, 6], 10), W)).toMatchObject({ weight: 12.5, reps: 8, reason: 'reduce' });
  });
  it('missing RPE counts as 8; undone sets are ignored', () => {
    const log: SetLog[] = [...sets(15, [10, 10], null), { weight: 15, reps: 0, rpe: null, done: false }];
    expect(suggestNext(ex, 8, 12, log, W)).toMatchObject({ weight: 15, reps: 11 });
  });
  it('uses the heaviest working weight and its hardest set', () => {
    const log = [...sets(12.5, [12], 6), ...sets(15, [12, 12], 7)];
    expect(suggestNext(ex, 8, 12, log, W)).toMatchObject({ weight: 17.5, reps: 8 });
  });
  it('always lands on an owned weight', () => {
    expect(W).toContain(suggestNext(ex, 8, 12, sets(16, [12, 12, 12], 7), W).weight);
  });
  it('bodyweight exercises never get a load', () => {
    const bw = { ...ex, load: 'bodyweight' as const };
    expect(suggestNext(bw, 6, 15, sets(0, [15, 15], 7), W)).toMatchObject({ weight: 0, reps: 15 });
  });
  it('e1RM (Epley)', () => {
    expect(e1rm(20, 10)).toBeCloseTo(26.7, 1);
    expect(e1rm(0, 10)).toBe(0);
  });
});

describe('schedule re-balancing', () => {
  const rest = { restCompoundSec: 120, restAccessorySec: 75 };
  it('default is Mon–Wed full body A/B/C', () => {
    const s = buildSessions(DEFAULT_PROGRAM, rest);
    expect(s.map((x) => [x.name, x.weekday])).toEqual([['Full Body A', 0], ['Full Body B', 1], ['Full Body C', 2]]);
    expect(s[0].slots.map((x) => x.exerciseId)).toEqual(['goblet-squat', 'flat-db-press', 'one-arm-row', 'db-rdl', 'hammer-curl', 'overhead-triceps', 'dead-bug']);
  });
  it.each([2, 3, 4, 5])('%i days: every session is full body and weekly volume stays balanced', (n) => {
    const weekdays = [0, 1, 2, 3, 4].slice(0, n);
    const s = buildSessions({ weekdays: weekdays as never, swaps: {}, edits: {} }, rest);
    expect(s).toHaveLength(n);
    for (const sess of s) for (const p of ['knee', 'hinge', 'push', 'pull'] as const) expect(sess.slots.some((x) => x.pattern === p)).toBe(true);
    const v = weeklySetsByPattern(s);
    for (const p of ['knee', 'hinge', 'push', 'pull'] as const) { expect(v[p]).toBeGreaterThanOrEqual(8); expect(v[p]).toBeLessThanOrEqual(10); }
    expect(v.biceps).toBeGreaterThanOrEqual(4); expect(v.biceps).toBeLessThanOrEqual(6);
    // no session overloaded: at most 8 exercises
    for (const sess of s) expect(sess.slots.length).toBeLessThanOrEqual(8);
  });
  it('accessories are spread, not stacked', () => {
    expect(spreadIndices(5, 2)).toEqual([0, 2]);
    expect(spreadIndices(3, 3)).toEqual([0, 1, 2]);
    expect(spreadIndices(2, 3)).toEqual([0, 1]);
  });
  it('uses the chosen weekdays in order', () => {
    const s = buildSessions({ weekdays: [5, 1, 3] as never, swaps: {}, edits: {} }, rest);
    expect(s.map((x) => x.weekday)).toEqual([1, 3, 5]);
  });
  it('rejects fewer than 2 or more than 5 days', () => {
    expect(() => validateWeekdays([0])).toThrow();
    expect(() => validateWeekdays([0, 1, 2, 3, 4, 5])).toThrow();
    expect(validateWeekdays([2, 2, 0])).toEqual([0, 2]);
  });
  it('swaps and edits survive a change of day count', () => {
    const program = { weekdays: [0, 1, 2] as never, swaps: { 'knee:0': 'step-up', 'push:1': 'push-up' }, edits: { 'knee:0': { sets: 4, repMin: 6, repMax: 10 } } };
    const three = buildSessions(program, rest);
    expect(three[0].slots[0]).toMatchObject({ exerciseId: 'step-up', sets: 4, repMin: 6, repMax: 10 });
    const four = buildSessions({ ...program, weekdays: [0, 1, 2, 3] as never }, rest);
    expect(four[0].slots[0].exerciseId).toBe('step-up');
    expect(four[3].slots[0].exerciseId).toBe('step-up'); // variant 0 again on day 4
    expect(four[1].slots.find((x) => x.pattern === 'push')?.exerciseId).toBe('push-up');
  });
  it('ignores a swap to an exercise from another pattern', () => {
    const s = buildSessions({ weekdays: [0, 1, 2] as never, swaps: { 'knee:0': 'flat-db-press' }, edits: {} }, rest);
    expect(s[0].slots[0].exerciseId).toBe('goblet-squat');
  });
});

describe('exercise library', () => {
  it('every default variant exists and every exercise has 2–3 cues, an animation and same-pattern alternatives', () => {
    for (const p of PATTERNS) for (const id of p.variants) expect(getExercise(id).pattern).toBe(p.pattern);
    for (const e of EXERCISES) {
      expect(e.cues.length).toBeGreaterThanOrEqual(2);
      expect(e.anim).toBeTruthy();
      expect(alternativesFor(e.id).length).toBeGreaterThanOrEqual(2);
      expect(alternativesFor(e.id).every((a) => a.pattern === e.pattern)).toBe(true);
      expect(e.repMin).toBeLessThanOrEqual(e.repMax);
    }
  });
});
