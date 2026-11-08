import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, DEFAULT_SETTINGS } from '../src/domain/backup';
import type { WorkoutLog } from '../src/domain/types';

const workout: WorkoutLog = {
  id: 'w1', date: '2026-11-02', startedAt: 1, finishedAt: 2, sessionIndex: 0, sessionName: 'Full Body A', phase: 'summary', cursor: 0,
  exercises: [{ key: 'knee:0', exerciseId: 'goblet-squat', sets: [{ weight: 15, reps: 10, rpe: 7, done: true }] }],
  warmupDone: true, finisherDone: null, cooldownDone: true, restEndsAt: null, notes: '',
};

describe('backup', () => {
  it('round-trips everything including settings, theme and photos', () => {
    const data = {
      settings: { ...DEFAULT_SETTINGS, theme: 'dark' as const, weights: [5, 10, 41] },
      program: { weekdays: [0, 2, 4] as never, swaps: { 'knee:0': 'step-up' }, edits: { 'push:0': { sets: 4 } } },
      workouts: [workout],
      daily: [{ date: '2026-11-02', weight: 104, steps: 8000, sleepH: 6.5, waist: 108 }],
    };
    const photos = [{ id: 'p1', date: '2026-11-02', dataUrl: 'data:image/jpeg;base64,AAAA', width: 10, height: 20 }];
    const json = JSON.stringify(makeBackup(data, photos, new Date('2026-11-08T12:00:00Z')));
    const back = parseBackup(json);
    expect(back.settings).toEqual(data.settings);
    expect(back.program).toEqual(data.program);
    expect(back.workouts).toEqual(data.workouts);
    expect(back.daily).toEqual(data.daily);
    expect(back.photos).toEqual(photos);
    expect(back.exportedAt).toBe('2026-11-08T12:00:00.000Z');
  });
  it('omits photos when none are included', () => {
    const b = makeBackup({ settings: DEFAULT_SETTINGS, program: { weekdays: [0, 1, 2], swaps: {}, edits: {} }, workouts: [], daily: [] });
    expect('photos' in b).toBe(false);
  });
  it('rejects junk with a readable message and repairs bad fields', () => {
    expect(() => parseBackup('nope')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a Restart Fitness backup/);
    expect(() => parseBackup('{"app":"restart-fitness","version":9}')).toThrow(/version/);
    const fixed = parseBackup(JSON.stringify({ app: 'restart-fitness', version: 1, settings: { theme: 'neon', weights: [10, 5, 5] }, program: { weekdays: [1] }, workouts: [{ bad: true }], daily: [{ date: 'x' }] }));
    expect(fixed.settings.theme).toBe('system');
    expect(fixed.settings.weights).toEqual([5, 10]);
    expect(fixed.program.weekdays).toEqual([0, 1, 2]);
    expect(fixed.workouts).toEqual([]);
    expect(fixed.daily).toEqual([]);
  });
});

describe('backup import hardening', () => {
  const wrap = (extra: Record<string, unknown>) => JSON.stringify({ app: 'restart-fitness', version: 1, ...extra });

  it('drops malformed exercises and sets instead of crashing charts later', () => {
    const bad = {
      ...workout,
      exercises: [
        { key: 'knee:0', exerciseId: 'goblet-squat', sets: [{ weight: 15, reps: 10, rpe: 7, done: true }, { weight: 'x', reps: 5, done: true }, null] },
        { key: 'push:0', exerciseId: 'flat-db-press' }, // no sets array
        'junk',
      ],
    };
    const b = parseBackup(wrap({ workouts: [bad] }));
    expect(b.workouts).toHaveLength(1);
    expect(b.workouts[0].exercises).toHaveLength(1);
    expect(b.workouts[0].exercises[0].sets).toEqual([{ weight: 15, reps: 10, rpe: 7, done: true }]);
  });

  it('keeps only finite, non-negative daily numbers', () => {
    const b = parseBackup(wrap({ daily: [{ date: '2026-11-02', weight: '92.5', steps: -4, sleepH: 7, waist: null }] }));
    expect(b.daily).toEqual([{ date: '2026-11-02', sleepH: 7 }]);
  });

  it('falls back to defaults for invalid numeric / boolean settings', () => {
    const b = parseBackup(wrap({ settings: { restCompoundSec: 'abc', restAccessorySec: 90, sound: 'yes', warmupSec: -5 } }));
    expect(b.settings.restCompoundSec).toBe(DEFAULT_SETTINGS.restCompoundSec);
    expect(b.settings.restAccessorySec).toBe(90);
    expect(b.settings.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(b.settings.warmupSec).toBe(DEFAULT_SETTINGS.warmupSec);
  });

  it('drops swaps to exercises this version does not know', () => {
    const b = parseBackup(wrap({ program: { weekdays: [0, 1, 2], swaps: { 'knee:0': 'step-up', 'push:0': 'cable-fly-9000' }, edits: {} } }));
    expect(b.program.swaps).toEqual({ 'knee:0': 'step-up' });
  });

  it('gives a readable message for files that are not JSON or not a backup', () => {
    expect(() => parseBackup('Date,Steps\n2026-11-01,8000')).toThrow(/not valid JSON/);
    expect(() => parseBackup('[1,2,3]')).toThrow(/not a Restart Fitness backup/);
    expect(() => parseBackup('')).toThrow(/empty/);
  });
});

describe('backup import: workouts from other builds', () => {
  const wrap = (extra: Record<string, unknown>) => JSON.stringify({ app: 'restart-fitness', version: 1, ...extra });
  it('drops exercises this version does not know, and workouts without a numeric start time', () => {
    const w = { ...workout, exercises: [...workout.exercises, { key: 'x:0', exerciseId: 'cable-fly-9000', sets: [{ weight: 5, reps: 5, rpe: null, done: true }] }] };
    const noStart = { ...workout, id: 'w2', startedAt: 'yesterday' };
    const badFinish = { ...workout, id: 'w3', finishedAt: 'later' };
    const b = parseBackup(wrap({ workouts: [w, noStart, badFinish] }));
    expect(b.workouts.map((x) => x.id)).toEqual(['w1', 'w3']);
    expect(b.workouts[0].exercises.map((e) => e.exerciseId)).toEqual(['goblet-squat']);
    expect(b.workouts[1].finishedAt).toBeNull();
  });
});
