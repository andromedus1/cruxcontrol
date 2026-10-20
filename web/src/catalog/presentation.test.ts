import { describe, expect, it } from 'vitest';
import type { CatalogManifest } from '../data/catalog/manifest.ts';
import {
  LEGACY_RATING_SCALE,
  catalogProvenance,
  catalogRatingScale,
  catalogSourceCopy,
  catalogUpdateSummary,
  ratingScaleDescription,
} from './presentation.ts';
import { formatCalendarDate as formatCatalogDate } from '../climb-browser/calendar-date.ts';

const shared = {
  version: 2,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v2.db.gz',
  compression: 'gzip',
  sha256: 'd'.repeat(64),
  bytesGzipped: 10,
  bytesRaw: 100,
  generatedOn: '2026-10-19',
  generatedFrom: 'presentation fixture',
  filter: 'layout_id=8',
} as const;

const legacy: CatalogManifest = {
  ...shared,
  schemaVersion: 2,
  source: 'legacy-aurora-kilter',
  sourceDataThrough: null,
};

const boardsesh: CatalogManifest = {
  ...shared,
  schemaVersion: 3,
  source: 'boardsesh-kilter',
  sourceBuiltAt: '2026-10-18T23:59:00.000Z',
  sourceWatermarks: {},
  layoutRevision: 'kilter:7:8:17:f0d70b3db9a6',
  qualityScale: { min: 0, max: 5 },
  climbCount: 3,
  removedUpstreamCount: 1,
  changes: null,
};

describe('catalog presentation', () => {
  it('keeps the legacy snapshot wording and provenance unchanged', () => {
    expect(catalogSourceCopy(legacy)).toEqual({
      kind: 'legacy',
      name: 'Legacy Kilter',
      title: 'Legacy Kilter catalog',
      headline: 'Legacy Kilter',
      summary: 'Older offline snapshot · no live updates',
      climbLabel: 'Legacy Kilter · read only',
      setupDescription: 'Set up the older offline snapshot to search and preview compatible climbs.',
    });
    expect(catalogProvenance(legacy)).toEqual({
      source: 'Legacy Kilter (Aurora)',
      snapshotId: legacy.sha256,
      retrievedAt: null,
      coverage: 'Older offline snapshot; current first-party coverage is unknown; no live updates',
    });
  });

  it('presents a Boardsesh catalog as a community catalog with its build date, never as official data', () => {
    const copy = catalogSourceCopy(boardsesh);
    expect(copy.kind).toBe('boardsesh');
    expect(copy.headline).toBe(`Kilter community climbs via Boardsesh · updated ${formatCatalogDate('2026-10-19')}`);
    expect(copy.summary).toBe('Not official Kilter data · setters credited');
    expect(copy.title).toBe('Kilter community catalog');
    expect(copy.climbLabel).toBe('Kilter community via Boardsesh · read only');
    expect(Object.values(copy).join(' ')).not.toMatch(/Legacy|Older offline snapshot/);
    expect(catalogProvenance(boardsesh)).toEqual({
      source: 'Kilter community climbs via Boardsesh',
      snapshotId: boardsesh.sha256,
      retrievedAt: '2026-10-18T23:59:00.000Z',
      coverage: 'Community catalog derived from Boardsesh snapshots; not official Kilter data',
    });
  });

  it('claims no source before any manifest is known', () => {
    const copy = catalogSourceCopy(null);
    expect(copy.kind).toBe('unknown');
    expect(Object.values(copy).join(' ')).not.toMatch(/Legacy|Older|Boardsesh|official/);
  });

  it('formats calendar dates in UTC regardless of the local offset', () => {
    expect(formatCatalogDate('2026-10-19')).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
        .format(Date.UTC(2026, 9, 19)),
    );
    expect(formatCatalogDate('2026-10-18T23:59:00.000Z')).toBe(formatCatalogDate('2026-10-18'));
  });

  it('derives the rating scale from the installed manifest', () => {
    expect(catalogRatingScale(legacy)).toBe(LEGACY_RATING_SCALE);
    expect(catalogRatingScale(legacy)).toEqual({ min: 0, max: 3 });
    expect(catalogRatingScale(boardsesh)).toEqual({ min: 0, max: 5 });
    expect(ratingScaleDescription(LEGACY_RATING_SCALE)).toBe('three-star');
    expect(ratingScaleDescription({ min: 0, max: 5 })).toBe('0–5');
  });

  it('summarizes an update offer from its change counts, or its version when none are reported', () => {
    expect(catalogUpdateSummary(3, { added: 1261, removed: 23, restored: 0 })).toBe('1,261 new climbs · 23 removed');
    expect(catalogUpdateSummary(3, { added: 1, removed: 0, restored: 2 })).toBe('1 new climb · 0 removed · 2 restored');
    expect(catalogUpdateSummary(4, null)).toBe('Version 4 is available');
  });
});
