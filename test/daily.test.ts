import { describe, expect, it } from 'vitest';
import { validateDaily } from '../src/domain/daily';

describe('quick log validation', () => {
  it('accepts comma decimals and skips empty fields', () => {
    expect(validateDaily({ weight: '92,5', waist: '', steps: '8200', sleepH: '6.5' })).toEqual({ patch: { weight: 92.5, steps: 8200, sleepH: 6.5 }, errors: {} });
  });
  it('flags typos and out-of-range values per field', () => {
    const r = validateDaily({ weight: '925', waist: 'abc', steps: '-3', sleepH: '25' });
    expect(Object.keys(r.errors).sort()).toEqual(['sleepH', 'steps', 'waist', 'weight']);
    expect(r.patch).toEqual({});
    expect(r.errors.weight).toMatch(/30–300 kg/);
  });
  it('rounds steps to whole numbers', () => {
    expect(validateDaily({ weight: '', waist: '', steps: '8200.6', sleepH: '' }).patch).toEqual({ steps: 8201 });
  });
});
