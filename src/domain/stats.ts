import { addDays, isoDate, startOfWeek, weekdayOf } from './dates';
import { e1rm } from './progression';
import type { SessionPlan, Weekday, WorkoutLog } from './types';

export interface DayStatus { date: string; weekday: Weekday; planned: SessionPlan | null; done: number; isToday: boolean; past: boolean }

export function weekStatus(today: Date, sessions: SessionPlan[], workouts: WorkoutLog[]): DayStatus[] {
  const start = startOfWeek(today);
  const t = isoDate(today);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const date = isoDate(d);
    return {
      date, weekday: i as Weekday, planned: sessions.find((s) => s.weekday === i) ?? null,
      done: workouts.filter((w) => w.date === date && w.finishedAt).length, isToday: date === t, past: date < t,
    };
  });
}

export interface NextUp { session: SessionPlan; date: string; when: 'today' | 'upcoming' | 'catch-up' | 'next-week' }

/** Today's planned session if not done; else a missed one this week; else the next planned day. */
export function nextSession(today: Date, sessions: SessionPlan[], workouts: WorkoutLog[]): NextUp | null {
  if (!sessions.length) return null;
  const start = isoDate(startOfWeek(today));
  const doneIdx = new Set(workouts.filter((w) => w.finishedAt && w.date >= start).map((w) => w.sessionIndex));
  const wd = weekdayOf(today);
  const todays = sessions.find((s) => s.weekday === wd);
  if (todays && !doneIdx.has(todays.index)) return { session: todays, date: isoDate(today), when: 'today' };
  const missed = sessions.find((s) => s.weekday < wd && !doneIdx.has(s.index));
  if (missed) return { session: missed, date: isoDate(today), when: 'catch-up' };
  const upcoming = sessions.find((s) => s.weekday > wd && !doneIdx.has(s.index));
  if (upcoming) return { session: upcoming, date: isoDate(addDays(today, upcoming.weekday - wd)), when: 'upcoming' };
  const first = sessions[0];
  return { session: first, date: isoDate(addDays(startOfWeek(today), 7 + first.weekday)), when: 'next-week' };
}

/** Consecutive weeks (ending with the current week if already complete, else last week) hitting the plan. */
export function weekStreak(today: Date, perWeek: number, workouts: WorkoutLog[]): number {
  const count = (weekStart: Date) => {
    const a = isoDate(weekStart);
    const b = isoDate(addDays(weekStart, 7));
    return workouts.filter((w) => w.finishedAt && w.date >= a && w.date < b).length;
  };
  let ws = startOfWeek(today);
  let streak = 0;
  if (count(ws) >= perWeek) streak++;
  ws = addDays(ws, -7);
  while (count(ws) >= perWeek && streak < 520) { streak++; ws = addDays(ws, -7); }
  return streak;
}

export interface LiftPoint { date: string; t: number; e1rm: number; topWeight: number; topReps: number }

export function liftHistory(exerciseId: string, workouts: WorkoutLog[]): LiftPoint[] {
  const out: LiftPoint[] = [];
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((s) => s.done && s.reps > 0));
    if (!sets.length) continue;
    let best = sets[0];
    for (const s of sets) if (e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps)) best = s;
    const top = sets.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), sets[0]);
    out.push({ date: w.date, t: w.startedAt, e1rm: e1rm(best.weight, best.reps) || best.reps, topWeight: top.weight, topReps: top.reps });
  }
  return out.sort((a, b) => a.t - b.t);
}

export function workoutVolume(w: WorkoutLog): { sets: number; volume: number } {
  let sets = 0;
  let volume = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done) { sets++; volume += s.weight * s.reps; }
  return { sets, volume: Math.round(volume) };
}

/** Average a daily series per Monday-start week (x = the week's Monday at local midnight). */
export function weeklyAverages(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const by = new Map<number, number[]>();
  for (const p of points) {
    const wk = startOfWeek(new Date(p.x)).getTime();
    by.set(wk, [...(by.get(wk) ?? []), p.y]);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([x, ys]) => ({ x, y: ys.reduce((a, b) => a + b, 0) / ys.length }));
}
