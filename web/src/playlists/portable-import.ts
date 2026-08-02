import type { LocalDraftRepository } from '../drafts/repository.ts';
import type { LocalClimbDraft } from '../drafts/types.ts';
import type {
  BoardInstallationId,
  ConfiguredBoardInstallation,
} from '../installations/contracts.ts';
import { decodePortablePlaylist } from './portable-codec.ts';
import type { PortablePlaylistV1 } from './portable-types.ts';
import type { LocalPlaylistRepository } from './repository.ts';
import type { LocalPlaylist, PlaylistClimbReference } from './types.ts';

export interface PlaylistImportPlan {
  readonly source: PortablePlaylistV1;
  readonly installationId: BoardInstallationId;
  readonly localCopyCount: number;
  readonly providerReferenceCount: number;
  readonly unresolvedProviderCount: number;
  readonly warnings: readonly string[];
}

export interface PlaylistImportResult {
  readonly playlist: LocalPlaylist;
  readonly createdClimbs: readonly LocalClimbDraft[];
}

export type PlaylistImportCompatibilityCode =
  | 'local-creation-unavailable'
  | 'definition-mismatch'
  | 'layout-mismatch'
  | 'unsupported-angle'
  | 'unknown-placement';

export class PlaylistImportCompatibilityError extends Error {
  constructor(
    readonly code: PlaylistImportCompatibilityCode,
    readonly path: string,
    message: string,
  ) {
    super(`Cannot import portable playlist at ${path}: ${message}`);
    this.name = 'PlaylistImportCompatibilityError';
  }
}

export interface PlaylistImportCleanupFailure {
  readonly climb: LocalClimbDraft;
  readonly error: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class PlaylistImportExecutionError extends Error {
  readonly code = 'import-failed';
  override readonly cause: unknown;
  readonly cleanupFailures: readonly PlaylistImportCleanupFailure[];
  readonly orphanedClimbIds: readonly LocalClimbDraft['id'][];

  constructor(cause: unknown, cleanupFailures: readonly PlaylistImportCleanupFailure[]) {
    const cleanup = cleanupFailures.length
      ? ` Cleanup also failed for ${cleanupFailures
          .map(({ climb, error }) => `${climb.id} (${errorMessage(error)})`)
          .join(', ')}.`
      : '';
    super(`Playlist import failed: ${errorMessage(cause)}.${cleanup}`, { cause });
    this.name = 'PlaylistImportExecutionError';
    this.cause = cause;
    this.cleanupFailures = Object.freeze([...cleanupFailures]);
    this.orphanedClimbIds = Object.freeze(cleanupFailures.map(({ climb }) => climb.id));
  }
}

export function planPlaylistImport(
  source: PortablePlaylistV1,
  installation: ConfiguredBoardInstallation,
): PlaylistImportPlan {
  const decoded = decodePortablePlaylist(source);
  if (!installation.capabilities.create.available) {
    throw new PlaylistImportCompatibilityError(
      'local-creation-unavailable',
      'installation.capabilities.create',
      'the active installation does not allow local climb creation',
    );
  }
  const placementIds = new Set(installation.definition.placements.map(({ id }) => id));
  let localCopyCount = 0;
  let providerReferenceCount = 0;
  decoded.playlist.entries.forEach((entry, entryIndex) => {
    if (entry.kind === 'provider') {
      providerReferenceCount += 1;
      return;
    }
    localCopyCount += 1;
    const { snapshot } = entry;
    const path = `playlist.entries[${entryIndex}].snapshot`;
    if (snapshot.definitionId !== installation.definition.id) {
      throw new PlaylistImportCompatibilityError(
        'definition-mismatch',
        `${path}.definitionId`,
        `expected ${installation.definition.id}, received ${snapshot.definitionId}`,
      );
    }
    if (snapshot.layoutRevision !== installation.definition.layoutRevision) {
      throw new PlaylistImportCompatibilityError(
        'layout-mismatch',
        `${path}.layoutRevision`,
        `expected ${installation.definition.layoutRevision}, received ${snapshot.layoutRevision}`,
      );
    }
    if (!installation.definition.supportedAngles.includes(snapshot.angle)) {
      throw new PlaylistImportCompatibilityError(
        'unsupported-angle',
        `${path}.angle`,
        `${snapshot.angle}° is not supported by the active board`,
      );
    }
    snapshot.assignments.forEach(({ placementId }, assignmentIndex) => {
      if (!placementIds.has(placementId)) {
        throw new PlaylistImportCompatibilityError(
          'unknown-placement',
          `${path}.assignments[${assignmentIndex}].placementId`,
          `hold ${placementId} is unavailable on the active board`,
        );
      }
    });
  });

  const unresolvedProviderCount = providerReferenceCount;
  const warnings = Object.freeze(
    unresolvedProviderCount === 0
      ? []
      : [
          `${unresolvedProviderCount} provider ${
            unresolvedProviderCount === 1 ? 'reference is' : 'references are'
          } retained in order but unresolved until matching catalog climbs are available.`,
        ],
  );
  return Object.freeze({
    source: decoded,
    installationId: installation.config.id,
    localCopyCount,
    providerReferenceCount,
    unresolvedProviderCount,
    warnings,
  });
}

async function cleanupCreatedClimbs(
  drafts: LocalDraftRepository,
  created: readonly LocalClimbDraft[],
): Promise<readonly PlaylistImportCleanupFailure[]> {
  const failures: PlaylistImportCleanupFailure[] = [];
  for (let index = created.length - 1; index >= 0; index -= 1) {
    const climb = created[index]!;
    try {
      await drafts.deletePermanently(climb.id, climb.revision);
    } catch (error) {
      failures.push(Object.freeze({ climb, error }));
    }
  }
  return Object.freeze(failures);
}

export async function executePlaylistImport(
  plan: PlaylistImportPlan,
  drafts: LocalDraftRepository,
  playlists: LocalPlaylistRepository,
): Promise<PlaylistImportResult> {
  const created: LocalClimbDraft[] = [];
  const entries: PlaylistClimbReference[] = [];
  try {
    for (const entry of plan.source.playlist.entries) {
      if (entry.kind === 'provider') {
        entries.push(entry);
        continue;
      }
      const createdClimb = await drafts.create({
        status: entry.snapshot.status,
        installationId: plan.installationId,
        definitionId: entry.snapshot.definitionId,
        layoutRevision: entry.snapshot.layoutRevision,
        name: entry.snapshot.name,
        angle: entry.snapshot.angle,
        assignments: entry.snapshot.assignments,
        effectGroups: entry.snapshot.effectGroups,
        metadata: entry.snapshot.metadata,
      });
      created.push(createdClimb);
      entries.push(Object.freeze({ kind: 'local', id: createdClimb.id }));
    }
    const playlist = await playlists.create({
      name: plan.source.playlist.name,
      notes: plan.source.playlist.notes,
      entries,
    });
    return Object.freeze({ playlist, createdClimbs: Object.freeze([...created]) });
  } catch (cause) {
    const cleanupFailures = await cleanupCreatedClimbs(drafts, created);
    throw new PlaylistImportExecutionError(cause, cleanupFailures);
  }
}
