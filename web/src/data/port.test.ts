import { describe, expect, it } from 'vitest';
import type { Row } from './port.ts';
import { MockCatalogPort } from './mock-port.ts';

describe('MockCatalogPort', () => {
  it('returns seeded rows for a known query', async () => {
    const rows: Row[] = [
      { uuid: 'abc', name: 'Test Climb', angle: 40 },
      { uuid: 'def', name: 'Another', angle: 25 },
    ];
    const port = new MockCatalogPort();
    port.seed('SELECT uuid, name, angle FROM climbs', rows);

    const result = await port.query('SELECT uuid, name, angle FROM climbs');
    expect(result).toEqual(rows);
  });

  it('returns an empty array for an unseeded query', async () => {
    const port = new MockCatalogPort();
    expect(await port.query('SELECT 1')).toEqual([]);
  });

  it('reports readiness and flips to not-ready after close', async () => {
    const port = new MockCatalogPort();
    expect(await port.isReady()).toBe(true);
    await port.close();
    expect(await port.isReady()).toBe(false);
  });
});
