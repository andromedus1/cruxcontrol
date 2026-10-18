import type { CatalogPort, SqlValue } from '../port.ts';
import type {
  CatalogClimb, CatalogClimbQuery, CatalogCursor, CatalogGradeOption, CatalogPage, CatalogSort,
  CatalogProvenance, CatalogQueryPort, CatalogRead,
} from '../../catalog/types.ts';
import { CatalogReadError } from '../../catalog/types.ts';
import type { BoardDefinition } from '../../domain/boards/definition.ts';
import type { ProviderClimbId } from '../../domain/boards/types.ts';
import { kilterFullride7x10Definition } from '../../domain/boards/definitions/kilter-fullride-7x10.ts';
import { projectKilterClimb } from './kilter-projection.ts';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_CANDIDATES = 250;
const CURSOR_MAX_LENGTH = 4096;
const UNAVAILABLE = Object.freeze({ status: 'unavailable' as const });

interface NormalizedQuery {
  readonly angle: number;
  readonly name: string;
  readonly minGrade: number | null;
  readonly maxGrade: number | null;
  readonly minRating: number | null;
  readonly minAscents: number | null;
  readonly setter: string;
  readonly sort: CatalogSort;
  readonly limit: number;
}

interface CursorData {
  readonly version: 2;
  readonly snapshot: string;
  readonly revision: string;
  readonly angle: number;
  readonly name: string;
  readonly minGrade: number | null;
  readonly maxGrade: number | null;
  readonly minRating: number | null;
  readonly minAscents: number | null;
  readonly setter: string;
  readonly sort: CatalogSort;
  readonly limit: number;
  readonly lastSortRank: number;
  readonly lastSortValue: string | number;
  readonly lastId: string;
}

interface SortExpressions {
  readonly rank: string;
  readonly value: string;
  readonly direction: 'ASC' | 'DESC';
}

function sortExpressions(sort: CatalogSort): SortExpressions {
  switch (sort) {
    case 'rating':
      return {
        rank: "CASE WHEN typeof(s.quality_average) IN ('integer', 'real') AND s.quality_average >= 0 AND s.quality_average <= 1.7976931348623157e308 THEN 0 ELSE 1 END",
        value: "CASE WHEN typeof(s.quality_average) IN ('integer', 'real') AND s.quality_average >= 0 AND s.quality_average <= 1.7976931348623157e308 THEN s.quality_average ELSE 0 END",
        direction: 'DESC',
      };
    case 'sends':
      return {
        rank: "CASE WHEN typeof(s.ascensionist_count) = 'integer' AND s.ascensionist_count >= 0 THEN 0 ELSE 1 END",
        value: "CASE WHEN typeof(s.ascensionist_count) = 'integer' AND s.ascensionist_count >= 0 THEN s.ascensionist_count ELSE 0 END",
        direction: 'DESC',
      };
    case 'grade-asc':
    case 'grade-desc':
      return {
        rank: "CASE WHEN typeof(s.display_difficulty) IN ('integer', 'real') AND s.display_difficulty >= 0 AND s.display_difficulty <= 1.7976931348623157e308 THEN 0 ELSE 1 END",
        value: "CASE WHEN typeof(s.display_difficulty) IN ('integer', 'real') AND s.display_difficulty >= 0 AND s.display_difficulty <= 1.7976931348623157e308 THEN ROUND(s.display_difficulty) ELSE 0 END",
        direction: sort === 'grade-asc' ? 'ASC' : 'DESC',
      };
    case 'name':
      return {
        rank: "CASE WHEN typeof(c.name) = 'text' AND length(trim(c.name)) > 0 THEN 0 ELSE 1 END",
        value: "lower(CASE WHEN typeof(c.name) = 'text' THEN c.name ELSE '' END)",
        direction: 'ASC',
      };
  }
}

function normalizeQuery(input: CatalogClimbQuery, definition: BoardDefinition): NormalizedQuery {
  if (!input || typeof input !== 'object') throw new TypeError('Catalog query must be an object');
  const { angle, minGrade, maxGrade } = input;
  if (!Number.isInteger(angle) || !definition.supportedAngles.includes(angle)) {
    throw new RangeError('Catalog angle is not supported by this board');
  }
  for (const [label, value] of [['minGrade', minGrade], ['maxGrade', maxGrade]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || !Number.isInteger(value) || value < 0)) {
      throw new RangeError(`${label} must be a finite nonnegative integer`);
    }
  }
  if (minGrade !== undefined && maxGrade !== undefined && minGrade > maxGrade) {
    throw new RangeError('minGrade must not exceed maxGrade');
  }
  const { minRating, minAscents } = input;
  if (minRating !== undefined && (!Number.isFinite(minRating) || minRating < 0 || minRating > 3)) {
    throw new RangeError('minRating must be a finite number from 0 to 3');
  }
  if (minAscents !== undefined && (!Number.isSafeInteger(minAscents) || minAscents < 0)) {
    throw new RangeError('minAscents must be a nonnegative safe integer');
  }
  const limit = input.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new RangeError(`limit must be an integer from 1 to ${MAX_LIMIT}`);
  }
  const rawName = input.name ?? '';
  if (typeof rawName !== 'string') throw new TypeError('name must be a string');
  if (rawName.length > 200) throw new RangeError('name must be at most 200 characters');
  const rawSetter = input.setter ?? '';
  if (typeof rawSetter !== 'string') throw new TypeError('setter must be a string');
  if (rawSetter.length > 200) throw new RangeError('setter must be at most 200 characters');
  const sort = input.sort ?? 'rating';
  if (!['rating', 'sends', 'grade-asc', 'grade-desc', 'name'].includes(sort)) {
    throw new RangeError('sort is not supported');
  }
  return Object.freeze({
    angle,
    name: rawName.trim(),
    minGrade: minGrade ?? null,
    maxGrade: maxGrade ?? null,
    minRating: minRating ?? null,
    minAscents: minAscents ?? null,
    setter: rawSetter.trim(),
    sort,
    limit,
  });
}

function encodeCursor(value: CursorData): CatalogCursor {
  return JSON.stringify(value) as CatalogCursor;
}

function decodeCursor(
  cursor: CatalogCursor,
  expected: Omit<CursorData, 'lastId' | 'lastSortRank' | 'lastSortValue' | 'version'>,
): Pick<CursorData, 'lastId' | 'lastSortRank' | 'lastSortValue'> {
  if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > CURSOR_MAX_LENGTH) {
    throw new TypeError('Catalog cursor is malformed');
  }
  let value: unknown;
  try {
    value = JSON.parse(cursor);
  } catch {
    throw new TypeError('Catalog cursor is malformed');
  }
  if (!value || typeof value !== 'object') throw new TypeError('Catalog cursor is malformed');
  const data = value as Partial<CursorData>;
  if (data.version !== 2 || data.snapshot !== expected.snapshot || data.revision !== expected.revision
    || data.angle !== expected.angle || data.name !== expected.name
    || data.minGrade !== expected.minGrade || data.maxGrade !== expected.maxGrade
    || data.minRating !== expected.minRating || data.minAscents !== expected.minAscents
    || data.setter !== expected.setter || data.sort !== expected.sort || data.limit !== expected.limit
    || (data.lastSortRank !== 0 && data.lastSortRank !== 1)
    || (typeof data.lastSortValue !== 'string' && (typeof data.lastSortValue !== 'number' || !Number.isFinite(data.lastSortValue)))
    || (expected.sort === 'name' ? typeof data.lastSortValue !== 'string' : typeof data.lastSortValue !== 'number')
    || typeof data.lastId !== 'string' || !data.lastId.trim()) {
    throw new TypeError('Catalog cursor does not match this query or snapshot');
  }
  return {
    lastId: data.lastId,
    lastSortRank: data.lastSortRank,
    lastSortValue: data.lastSortValue,
  };
}

function readFailure(cause: unknown): CatalogReadError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new CatalogReadError(`Catalog read failed: ${detail}`, { cause });
}

async function ready(catalog: CatalogPort): Promise<boolean> {
  try {
    return await catalog.isReady();
  } catch (cause) {
    throw readFailure(cause);
  }
}

const PROJECT_COLUMNS = `
  c.uuid AS source_uuid,
  c.name AS source_name,
  c.frames AS source_frames,
  c.setter_username AS source_setter,
  c.description AS source_description,
  c.layout_id AS source_layout_id,
  c.frames_count AS source_frames_count,
  c.is_draft AS source_is_draft,
  c.is_listed AS source_is_listed,
  s.angle AS stat_angle,
  s.display_difficulty AS stat_display_difficulty,
  s.difficulty_average AS stat_difficulty_average,
  s.benchmark_difficulty AS stat_benchmark_difficulty,
  s.ascensionist_count AS stat_ascensionist_count,
  s.quality_average AS stat_quality_average,
  g.boulder_name AS grade_label`;

const BASE_SCOPE = `
  FROM climbs c
  JOIN climb_stats s ON s.climb_uuid = c.uuid
  LEFT JOIN difficulty_grades g
    ON g.difficulty = ROUND(s.display_difficulty) AND g.is_listed = 1
  WHERE c.layout_id = ?
    AND c.is_listed = 1
    AND c.is_draft = 0
    AND c.frames_count = 1
    AND s.angle = ?`;

export function createKilterCatalog(
  catalog: CatalogPort,
  definition: BoardDefinition,
  provenance: CatalogProvenance,
): CatalogQueryPort {
  if (definition.id !== kilterFullride7x10Definition.id
    || definition.layoutRevision !== kilterFullride7x10Definition.layoutRevision) {
    throw new TypeError('Kilter catalog supports only the installed Fullride 7x10 definition revision');
  }
  if (!provenance || typeof provenance.source !== 'string' || !provenance.source.trim()
    || typeof provenance.snapshotId !== 'string' || !provenance.snapshotId.trim()
    || (provenance.retrievedAt !== null && typeof provenance.retrievedAt !== 'string')
    || (provenance.coverage !== null && typeof provenance.coverage !== 'string')) {
    throw new TypeError('Catalog provenance requires a source, snapshot ID, and nullable retrieval metadata');
  }
  const stableProvenance = Object.freeze({
    source: provenance.source.trim(),
    snapshotId: provenance.snapshotId.trim(),
    retrievedAt: provenance.retrievedAt,
    coverage: provenance.coverage,
  });

  return Object.freeze({
    provenance: stableProvenance,

    async query(input: CatalogClimbQuery): Promise<CatalogRead<CatalogPage>> {
      const normalized = normalizeQuery(input, definition);
      const expected = {
        snapshot: stableProvenance.snapshotId,
        revision: String(definition.layoutRevision),
        angle: normalized.angle,
        name: normalized.name,
        minGrade: normalized.minGrade,
        maxGrade: normalized.maxGrade,
        minRating: normalized.minRating,
        minAscents: normalized.minAscents,
        setter: normalized.setter,
        sort: normalized.sort,
        limit: normalized.limit,
      };
      const cursor = input.cursor === undefined ? null : decodeCursor(input.cursor, expected);
      if (!await ready(catalog)) return UNAVAILABLE;

      const expressions = sortExpressions(normalized.sort);
      const clauses: string[] = [];
      const params: SqlValue[] = [8, normalized.angle];
      if (normalized.name) {
        clauses.push("AND typeof(c.name) = 'text' AND instr(lower(c.name), lower(?)) > 0");
        params.push(normalized.name);
      }
      if (normalized.minGrade !== null) {
        clauses.push("AND typeof(s.display_difficulty) IN ('integer', 'real') AND s.display_difficulty >= 0 AND s.display_difficulty <= 1.7976931348623157e308 AND ROUND(s.display_difficulty) >= ?");
        params.push(normalized.minGrade);
      }
      if (normalized.maxGrade !== null) {
        clauses.push("AND typeof(s.display_difficulty) IN ('integer', 'real') AND s.display_difficulty >= 0 AND s.display_difficulty <= 1.7976931348623157e308 AND ROUND(s.display_difficulty) <= ?");
        params.push(normalized.maxGrade);
      }
      if (normalized.minRating !== null) {
        clauses.push("AND typeof(s.quality_average) IN ('integer', 'real') AND s.quality_average >= 0 AND s.quality_average <= 1.7976931348623157e308 AND s.quality_average >= ?");
        params.push(normalized.minRating);
      }
      if (normalized.minAscents !== null) {
        clauses.push("AND typeof(s.ascensionist_count) = 'integer' AND s.ascensionist_count >= 0 AND s.ascensionist_count >= ?");
        params.push(normalized.minAscents);
      }
      if (normalized.setter) {
        clauses.push("AND typeof(c.setter_username) = 'text' AND instr(lower(c.setter_username), lower(?)) > 0");
        params.push(normalized.setter);
      }
      if (cursor !== null) {
        const valueOperator = expressions.direction === 'DESC' ? '<' : '>';
        clauses.push(`AND (
          (${expressions.rank}) > ?
          OR ((${expressions.rank}) = ? AND (
            (${expressions.value}) ${valueOperator} ?
            OR ((${expressions.value}) = ? AND c.uuid COLLATE BINARY > ?)
          ))
        )`);
        params.push(
          cursor.lastSortRank,
          cursor.lastSortRank,
          cursor.lastSortValue,
          cursor.lastSortValue,
          cursor.lastId,
        );
      }
      params.push(MAX_CANDIDATES + 1);
      const sql = `SELECT ${PROJECT_COLUMNS},
          (${expressions.rank}) AS cursor_sort_rank,
          (${expressions.value}) AS cursor_sort_value
        ${BASE_SCOPE} ${clauses.join('\n')}
        ORDER BY cursor_sort_rank ASC, cursor_sort_value COLLATE BINARY ${expressions.direction}, c.uuid COLLATE BINARY ASC
        LIMIT ?`;
      try {
        const rows = await catalog.query(sql, params);
        const climbs: CatalogClimb[] = [];
        let excludedCount = 0;
        let inspected = 0;
        let finalInspected: Pick<CursorData, 'lastId' | 'lastSortRank' | 'lastSortValue'> | null = null;
        for (const row of rows) {
          if (inspected >= MAX_CANDIDATES || climbs.length >= normalized.limit) break;
          inspected += 1;
          const id = row.source_uuid;
          const sortRank = row.cursor_sort_rank;
          const sortValue = row.cursor_sort_value;
          finalInspected = typeof id === 'string' && id.trim()
            && (sortRank === 0 || sortRank === 1)
            && (typeof sortValue === 'string' || (typeof sortValue === 'number' && Number.isFinite(sortValue)))
            ? { lastId: id, lastSortRank: sortRank, lastSortValue: sortValue }
            : null;
          const climb = projectKilterClimb(row, definition);
          if (climb) climbs.push(climb);
          else excludedCount += 1;
        }
        const hasMore = rows.length > inspected;
        const nextCursor = hasMore && finalInspected !== null
          ? encodeCursor({ version: 2, ...expected, ...finalInspected })
          : null;
        return Object.freeze({
          status: 'ready' as const,
          value: Object.freeze({
            climbs: Object.freeze(climbs),
            nextCursor,
            excludedCount,
          }),
        });
      } catch (cause) {
        throw readFailure(cause);
      }
    },

    async get(id: ProviderClimbId, angle: number): Promise<CatalogRead<ReturnType<typeof projectKilterClimb>>> {
      if (!Number.isInteger(angle) || !definition.supportedAngles.includes(angle)) {
        throw new RangeError('Catalog angle is not supported by this board');
      }
      if (!await ready(catalog)) return UNAVAILABLE;
      if (!id || id.provider !== 'kilter' || id.layoutRevision !== definition.layoutRevision
        || typeof id.sourceId !== 'string' || !id.sourceId.trim()) {
        return { status: 'ready', value: null };
      }
      const sql = `SELECT ${PROJECT_COLUMNS}${BASE_SCOPE}
        AND c.uuid = ?
        LIMIT 1`;
      try {
        const rows = await catalog.query(sql, [8, angle, id.sourceId]);
        return { status: 'ready', value: rows[0] ? projectKilterClimb(rows[0], definition) : null };
      } catch (cause) {
        throw readFailure(cause);
      }
    },

    async grades(): Promise<CatalogRead<readonly CatalogGradeOption[]>> {
      if (!await ready(catalog)) return UNAVAILABLE;
      try {
        const rows = await catalog.query(
          `SELECT difficulty AS grade_value, boulder_name AS grade_label
           FROM difficulty_grades
           WHERE is_listed = 1
           ORDER BY difficulty ASC
           LIMIT 257`,
        );
        if (rows.length > 256) throw new CatalogReadError('Catalog grade scale exceeds the supported 256 choices');
        const options: CatalogGradeOption[] = [];
        for (const row of rows) {
          const value = row.grade_value;
          const label = row.grade_label;
          if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
            && typeof label === 'string' && label.trim()) {
            options.push(Object.freeze({ value, label }));
          }
        }
        return Object.freeze({ status: 'ready' as const, value: Object.freeze(options) });
      } catch (cause) {
        if (cause instanceof CatalogReadError) throw cause;
        throw readFailure(cause);
      }
    },
  });
}
