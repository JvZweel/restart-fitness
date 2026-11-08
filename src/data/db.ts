import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DailyLog, ProgramSettings, ProgressPhoto, Settings, WorkoutLog } from '../domain/types';

interface RFSchema extends DBSchema {
  kv: { key: string; value: unknown };
  workouts: { key: string; value: WorkoutLog; indexes: { date: string } };
  daily: { key: string; value: DailyLog };
  photos: { key: string; value: ProgressPhoto; indexes: { date: string } };
}

let dbp: Promise<IDBPDatabase<RFSchema>> | null = null;

export function db(): Promise<IDBPDatabase<RFSchema>> {
  dbp ??= openDB<RFSchema>('restart-fitness', 1, {
    upgrade(d) {
      d.createObjectStore('kv');
      d.createObjectStore('workouts', { keyPath: 'id' }).createIndex('date', 'date');
      d.createObjectStore('daily', { keyPath: 'date' });
      d.createObjectStore('photos', { keyPath: 'id' }).createIndex('date', 'date');
    },
  });
  return dbp;
}

export const KV = { settings: 'settings', program: 'program', active: 'activeWorkout' } as const;

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('kv', key)) as T | undefined;
}
export async function setKV(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key);
}
export async function delKV(key: string): Promise<void> {
  await (await db()).delete('kv', key);
}

export async function loadAll(): Promise<{ settings?: Settings; program?: ProgramSettings; active?: WorkoutLog; workouts: WorkoutLog[]; daily: DailyLog[]; photos: ProgressPhoto[] }> {
  const d = await db();
  const [settings, program, active, workouts, daily, photos] = await Promise.all([
    d.get('kv', KV.settings) as Promise<Settings | undefined>,
    d.get('kv', KV.program) as Promise<ProgramSettings | undefined>,
    d.get('kv', KV.active) as Promise<WorkoutLog | undefined>,
    d.getAll('workouts'), d.getAll('daily'), d.getAll('photos'),
  ]);
  return { settings, program, active, workouts, daily, photos };
}

export async function putWorkout(w: WorkoutLog): Promise<void> { await (await db()).put('workouts', w); }
export async function deleteWorkout(id: string): Promise<void> { await (await db()).delete('workouts', id); }
export async function putDaily(d: DailyLog): Promise<void> { await (await db()).put('daily', d); }
export async function putDailyMany(list: DailyLog[]): Promise<void> {
  const tx = (await db()).transaction('daily', 'readwrite');
  await Promise.all([...list.map((d) => tx.store.put(d)), tx.done]);
}
export async function putPhoto(p: ProgressPhoto): Promise<void> { await (await db()).put('photos', p); }
export async function deletePhoto(id: string): Promise<void> { await (await db()).delete('photos', id); }

/** Replace everything (backup import / reset). */
export async function replaceAll(data: { settings: Settings; program: ProgramSettings; workouts: WorkoutLog[]; daily: DailyLog[]; photos: ProgressPhoto[] }): Promise<void> {
  const d = await db();
  const tx = d.transaction(['kv', 'workouts', 'daily', 'photos'], 'readwrite');
  await Promise.all([
    tx.objectStore('kv').clear(), tx.objectStore('workouts').clear(), tx.objectStore('daily').clear(), tx.objectStore('photos').clear(),
  ]);
  await Promise.all([
    tx.objectStore('kv').put(data.settings, KV.settings),
    tx.objectStore('kv').put(data.program, KV.program),
    ...data.workouts.map((w) => tx.objectStore('workouts').put(w)),
    ...data.daily.map((x) => tx.objectStore('daily').put(x)),
    ...data.photos.map((p) => tx.objectStore('photos').put(p)),
    tx.done,
  ]);
}
