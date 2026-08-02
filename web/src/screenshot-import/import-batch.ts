import type { BoardHoldAppearance, BoardHoldAssignment } from '../board-renderer/types';
import type { LocalDraftRepository } from '../drafts/repository';
import type { LocalClimbDraft } from '../drafts/types';
import type { ConfiguredBoardInstallation } from '../installations/contracts';
import type {
  ConfirmedScreenshotCandidate,
  ScreenshotImportFailure,
  ScreenshotImportResult,
} from './types';

function appearanceKey(appearance: BoardHoldAppearance): string {
  return appearance.kind === 'role'
    ? `role:${appearance.role}`
    : `custom:${Number(appearance.color)}`;
}

function assignmentKey(assignments: readonly BoardHoldAssignment[]): string {
  return assignments
    .map((assignment) => `${assignment.placementId}=${appearanceKey(assignment.appearance)}`)
    .sort()
    .join('|');
}

function identityKey(input: {
  readonly installationId: string;
  readonly definitionId: string;
  readonly layoutRevision: string;
  readonly angle: number;
  readonly name: string;
  readonly assignments: readonly BoardHoldAssignment[];
}): string {
  return JSON.stringify([
    input.installationId,
    input.definitionId,
    input.layoutRevision,
    input.angle,
    input.name.trim(),
    assignmentKey(input.assignments),
  ]);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function importScreenshotCandidates(
  repository: LocalDraftRepository,
  installation: ConfiguredBoardInstallation,
  candidates: readonly ConfirmedScreenshotCandidate[],
): Promise<ScreenshotImportResult> {
  const [active, trash] = await Promise.all([
    repository.list({ collection: 'active' }),
    repository.list({ collection: 'trash' }),
  ]);
  const existing = new Map<string, LocalClimbDraft>();
  for (const draft of [...active, ...trash]) {
    existing.set(identityKey(draft), draft);
  }

  const created: LocalClimbDraft[] = [];
  const skipped: string[] = [];
  const failures: ScreenshotImportFailure[] = [];
  const placementIds = new Set(installation.definition.placements.map(({ id }) => id));

  for (const candidate of candidates) {
    const name = candidate.name.trim();
    try {
      if (!name) throw new TypeError('Climb name is required.');
      if (!installation.definition.supportedAngles.includes(40)) {
        throw new TypeError('The active board definition does not support 40°.');
      }
      if (candidate.assignments.some(({ placementId }) => !placementIds.has(placementId))) {
        throw new TypeError('The climb contains a hold outside the active board definition.');
      }
      const identity = identityKey({
        installationId: installation.config.id,
        definitionId: installation.definition.id,
        layoutRevision: installation.definition.layoutRevision,
        angle: 40,
        name,
        assignments: candidate.assignments,
      });
      const duplicate = existing.get(identity);
      if (duplicate) {
        skipped.push(
          duplicate.trashedAt
            ? `${name} — already in Trash; restore it instead`
            : `${name} — already imported`,
        );
        continue;
      }
      const draft = await repository.create({
        status: 'draft',
        installationId: installation.config.id,
        definitionId: installation.definition.id,
        layoutRevision: installation.definition.layoutRevision,
        name,
        angle: 40,
        assignments: Object.freeze([...candidate.assignments]),
        effectGroups: Object.freeze([]),
        metadata: Object.freeze({}),
      });
      created.push(draft);
      existing.set(identity, draft);
    } catch (error) {
      failures.push({ sourceName: candidate.sourceName, message: errorMessage(error) });
    }
  }

  return Object.freeze({
    created: Object.freeze(created),
    skipped: Object.freeze(skipped),
    failures: Object.freeze(failures),
  });
}
