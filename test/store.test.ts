import { describe, expect, it } from 'vitest';
import { dataUrlToBlob } from '../src/data/store';

describe('backup photo decoding', () => {
  it('decodes a base64 data URL into a typed blob', async () => {
    const b = dataUrlToBlob('data:image/jpeg;base64,AAEC/w==');
    expect(b.type).toBe('image/jpeg');
    expect([...new Uint8Array(await b.arrayBuffer())]).toEqual([0, 1, 2, 255]);
  });
  it('rejects damaged data with a readable message', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow(/damaged/);
  });
});
