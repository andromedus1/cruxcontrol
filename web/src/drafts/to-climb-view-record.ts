import { climbViewKey, type ClimbViewKey, type ClimbViewRecord } from '../climb-browser/types.ts';
import type { LocalClimbDraft, LocalDraftId } from './types.ts';

export function localDraftClimbViewKey(id: LocalDraftId): ClimbViewKey {
  const namespace = 'local-draft';
  return climbViewKey(`${namespace.length}:${namespace}${id.length}:${id}`);
}

export function toClimbViewRecord(draft: LocalClimbDraft): ClimbViewRecord {
  return {
    key: localDraftClimbViewKey(draft.id),
    name: draft.name,
    angle: draft.angle,
    assignments: draft.assignments,
    origin: 'local-draft',
    ...(draft.metadata.grade === undefined ? {} : { grade: draft.metadata.grade }),
    ...(draft.metadata.description === undefined
      ? {}
      : { description: draft.metadata.description }),
  };
}
