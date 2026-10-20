"""Carry previously published climb identities forward so the catalog only grows."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Dict, List

from .hardware import HardwareScope
from .normalize_climbs import normalize_frames
from .previous import PreviousArtifact


@dataclass
class ReconcileReport:
    previous_version: int
    previous_present: int = 0   # previous app-visible climbs present upstream
    present: int = 0            # climbs present upstream in this build
    added: int = 0              # present now, not app-visible before
    removed: int = 0            # newly marked removed upstream by this build
    restored: int = 0           # previously marked, present again
    carried: int = 0            # all climbs marked removed upstream in this build
    lost: List[str] = field(default_factory=list)          # must stay empty
    case_changed: List[str] = field(default_factory=list)  # uuid reappeared with other casing


def _columns(connection: sqlite3.Connection, table: str) -> List[str]:
    return [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]


def _visible(previous: sqlite3.Connection, scope: HardwareScope) -> Dict[str, dict]:
    """Previous climbs the app could show: listed, single-frame, fully lit on size 17."""
    columns = _columns(previous, "climbs")
    visible = {}
    for row in previous.execute(f"SELECT {','.join(columns)} FROM climbs ORDER BY uuid"):
        climb = dict(zip(columns, row))
        if climb.get("is_listed") != 1 or climb.get("frames_count") != 1:
            continue
        frames, _ = normalize_frames(climb["frames"], scope)
        if frames is None:
            continue
        climb["frames"] = frames
        visible[climb["uuid"]] = climb
    return visible


def reconcile(new: sqlite3.Connection, previous: PreviousArtifact, scope: HardwareScope,
              build_date: str) -> ReconcileReport:
    report = ReconcileReport(previous.version)
    old = sqlite3.connect(f"file:{previous.db_path}?mode=ro", uri=True)
    try:
        visible = _visible(old, scope)
        current = {uuid for (uuid,) in new.execute("SELECT uuid FROM climbs")}
        folded = {uuid.casefold() for uuid in current}
        report.present = len(current)
        report.previous_present = sum(1 for climb in visible.values() if climb.get("upstream_removed_at") is None)
        report.added = len(current - visible.keys())

        target = _columns(new, "climbs")
        carried_rows = []
        carried = []
        for uuid, climb in visible.items():
            marker = climb.get("upstream_removed_at")
            if uuid in current:
                report.restored += marker is not None
                continue
            if uuid.casefold() in folded:
                report.case_changed.append(uuid)
                continue
            report.removed += marker is None
            values = dict(climb, is_listed=1, is_draft=0, frames_count=1,
                          upstream_removed_at=marker or build_date)
            values.setdefault("upstream_frames", climb["frames"])
            values.setdefault("is_nomatch", 0)
            carried_rows.append(tuple(values.get(column) for column in target))
            carried.append(uuid)
        new.executemany(f"INSERT INTO climbs VALUES ({','.join('?' * len(target))})", carried_rows)
        report.carried = len(carried)

        stat_columns = _columns(new, "climb_stats")
        available = set(_columns(old, "climb_stats"))
        angles = set(scope.supported_angles)
        selected = ",".join(column if column in available else "NULL" for column in stat_columns)
        stats = []
        for uuid in carried:
            for row in old.execute(f"SELECT {selected} FROM climb_stats WHERE climb_uuid=? ORDER BY angle", (uuid,)):
                if row[1] in angles:
                    stats.append(row)
        new.executemany(f"INSERT INTO climb_stats VALUES ({','.join('?' * len(stat_columns))})", stats)

        final = {uuid for (uuid,) in new.execute("SELECT uuid FROM climbs")}
        report.lost = sorted(uuid for uuid in visible if uuid not in final)
    finally:
        old.close()
    return report
