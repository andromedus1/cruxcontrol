"""Fetch and materialize Boardsesh snapshot inputs (one GET per manifest/artifact)."""
from __future__ import annotations

import gzip
import hashlib
import json
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Protocol

MANIFEST_GZIP_URL = "https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json"
MANIFEST_CATALOG_URL = "https://snapshots.boardsesh.com/board-snapshots/v1-catalog/manifest.json"
CLIMBS_FORMAT_VERSIONS = {2}
CATALOG_FORMAT_VERSIONS = {1}
# Artifact schema versions this normalizer was verified against. A new upstream schema
# holds the build (fail closed) until the normalizer is re-verified against it.
CLIMBS_SCHEMA_VERSIONS = {13}
CATALOG_SCHEMA_VERSIONS = {1}
SQLITE_HEADER = b"SQLite format 3\x00"
GZIP_MAGIC = b"\x1f\x8b"
MAX_BODY_BYTES = 512 * 1024 * 1024
USER_AGENT = "cruxcontrol-catalog-build (+https://github.com/andromedus1/cruxcontrol)"


class SourceError(Exception):
    """Upstream manifest or artifact is missing, unsupported, or inconsistent."""


@dataclass(frozen=True)
class ArtifactEntry:
    url: str
    bytes: int
    uncompressed_bytes: int
    built_at: str
    schema_version: int
    watermarks: Dict[str, str]


@dataclass(frozen=True)
class SnapshotInputs:
    climbs_db: Path
    catalog_db: Path
    climbs_entry: ArtifactEntry
    catalog_entry: ArtifactEntry
    climbs_sha256: str
    catalog_sha256: str


class Fetcher(Protocol):
    def get(self, url: str) -> bytes: ...


class UrllibFetcher:
    def __init__(self, timeout: float = 120.0) -> None:
        self.timeout = timeout

    def get(self, url: str) -> bytes:
        request = urllib.request.Request(url, headers={
            "Accept-Encoding": "identity",
            "User-Agent": USER_AGENT,
        })
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read(MAX_BODY_BYTES + 1)
        except OSError as error:
            raise SourceError(f"fetch failed for {url}: {error}") from error
        if len(body) > MAX_BODY_BYTES:
            raise SourceError(f"response larger than {MAX_BODY_BYTES} bytes: {url}")
        return body


def _entry(raw: dict, label: str, schema_versions: set) -> ArtifactEntry:
    try:
        url = raw["url"]
        size = raw["bytes"]
        uncompressed = raw["uncompressedBytes"]
        built_at = raw["builtAt"]
        schema_version = raw["schemaVersion"]
    except (KeyError, TypeError) as error:
        raise SourceError(f"{label} entry is missing {error}") from error
    if not (isinstance(url, str) and url.startswith("https://")):
        raise SourceError(f"{label} entry has an invalid url")
    for name, value in (("bytes", size), ("uncompressedBytes", uncompressed), ("schemaVersion", schema_version)):
        if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
            raise SourceError(f"{label} entry has an invalid {name}")
    if schema_version not in schema_versions:
        raise SourceError(f"{label} schemaVersion {schema_version} is not supported "
                          f"(expected one of {sorted(schema_versions)})")
    if not isinstance(built_at, str) or not built_at:
        raise SourceError(f"{label} entry has an invalid builtAt")
    tables = raw.get("tables") or {}
    watermarks = {
        name: info["watermarkUpdatedAt"]
        for name, info in sorted(tables.items())
        if isinstance(info, dict) and isinstance(info.get("watermarkUpdatedAt"), str)
    }
    return ArtifactEntry(url, size, uncompressed, built_at, schema_version, watermarks)


def parse_climbs_entry(manifest: dict, layout_id: int = 8) -> ArtifactEntry:
    if not isinstance(manifest, dict) or manifest.get("formatVersion") not in CLIMBS_FORMAT_VERSIONS:
        raise SourceError("unsupported v1-gzip manifest formatVersion")
    matches = [
        entry for entry in manifest.get("entries") or []
        if isinstance(entry, dict) and entry.get("boardType") == "kilter" and entry.get("layoutId") == layout_id
    ]
    if len(matches) != 1:
        raise SourceError(f"expected one kilter layout {layout_id} entry, found {len(matches)}")
    return _entry(matches[0], f"kilter layout {layout_id}", CLIMBS_SCHEMA_VERSIONS)


def parse_catalog_entry(manifest: dict) -> ArtifactEntry:
    if not isinstance(manifest, dict) or manifest.get("formatVersion") not in CATALOG_FORMAT_VERSIONS:
        raise SourceError("unsupported v1-catalog manifest formatVersion")
    artifact = manifest.get("artifact")
    if not isinstance(artifact, dict):
        raise SourceError("v1-catalog manifest has no artifact")
    return _entry(artifact, "v1-catalog", CATALOG_SCHEMA_VERSIONS)


def materialize(body: bytes, entry: ArtifactEntry, dest: Path) -> str:
    """Write plain SQLite to dest from a gzip or plain body; return sha256 of body."""
    if body[:2] == GZIP_MAGIC:
        if len(body) != entry.bytes:
            raise SourceError(f"gzip body is {len(body)} bytes, manifest declares {entry.bytes}")
        try:
            raw = gzip.decompress(body)
        except OSError as error:
            raise SourceError(f"gzip body does not decompress: {error}") from error
    elif body[:16] == SQLITE_HEADER:
        raw = body
    else:
        raise SourceError("artifact body is neither gzip nor SQLite")
    if len(raw) != entry.uncompressed_bytes:
        raise SourceError(f"SQLite is {len(raw)} bytes, manifest declares {entry.uncompressed_bytes}")
    if raw[:16] != SQLITE_HEADER:
        raise SourceError("decompressed artifact is not SQLite")
    dest.write_bytes(raw)
    return hashlib.sha256(body).hexdigest()


def _json(body: bytes, label: str) -> dict:
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise SourceError(f"{label} manifest is not JSON") from error


def _inputs(climbs_manifest: dict, catalog_manifest: dict, climbs_body: bytes,
            catalog_body: bytes, work_dir: Path) -> SnapshotInputs:
    climbs_entry = parse_climbs_entry(climbs_manifest)
    catalog_entry = parse_catalog_entry(catalog_manifest)
    climbs_db = work_dir / "boardsesh-kilter-8.db"
    catalog_db = work_dir / "boardsesh-catalog.db"
    return SnapshotInputs(
        climbs_db, catalog_db, climbs_entry, catalog_entry,
        materialize(climbs_body, climbs_entry, climbs_db),
        materialize(catalog_body, catalog_entry, catalog_db),
    )


def fetch_inputs(fetcher: Fetcher, work_dir: Path) -> SnapshotInputs:
    climbs_manifest = _json(fetcher.get(MANIFEST_GZIP_URL), "v1-gzip")
    catalog_manifest = _json(fetcher.get(MANIFEST_CATALOG_URL), "v1-catalog")
    climbs_body = fetcher.get(parse_climbs_entry(climbs_manifest).url)
    catalog_body = fetcher.get(parse_catalog_entry(catalog_manifest).url)
    return _inputs(climbs_manifest, catalog_manifest, climbs_body, catalog_body, work_dir)


def load_inputs(source_dir: Path, work_dir: Path) -> SnapshotInputs:
    """Offline inputs: climbs-manifest.json, catalog-manifest.json, climbs.db, catalog.db."""
    def read(name: str) -> bytes:
        path = source_dir / name
        if not path.is_file():
            raise SourceError(f"missing offline input {path}")
        return path.read_bytes()

    return _inputs(
        _json(read("climbs-manifest.json"), "v1-gzip"),
        _json(read("catalog-manifest.json"), "v1-catalog"),
        read("climbs.db"), read("catalog.db"), work_dir,
    )
