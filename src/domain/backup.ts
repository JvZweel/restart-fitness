import { DEFAULT_PROGRAM, validateWeekdays } from './program';
import { DEFAULT_WEIGHTS, normalizeWeights } from './weights';
import { EXERCISE_BY_ID } from './exercises';
import type { Backup, DailyLog, ExerciseLog, ProgramSettings, SetLog, Settings, WorkoutLog } from './types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  units: 'kg',
  weights: DEFAULT_WEIGHTS,
  restCompoundSec: 120,
  restAccessorySec: 75,
  autoRest: true,
  sound: true,
  vibrate: true,
  warmupSec: 40,
  cooldownSec: 40,
  showFinisher: true,
};

export interface AppData {
  settings: Settings;
  program: ProgramSettings;
  workouts: WorkoutLog[];
  daily: DailyLog[];
}

export function makeBackup(data: AppData, photos?: Backup['photos'], now = new Date()): Backup {
  return {
    app: 'restart-fitness', version: 1, exportedAt: now.toISOString(),
    settings: data.settings, program: data.program, workouts: data.workouts, daily: data.daily,
    ...(photos && photos.length ? { photos } : {}),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function cleanSettings(s: Record<string, unknown>): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const k of ['restCompoundSec', 'restAccessorySec', 'warmupSec', 'cooldownSec'] as const) if (isNum(s[k]) && s[k] > 0) out[k] = s[k];
  for (const k of ['autoRest', 'sound', 'vibrate', 'showFinisher'] as const) if (typeof s[k] === 'boolean') out[k] = s[k];
  if (s.theme === 'system' || s.theme === 'light' || s.theme === 'dark') out.theme = s.theme;
  out.weights = normalizeWeights(Array.isArray(s.weights) ? (s.weights as number[]) : DEFAULT_WEIGHTS);
  return out;
}

function cleanSets(v: unknown): SetLog[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is SetLog => isObj(x) && isNum(x.weight) && x.weight >= 0 && isNum(x.reps) && x.reps >= 0)
    .map((x) => ({ weight: x.weight, reps: x.reps, rpe: isNum(x.rpe) ? x.rpe : null, done: x.done === true }));
}

function cleanWorkout(w: Record<string, unknown>): WorkoutLog {
  const exercises: ExerciseLog[] = (w.exercises as unknown[])
    // Unknown exercise ids (e.g. a backup from a newer build) would crash screens that look them up.
    .filter((e): e is Record<string, unknown> => isObj(e) && typeof e.exerciseId === 'string' && e.exerciseId in EXERCISE_BY_ID && typeof e.key === 'string' && Array.isArray(e.sets))
    .map((e) => ({ key: e.key as string, exerciseId: e.exerciseId as string, sets: cleanSets(e.sets) }));
  return { ...(w as unknown as WorkoutLog), finishedAt: isNum(w.finishedAt) ? w.finishedAt : null, exercises };
}

function cleanDaily(d: Record<string, unknown>): DailyLog {
  const out: DailyLog = { ...(d as unknown as DailyLog) };
  for (const k of ['weight', 'waist', 'steps', 'sleepH'] as const) if (k in out && !(isNum(d[k]) && (d[k] as number) >= 0)) delete out[k];
  return out;
}

/** Validate and normalise an imported backup. Throws a readable error on anything unusable. */
export function parseBackup(json: string): Backup {
  if (!json.trim()) throw new Error('That file is empty.');
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('That file is not valid JSON. Choose the .json file exported from Settings → Backup.'); }
  if (!isObj(raw) || raw.app !== 'restart-fitness') throw new Error('That is not a Restart Fitness backup.');
  if (raw.version !== 1) throw new Error(`Unsupported backup version ${String(raw.version)}.`);
  const settings = cleanSettings(isObj(raw.settings) ? raw.settings : {});
  const p = isObj(raw.program) ? (raw.program as Partial<ProgramSettings>) : {};
  let weekdays = DEFAULT_PROGRAM.weekdays;
  try { weekdays = validateWeekdays(p.weekdays ?? DEFAULT_PROGRAM.weekdays); } catch { /* keep default */ }
  const swaps = Object.fromEntries(Object.entries(isObj(p.swaps) ? p.swaps : {}).filter(([, id]) => typeof id === 'string' && id in EXERCISE_BY_ID)) as Record<string, string>;
  const program: ProgramSettings = { weekdays, swaps, edits: isObj(p.edits) ? (p.edits as ProgramSettings['edits']) : {} };
  const workouts = Array.isArray(raw.workouts)
    ? (raw.workouts as unknown[]).filter((w): w is Record<string, unknown> => isObj(w) && typeof w.id === 'string' && typeof w.date === 'string' && isNum(w.startedAt) && Array.isArray(w.exercises)).map(cleanWorkout)
    : [];
  const daily = Array.isArray(raw.daily) ? (raw.daily as unknown[]).filter((d): d is Record<string, unknown> => isObj(d) && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date))).map(cleanDaily) : [];
  const photos = Array.isArray(raw.photos) ? (raw.photos as NonNullable<Backup['photos']>).filter((ph) => isObj(ph) && typeof ph.id === 'string' && typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:image/')) : undefined;
  return { app: 'restart-fitness', version: 1, exportedAt: String(raw.exportedAt ?? ''), settings, program, workouts, daily, ...(photos ? { photos } : {}) };
}
