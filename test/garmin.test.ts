import { describe, expect, it } from 'vitest';
import { parseGarminCsv, parseDate, parseDurationHours, parseNumber, parseWeightKg, mergeDaily } from '../src/domain/garmin';

describe('garmin field parsers', () => {
  it('dates', () => {
    expect(parseDate('2026-11-03')).toBe('2026-11-03');
    expect(parseDate('2026-11-03 07:12:00')).toBe('2026-11-03');
    expect(parseDate('11/03/2026')).toBe('2026-11-03');
    expect(parseDate('23/10/2026')).toBe('2026-10-23');
    expect(parseDate('03.11.2026')).toBe('2026-11-03');
    expect(parseDate('Nov 3, 2026')).toBe('2026-11-03');
    expect(parseDate(' Nov 3, 2026')).toBe('2026-11-03');
    expect(parseDate('Mon, Nov 3', 2026)).toBe('2026-11-03');
    expect(parseDate('3 Nov 2026')).toBe('2026-11-03');
    expect(parseDate('Sept 9, 2026')).toBe('2026-09-09');
    expect(parseDate('Steps')).toBeNull();
    expect(parseDate('7:12')).toBeNull();
  });
  it('numbers, durations, weights', () => {
    expect(parseNumber('10,234')).toBe(10234);
    expect(parseNumber('104,2')).toBe(104.2);
    expect(parseNumber('--')).toBeNull();
    expect(parseDurationHours('7h 12min')).toBe(7.2);
    expect(parseDurationHours('6h')).toBe(6);
    expect(parseDurationHours('7:30')).toBe(7.5);
    expect(parseDurationHours('432')).toBe(7.2);
    expect(parseDurationHours('25920')).toBe(7.2);
    expect(parseDurationHours('6.5')).toBe(6.5);
    expect(parseWeightKg('104.2 kg')).toBe(104.2);
    expect(parseWeightKg('229.7 lbs')).toBe(104.2);
    expect(parseWeightKg('229.7', 'Weight (lbs)')).toBe(104.2);
    expect(parseWeightKg('5')).toBeNull();
  });
});

describe('garmin CSV exports', () => {
  it('steps report', () => {
    const csv = ',Actual,Goal\n2026-11-01,"8,412","7,500"\n2026-11-02,10234,7500\n2026-11-03,--,7500\n';
    const r = parseGarminCsv(csv);
    expect(r.detected).toEqual(['steps']);
    expect(r.rows).toEqual([{ date: '2026-11-01', steps: 8412 }, { date: '2026-11-02', steps: 10234 }]);
    expect(r.skipped).toBe(1);
  });
  it('sleep report with score columns', () => {
    const csv = 'Sleep Score 7 Days,Score,Resting Heart Rate,Body Battery,Quality,Duration,Sleep Need,Bedtime,Wake Time\n'
      + '2026-11-02,72,58,45,Fair,6h 24min,8h 0min,11:40 PM,6:10 AM\n'
      + '2026-11-03,81,56,60,Good,7h 6min,7h 50min,11:05 PM,6:15 AM\n';
    const r = parseGarminCsv(csv);
    expect(r.detected).toContain('sleep');
    expect(r.rows).toEqual([{ date: '2026-11-02', sleepH: 6.4 }, { date: '2026-11-03', sleepH: 7.1 }]);
  });
  it('weight export with date lines and time rows, latest reading wins', () => {
    const csv = 'Time,Weight,Change,BMI,Body Fat,Skeletal Muscle Mass,Bone Mass,Body Water\n'
      + '" Nov 3, 2026",\n'
      + '7:05 AM,104.1 kg,0.3 kg,31.4,--,--,--,--\n'
      + '"Nov 2, 2026",\n'
      + '7:12 AM,103.8 kg,--,31.3,--,--,--,--\n';
    const r = parseGarminCsv(csv);
    expect(r.detected).toEqual(['weight']);
    expect(r.rows).toEqual([{ date: '2026-11-02', weight: 103.8 }, { date: '2026-11-03', weight: 104.1 }]);
  });
  it('semicolon, BOM and EU decimals', () => {
    const csv = '\uFEFFDatum;Vikt;Steg\n03.11.2026;104,2;9 100\n';
    expect(parseGarminCsv(csv).rows).toEqual([{ date: '2026-11-03', weight: 104.2, steps: 9100 }]);
  });
  it('preamble lines before the header and empty file', () => {
    expect(parseGarminCsv('Garmin Connect export\n\nDate,Steps\n2026-11-04,6000').rows).toEqual([{ date: '2026-11-04', steps: 6000 }]);
    expect(parseGarminCsv('').rows).toEqual([]);
  });
  it('merge fills gaps by default, overwrites when asked', () => {
    const existing = [{ date: '2026-11-02', weight: 104.5, sleepH: 6 }];
    const rows = [{ date: '2026-11-02', weight: 103.8, steps: 9000 }, { date: '2026-11-03', sleepH: 7 }];
    expect(mergeDaily(existing, rows, false)).toEqual([
      { date: '2026-11-02', weight: 104.5, sleepH: 6, steps: 9000, source: 'garmin' },
      { date: '2026-11-03', sleepH: 7, source: 'garmin' },
    ]);
    expect(mergeDaily(existing, rows, true)[0].weight).toBe(103.8);
  });
});
