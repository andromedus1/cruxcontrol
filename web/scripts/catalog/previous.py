"""Load and verify the previously published artifact that a new build must extend."""
from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

SUPPORTED = {2: "legacy-aurora-kilter", 3: "boardsesh-kilter"}


class PreviousArtifactError(Exception):
    """The previous artifact is missing, unsupported, or does not match its manifest."""


@dataclass(frozen=True)
class PreviousArtifact:
    db_path: Path
    manifest: dict
    version: int
    schema_version: int
    source_built_at: Optional[str]
    layout_revision: Optional[str]


def load_previous(previous_dir: Path, work_dir: Path) -> PreviousArtifact:
    """Read <dir>/manifest.json and the artifact it names; verify hash and sizes."""
    manifest_path = previous_dir / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise PreviousArtifactError(f"cannot read previous manifest {manifest_path}: {error}") from error
    schema = manifest.get("schemaVersion")
    if SUPPORTED.get(schema) != manifest.get("source"):
        raise PreviousArtifactError(f"unsupported previous manifest schema {schema!r} / source {manifest.get('source')!r}")
    version = manifest.get("version")
    name = manifest.get("file")
    if not isinstance(version, int) or isinstance(version, bool) or version <= 0 \
            or not isinstance(name, str) or "/" in name or name != f"kilter-7x10.v{version}.db.gz":
        raise PreviousArtifactError("previous manifest has an invalid version or file name")
    artifact = previous_dir / name
    try:
        body = artifact.read_bytes()
    except OSError as error:
        raise PreviousArtifactError(f"cannot read previous artifact {artifact}: {error}") from error
    if len(body) != manifest.get("bytesGzipped") or hashlib.sha256(body).hexdigest() != manifest.get("sha256"):
        raise PreviousArtifactError("previous artifact does not match its manifest size and sha256")
    raw = gzip.decompress(body)
    if len(raw) != manifest.get("bytesRaw"):
        raise PreviousArtifactError("previous artifact raw size does not match its manifest")
    if schema == 3:
        for key in ("sourceBuiltAt", "layoutRevision"):
            if not isinstance(manifest.get(key), str) or not manifest[key]:
                raise PreviousArtifactError(f"previous schema-3 manifest is missing {key}; guards need it")
    db_path = work_dir / "previous.sqlite3"
    db_path.write_bytes(raw)
    return PreviousArtifact(db_path, manifest, version, schema,
                            manifest.get("sourceBuiltAt"), manifest.get("layoutRevision"))
