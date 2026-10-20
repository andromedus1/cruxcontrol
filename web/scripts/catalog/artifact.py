"""Assemble, finalize and describe a CruxControl catalog artifact."""
from __future__ import annotations

import dataclasses
import gzip
import hashlib
import json
import shutil
import sqlite3
from pathlib import Path
from typing import Dict

from .boardsesh_source import SnapshotInputs
from .hardware import PinnedDefinition, copy_hardware, verify_scope
from .normalize_climbs import NormalizationReport, normalize
from .schema import create

MANIFEST_SCHEMA_VERSION = 3
BOARD_ID = "kilter-fullride-7x10"
SOURCE_ID = "boardsesh-kilter"
COMPRESSED_LIMIT = 8 * 1024 * 1024
RAW_LIMIT = 32 * 1024 * 1024
QUALITY_SCALE = {"min": 0, "max": 5}
GENERATED_FROM = ("boardsesh v1-gzip kilter layout 8 + v1-catalog -> pin to "
                  "kilter-fullride-7x10 definition -> normalize roles to product 7 -> gzip")
FILTER = ("climbs WHERE layout_id=8 AND is_listed=1 AND frames_count=1 "
          "AND every placement lit on product_size 17")


class SizeLimitError(Exception):
    """The artifact exceeds the app's supported catalog size."""


@dataclasses.dataclass(frozen=True)
class BuildResult:
    manifest: Dict[str, object]
    report: NormalizationReport
    artifact_path: Path


def artifact_name(version: int) -> str:
    return f"kilter-7x10.v{version}.db.gz"


def _meta(inputs: SnapshotInputs, revision: str, report: NormalizationReport) -> Dict[str, str]:
    return {
        "source": SOURCE_ID,
        "layoutRevision": revision,
        "sourceBuiltAt": inputs.climbs_entry.built_at,
        "catalogBuiltAt": inputs.catalog_entry.built_at,
        "sourceWatermarks": json.dumps(inputs.climbs_entry.watermarks, sort_keys=True),
        "climbsSha256": inputs.climbs_sha256,
        "catalogSha256": inputs.catalog_sha256,
        "qualityScale": json.dumps(QUALITY_SCALE, sort_keys=True),
        "normalization": json.dumps(dataclasses.asdict(report), sort_keys=True),
    }


def build_database(inputs: SnapshotInputs, pinned: PinnedDefinition, db_path: Path) -> tuple:
    """Write the uncompressed artifact; return (revision, report)."""
    if db_path.exists():
        db_path.unlink()
    catalog = sqlite3.connect(f"file:{inputs.catalog_db}?mode=ro", uri=True)
    climbs = sqlite3.connect(f"file:{inputs.climbs_db}?mode=ro", uri=True)
    out = sqlite3.connect(db_path)
    try:
        copy_hardware(catalog, out, pinned.angles)
        out.commit()
        scope = verify_scope(db_path, catalog, pinned)
        report = normalize(climbs, catalog, scope, out)
        create(out, "catalog_meta")
        out.executemany("INSERT INTO catalog_meta VALUES (?,?)",
                        sorted(_meta(inputs, scope.revision, report).items()))
        out.commit()
        out.execute("VACUUM")
    finally:
        out.close()
        climbs.close()
        catalog.close()
    return scope.revision, report


def finalize(db_path: Path, out_dir: Path, version: int, generated_on: str,
             inputs: SnapshotInputs, revision: str, report: NormalizationReport) -> Dict[str, object]:
    name = artifact_name(version)
    gz_path = out_dir / name
    if gz_path.exists():
        raise FileExistsError(f"refusing to overwrite existing artifact {gz_path}")
    raw = db_path.stat().st_size
    if raw > RAW_LIMIT:
        raise SizeLimitError(f"raw artifact is {raw} bytes, limit {RAW_LIMIT}")
    out_dir.mkdir(parents=True, exist_ok=True)
    partial = out_dir / f".{name}.partial"
    with open(db_path, "rb") as source, open(partial, "wb") as target:
        with gzip.GzipFile(filename="", mode="wb", fileobj=target, compresslevel=9, mtime=0) as stream:
            shutil.copyfileobj(source, stream)
    compressed = partial.stat().st_size
    if compressed > COMPRESSED_LIMIT:
        partial.unlink()
        raise SizeLimitError(f"gzipped artifact is {compressed} bytes, limit {COMPRESSED_LIMIT}")
    sha = hashlib.sha256(partial.read_bytes()).hexdigest()
    partial.replace(gz_path)
    manifest = {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "version": version,
        "board": BOARD_ID,
        "file": name,
        "compression": "gzip",
        "sha256": sha,
        "bytesGzipped": compressed,
        "bytesRaw": raw,
        "generatedOn": generated_on,
        "source": SOURCE_ID,
        "sourceBuiltAt": inputs.climbs_entry.built_at,
        "sourceWatermarks": inputs.climbs_entry.watermarks,
        "layoutRevision": revision,
        "qualityScale": QUALITY_SCALE,
        "climbCount": report.emitted,
        "generatedFrom": GENERATED_FROM,
        "filter": FILTER,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def build(inputs: SnapshotInputs, pinned: PinnedDefinition, out_dir: Path, work_dir: Path,
          version: int, generated_on: str) -> BuildResult:
    if version <= 0:
        raise ValueError("version must be positive")
    db_path = work_dir / "artifact.sqlite3"
    revision, report = build_database(inputs, pinned, db_path)
    manifest = finalize(db_path, out_dir, version, generated_on, inputs, revision, report)
    return BuildResult(manifest, report, out_dir / artifact_name(version))
