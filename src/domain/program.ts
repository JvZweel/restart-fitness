import { EXERCISE_BY_ID, FINISHERS } from './exercises';
import type { Pattern, ProgramSettings, SessionPlan, Settings, SlotPrescription, Weekday } from './types';

/**
 * Default programme: 3-day full-body restart (Mon–Wed), dumbbells + adjustable bench.
 * Each pattern has an ordered list of variants; session i uses variant i mod n, so any
 * day count from 2 to 5 gets a balanced rotation of the same movement patterns.
 */
export interface PatternSpec {
  pattern: Pattern;
  variants: string[]; // exercise ids, default per variant
  weeklySets: number; // target hard sets per week for this pattern
  role: 'main' | 'accessory';
  targetRpe: number;
}

export const PATTERNS: PatternSpec[] = [
  { pattern: 'knee', variants: ['goblet-squat', 'bulgarian-split-squat', 'reverse-lunge'], weeklySets: 9, role: 'main', targetRpe: 8 },
  { pattern: 'push', variants: ['flat-db-press', 'seated-shoulder-press', 'incline-db-press'], weeklySets: 9, role: 'main', targetRpe: 8 },
  { pattern: 'pull', variants: ['one-arm-row', 'chest-supported-row', 'db-pullover'], weeklySets: 9, role: 'main', targetRpe: 8 },
  { pattern: 'hinge', variants: ['db-rdl', 'hip-thrust', 'sumo-deadlift'], weeklySets: 9, role: 'main', targetRpe: 8 },
  { pattern: 'biceps', variants: ['hammer-curl', 'incline-curl'], weeklySets: 4, role: 'accessory', targetRpe: 8 },
  { pattern: 'triceps', variants: ['overhead-triceps', 'skull-crusher'], weeklySets: 4, role: 'accessory', targetRpe: 8 },
  { pattern: 'core', variants: ['dead-bug', 'side-plank', 'reverse-crunch'], weeklySets: 6, role: 'accessory', targetRpe: 7 },
];

export const DEFAULT_PROGRAM: ProgramSettings = { weekdays: [0, 1, 2], swaps: {}, edits: {} };

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const LETTERS = 'ABCDE';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Which session indices (0..n-1) an accessory with `appearances` slots lands on, evenly spread. */
export function spreadIndices(n: number, appearances: number): number[] {
  const k = clamp(appearances, 0, n);
  const out = new Set<number>();
  for (let j = 0; j < k; j++) out.add(Math.floor((j * n) / k));
  return [...out].sort((a, b) => a - b);
}

export function validateWeekdays(days: number[]): Weekday[] {
  const uniq = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b) as Weekday[];
  if (uniq.length < 2 || uniq.length > 5) throw new Error('Choose between 2 and 5 training days');
  return uniq;
}

/**
 * Re-balance full-body sessions across the chosen weekdays.
 * - Main patterns (squat, push, pull, hinge) appear every session; sets = weekly target / days, clamped 2–4.
 * - Accessories appear on ceil(weeklySets / 2) sessions (2 sets each, 3 on 2-day plans), spread evenly.
 * - Swaps and set/rep edits are keyed by `${pattern}:${variant}` so they survive re-balancing.
 */
export function buildSessions(program: ProgramSettings, settings: Pick<Settings, 'restCompoundSec' | 'restAccessorySec'>): SessionPlan[] {
  const weekdays = validateWeekdays(program.weekdays);
  const n = weekdays.length;
  const sessions: SessionPlan[] = weekdays.map((weekday, index) => ({
    index, weekday, name: `Full Body ${LETTERS[index]}`, slots: [], finisherId: FINISHERS[index % FINISHERS.length].id,
  }));

  for (const spec of PATTERNS) {
    const indices = spec.role === 'main' ? sessions.map((s) => s.index) : spreadIndices(n, Math.ceil(spec.weeklySets / 2));
    const baseSets = spec.role === 'main' ? clamp(Math.round(spec.weeklySets / n), 2, 4) : n <= 2 ? 3 : 2;
    indices.forEach((sessionIndex, occurrence) => {
      const variant = (spec.role === 'main' ? sessionIndex : occurrence) % spec.variants.length;
      const key = `${spec.pattern}:${variant}`;
      const exerciseId = program.swaps[key] && EXERCISE_BY_ID[program.swaps[key]]?.pattern === spec.pattern ? program.swaps[key] : spec.variants[variant];
      const ex = EXERCISE_BY_ID[exerciseId];
      const edit = program.edits[key] ?? {};
      const repMin = clamp(edit.repMin ?? ex.repMin, 1, 100);
      const repMax = clamp(edit.repMax ?? ex.repMax, repMin, 100);
      const slot: SlotPrescription = {
        key, pattern: spec.pattern, exerciseId,
        sets: clamp(edit.sets ?? baseSets, 1, 8), repMin, repMax, targetRpe: spec.targetRpe,
        restSec: spec.role === 'main' ? settings.restCompoundSec : settings.restAccessorySec,
      };
      sessions[sessionIndex].slots.push(slot);
    });
  }
  return sessions;
}

/** Weekly hard sets per pattern — used by tests and the programme screen's balance read-out. */
export function weeklySetsByPattern(sessions: SessionPlan[]): Record<Pattern, number> {
  const out = { knee: 0, hinge: 0, push: 0, pull: 0, biceps: 0, triceps: 0, core: 0 } as Record<Pattern, number>;
  for (const s of sessions) for (const slot of s.slots) out[slot.pattern] += slot.sets;
  return out;
}

/** Rough session length in minutes: warm-up + work sets + rests + cool-down (finisher excluded). */
export function estimateMinutes(session: SessionPlan, warmupMin = 6, cooldownMin = 6): number {
  let sec = 0;
  for (const slot of session.slots) {
    const ex = EXERCISE_BY_ID[slot.exerciseId];
    const perSet = (ex.timed ? slot.repMax : slot.repMax * 3) * (ex.perSide ? 2 : 1) + 20;
    sec += slot.sets * perSet + (slot.sets - 1) * slot.restSec + 45;
  }
  return Math.round(sec / 60 + warmupMin + cooldownMin);
}

export const GUIDANCE = {
  calories: '2,100–2,300 kcal per day',
  protein: '190–220 g protein per day (spread over 3–4 meals)',
  walk: 'Daily walk: 30–45 min or 7,000–10,000 steps, every day, including rest days',
  sleep: 'Sleep: protect 7 h where you can; on <6 h nights keep RPE at 7 and skip the finisher',
  meals: [
    'Breakfast: Huel, or kvarg + 3 eggs',
    'Lunch / dinner: chicken + rice or bulgur + vegetables + a tablespoon of olive oil',
    'Snack if needed: kvarg, or a Huel shake after training',
  ],
  rpe: 'RPE 7–8 = 2–3 reps left in the tank. First 2 weeks: stay at RPE 7.',
  progression: 'Double progression: hit the top of the rep range on every set at RPE ≤ 8, then go up to your next dumbbell.',
};
