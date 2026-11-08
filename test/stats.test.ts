import { describe, expect, it } from 'vitest';
import { nextSession, weekStatus, weekStreak, liftHistory } from '../src/domain/stats';
import { buildSessions } from '../src/domain/program';
import type { WorkoutLog } from '../src/domain/types';

const sessions = buildSessions({ weekdays: [0, 1, 2], swaps: {}, edits: {} }, { restCompoundSec: 120, restAccessorySec: 75 });
const wk = (date: string, idx: number, sets: [number, number][] = []): WorkoutLog => ({
  id: date + idx, date, startedAt: new Date(date).getTime(), finishedAt: new Date(date).getTime() + 1, sessionIndex: idx, sessionName: '', phase: 'summary', cursor: 0,
  exercises: [{ key: 'knee:0', exerciseId: 'goblet-squat', sets: sets.map(([weight, reps]) => ({ weight, reps, rpe: 8, done: true })) }],
  warmupDone: true, finisherDone: null, cooldownDone: true, restEndsAt: null, notes: '',
});
// 2026-11-09 is a Monday
const mon = new Date(2026, 10, 9);
const wed = new Date(2026, 10, 11);
const sat = new Date(2026, 10, 14);

describe('today / next session', () => {
  it('Monday with nothing done → today, Full Body A', () => {
    expect(nextSession(mon, sessions, [])).toMatchObject({ when: 'today', session: { name: 'Full Body A' } });
  });
  it('Wednesday with Monday missed → today first, then catch-up', () => {
    expect(nextSession(wed, sessions, [])?.session.name).toBe('Full Body C');
    expect(nextSession(wed, sessions, [wk('2026-11-11', 2)])).toMatchObject({ when: 'catch-up', session: { name: 'Full Body A' } });
  });
  it('week done → next week Monday', () => {
    const done = [wk('2026-11-09', 0), wk('2026-11-10', 1), wk('2026-11-11', 2)];
    expect(nextSession(sat, sessions, done)).toMatchObject({ when: 'next-week', date: '2026-11-16' });
  });
  it('week strip marks planned, done and today', () => {
    const w = weekStatus(wed, sessions, [wk('2026-11-09', 0)]);
    expect(w.map((d) => !!d.planned)).toEqual([true, true, true, false, false, false, false]);
    expect(w[0].done).toBe(1);
    expect(w[2].isToday).toBe(true);
  });
  it('week streak counts consecutive complete weeks', () => {
    const done = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-11-02', '2026-11-03', '2026-11-04'].map((d, i) => wk(d, i % 3));
    expect(weekStreak(mon, 3, done)).toBe(2);
    expect(weekStreak(mon, 3, done.slice(3))).toBe(1);
    expect(weekStreak(mon, 3, [])).toBe(0);
  });
  it('lift history picks the best e1RM set per session', () => {
    const h = liftHistory('goblet-squat', [wk('2026-11-02', 0, [[15, 12], [17.5, 8]]), wk('2026-11-09', 0, [[17.5, 10]])]);
    expect(h.map((p) => p.e1rm)).toEqual([22.2, 23.3]);
    expect(h[0].topWeight).toBe(17.5);
  });
});
