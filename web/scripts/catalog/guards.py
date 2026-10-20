"""Decide whether a reconciled build may be published (fail closed)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Tuple

from .previous import PreviousArtifact
from .reconcile import ReconcileReport

# Operator-approved limits (2026-10-19).
MAX_PRESENT_DROP_FRACTION = 0.02
MAX_NEWLY_REMOVED = 250


_ISO = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$")


def instant(value: str) -> Optional[datetime]:
    """Parse an ISO-8601 timestamp with an explicit offset into an aware UTC datetime."""
    match = _ISO.match(value) if isinstance(value, str) else None
    if not match:
        return None
    base, fraction, offset = match.groups()
    micros = (fraction or "").ljust(6, "0")[:6]
    parsed = datetime.fromisoformat(f"{base}.{micros}{'+00:00' if offset == 'Z' else offset}")
    return parsed.astimezone(timezone.utc)


@dataclass(frozen=True)
class GuardVerdict:
    publish: bool
    unchanged: bool
    reasons: Tuple[str, ...]


def evaluate(report: ReconcileReport, previous: PreviousArtifact,
             source_built_at: str, revision: str) -> GuardVerdict:
    current = instant(source_built_at)
    prior = instant(previous.source_built_at) if previous.source_built_at is not None else None
    if current is None or (previous.source_built_at is not None and prior is None):
        return GuardVerdict(False, False, (f"unparsable upstream build time {source_built_at!r} / "
                                           f"{previous.source_built_at!r}",))
    if prior is not None and current == prior:
        return GuardVerdict(False, True, ("upstream snapshot unchanged since the previous artifact",))
    reasons = []
    if report.lost:
        reasons.append(f"{len(report.lost)} previously published climbs would be lost")
    if report.case_changed:
        reasons.append(f"{len(report.case_changed)} climbs reappeared with different UUID casing")
    if prior is not None and current < prior:
        reasons.append(f"upstream build {source_built_at} is older than previous {previous.source_built_at}")
    if previous.layout_revision is not None and revision != previous.layout_revision:
        reasons.append(f"layout revision {revision} differs from previous {previous.layout_revision}")
    floor = report.previous_present * (1 - MAX_PRESENT_DROP_FRACTION)
    if report.present < floor:
        reasons.append(f"upstream-present climbs fell from {report.previous_present} to {report.present} "
                       f"(more than {MAX_PRESENT_DROP_FRACTION:.0%})")
    if report.removed > MAX_NEWLY_REMOVED:
        reasons.append(f"{report.removed} climbs newly removed upstream (limit {MAX_NEWLY_REMOVED})")
    return GuardVerdict(not reasons, False, tuple(reasons))
