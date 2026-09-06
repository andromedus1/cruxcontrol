import {
  LIGHT_EFFECT_PERIOD_MAX_MS,
  LIGHT_EFFECT_PERIOD_MIN_MS,
  lightEffectGroupId,
  requiresSpatialRecipeV2,
  type BoardHoldAppearance,
  type LightEffectGroup,
  type LightEffectGroupId,
  type LightEffectKind,
} from '../board-renderer/types.ts';
import { apiLevel3Color } from '../domain/boards/colors.ts';
import {
  boardDefinitionId,
  boardPlacementId,
  layoutRevisionId,
  providerClimbKey,
  providerId,
  providerSourceId,
} from '../domain/boards/identity.ts';
import type { ProviderClimbId } from '../domain/boards/types.ts';
import type { DraftMetadata, LocalClimbStatus } from '../drafts/types.ts';
import {
  PORTABLE_PLAYLIST_FORMAT,
  PORTABLE_PLAYLIST_LIMITS,
  PORTABLE_PLAYLIST_SCHEMA_VERSION,
  type PortableClimbSnapshotV1,
  type PortablePlaylistEntryV1,
  type PortablePlaylistV1,
} from './portable-types.ts';

const ROLES = new Set(['start', 'middle', 'finish', 'foot-only']);
const CLIMB_STATUSES = new Set<LocalClimbStatus>(['draft', 'finished']);
const EFFECT_KINDS = new Set<LightEffectKind>([
  'pulse',
  'color-cycle',
  'wave',
  'twinkle',
  'alternate',
]);
const MAX_BASE64URL_LENGTH = Math.ceil(PORTABLE_PLAYLIST_LIMITS.bytes / 3) * 4;

function validSpatialRecipe(raw: Record<string, unknown>): boolean {
  switch(raw.kind) {
    case 'ocean-tide': return ['in','out'].includes(raw.direction as string) && typeof raw.foam==='number' && raw.foam>=0 && raw.foam<=1;
    case 'tie-dye-spiral': return ['clockwise','counterclockwise'].includes(raw.direction as string) && [2,3,4].includes(raw.arms as number);
    case 'matrix-rain': return ['down','up'].includes(raw.direction as string) && Number.isInteger(raw.columns) && (raw.columns as number)>=1 && (raw.columns as number)<=20;
    case 'snake': return ['forward','reverse'].includes(raw.direction as string) && Number.isInteger(raw.bodyLength) && (raw.bodyLength as number)>=1 && (raw.bodyLength as number)<=20;
    case 'beach-ball': return typeof raw.velocityX==='number' && Number.isFinite(raw.velocityX) && typeof raw.velocityY==='number' && Number.isFinite(raw.velocityY) && Number.isInteger(raw.size) && (raw.size as number)>=1 && (raw.size as number)<=20;
    case 'pac-man': return ['forward','reverse'].includes(raw.direction as string) && typeof raw.mouthBeat==='number' && Number.isFinite(raw.mouthBeat) && raw.mouthBeat>0;
    case 'pong': return ['forward','reverse'].includes(raw.direction as string) && Number.isInteger(raw.paddleSize) && (raw.paddleSize as number)>=1 && (raw.paddleSize as number)<=20;
    case 'bird-flock': return ['left','right'].includes(raw.direction as string) && typeof raw.quietFraction==='number' && raw.quietFraction>=0 && raw.quietFraction<1;
    case 'frogger': return Number.isInteger(raw.lanes) && (raw.lanes as number)>=1 && (raw.lanes as number)<=8;
    case 'pentagram': return typeof raw.fadeRate==='number' && Number.isFinite(raw.fadeRate) && raw.fadeRate>0 && raw.fadeRate<=8;
    case 'bumblebee': return typeof raw.hoverFraction==='number' && Number.isFinite(raw.hoverFraction) && raw.hoverFraction>=0 && raw.hoverFraction<=.8;
    case 'fireflies': case 'shooting-stars': case 'jellyfish': case 'embers': return Object.keys(raw).length === 1;
    default: return false;
  }
}

export type PortablePlaylistErrorCode =
  | 'invalid-payload'
  | 'unsupported-schema'
  | 'oversized-payload';

export class PortablePlaylistValidationError extends Error {
  readonly code: PortablePlaylistErrorCode;
  readonly path: string;
  override readonly cause?: unknown;

  constructor(
    code: PortablePlaylistErrorCode,
    path: string,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(`Invalid portable playlist at ${path}: ${message}`, options);
    this.name = 'PortablePlaylistValidationError';
    this.code = code;
    this.path = path;
    this.cause = options?.cause;
  }
}

export class PortablePlaylistSchemaError extends PortablePlaylistValidationError {
  readonly schemaVersion: unknown;

  constructor(schemaVersion: unknown) {
    super(
      'unsupported-schema',
      'schemaVersion',
      `unsupported schema version ${String(schemaVersion)}`,
    );
    this.name = 'PortablePlaylistSchemaError';
    this.schemaVersion = schemaVersion;
  }
}

function invalid(path: string, message: string, cause?: unknown): never {
  throw new PortablePlaylistValidationError('invalid-payload', path, message, { cause });
}

function oversized(path: string, message: string): never {
  throw new PortablePlaylistValidationError('oversized-payload', path, message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(path, 'expected an object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(path, 'expected a plain object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(raw: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) invalid(path === '$' ? key : `${path}.${key}`, 'unknown field');
  }
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') invalid(path, 'expected a string');
  if (value.length > PORTABLE_PLAYLIST_LIMITS.stringCodeUnits) {
    oversized(path, `must not exceed ${PORTABLE_PLAYLIST_LIMITS.stringCodeUnits} code units`);
  }
  return value;
}

function branded<T>(factory: (value: string) => T, value: unknown, path: string): T {
  try {
    return factory(string(value, path));
  } catch (cause) {
    if (cause instanceof PortablePlaylistValidationError) throw cause;
    invalid(path, 'invalid identifier', cause);
  }
}

function timestamp(value: unknown, path: string): string {
  const result = string(value, path);
  const parsed = new Date(result);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== result) {
    invalid(path, 'expected a canonical ISO timestamp');
  }
  return result;
}

function boundedArray(value: unknown, path: string, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) invalid(path, 'expected an array');
  if (value.length > maximum) oversized(path, `must not contain more than ${maximum} items`);
  return value;
}

function decodeAppearance(value: unknown, path: string): Readonly<BoardHoldAppearance> {
  const raw = record(value, path);
  if (raw.kind === 'role') {
    exactKeys(raw, ['kind', 'role'], path);
    const role = string(raw.role, `${path}.role`);
    if (!ROLES.has(role)) invalid(`${path}.role`, 'unknown semantic role');
    return Object.freeze({
      kind: 'role',
      role: role as 'start' | 'middle' | 'finish' | 'foot-only',
    });
  }
  if (raw.kind === 'custom') {
    exactKeys(raw, ['kind', 'color'], path);
    try {
      return Object.freeze({ kind: 'custom', color: apiLevel3Color(raw.color as number) });
    } catch (cause) {
      invalid(`${path}.color`, 'expected a packed color from 0 to 255', cause);
    }
  }
  invalid(`${path}.kind`, 'expected role or custom');
}

function decodeEffectGroups(value: unknown, path: string, _legacy: boolean): readonly LightEffectGroup[] {
  const source = boundedArray(value, path, PORTABLE_PLAYLIST_LIMITS.effectGroupsPerClimb);
  const seen = new Set<string>();
  return Object.freeze(
    source.map((entry, index) => {
      const entryPath = `${path}[${index}]`;
      const raw = record(entry, entryPath);
      exactKeys(raw, raw.model === undefined ? ['id', 'kind', 'palette', 'periodMs', 'intensity'] : raw.model === 'assigned' ? ['model', 'id', 'kind', 'palette', 'periodMs', 'intensity'] : ['model', 'id', 'kind', 'recipeVersion', 'recipe', 'seed', 'palette', 'periodMs', 'intensity', 'footprint', 'target'], entryPath);
      const id = branded(lightEffectGroupId, raw.id, `${entryPath}.id`);
      if (seen.has(id)) invalid(`${entryPath}.id`, 'duplicate effect group ID');
      seen.add(id);
      if (!Array.isArray(raw.palette) || raw.palette.length < 1 || raw.palette.length > 8) {
        invalid(`${entryPath}.palette`, 'expected 1 to 8 packed colors');
      }
      const palette = Object.freeze(
        raw.palette.map((value, colorIndex) => {
          try {
            return apiLevel3Color(value as number);
          } catch (cause) {
            invalid(
              `${entryPath}.palette[${colorIndex}]`,
              'expected a packed color from 0 to 255',
              cause,
            );
          }
        }),
      );
      if (
        typeof raw.periodMs !== 'number' ||
        !Number.isFinite(raw.periodMs) ||
        raw.periodMs < LIGHT_EFFECT_PERIOD_MIN_MS ||
        raw.periodMs > LIGHT_EFFECT_PERIOD_MAX_MS
      ) {
        invalid(`${entryPath}.periodMs`, `expected a number from ${LIGHT_EFFECT_PERIOD_MIN_MS} to ${LIGHT_EFFECT_PERIOD_MAX_MS}`);
      }
      if (
        typeof raw.intensity !== 'number' ||
        !Number.isFinite(raw.intensity) ||
        raw.intensity < 0 ||
        raw.intensity > 1
      ) {
        invalid(`${entryPath}.intensity`, 'expected a number from 0 to 1');
      }
      const model = raw.model === undefined ? 'assigned' : string(raw.model, `${entryPath}.model`);
      if (model === 'assigned') {
        const kind = string(raw.kind, `${entryPath}.kind`) as LightEffectKind;
        if (!EFFECT_KINDS.has(kind)) invalid(`${entryPath}.kind`, 'unknown effect kind');
        return Object.freeze({ model: 'assigned' as const, id, kind, palette, periodMs: raw.periodMs, intensity: raw.intensity });
      }
      if (model !== 'spatial') invalid(`${entryPath}.model`, 'expected assigned or spatial');
      if ((raw.recipeVersion !== 1 && raw.recipeVersion !== 2) || !Number.isSafeInteger(raw.seed) || !Number.isInteger(raw.footprint) || (raw.footprint as number) < 1 || (raw.footprint as number) > 20) invalid(entryPath, 'invalid spatial recipe version, seed, or footprint');
      const recipe = record(raw.recipe, `${entryPath}.recipe`);
      const spatialKinds = new Set(['ocean-tide','tie-dye-spiral','matrix-rain','snake','beach-ball','pac-man','pong','bird-flock','frogger','pentagram','bumblebee','fireflies','shooting-stars','jellyfish','embers']);
      if (!spatialKinds.has(recipe.kind as string)) invalid(`${entryPath}.recipe.kind`, 'unknown spatial recipe');
      if (requiresSpatialRecipeV2(recipe.kind as import('../board-renderer/types').SpatialEffectKind) && raw.recipeVersion === 1) invalid(`${entryPath}.recipeVersion`, `${recipe.kind} recipes require version 2`);
      if (!validSpatialRecipe(recipe)) invalid(`${entryPath}.recipe`, 'invalid spatial recipe parameters');
      const target = record(raw.target, `${entryPath}.target`);
      if (!['unused','background-board','selected'].includes(target.scope as string)) invalid(`${entryPath}.target.scope`, 'unknown target scope');
      const placements = (input: unknown, targetPath: string) => Object.freeze(boundedArray(input, targetPath, PORTABLE_PLAYLIST_LIMITS.assignmentsPerClimb).map((value, placementIndex) => branded(boardPlacementId, value, `${targetPath}[${placementIndex}]`)));
      const include = placements(target.include, `${entryPath}.target.include`); const exclude = placements(target.exclude, `${entryPath}.target.exclude`);
      if (new Set(include).size !== include.length || new Set(exclude).size !== exclude.length || include.some((placementId) => exclude.includes(placementId))) invalid(`${entryPath}.target`, 'target lists must be unique and disjoint');
      return Object.freeze({ model: 'spatial' as const, id, recipeVersion: raw.recipeVersion as 1 | 2, recipe: Object.freeze({ ...recipe }) as import('../board-renderer/types').SpatialRecipe, seed: raw.seed as number, palette, periodMs: raw.periodMs, intensity: raw.intensity, footprint: raw.footprint as number, target: Object.freeze({ scope: target.scope as 'unused'|'background-board'|'selected', include, exclude }) });
    }),
  );
}

function decodeAssignments(
  value: unknown,
  path: string,
  effectGroupIds: ReadonlySet<LightEffectGroupId>,
) {
  const source = boundedArray(value, path, PORTABLE_PLAYLIST_LIMITS.assignmentsPerClimb);
  const seen = new Set<string>();
  return Object.freeze(
    source.map((entry, index) => {
      const entryPath = `${path}[${index}]`;
      const raw = record(entry, entryPath);
      exactKeys(raw, ['placementId', 'appearance', 'effectGroupId'], entryPath);
      const placementId = branded(boardPlacementId, raw.placementId, `${entryPath}.placementId`);
      if (seen.has(placementId)) invalid(`${entryPath}.placementId`, 'duplicate placement');
      seen.add(placementId);
      const effectGroupId =
        raw.effectGroupId === undefined
          ? undefined
          : branded(lightEffectGroupId, raw.effectGroupId, `${entryPath}.effectGroupId`);
      if (effectGroupId !== undefined && !effectGroupIds.has(effectGroupId)) {
        invalid(`${entryPath}.effectGroupId`, 'references an unknown effect group');
      }
      return Object.freeze({
        placementId,
        appearance: decodeAppearance(raw.appearance, `${entryPath}.appearance`),
        ...(effectGroupId === undefined ? {} : { effectGroupId }),
      });
    }),
  );
}

function decodeMetadata(value: unknown, path: string): Readonly<DraftMetadata> {
  const raw = record(value, path);
  exactKeys(raw, ['grade', 'description', 'setterNotes'], path);
  const metadata: { grade?: string; description?: string; setterNotes?: string } = {};
  for (const key of ['grade', 'description', 'setterNotes'] as const) {
    if (raw[key] !== undefined) metadata[key] = string(raw[key], `${path}.${key}`);
  }
  return Object.freeze(metadata);
}

function decodeSnapshot(value: unknown, path: string, legacy: boolean): PortableClimbSnapshotV1 {
  const raw = record(value, path);
  exactKeys(
    raw,
    [
      'status',
      'definitionId',
      'layoutRevision',
      'name',
      'angle',
      'assignments',
      'effectGroups',
      'metadata',
    ],
    path,
  );
  const status = string(raw.status, `${path}.status`) as LocalClimbStatus;
  if (!CLIMB_STATUSES.has(status)) invalid(`${path}.status`, 'expected draft or finished');
  if (typeof raw.angle !== 'number' || !Number.isFinite(raw.angle)) {
    invalid(`${path}.angle`, 'expected a finite number');
  }
  const effectGroups = decodeEffectGroups(raw.effectGroups, `${path}.effectGroups`, legacy);
  const effectGroupIds = new Set(effectGroups.filter((group) => group.model !== 'spatial').map(({ id }) => id));
  return Object.freeze({
    status,
    definitionId: branded(boardDefinitionId, raw.definitionId, `${path}.definitionId`),
    layoutRevision: branded(layoutRevisionId, raw.layoutRevision, `${path}.layoutRevision`),
    name: string(raw.name, `${path}.name`),
    angle: raw.angle,
    assignments: decodeAssignments(raw.assignments, `${path}.assignments`, effectGroupIds),
    effectGroups,
    metadata: decodeMetadata(raw.metadata, `${path}.metadata`),
  });
}

function decodeProviderId(value: unknown, path: string): ProviderClimbId {
  const raw = record(value, path);
  exactKeys(raw, ['provider', 'sourceId', 'layoutRevision'], path);
  return Object.freeze({
    provider: branded(providerId, raw.provider, `${path}.provider`),
    sourceId: branded(providerSourceId, raw.sourceId, `${path}.sourceId`),
    layoutRevision: branded(layoutRevisionId, raw.layoutRevision, `${path}.layoutRevision`),
  });
}

function decodeEntry(value: unknown, path: string, legacy: boolean): PortablePlaylistEntryV1 {
  const raw = record(value, path);
  if (raw.kind === 'local-snapshot') {
    exactKeys(raw, ['kind', 'snapshot'], path);
    return Object.freeze({
      kind: 'local-snapshot',
      snapshot: decodeSnapshot(raw.snapshot, `${path}.snapshot`, legacy),
    });
  }
  if (raw.kind === 'provider') {
    exactKeys(raw, ['kind', 'id'], path);
    return Object.freeze({ kind: 'provider', id: decodeProviderId(raw.id, `${path}.id`) });
  }
  invalid(`${path}.kind`, 'expected local-snapshot or provider');
}

function canonicalJson(value: PortablePlaylistV1): string {
  const json = JSON.stringify(value);
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > PORTABLE_PLAYLIST_LIMITS.bytes) {
    oversized('$', `UTF-8 JSON must not exceed ${PORTABLE_PLAYLIST_LIMITS.bytes} bytes`);
  }
  return json;
}

export function decodePortablePlaylist(value: unknown): PortablePlaylistV1 {
  const raw = record(value, '$');
  exactKeys(raw, ['format', 'schemaVersion', 'exportedAt', 'playlist'], '$');
  if (raw.format !== PORTABLE_PLAYLIST_FORMAT) {
    invalid('format', `expected ${PORTABLE_PLAYLIST_FORMAT}`);
  }
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== PORTABLE_PLAYLIST_SCHEMA_VERSION) {
    throw new PortablePlaylistSchemaError(raw.schemaVersion);
  }
  const playlist = record(raw.playlist, 'playlist');
  exactKeys(playlist, ['name', 'notes', 'entries'], 'playlist');
  const name = string(playlist.name, 'playlist.name');
  if (name.length === 0 || name !== name.trim()) {
    invalid('playlist.name', 'expected a non-empty trimmed name');
  }
  const sourceEntries = boundedArray(
    playlist.entries,
    'playlist.entries',
    PORTABLE_PLAYLIST_LIMITS.entries,
  );
  const seenProviders = new Set<string>();
  const entries = Object.freeze(
    sourceEntries.map((entry, index) => {
      const decoded = decodeEntry(entry, `playlist.entries[${index}]`, raw.schemaVersion === 1);
      if (decoded.kind === 'provider') {
        const key = providerClimbKey(decoded.id);
        if (seenProviders.has(key)) {
          invalid(`playlist.entries[${index}]`, 'duplicate provider climb reference');
        }
        seenProviders.add(key);
      }
      return decoded;
    }),
  );
  const result = Object.freeze({
    format: PORTABLE_PLAYLIST_FORMAT,
    schemaVersion: PORTABLE_PLAYLIST_SCHEMA_VERSION,
    exportedAt: timestamp(raw.exportedAt, 'exportedAt'),
    playlist: Object.freeze({
      name,
      notes: string(playlist.notes, 'playlist.notes'),
      entries,
    }),
  });
  canonicalJson(result);
  return result;
}

export function encodePortablePlaylist(value: PortablePlaylistV1): string {
  return canonicalJson(decodePortablePlaylist(value));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlBytes(value: string): Uint8Array {
  if (value.length > MAX_BASE64URL_LENGTH) {
    oversized('#playlist', `encoded payload exceeds ${PORTABLE_PLAYLIST_LIMITS.bytes} bytes`);
  }
  if (value.length === 0 || !/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) {
    invalid('#playlist', 'expected unpadded base64url data');
  }
  let binary: string;
  try {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding);
  } catch (cause) {
    invalid('#playlist', 'invalid base64url data', cause);
  }
  if (binary.length > PORTABLE_PLAYLIST_LIMITS.bytes) {
    oversized('#playlist', `decoded payload exceeds ${PORTABLE_PLAYLIST_LIMITS.bytes} bytes`);
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (base64Url(bytes) !== value) invalid('#playlist', 'expected canonical base64url data');
  return bytes;
}

export function encodePlaylistFragment(value: PortablePlaylistV1): string {
  const bytes = new TextEncoder().encode(encodePortablePlaylist(value));
  return `#playlist=${base64Url(bytes)}`;
}

export function decodePlaylistFragment(fragment: string): PortablePlaylistV1 | null {
  if (!fragment.startsWith('#playlist=')) return null;
  const encoded = fragment.slice('#playlist='.length);
  const bytes = base64UrlBytes(encoded);
  let json: string;
  try {
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (cause) {
    invalid('#playlist', 'payload is not valid UTF-8', cause);
  }
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (cause) {
    invalid('#playlist', 'payload is not valid JSON', cause);
  }
  return decodePortablePlaylist(value);
}
