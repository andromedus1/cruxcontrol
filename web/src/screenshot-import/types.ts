import type { BoardHoldAssignment } from '../board-renderer/types';
import type { ClimbRole } from '../domain/boards/definition';

export interface ScreenshotPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface DetectedRing {
  readonly column: number;
  readonly row: number;
  readonly role: ClimbRole;
  readonly confidence: number;
}

export type ScreenshotImportWarning =
  | { readonly code: 'unsupported-profile'; readonly message: string }
  | {
      readonly code: 'off-grid';
      readonly message: string;
      readonly role: ClimbRole;
      readonly centroid: Readonly<{ x: number; y: number }>;
    }
  | {
      readonly code: 'low-confidence';
      readonly message: string;
      readonly column: number;
      readonly row: number;
      readonly role: ClimbRole;
    }
  | {
      readonly code: 'duplicate-cell';
      readonly message: string;
      readonly column: number;
      readonly row: number;
    }
  | {
      readonly code: 'unresolved-cell';
      readonly message: string;
      readonly column: number;
      readonly row: number;
    }
  | { readonly code: 'title-required'; readonly message: string };

export interface ScreenshotImportCandidate {
  readonly sourceName: string;
  readonly sourceSha256: string;
  readonly name: string;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly warnings: readonly ScreenshotImportWarning[];
}

export interface AnalyzedScreenshot {
  readonly file: File;
  readonly candidate: ScreenshotImportCandidate;
}

export interface ConfirmedScreenshotCandidate {
  readonly sourceName: string;
  readonly name: string;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly warningsOverridden: boolean;
}

export interface SuppliedRingFact {
  readonly column: number;
  readonly row: number;
  readonly role: ClimbRole;
}

export interface SuppliedFullrideClimb {
  readonly sha256: string;
  readonly sourceName: string;
  readonly name: string;
  readonly rings: readonly SuppliedRingFact[];
}
