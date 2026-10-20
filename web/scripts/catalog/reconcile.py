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
    stats_kept: int = 0         # (climb, angle) stats of present climbs kept from the previous version
    lost: List[str] = field(default_factory=list)          # must stay empty
    case_changed: List[str] = field(default_factory=list)  # uuid reappeared with other casing


def _columns(connection: sqlite3.Connection, table: str) -> List[str]:
    return [row[1] for row in connection.execute(f"PRAGMA table_info({table})")]


USABLE_STATS = ("display_difficulty IS NOT NULL AND difficulty_average IS NOT NULL "
                "AND quality_average IS NOT NULL AND ascensionist_count IS NOT NULL")


def _with_stats(connection: sqlite3.Connection, angles) -> set:
    """UUIDs with at least one usable stats row; the app's climb query joins on stats."""
    marks = ",".join("?" * len(angles))
    return {uuid for (uuid,) in connection.execute(
        f"SELECT DISTINCT climb_uuid FROM climb_stats WHERE angle IN ({marks}) AND {USABLE_STATS}",
        tuple(angles))}


def _usable_pairs(connection: sqlite3.Connection, angles) -> set:
    """(uuid, angle) pairs with a usable stats row; the app resolves climbs per angle."""
    marks = ",".join("?" * len(angles))
    return set(connection.execute(
        f"SELECT climb_uuid, angle FROM climb_stats WHERE angle IN ({marks}) AND {USABLE_STATS}",
        tuple(angles)))


def _visible(previous: sqlite3.Connection, scope: HardwareScope) -> Dict[str, dict]:
    """Previous climbs the app could show: listed, single-frame, fully lit on size 17,
    and with at least one usable stats row."""
    columns = _columns(previous, "climbs")
    with_stats = _with_stats(previous, scope.supported_angles)
    visible = {}
    for row in previous.execute(f"SELECT {','.join(columns)} FROM climbs ORDER BY uuid"):
        climb = dict(zip(columns, row))
        if climb.get("is_listed") != 1 or climb.get("frames_count") != 1 or climb["uuid"] not in with_stats:
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
        angles = tuple(scope.supported_angles)
        current = {uuid for (uuid,) in new.execute("SELECT uuid FROM climbs")}
        folded = {uuid.casefold() for uuid in current}
        report.previous_present = sum(1 for climb in visible.values() if climb.get("upstream_removed_at") is None)

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

        # Playlists resolve a climb at a specific angle, so preservation works per (climb, angle):
        # carried climbs keep all their usable stats, and a present climb keeps the previous
        # row for any angle whose new stats are missing or unusable.
        previous_pairs = {pair for pair in _usable_pairs(old, angles) if pair[0] in visible}
        current_pairs = _usable_pairs(new, angles)
        carried_set = set(carried)
        keep = sorted(pair for pair in previous_pairs
                      if pair not in current_pairs and (pair[0] in carried_set or pair[0] in current))
        report.stats_kept = sum(1 for uuid, _ in keep if uuid not in carried_set)
        stat_columns = _columns(new, "climb_stats")
        available = set(_columns(old, "climb_stats"))
        selected = ",".join(column if column in available else "NULL" for column in stat_columns)
        quality = stat_columns.index("quality_average")
        # Schema-2 (Aurora-era) ratings are on 1-3; schema-3 artifacts declare 0-5.
        scale = 5 / 3 if previous.schema_version == 2 else 1
        stats = []
        for uuid, angle in keep:
            row = old.execute(f"SELECT {selected} FROM climb_stats WHERE climb_uuid=? AND angle=?",
                              (uuid, angle)).fetchone()
            if scale != 1:
                row = row[:quality] + (row[quality] * scale,) + row[quality + 1:]
            stats.append(row)
        new.executemany(f"INSERT INTO climb_stats VALUES ({','.join('?' * len(stat_columns))})", stats)

        final_pairs = _usable_pairs(new, angles)
        final_visible = {uuid for uuid, _ in final_pairs}
        present = {uuid for (uuid,) in new.execute("SELECT uuid FROM climbs WHERE upstream_removed_at IS NULL")}
        report.present = len(present & final_visible)
        report.added = len((present & final_visible) - visible.keys())
        final = {uuid for (uuid,) in new.execute("SELECT uuid FROM climbs")}
        missing_pairs = {uuid for uuid, angle in previous_pairs if (uuid, angle) not in final_pairs}
        report.lost = sorted(uuid for uuid in visible if uuid not in final or uuid in missing_pairs)
    finally:
        old.close()
    return report
