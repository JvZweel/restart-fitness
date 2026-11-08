import { isoDate } from './dates';
import type { DailyLog } from './types';

/**
 * Tolerant parser for Garmin Connect CSV exports (Reports → Sleep / Steps / Weight → export, or
 * the account data export). Handles comma / semicolon / tab separators, quoted fields, header rows
 * that are not on line 1, "date on its own line" weight exports, and many date / duration formats.
 */
export interface GarminRow { date: string; steps?: number; sleepH?: number; weight?: number }
export interface GarminParseResult { rows: GarminRow[]; detected: string[]; skipped: number }

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  maj: 5, okt: 10, mars: 3, juni: 6, juli: 7, augusti: 8 };

export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { out.push(cur.trim()); cur = ''; } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function detectSep(lines: string[]): string {
  const sample = lines.slice(0, 10).join('\n');
  const counts = [',', ';', '\t'].map((s) => [s, sample.split(s).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

function monthOf(word: string): number | undefined {
  const w = word.toLowerCase();
  return MONTHS[w.slice(0, 4)] ?? MONTHS[w.slice(0, 3)];
}

/** Parse many date spellings into YYYY-MM-DD; returns null when it is not a date. */
export function parseDate(raw: string, refYear = new Date().getFullYear()): string | null {
  const s = raw.trim().replace(/^"|"$/g, '');
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); // 03.11.2026 (EU)
  if (m) return mk(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // 11/03/2026 (US, Garmin default) – day>12 means EU
  if (m) return +m[1] > 12 ? mk(+m[3], +m[2], +m[1]) : mk(+m[3], +m[1], +m[2]);
  m = s.match(/^(?:[A-Za-z]{2,9},?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/); // Nov 3, 2026 / Mon, Nov 3
  if (m && monthOf(m[1])) return mk(m[3] ? +m[3] : refYear, monthOf(m[1])!, +m[2]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:\s+(\d{4}))?/); // 3 Nov 2026
  if (m && monthOf(m[2])) return mk(m[3] ? +m[3] : refYear, monthOf(m[2])!, +m[1]);
  return null;
}

function mk(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getMonth() !== mo - 1) return null;
  return isoDate(dt);
}

export function parseNumber(raw: string): number | null {
  const s = raw.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!s || s === '--' || s === '-') return null;
  // "10,234" (thousands) vs "104,2" (decimal comma)
  let norm: string;
  if (/^\d{1,3}(,\d{3})+$/.test(s)) norm = s.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(s)) norm = s.replace(',', '.');
  else norm = s.replace(/,/g, '');
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : null;
}

/** Sleep duration → hours. Accepts "7h 12min", "7h12m", "7:12", "7.2", "432" (minutes), "25920" (seconds). */
export function parseDurationHours(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s || s === '--') return null;
  let m = s.match(/(\d+)\s*h(?:rs?|ours?)?\s*(?:(\d+)\s*m)?/);
  if (m) return round1(+m[1] + (m[2] ? +m[2] / 60 : 0));
  m = s.match(/^(\d+)\s*m(?:in)?/);
  if (m) return round1(+m[1] / 60);
  m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return round1(+m[1] + +m[2] / 60);
  const n = parseNumber(s);
  if (n == null) return null;
  if (n <= 24) return round1(n);
  if (n <= 24 * 60) return round1(n / 60);
  if (n <= 24 * 3600) return round1(n / 3600);
  return null;
}

/** Weight with optional unit → kg. */
export function parseWeightKg(raw: string, headerHint = ''): number | null {
  const n = parseNumber(raw);
  if (n == null || n <= 0) return null;
  const lbs = /lb/i.test(raw) || (/lb/i.test(headerHint) && !/kg/i.test(raw));
  const kg = lbs ? n * 0.45359237 : n;
  return kg > 20 && kg < 400 ? round1(kg) : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

type Col = { idx: number; header: string };

export function parseGarminCsv(text: string, refYear?: number): GarminParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { rows: [], detected: [], skipped: 0 };
  const sep = detectSep(lines);
  const table = lines.map((l) => splitCsvLine(l, sep));

  // Header = first row containing a recognisable metric or date label.
  const isHeader = (r: string[]) => r.some((c) => /(date|day|time|steps|sleep|duration|weight|actual|vikt|steg|datum)/i.test(c)) && r.every((c) => parseDate(c) == null);
  const hIdx = table.findIndex(isHeader);
  const header = hIdx >= 0 ? table[hIdx] : [];
  const body = table.slice(hIdx >= 0 ? hIdx + 1 : 0);
  const find = (re: RegExp, not?: RegExp): Col | null => {
    const idx = header.findIndex((h) => re.test(h) && !(not && not.test(h)));
    return idx >= 0 ? { idx, header: header[idx] } : null;
  };
  let dateCol = find(/^(date|day|calendar date|datum|sleep score 7 days|time)$/i) ?? find(/date|datum/i);
  const stepsCol = find(/steps|steg/i, /goal|mål/i) ?? find(/^actual$/i);
  const sleepCol = find(/^(duration|total sleep|sleep time|sleep duration|sömn)/i) ?? find(/sleep.*(dur|time|hours)|asleep/i);
  const weightCol = find(/^weight|vikt/i, /change|goal/i);
  if (!dateCol) dateCol = { idx: 0, header: header[0] ?? '' };

  const detected: string[] = [];
  if (stepsCol) detected.push('steps');
  if (sleepCol) detected.push('sleep');
  if (weightCol) detected.push('weight');

  const byDate = new Map<string, GarminRow>();
  let carryDate: string | null = null;
  let skipped = 0;
  for (const r of body) {
    const cell = (c: Col | null) => (c ? r[c.idx] ?? '' : '');
    let date = parseDate(cell(dateCol), refYear);
    // Weight exports put the date alone on a line, then time rows underneath.
    if (date && r.filter((c) => c).length === 1) { carryDate = date; continue; }
    if (!date && carryDate && /^\s*\d{1,2}:\d{2}/.test(cell(dateCol))) date = carryDate;
    if (!date) date = r.map((c) => parseDate(c, refYear)).find((d) => d) ?? null;
    if (!date) { skipped++; continue; }
    const row: GarminRow = byDate.get(date) ?? { date };
    const st = stepsCol ? parseNumber(cell(stepsCol)) : null;
    const sl = sleepCol ? parseDurationHours(cell(sleepCol)) : null;
    const w = weightCol ? parseWeightKg(cell(weightCol), weightCol.header) : null;
    if (st != null && st >= 0 && st < 200000) row.steps = Math.round(st);
    if (sl != null && sl > 0) row.sleepH = sl;
    if (w != null && row.weight == null) row.weight = w; // first (latest) reading of the day
    if (row.steps == null && row.sleepH == null && row.weight == null) { skipped++; continue; }
    byDate.set(date, row);
  }
  return { rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), detected, skipped };
}

/** Merge imported rows into daily logs by date. `overwrite` replaces existing values; otherwise fills gaps only. */
export function mergeDaily(existing: DailyLog[], rows: GarminRow[], overwrite: boolean): DailyLog[] {
  const map = new Map(existing.map((d) => [d.date, { ...d }]));
  for (const r of rows) {
    const cur: DailyLog = map.get(r.date) ?? { date: r.date };
    for (const k of ['steps', 'sleepH', 'weight'] as const) {
      const v = r[k];
      if (v == null) continue;
      if (overwrite || cur[k] == null) { cur[k] = v; cur.source = 'garmin'; }
    }
    map.set(r.date, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
