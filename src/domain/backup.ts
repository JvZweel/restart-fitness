import { DEFAULT_PROGRAM, validateWeekdays } from './program';
import { DEFAULT_WEIGHTS, normalizeWeights } from './weights';
import type { Backup, DailyLog, ProgramSettings, Settings, WorkoutLog } from './types';

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

/** Validate and normalise an imported backup. Throws a readable error on anything unusable. */
export function parseBackup(json: string): Backup {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('That file is not valid JSON.'); }
  if (!isObj(raw) || raw.app !== 'restart-fitness') throw new Error('That is not a Restart Fitness backup.');
  if (raw.version !== 1) throw new Error(`Unsupported backup version ${String(raw.version)}.`);
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(s as Partial<Settings>) };
  settings.weights = normalizeWeights(Array.isArray(s.weights) ? (s.weights as number[]) : DEFAULT_WEIGHTS);
  if (!['system', 'light', 'dark'].includes(settings.theme)) settings.theme = 'system';
  const p = isObj(raw.program) ? (raw.program as Partial<ProgramSettings>) : {};
  let weekdays = DEFAULT_PROGRAM.weekdays;
  try { weekdays = validateWeekdays(p.weekdays ?? DEFAULT_PROGRAM.weekdays); } catch { /* keep default */ }
  const program: ProgramSettings = { weekdays, swaps: isObj(p.swaps) ? (p.swaps as Record<string, string>) : {}, edits: isObj(p.edits) ? (p.edits as ProgramSettings['edits']) : {} };
  const workouts = Array.isArray(raw.workouts) ? (raw.workouts as WorkoutLog[]).filter((w) => isObj(w) && typeof w.id === 'string' && typeof w.date === 'string' && Array.isArray(w.exercises)) : [];
  const daily = Array.isArray(raw.daily) ? (raw.daily as DailyLog[]).filter((d) => isObj(d) && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) : [];
  const photos = Array.isArray(raw.photos) ? (raw.photos as NonNullable<Backup['photos']>).filter((ph) => isObj(ph) && typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:image/')) : undefined;
  return { app: 'restart-fitness', version: 1, exportedAt: String(raw.exportedAt ?? ''), settings, program, workouts, daily, ...(photos ? { photos } : {}) };
}
