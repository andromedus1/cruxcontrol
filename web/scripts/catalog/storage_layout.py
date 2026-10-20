"""Object names in the private catalog bucket (mirrored by the catalog gateway).

Objects are immutable and created only if absent. A version is published once both its
artifact and manifest exist; the publisher writes the artifact first, then the manifest.
"""
from __future__ import annotations

import re
from typing import Iterable, Optional

PREFIX = "kilter-7x10"
MAX_VERSION = 999_999
_ARTIFACT = re.compile(r"^kilter-7x10/artifacts/kilter-7x10\.v([1-9][0-9]{0,5})\.db\.gz$")
_MANIFEST = re.compile(r"^kilter-7x10/manifests/v([0-9]{6})\.json$")


def _check(version: int) -> int:
    if not isinstance(version, int) or isinstance(version, bool) or not 1 <= version <= MAX_VERSION:
        raise ValueError(f"catalog version out of range: {version!r}")
    return version


def artifact_object(version: int) -> str:
    return f"{PREFIX}/artifacts/kilter-7x10.v{_check(version)}.db.gz"


def manifest_object(version: int) -> str:
    return f"{PREFIX}/manifests/v{_check(version):06d}.json"


def latest_version(object_names: Iterable[str]) -> Optional[int]:
    """Highest version with both its artifact and manifest present."""
    artifacts, manifests = set(), set()
    for name in object_names:
        match = _ARTIFACT.match(name)
        if match:
            artifacts.add(int(match.group(1)))
            continue
        match = _MANIFEST.match(name)
        if match and int(match.group(1)) >= 1:
            manifests.add(int(match.group(1)))
    published = artifacts & manifests
    return max(published) if published else None
