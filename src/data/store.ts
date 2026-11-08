import { computed, signal } from '@preact/signals';
import * as DB from './db';
import { DEFAULT_SETTINGS, makeBackup, parseBackup } from '../domain/backup';
import { buildSessions, DEFAULT_PROGRAM } from '../domain/program';
import { getExercise } from '../domain/exercises';
import { suggestNext, type Suggestion } from '../domain/progression';
import { isoDate } from '../domain/dates';
import { normalizeWeights } from '../domain/weights';
import type { DailyLog, ExerciseLog, ProgramSettings, ProgressPhoto, SessionPlan, SetLog, Settings, SlotPrescription, ThemePref, WorkoutLog } from '../domain/types';

export const ready = signal(false);
export const loadError = signal<string | null>(null);
export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const program = signal<ProgramSettings>(DEFAULT_PROGRAM);
export const workouts = signal<WorkoutLog[]>([]); // finished, newest first
export const daily = signal<DailyLog[]>([]); // ascending by date
export const photos = signal<ProgressPhoto[]>([]); // ascending by date
export const active = signal<WorkoutLog | null>(null);
export const toast = signal<{ text: string; kind: 'ok' | 'err'; id: number } | null>(null);

export const sessions = computed<SessionPlan[]>(() => {
  try { return buildSessions(program.value, settings.value); } catch { return buildSessions(DEFAULT_PROGRAM, settings.value); }
});

export function notify(text: string, kind: 'ok' | 'err' = 'ok'): void {
  toast.value = { text, kind, id: Date.now() };
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ── Theme ─────────────────────────────────────────────────────
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
export const systemDark = signal(mq?.matches ?? false);
mq?.addEventListener('change', (e) => { systemDark.value = e.matches; applyTheme(); });
export const isDark = computed(() => settings.value.theme === 'dark' || (settings.value.theme === 'system' && systemDark.value));

export function applyTheme(): void {
  const dark = isDark.value;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1012' : '#f4f5f6');
  try { localStorage.setItem('rf-theme', settings.value.theme); } catch { /* private mode */ }
}

// ── Boot ──────────────────────────────────────────────────────
export async function boot(): Promise<void> {
  try {
    const all = await DB.loadAll();
    settings.value = { ...DEFAULT_SETTINGS, ...(all.settings ?? {}) };
    program.value = all.program ?? DEFAULT_PROGRAM;
    workouts.value = all.workouts.sort((a, b) => b.startedAt - a.startedAt);
    daily.value = all.daily.sort((a, b) => a.date.localeCompare(b.date));
    photos.value = all.photos.sort((a, b) => a.date.localeCompare(b.date));
    active.value = all.active ?? null;
    applyTheme();
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => undefined);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    ready.value = true;
  }
}

// ── Settings & programme ─────────────────────────────────────
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...settings.value, ...patch };
  if (patch.weights) next.weights = normalizeWeights(patch.weights);
  settings.value = next;
  if (patch.theme) applyTheme();
  await DB.setKV(DB.KV.settings, next);
}
export function setTheme(theme: ThemePref): Promise<void> { return updateSettings({ theme }); }

export async function updateProgram(patch: Partial<ProgramSettings>): Promise<void> {
  const next = { ...program.value, ...patch };
  buildSessions(next, settings.value); // throws on invalid day selection
  program.value = next;
  await DB.setKV(DB.KV.program, next);
}

// ── History helpers ───────────────────────────────────────────
export function lastLogFor(exerciseId: string, before = Infinity): ExerciseLog | null {
  for (const w of workouts.value) {
    if (w.startedAt >= before) continue;
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done));
    if (ex) return ex;
  }
  return null;
}

export function suggestionFor(slot: Pick<SlotPrescription, 'exerciseId' | 'repMin' | 'repMax'>): Suggestion {
  const ex = getExercise(slot.exerciseId);
  const last = lastLogFor(slot.exerciseId, active.value?.startedAt ?? Infinity);
  return suggestNext(ex, slot.repMin, slot.repMax, last?.sets ?? null, settings.value.weights);
}

function seedSets(slot: SlotPrescription): SetLog[] {
  const s = suggestionFor(slot);
  return Array.from({ length: slot.sets }, () => ({ weight: s.weight, reps: s.reps, rpe: null, done: false }));
}

// ── Active workout ────────────────────────────────────────────
export async function startWorkout(sessionIndex: number): Promise<void> {
  const plan = sessions.value[sessionIndex] ?? sessions.value[0];
  const w: WorkoutLog = {
    id: uid(), date: isoDate(), startedAt: Date.now(), finishedAt: null, sessionIndex: plan.index, sessionName: plan.name,
    phase: 'warmup', cursor: 0, exercises: [], warmupDone: false, finisherDone: null, cooldownDone: false, restEndsAt: null, notes: '',
  };
  active.value = w;
  w.exercises = plan.slots.map((slot) => ({ key: slot.key, exerciseId: slot.exerciseId, sets: seedSets(slot) }));
  active.value = { ...w };
  await DB.setKV(DB.KV.active, active.value);
}

export async function updateActive(fn: (w: WorkoutLog) => WorkoutLog): Promise<void> {
  if (!active.value) return;
  const next = fn(structuredClone(active.value));
  active.value = next;
  await DB.setKV(DB.KV.active, next);
}

export function planForActive(): SessionPlan | null {
  const w = active.value;
  if (!w) return null;
  return sessions.value.find((s) => s.index === w.sessionIndex) ?? null;
}

export async function finishWorkout(): Promise<WorkoutLog | null> {
  const w = active.value;
  if (!w) return null;
  const done: WorkoutLog = { ...w, finishedAt: Date.now(), phase: 'summary', restEndsAt: null };
  await DB.putWorkout(done);
  await DB.delKV(DB.KV.active);
  workouts.value = [done, ...workouts.value].sort((a, b) => b.startedAt - a.startedAt);
  active.value = null;
  return done;
}

export async function discardWorkout(): Promise<void> {
  active.value = null;
  await DB.delKV(DB.KV.active);
}

export async function removeWorkout(id: string): Promise<void> {
  await DB.deleteWorkout(id);
  workouts.value = workouts.value.filter((w) => w.id !== id);
}

// ── Daily log ─────────────────────────────────────────────────
export function dailyFor(date: string): DailyLog | undefined {
  return daily.value.find((d) => d.date === date);
}

export async function saveDaily(date: string, patch: Partial<DailyLog>): Promise<void> {
  const cur = dailyFor(date) ?? { date };
  const next: DailyLog = { ...cur, ...patch, date, source: 'manual' };
  for (const k of ['weight', 'waist', 'steps', 'sleepH'] as const) if (next[k] == null || Number.isNaN(next[k])) delete next[k];
  await DB.putDaily(next);
  daily.value = [...daily.value.filter((d) => d.date !== date), next].sort((a, b) => a.date.localeCompare(b.date));
}

export async function mergeDailyRows(rows: DailyLog[]): Promise<void> {
  await DB.putDailyMany(rows);
  const map = new Map(daily.value.map((d) => [d.date, d]));
  for (const r of rows) map.set(r.date, r);
  daily.value = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Most recent value of a daily metric, for smart defaults. */
export function lastValue(key: 'weight' | 'waist' | 'steps' | 'sleepH'): number | undefined {
  for (let i = daily.value.length - 1; i >= 0; i--) { const v = daily.value[i][key]; if (v != null) return v; }
  return undefined;
}

// ── Photos ────────────────────────────────────────────────────
export async function compressImage(file: Blob, max = 1280, quality = 0.8): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/jpeg', quality));
  return { blob, width, height };
}

export async function addPhoto(file: Blob, date = isoDate()): Promise<void> {
  const { blob, width, height } = await compressImage(file);
  const p: ProgressPhoto = { id: uid(), date, blob, width, height };
  await DB.putPhoto(p);
  photos.value = [...photos.value, p].sort((a, b) => a.date.localeCompare(b.date));
}

export async function removePhoto(id: string): Promise<void> {
  await DB.deletePhoto(id);
  photos.value = photos.value.filter((p) => p.id !== id);
}

// ── Backup ────────────────────────────────────────────────────
const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

export async function exportBackupJson(includePhotos: boolean): Promise<string> {
  const ph = includePhotos ? await Promise.all(photos.value.map(async (p) => ({ id: p.id, date: p.date, width: p.width, height: p.height, dataUrl: await blobToDataUrl(p.blob) }))) : undefined;
  return JSON.stringify(makeBackup({ settings: settings.value, program: program.value, workouts: workouts.value, daily: daily.value }, ph));
}

export async function importBackupJson(json: string): Promise<{ workouts: number; days: number; photos: number }> {
  const b = parseBackup(json);
  const ph: ProgressPhoto[] = await Promise.all((b.photos ?? []).map(async (p) => ({ id: p.id, date: p.date, width: p.width, height: p.height, blob: await dataUrlToBlob(p.dataUrl) })));
  // Keep existing photos when the backup carries none.
  const keepPhotos = ph.length ? ph : photos.value;
  await DB.replaceAll({ settings: b.settings, program: b.program, workouts: b.workouts, daily: b.daily, photos: keepPhotos });
  settings.value = b.settings;
  program.value = b.program;
  workouts.value = [...b.workouts].sort((a, c) => c.startedAt - a.startedAt);
  daily.value = [...b.daily].sort((a, c) => a.date.localeCompare(c.date));
  photos.value = [...keepPhotos].sort((a, c) => a.date.localeCompare(c.date));
  applyTheme();
  return { workouts: b.workouts.length, days: b.daily.length, photos: ph.length };
}

export async function resetAll(): Promise<void> {
  await DB.replaceAll({ settings: DEFAULT_SETTINGS, program: DEFAULT_PROGRAM, workouts: [], daily: [], photos: [] });
  await DB.delKV(DB.KV.active);
  settings.value = DEFAULT_SETTINGS;
  program.value = DEFAULT_PROGRAM;
  workouts.value = [];
  daily.value = [];
  photos.value = [];
  active.value = null;
  applyTheme();
}
