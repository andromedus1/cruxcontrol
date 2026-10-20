---
id: epic-catalog-sync-snapshot-normalize
kind: feature
stage: done
tags: [data]
parent: epic-catalog-sync
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Normalize Boardsesh Snapshots into the CruxControl 7x10 Catalog Artifact

## Brief

Deterministically convert one Boardsesh Homewall snapshot (v1-gzip layout 8 plus the
v1-catalog hardware artifact) into a CruxControl catalog artifact the existing app
can install: the legacy-compatible tables and columns the query layer reads, pruned to
product 7 / layout 8 / size 17 / sets 26–27, gzipped reproducibly, with a manifest that
carries provenance (source, Boardsesh build time, table watermarks, schema version).
This replaces the BoardLib path in `web/scripts/build-catalog-snapshot.py` as the
catalog's source.

Normalization is the core of this feature: map role codes 12–15 to 42–45 by role name;
preserve the exact UUID spelling already published (legacy 32-hex climbs match exactly
today) and carry new dashed UUIDs as-is; resolve aliases; keep 7x10 compatibility
consistent with the app's placement/LED check; carry quality, sends and grades with an
explicit scale marker; and refuse to emit anything if the snapshot's hardware rows for
size 17 differ from the pinned board definition (`layoutRevision`
`kilter:7:8:17:f0d70b3db9a6`). Accept both gzip and plain SQLite bodies and record
the source bytes' hash.

It does **not** merge with previous artifacts, enforce append-only identity, publish
anything, or change the app. Those belong to sibling features.

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: foundation feature. Every sibling consumes the artifact and manifest
  contract defined here.

## Inherited design decisions

- Boardsesh snapshots are the recurring upstream; CruxControl re-hosts its own derived
  artifact (epic §Design decisions).
- The personal library is never touched by catalog work.

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) §4 (artifact shape, role codes, UUIDs, aliases,
  quality scale, transport) and implementation notes 2–5, 7–8.

## Foundation references

- `docs/SPEC.md` §2 Climb Browser and §6 Data Acquisition (provenance per import,
  native payloads alongside normalized fields).
- `docs/ARCHITECTURE.md` Module Map 2–3 (Data Layer, Catalog Providers).
- Existing contract: `web/src/data/catalog/manifest.ts`,
  `web/src/data/sqlite/catalog-install.ts` (`KILTER_CATALOG_REQUIRED_COLUMNS`),
  `web/src/data/catalog/kilter-projection.ts`.

## Design decisions

Resolved during feature design (2026-10-19) from the epic decisions, the brief and the
existing app contract; none required a new product choice.

- **Artifact climb scope**: listed, single-frame layout-8 climbs whose every placement
  maps to a size-17 LED (after role normalization). The app already excludes everything
  else at query time (`kilter-projection.ts` requires `frames_count=1`, `is_listed=1`
  and known placements/roles), so narrowing changes no visible behavior and keeps the
  artifact well under the 8 MiB limit. Multi-frame climbs (37 lightable today) stay
  excluded and are counted in the report.
- **Role normalization lives in the artifact**: `frames` is rewritten to product-7 role
  ids by role name, so the app contract is unchanged; the upstream string is preserved
  in `upstream_frames` (SPEC: keep source-native payloads beside normalized fields).
- **UUID spelling is preserved exactly**; no case folding. Case-insensitive duplicates
  within one snapshot are a hard error.
- **Hardware pin reuses the definition exporter**: the normalizer rebuilds legacy-shaped
  hardware tables and must reproduce the generated definition's revision
  (`kilter:7:8:17:f0d70b3db9a6`) via `export-fullride-definition.extract()`; any other
  value stops the build. Spike on the 2026-10-19 snapshot reproduced it exactly.
- **Upstream status sidecar**: the artifact also records every layout-8 UUID the
  snapshot mentions (listed, unlisted, aliased) so `append-only-guards` can mark
  removals without re-reading the snapshot.
- **Manifest schema 3**: new source and quality-scale fields; current app builds reject
  schema 3 (`manifest.ts` pins 2), so no older client can install a Boardsesh-derived
  artifact before `catalog-semantics` and `device-update` land.

## Architectural choice

Extend the existing Python catalog tooling in `web/scripts/` with a small standard-
library package (`sqlite3`, `gzip`, `hashlib`, `urllib`, `json`) that the existing
build CLI calls. Python already owns the catalog build and the board-definition export,
so the hardware pin can call `extract()` directly instead of duplicating its hash
recipe, and CI needs no native SQLite binding.

Alternatives considered: (B) a Node/TypeScript builder reusing the app's projection
code — it shares validation with the app but needs a SQLite binding Node 20 lacks
(`node:sqlite` requires 22.5+) and would split catalog tooling across languages;
(C) normalizing on device from raw Boardsesh files — rejected by the epic's re-host
decision and by size (20.8 MB raw for layout 8 alone).

Data flow: `SnapshotInputs` (layout-8 artifact + v1-catalog artifact + their manifest
entries) → `HardwareScope` (pinned, verified) → `NormalizedClimbs` (+ status sidecar,
stats, grades) → artifact SQLite → deterministic gzip + manifest v3 + JSON report.
All stages are pure functions over SQLite connections except the fetch adapter, which
sits behind a small interface so tests run fully offline.

## Implementation Units

### Unit 1: Snapshot source adapter

**File**: `web/scripts/catalog/boardsesh_source.py`

```python
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

MANIFEST_GZIP_URL = "https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json"
MANIFEST_CATALOG_URL = "https://snapshots.boardsesh.com/board-snapshots/v1-catalog/manifest.json"
SUPPORTED_FORMAT_VERSIONS = {"v1-gzip": {2}, "v1-catalog": {1}}

@dataclass(frozen=True)
class ArtifactEntry:
    url: str
    bytes: int               # declared compressed size
    uncompressed_bytes: int
    built_at: str            # ISO-8601
    schema_version: int
    watermarks: dict[str, str]  # table -> watermarkUpdatedAt

@dataclass(frozen=True)
class SnapshotInputs:
    climbs_db: Path          # plain SQLite on disk
    catalog_db: Path
    climbs_entry: ArtifactEntry
    catalog_entry: ArtifactEntry
    climbs_sha256: str       # of the bytes as received
    catalog_sha256: str

class Fetcher(Protocol):
    def get(self, url: str) -> bytes: ...

class SourceError(Exception):
    """Manifest/artifact missing, unsupported format, size or encoding mismatch."""

def parse_climbs_entry(manifest: dict, layout_id: int = 8) -> ArtifactEntry: ...
def parse_catalog_entry(manifest: dict) -> ArtifactEntry: ...
def materialize(body: bytes, entry: ArtifactEntry, dest: Path) -> str:
    """Accept gzip (1f 8b, length == entry.bytes) or plain SQLite (header, length ==
    entry.uncompressed_bytes); write plain SQLite to dest; return sha256 of body."""
def fetch_inputs(fetcher: Fetcher, work_dir: Path) -> SnapshotInputs: ...
def load_inputs(climbs_db: Path, catalog_db: Path, climbs_manifest: Path,
                catalog_manifest: Path) -> SnapshotInputs:
    """Offline path used by tests and reruns."""
```

**Implementation Notes**:
- Exactly one manifest GET and one artifact GET per source per run; send
  `Accept-Encoding: identity` and a descriptive User-Agent; no retries beyond one.
- Unknown `formatVersion`, missing `kilter`/layout-8 entry, or an entry without
  `url`/sizes raises `SourceError` (fail closed).
- Decompressed output must equal `uncompressed_bytes`; SQLite header must be present.

**Acceptance Criteria**:
- [x] A gzip body and the equivalent plain body produce byte-identical `climbs_db`.
- [x] Length mismatch, wrong magic, unknown format version and missing layout-8 entry
      each raise `SourceError` with a distinct message.
- [x] `load_inputs` needs no network.

---

### Unit 2: Hardware scope and pin

**File**: `web/scripts/catalog/hardware.py`

```python
from __future__ import annotations
import sqlite3
from dataclasses import dataclass

PRODUCT_ID = 7; LAYOUT_ID = 8; PRODUCT_SIZE_ID = 17; SET_IDS = (26, 27)
HARDWARE_TABLES = ("product_sizes", "placement_roles", "holes", "placements", "leds",
                   "products", "layouts", "sets", "product_sizes_layouts_sets",
                   "difficulty_grades")

@dataclass(frozen=True)
class HardwareScope:
    revision: str                      # e.g. "kilter:7:8:17:f0d70b3db9a6"
    lit_placement_ids: frozenset[int]  # placements with a size-17 LED in sets 26/27
    role_map: dict[int, int]           # upstream role id -> product-7 role id, by name
    supported_angles: tuple[int, ...]

class HardwareMismatch(Exception): ...

def pinned_revision(generated_ts: Path) -> str:
    """Read the "revision" literal from kilter-fullride-7x10.generated.ts."""
def copy_hardware(catalog: sqlite3.Connection, out: sqlite3.Connection,
                  angles: tuple[int, ...]) -> None:
    """Create legacy-named tables (no board_type column), kilter rows only, pruned to
    product 7 / layout 8 / size 17 / sets 26-27; products_angles from `angles`."""
def verify_scope(out_path: Path, expected_revision: str) -> HardwareScope:
    """Run export-fullride-definition.extract(out_path); raise HardwareMismatch unless
    revision == expected_revision; build role_map from placement_roles names."""
```

**Implementation Notes**:
- `products_angles` is absent upstream; angles come from the pinned generated
  definition (board identity, not climb data) and are hashed by `extract()` as before.
- `role_map` maps every kilter role whose name is start/middle/finish/foot (any
  product) to the product-7 id with the same name; an unknown name is a mismatch.
- Import the exporter by path (as its test does) so there is one hash recipe.

**Acceptance Criteria**:
- [x] On the real 2026-10-19 snapshot fixture, revision equals the pinned value.
- [x] Moving one LED position, removing a placement or renaming a role raises
      `HardwareMismatch`.
- [x] `role_map == {12: 42, 13: 43, 14: 44, 15: 45, 42: 42, 43: 43, 44: 44, 45: 45}`
      for the Kilter fixture.

---

### Unit 3: Climb normalization (trickiest; build first)

**File**: `web/scripts/catalog/normalize_climbs.py`

```python
from __future__ import annotations
import sqlite3
from dataclasses import dataclass, field

FRAME_TOKEN = r"p([1-9][0-9]*)r([1-9][0-9]*)"   # mirrors kilter-projection.ts

@dataclass(frozen=True)
class ClimbStatus:
    uuid: str
    status: str            # "listed" | "unlisted" | "aliased"
    canonical_uuid: str | None

@dataclass
class NormalizationReport:
    upstream_rows: int = 0
    listed: int = 0
    emitted: int = 0
    excluded: dict[str, int] = field(default_factory=dict)  # reason -> count
    role_rewritten: int = 0
    multi_frame: int = 0

class NormalizationError(Exception): ...

def normalize_frames(frames: str, scope: HardwareScope) -> str | None:
    """Return frames with roles mapped to product-7 ids, or None if any token is
    unparsable, a placement is unlit on size 17, or a placement repeats."""
def normalize(climbs_db: sqlite3.Connection, catalog_db: sqlite3.Connection,
              scope: HardwareScope, out: sqlite3.Connection) -> NormalizationReport:
    """Write climbs, climb_stats, upstream_climbs into `out`."""
```

**Implementation Notes**:
- Select `board_climbs WHERE board_type='kilter' AND layout_id=8`; every row lands in
  `upstream_climbs` (status listed/unlisted); every `board_climb_aliases` row whose
  canonical is a layout-8 climb lands as `aliased` with its canonical.
- Emit to `climbs` only `is_listed=1 AND is_draft IS NOT 1 AND frames_count=1` rows
  whose frames normalize; exclusion reasons are counted (`multi_frame`,
  `unlit_placement`, `unparsable_frames`, `duplicate_placement`).
- `climbs` columns: the current artifact's `climbs` schema (copied verbatim as a
  constant from today's artifact `CREATE TABLE`) plus `upstream_frames TEXT`; missing
  upstream columns are NULL. `is_draft` written as 0.
- `climb_stats` for emitted UUIDs and supported angles only; values copied unchanged
  (scale recorded in the manifest, not converted).
- Duplicate UUIDs differing only by case → `NormalizationError`.

**Acceptance Criteria**:
- [x] On the real snapshot: every emitted `frames` uses only roles 42–45 and parses
      under the app's token rule. Emitted 13,299 (design estimate 13,310 also counted
      20 duplicate-placement and 2 setter-less climbs the app rejects anyway).
- [x] Legacy climbs keep byte-identical UUIDs and `frames`: 11,068 of the 11,101
      currently lightable bundled climbs are emitted identically; the other 33 are
      unlisted (32) or aliased (1) upstream and recorded in `upstream_climbs`.
- [x] Each exclusion reason is exercised by a synthetic fixture.
- [x] Every layout-8 UUID in the snapshot and every layout-8 alias appears once in
      `upstream_climbs`.

---

### Unit 4: Artifact writer and manifest v3

**File**: `web/scripts/catalog/artifact.py`

```python
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path

MANIFEST_SCHEMA_VERSION = 3
SOURCE_ID = "boardsesh-kilter"

@dataclass(frozen=True)
class ManifestV3:
    schemaVersion: int          # 3
    version: int
    board: str                  # "kilter-fullride-7x10"
    file: str                   # kilter-7x10.v<version>.db.gz
    compression: str            # "gzip"
    sha256: str
    bytesGzipped: int
    bytesRaw: int
    generatedOn: str            # YYYY-MM-DD
    source: str                 # "boardsesh-kilter"
    sourceBuiltAt: str          # Boardsesh builtAt (ISO-8601)
    sourceWatermarks: dict[str, str]
    layoutRevision: str
    qualityScale: dict[str, float]   # {"min": 0, "max": 5}
    climbCount: int
    generatedFrom: str
    filter: str

def write_meta(out: sqlite3.Connection, inputs: SnapshotInputs, scope: HardwareScope,
               report: NormalizationReport) -> None:
    """catalog_meta(key TEXT PRIMARY KEY, value TEXT) with source provenance."""
def finalize(db_path: Path, out_dir: Path, version: int, generated_on: str,
             meta: dict) -> ManifestV3:
    """VACUUM, gzip (level 9, mtime 0, empty filename), hash, write manifest.json."""
```

**Implementation Notes**:
- Rows are inserted in primary-key order so identical inputs produce identical bytes.
- Enforce the app limits (8 MiB gzipped, 32 MiB raw) as hard errors, not warnings.
- `catalog_meta` also records input SHA-256s, Boardsesh `builtAt`, watermarks and the
  report counts, so the artifact is self-describing.

**Acceptance Criteria**:
- [x] Two builds from the same inputs produce the same `sha256`.
- [x] The output passes the app's install checks: required columns
      (`KILTER_CATALOG_REQUIRED_COLUMNS`), nonempty layout-8-only `climbs`,
      `page_count*page_size == bytesRaw`, `integrity_check == ok`.
- [x] Manifest validates against the schema-3 fixture committed at
      `web/src/data/catalog/__fixtures__/manifest-v3.example.json` (consumed later by
      `device-update`).

---

### Unit 5: Build CLI

**File**: `web/scripts/build-catalog-snapshot.py` (rewritten; BoardLib path removed)

```text
python web/scripts/build-catalog-snapshot.py --version N
    [--from-dir DIR]            # offline: climbs.db, catalog.db, manifest JSONs
    [--out-dir web/public/catalog] [--generated-on YYYY-MM-DD]
    [--report PATH]             # JSON NormalizationReport + manifest summary
exit 0 = built; 2 = SourceError; 3 = HardwareMismatch; 4 = NormalizationError;
5 = size limit
```

**Implementation Notes**:
- Never overwrites an existing artifact file of the same version.
- Prints a one-screen summary (counts, revision, sizes, sha) and writes the report.
- Keeps `--generated-on` semantics: build date is never a freshness claim.

**Acceptance Criteria**:
- [x] `--from-dir` on the fixture completes offline with exit 0 and writes artifact,
      manifest and report.
- [x] Each failure class maps to its exit code.

---

### Unit 6: Tests and CI lane

**Files**: `web/scripts/catalog/test_*.py`, `web/scripts/catalog/fixtures/`,
`.github/workflows/ci.yml`

- Synthetic fixtures built in-test from SQL (Boardsesh-shaped `board_*` tables), as
  `test_export_fullride_definition.py` does; no downloaded data committed.
- CI: run `python -m unittest discover -s web/scripts -p 'test_*.py'` on Python 3.11
  (this also starts running the existing exporter tests, which pass today). Code stays
  3.9-compatible for local runs.
- A local-only verification (documented in the feature body, not in CI) runs the CLI
  against the real 2026-10-19 snapshot and records counts.

## Implementation Order

1. Unit 3 core (`normalize_frames`) with synthetic tests — the riskiest logic.
2. Unit 2 hardware scope (spike already proven) — needed by Unit 3's lit-placement set.
3. Unit 3 full normalization and status sidecar.
4. Unit 1 source adapter (offline path first, then fetch).
5. Unit 4 artifact writer and manifest v3 + example fixture.
6. Unit 5 CLI; Unit 6 CI wiring; local real-snapshot verification.

## Testing

### Unit tests: `web/scripts/catalog/test_normalize_climbs.py`, `test_hardware.py`, `test_boardsesh_source.py`, `test_artifact.py`
- Frames: role rewrite 12→42 etc., 42–45 pass-through, unlit placement, duplicate
  placement, garbage token, multi-frame string.
- Hardware: pinned revision reproduced; LED/placement/role perturbations fail.
- Source: gzip vs plain equivalence, size/magic/format failures, missing entry.
- Artifact: determinism (same sha twice), size-limit errors, manifest fields.

### Integration tests
- End-to-end `--from-dir` build on a synthetic Boardsesh-shaped fixture, then open the
  output with Python `sqlite3` and assert the app's install-time checks (columns,
  layout-8 only, page math, integrity).
- Local real-data run (not CI): expected 13,310 emitted climbs and the pinned revision.

## Risks

- **Upstream conversion drift**: Boardsesh may change role codes, UUID forms or column
  names. — **Fallback**: hardware pin, explicit exclusion counts and fail-closed
  `SourceError`; guards feature catches large swings before publication.
- **Artifact size**: emitted set plus append-only carry-over must stay under 8 MiB
  gzipped. — **Fallback**: today's estimate is well under (13k climbs vs 23k in a
  5.1 MB artifact); size limit is a hard error, so it cannot ship oversized.
- **Least sure**: whether Boardsesh's case-insensitive alias/deletion handling ever
  emits a legacy UUID in a different case. Exact-case match is 23,147/23,147 today;
  a case-only duplicate is a hard error rather than a silent split.

## Implementation notes

- Execution capability: inline, single owner — one cohesive standard-library Python
  package; no fan-out needed.
- Review weight: standard (project default).
- Files changed: `web/scripts/catalog/{__init__,schema,boardsesh_source,hardware,normalize_climbs,artifact,fixtures}.py`,
  `web/scripts/catalog/test_catalog_build.py`, `web/scripts/build-catalog-snapshot.py`
  (rewritten), `web/src/data/catalog/__fixtures__/manifest-v3.example.json`,
  `.github/workflows/ci.yml` (new `catalog-pipeline` job), `docs/SPEC.md` §6,
  `docs/ARCHITECTURE.md` Module Map 3.
- Tests added: 20 offline unit/integration tests (frames normalization and every
  exclusion reason; hardware pin and LED/role perturbations; source gzip/plain
  equivalence and fail-closed manifest parsing; deterministic build; app install-time
  checks with required columns parsed from `catalog-install.ts`; manifest keys matched
  to the committed example). CI now also runs the 6 existing exporter tests, which were
  never run in CI before.
- Real-data verification (local, not CI; 2026-10-19 snapshot): revision
  `kilter:7:8:17:f0d70b3db9a6` reproduced; 34,070 upstream rows, 29,053 listed,
  13,299 emitted, 791 aliases, 1,862 role-rewritten; excluded unlit 15,652, multi-frame
  80, duplicate placement 20, missing setter 2; 28,655 stats (447 missing metrics).
  4,969,627 bytes gzipped / 11,767,808 raw; two builds byte-identical
  (`8bacc43f…`); `integrity_check` ok and page math matches.
- Simplification: removed the BoardLib download/prune path and its `boardlib`/Pillow
  dependency; the hardware pin reuses `export-fullride-definition.extract()` instead
  of a second hash recipe.
- Discrepancies from design:
  - Artifact schema keeps legacy column names but makes app-unread columns nullable
    (`setter_id`, `hsm`, `fa_username`, `fa_at`): 4,983 new-backend climbs lack them
    upstream, and inventing values was rejected.
  - `created_at` converted to the legacy text form; `is_nomatch` derived from Boardsesh
    `characteristics`.
  - `normalize_frames` returns `(frames, reason)` rather than `frames | None` so
    exclusion reasons are counted.
  - `--out-dir` is required (no default) so a build cannot replace the committed
    schema-2 manifest that current app builds install.
  - The live `UrllibFetcher` path was not exercised end to end in this session to
    respect Boardsesh's once-per-day fetch guidance (both artifacts were already
    fetched today); the identical bytes were run through `--from-dir`.
- Adjacent issues parked: none. Note for `private-publish`: the v1-catalog artifact is
  served uncompressed (~194 MB); cache it by `builtAt` rather than re-fetching weekly.

## Review

- Effective weight: standard (project default); one independent pass.
- Reviewer: Codex `gpt-6.1-sol` (medium effort) via peeragent — cross-model (host Claude).
  Review-only; it re-ran the suite on Python 3.9.6 (green) and did not re-run real data.
- Proposed verdict: Request changes (2 blockers). Receiver adjudication:
  - **Blocker, accepted — artifact schema versions not pinned.** Only `formatVersion`
    was checked, so an upstream `schemaVersion` change would normalize silently
    despite the epic's fail-closed rule. Fixed: `CLIMBS_SCHEMA_VERSIONS = {13}`,
    `CATALOG_SCHEMA_VERSIONS = {1}`; others raise `SourceError`; regression tests added.
  - **Blocker, accepted — alias identity collisions skipped silently.** A case-variant
    alias, an alias mapped to two canonicals, or an alias colliding with a climb's UUID
    was dropped without error. Real data has none (34,859 layout-8 alias rows: 34,068
    self-aliases, 791 genuine, no case variants or conflicts), but the invariant was
    unenforced. Fixed: self-aliases and exact duplicates are ignored; every other
    collision raises `NormalizationError`; regression tests added.
- Verification after fixes: 28 tests pass; real-snapshot build unchanged (13,299
  climbs, 791 aliases, sha256 `8bacc43f…`).
- Closure: standard weight — blockers fixed and verified, no second pass.
- Observed, not part of this change: `.work/bin/work-view` was rewritten (48-byte binary
  difference) at the moment the reviewer session started; left uncommitted for the
  operator to inspect.
