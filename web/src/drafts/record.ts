import { decodeStoredDraft } from './codec.ts';
import type { DraftListOptions } from './repository.ts';
import {
  LOCAL_DRAFT_SCHEMA_VERSION,
  type DraftContent,
  type DraftRevision,
  type LocalClimbDraft,
  type LocalDraftId,
} from './types.ts';

export function draftFrom(
  content: DraftContent,
  identity: {
    id: LocalDraftId;
    revision: DraftRevision;
    createdAt: string;
    updatedAt: string;
    trashedAt?: string;
  },
): LocalClimbDraft {
  return decodeStoredDraft({
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    id: identity.id,
    revision: identity.revision,
    status: content.status,
    ...(identity.trashedAt === undefined ? {} : { trashedAt: identity.trashedAt }),
    installationId: content.installationId,
    definitionId: content.definitionId,
    layoutRevision: content.layoutRevision,
    name: content.name,
    angle: content.angle,
    assignments: content.assignments,
    effectGroups: content.effectGroups,
    metadata: content.metadata ?? {},
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    updatedOrder: [identity.updatedAt, identity.id],
  });
}

export function draftContentOf(draft: LocalClimbDraft): DraftContent {
  return {
    status: draft.status,
    installationId: draft.installationId,
    definitionId: draft.definitionId,
    layoutRevision: draft.layoutRevision,
    name: draft.name,
    angle: draft.angle,
    assignments: draft.assignments,
    effectGroups: draft.effectGroups,
    metadata: draft.metadata,
  };
}

export function draftInCollection(
  draft: LocalClimbDraft,
  collection: NonNullable<DraftListOptions['collection']>,
): boolean {
  if (collection === 'trash') return draft.trashedAt !== undefined;
  if (draft.trashedAt !== undefined) return false;
  if (collection === 'drafts') return draft.status === 'draft';
  if (collection === 'finished') return draft.status === 'finished';
  return true;
}
