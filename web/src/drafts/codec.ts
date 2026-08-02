import type { BoardHoldAssignment, BoardHoldAppearance } from '../board-renderer/types.ts';
import { apiLevel3Color } from '../domain/boards/colors.ts';
import {
  boardDefinitionId,
  boardPlacementId,
  layoutRevisionId,
} from '../domain/boards/identity.ts';
import { boardInstallationId } from '../installations/contracts.ts';
import { DraftCorruptRecordError, DraftSchemaError } from './errors.ts';
import {
  LOCAL_DRAFT_SCHEMA_VERSION,
  type DraftMetadata,
  type DraftRevision,
  type LocalClimbDraft,
  type LocalDraftId,
  type StoredDraftV1,
} from './types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES = new Set(['start', 'middle', 'finish', 'foot-only']);

export function localDraftId(value: string): LocalDraftId {
  if (!UUID.test(value)) throw new TypeError('Local draft ID must be a canonical UUID');
  return value as LocalDraftId;
}

export function draftRevision(value: number): DraftRevision {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError('Draft revision must be a positive safe integer');
  }
  return value as DraftRevision;
}

function record(value: unknown, path: string, source: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw corrupt(path, 'expected an object', source);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, source: unknown): string {
  if (typeof value !== 'string') throw corrupt(path, 'expected a string', source);
  return value;
}

function branded<T>(
  factory: (value: string) => T,
  value: unknown,
  path: string,
  source: unknown,
): T {
  try {
    return factory(string(value, path, source));
  } catch (cause) {
    throw corrupt(path, 'invalid identifier', source, cause);
  }
}

function timestamp(value: unknown, path: string, source: unknown): string {
  const result = string(value, path, source);
  const date = new Date(result);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== result) {
    throw corrupt(path, 'expected a canonical ISO timestamp', source);
  }
  return result;
}

function corrupt(path: string, message: string, source: unknown, cause?: unknown) {
  const raw =
    typeof source === 'object' && source !== null ? (source as Record<string, unknown>) : null;
  return new DraftCorruptRecordError(path, message, {
    id: typeof raw?.id === 'string' ? raw.id : undefined,
    cause,
    record: source,
  });
}

function decodeMetadata(value: unknown, source: unknown): Readonly<DraftMetadata> {
  const raw = record(value, 'metadata', source);
  const metadata: { grade?: string; description?: string; setterNotes?: string } = {};
  for (const key of ['grade', 'description', 'setterNotes'] as const) {
    if (raw[key] !== undefined) metadata[key] = string(raw[key], `metadata.${key}`, source);
  }
  return Object.freeze(metadata);
}

function decodeAppearance(
  value: unknown,
  path: string,
  source: unknown,
): Readonly<BoardHoldAppearance> {
  const raw = record(value, path, source);
  if (raw.kind === 'role') {
    const role = string(raw.role, `${path}.role`, source);
    if (!ROLES.has(role)) throw corrupt(`${path}.role`, 'unknown semantic role', source);
    return Object.freeze({
      kind: 'role',
      role: role as 'start' | 'middle' | 'finish' | 'foot-only',
    });
  }
  if (raw.kind === 'custom') {
    try {
      return Object.freeze({ kind: 'custom', color: apiLevel3Color(raw.color as number) });
    } catch (cause) {
      throw corrupt(`${path}.color`, 'expected a packed color from 0 to 255', source, cause);
    }
  }
  throw corrupt(`${path}.kind`, 'expected role or custom', source);
}

function decodeAssignments(value: unknown, source: unknown): readonly BoardHoldAssignment[] {
  if (!Array.isArray(value)) throw corrupt('assignments', 'expected an array', source);
  const seen = new Set<string>();
  return Object.freeze(
    value.map((entry, index) => {
      const path = `assignments[${index}]`;
      const raw = record(entry, path, source);
      const placementId = branded(boardPlacementId, raw.placementId, `${path}.placementId`, source);
      if (seen.has(placementId))
        throw corrupt(`${path}.placementId`, 'duplicate placement', source);
      seen.add(placementId);
      return Object.freeze({
        placementId,
        appearance: decodeAppearance(raw.appearance, `${path}.appearance`, source),
      });
    }),
  );
}

export function encodeStoredDraft(draft: LocalClimbDraft): StoredDraftV1 {
  return {
    schemaVersion: 1,
    id: draft.id,
    revision: draft.revision,
    installationId: draft.installationId,
    definitionId: draft.definitionId,
    layoutRevision: draft.layoutRevision,
    name: draft.name,
    angle: draft.angle,
    assignments: draft.assignments.map(({ placementId, appearance }) => ({
      placementId,
      appearance:
        appearance.kind === 'role'
          ? { kind: 'role', role: appearance.role }
          : { kind: 'custom', color: appearance.color },
    })),
    metadata: { ...draft.metadata },
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    updatedOrder: [draft.updatedAt, draft.id],
  };
}

export function decodeStoredDraft(value: unknown): LocalClimbDraft {
  const raw = record(value, '$', value);
  if (raw.schemaVersion !== LOCAL_DRAFT_SCHEMA_VERSION) {
    throw new DraftSchemaError(raw.schemaVersion, typeof raw.id === 'string' ? raw.id : undefined);
  }
  let id: LocalDraftId;
  let revision: DraftRevision;
  try {
    id = localDraftId(string(raw.id, 'id', value));
  } catch (cause) {
    throw corrupt('id', 'invalid local draft UUID', value, cause);
  }
  try {
    revision = draftRevision(raw.revision as number);
  } catch (cause) {
    throw corrupt('revision', 'expected a positive safe integer', value, cause);
  }
  if (typeof raw.angle !== 'number' || !Number.isFinite(raw.angle)) {
    throw corrupt('angle', 'expected a finite number', value);
  }
  const createdAt = timestamp(raw.createdAt, 'createdAt', value);
  const updatedAt = timestamp(raw.updatedAt, 'updatedAt', value);
  const updatedOrder = raw.updatedOrder;
  if (
    !Array.isArray(updatedOrder) ||
    updatedOrder.length !== 2 ||
    updatedOrder[0] !== updatedAt ||
    updatedOrder[1] !== id
  ) {
    throw corrupt('updatedOrder', 'must equal [updatedAt, id]', value);
  }
  return Object.freeze({
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    id,
    revision,
    installationId: branded(boardInstallationId, raw.installationId, 'installationId', value),
    definitionId: branded(boardDefinitionId, raw.definitionId, 'definitionId', value),
    layoutRevision: branded(layoutRevisionId, raw.layoutRevision, 'layoutRevision', value),
    name: string(raw.name, 'name', value),
    angle: raw.angle,
    assignments: decodeAssignments(raw.assignments, value),
    metadata: decodeMetadata(raw.metadata, value),
    createdAt,
    updatedAt,
  });
}
