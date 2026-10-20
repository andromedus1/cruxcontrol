import type { CatalogManifest } from '../data/catalog/manifest.ts';
import type { CatalogProvenance, CatalogRatingScale } from './types.ts';
import { formatCalendarDate } from '../climb-browser/calendar-date.ts';

/** The legacy Aurora snapshot rates climbs on a three-star scale. */
export const LEGACY_RATING_SCALE: CatalogRatingScale = Object.freeze({ min: 0, max: 3 });

const LEGACY_COVERAGE = 'Older offline snapshot; current first-party coverage is unknown; no live updates';
const BOARDSESH_COVERAGE = 'Community catalog derived from Boardsesh snapshots; not official Kilter data';

export interface CatalogSourceCopy {
  readonly kind: 'legacy' | 'boardsesh' | 'unknown';
  /** Short source name used inside labels ("Filter <name> climbs", "Downloading <name>…"). */
  readonly name: string;
  /** Manage dialog heading. */
  readonly title: string;
  /** First line of the catalog source row. */
  readonly headline: string;
  /** Second line of the catalog source row. */
  readonly summary: string;
  /** Eyebrow shown above an individual catalog climb. */
  readonly climbLabel: string;
  /** Empty-state guidance before the catalog is installed. */
  readonly setupDescription: string;
}

export function catalogRatingScale(manifest: CatalogManifest): CatalogRatingScale {
  return manifest.schemaVersion === 3 ? manifest.qualityScale : LEGACY_RATING_SCALE;
}

/** Human description of a rating scale: "three-star" for the legacy scale, otherwise "0–5". */
export function ratingScaleDescription(scale: CatalogRatingScale): string {
  return scale.min === LEGACY_RATING_SCALE.min && scale.max === LEGACY_RATING_SCALE.max
    ? 'three-star'
    : `${scale.min}–${scale.max}`;
}

const UNKNOWN_COPY: CatalogSourceCopy = Object.freeze({
  kind: 'unknown',
  name: 'Kilter catalog',
  title: 'Kilter catalog',
  headline: 'Kilter catalog',
  summary: 'Offline climb catalog · source details shown before download',
  climbLabel: 'Kilter catalog · read only',
  setupDescription: 'Set up the offline catalog to search and preview compatible climbs.',
});

const LEGACY_COPY: CatalogSourceCopy = Object.freeze({
  kind: 'legacy',
  name: 'Legacy Kilter',
  title: 'Legacy Kilter catalog',
  headline: 'Legacy Kilter',
  summary: 'Older offline snapshot · no live updates',
  climbLabel: 'Legacy Kilter · read only',
  setupDescription: 'Set up the older offline snapshot to search and preview compatible climbs.',
});

/**
 * Selects the source wording for a catalog manifest. `null` means no manifest has been
 * read yet (nothing installed and no offer loaded), so the wording claims no source.
 */
export function catalogSourceCopy(manifest: CatalogManifest | null): CatalogSourceCopy {
  if (manifest === null) return UNKNOWN_COPY;
  if (manifest.schemaVersion === 2) return LEGACY_COPY;
  return Object.freeze({
    kind: 'boardsesh',
    name: 'Kilter community',
    title: 'Kilter community catalog',
    headline: `Kilter community climbs via Boardsesh · updated ${formatCalendarDate(manifest.generatedOn)}`,
    summary: 'Not official Kilter data · setters credited',
    climbLabel: 'Kilter community via Boardsesh · read only',
    setupDescription: 'Set up the Kilter community catalog to search and preview compatible climbs.',
  });
}

export function catalogProvenance(manifest: CatalogManifest): CatalogProvenance {
  return manifest.schemaVersion === 3
    ? {
        source: 'Kilter community climbs via Boardsesh',
        snapshotId: manifest.sha256,
        retrievedAt: manifest.sourceBuiltAt,
        coverage: BOARDSESH_COVERAGE,
      }
    : {
        source: 'Legacy Kilter (Aurora)',
        snapshotId: manifest.sha256,
        retrievedAt: null,
        coverage: LEGACY_COVERAGE,
      };
}
