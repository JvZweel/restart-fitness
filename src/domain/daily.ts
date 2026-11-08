import type { DailyLog } from './types';

export type DailyKey = 'weight' | 'waist' | 'steps' | 'sleepH';

/** Plausible ranges for hand-typed daily values (catches typos like 925 kg or 80 h of sleep). */
export const DAILY_RANGE: Record<DailyKey, { min: number; max: number; label: string; unit: string }> = {
  weight: { min: 30, max: 300, label: 'Body weight', unit: 'kg' },
  waist: { min: 40, max: 250, label: 'Waist', unit: 'cm' },
  steps: { min: 0, max: 100000, label: 'Steps', unit: '' },
  sleepH: { min: 0, max: 24, label: 'Sleep', unit: 'h' },
};

/** Parse one text field ("92,5" or "92.5"); '' means not entered. */
export function parseDailyField(raw: string): number | undefined | null {
  const t = raw.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Validate a quick-log form. Returns the patch, or per-field error messages. */
export function validateDaily(fields: Record<DailyKey, string>): { patch: Partial<DailyLog>; errors: Partial<Record<DailyKey, string>> } {
  const patch: Partial<DailyLog> = {};
  const errors: Partial<Record<DailyKey, string>> = {};
  for (const k of Object.keys(DAILY_RANGE) as DailyKey[]) {
    const v = parseDailyField(fields[k]);
    const r = DAILY_RANGE[k];
    if (v === undefined) continue;
    if (v === null || v < r.min || v > r.max) { errors[k] = `${r.label}: enter ${r.min}–${r.max.toLocaleString('en')}${r.unit ? ` ${r.unit}` : ''}`; continue; }
    patch[k] = k === 'steps' ? Math.round(v) : v;
  }
  return { patch, errors };
}
