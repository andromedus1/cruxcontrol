"""Decide whether a reconciled build may be published (fail closed)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

from .previous import PreviousArtifact
from .reconcile import ReconcileReport

# Operator-approved limits (2026-10-19).
MAX_PRESENT_DROP_FRACTION = 0.02
MAX_NEWLY_REMOVED = 250


@dataclass(frozen=True)
class GuardVerdict:
    publish: bool
    unchanged: bool
    reasons: Tuple[str, ...]


def evaluate(report: ReconcileReport, previous: PreviousArtifact,
             source_built_at: str, revision: str) -> GuardVerdict:
    if previous.source_built_at is not None and source_built_at == previous.source_built_at:
        return GuardVerdict(False, True, ("upstream snapshot unchanged since the previous artifact",))
    reasons = []
    if report.lost:
        reasons.append(f"{len(report.lost)} previously published climbs would be lost")
    if report.case_changed:
        reasons.append(f"{len(report.case_changed)} climbs reappeared with different UUID casing")
    if previous.source_built_at is not None and source_built_at < previous.source_built_at:
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
