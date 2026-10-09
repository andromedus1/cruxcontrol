import type { ClimbViewRecord } from '../climb-browser/types.ts';
import type { Brand, ProviderClimbId } from '../domain/boards/types.ts';

export type CatalogCursor = Brand<string, 'CatalogCursor'>;

export interface CatalogProvenance {
  readonly source: string;
  readonly snapshotId: string;
  readonly retrievedAt: string | null;
  readonly coverage: string | null;
}

export interface CatalogClimb extends ClimbViewRecord {
  readonly origin: 'provider';
  readonly providerClimbId: ProviderClimbId;
  readonly gradeValue: number;
  readonly nativeGrades: Readonly<{
    scale: string;
    display: number;
    community: number;
    benchmark: number | null;
  }>;
  readonly statistics: Readonly<{
    ascentCount: number;
    quality: number;
  }>;
}

export interface CatalogGradeOption {
  readonly value: number;
  readonly label: string;
}

export interface CatalogClimbQuery {
  readonly angle: number;
  readonly name?: string;
  readonly minGrade?: number;
  readonly maxGrade?: number;
  readonly limit?: number;
  readonly cursor?: CatalogCursor;
}

export interface CatalogPage {
  readonly climbs: readonly CatalogClimb[];
  readonly nextCursor: CatalogCursor | null;
  readonly excludedCount: number;
}

export type CatalogRead<T> =
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'ready'; value: T }>;

export interface CatalogQueryPort {
  readonly provenance: CatalogProvenance;
  query(input: CatalogClimbQuery): Promise<CatalogRead<CatalogPage>>;
  get(id: ProviderClimbId, angle: number): Promise<CatalogRead<CatalogClimb | null>>;
  grades(): Promise<CatalogRead<readonly CatalogGradeOption[]>>;
}

export class CatalogReadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CatalogReadError';
    Object.setPrototypeOf(this, CatalogReadError.prototype);
  }
}
