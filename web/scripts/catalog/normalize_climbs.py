"""Normalize Boardsesh Homewall climbs into the app's single-frame, product-7-role contract."""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from .hardware import HardwareScope
from .schema import LAYOUT_ID, create

# Mirrors the sticky token rule in web/src/data/catalog/kilter-projection.ts.
FRAME_TOKEN = re.compile(r"p([1-9][0-9]*)r([1-9][0-9]*)")
MAX_FRAME_LENGTH = 16_384


class NormalizationError(Exception):
    """The snapshot violates an identity invariant the artifact relies on."""


@dataclass
class NormalizationReport:
    upstream_rows: int = 0
    listed: int = 0
    emitted: int = 0
    role_rewritten: int = 0
    aliases: int = 0
    stats_emitted: int = 0
    excluded: Dict[str, int] = field(default_factory=dict)
    excluded_stats: Dict[str, int] = field(default_factory=dict)

    def exclude(self, reason: str) -> None:
        self.excluded[reason] = self.excluded.get(reason, 0) + 1

    def exclude_stat(self, reason: str) -> None:
        self.excluded_stats[reason] = self.excluded_stats.get(reason, 0) + 1


def normalize_frames(frames: str, scope: HardwareScope) -> Tuple[Optional[str], Optional[str]]:
    """Return (normalized frames, None) or (None, exclusion reason)."""
    if not frames or len(frames) > MAX_FRAME_LENGTH:
        return None, "unparsable_frames"
    tokens = []
    seen = set()
    offset = 0
    while offset < len(frames):
        match = FRAME_TOKEN.match(frames, offset)
        if not match:
            return None, "unparsable_frames"
        placement, role = int(match.group(1)), int(match.group(2))
        if placement not in scope.lit_placement_ids:
            return None, "unlit_placement"
        if role not in scope.role_map:
            return None, "unknown_role"
        if placement in seen:
            return None, "duplicate_placement"
        seen.add(placement)
        tokens.append(f"p{placement}r{scope.role_map[role]}")
        offset = match.end()
    return "".join(tokens), None


def legacy_timestamp(value: str) -> str:
    """'2024-08-06T04:50:54.912959Z' -> '2024-08-06 04:50:54.912959' (legacy text form)."""
    if value.endswith("Z"):
        value = value[:-1]
    return value.replace("T", " ", 1)


def _no_match(characteristics: Optional[str]) -> int:
    if not characteristics:
        return 0
    try:
        values = json.loads(characteristics)
    except ValueError:
        return 0
    return int(isinstance(values, list) and "no_match" in values)


CLIMB_COLUMNS = ("uuid", "is_listed", "is_draft", "frames_count", "frames", "setter_id",
                 "setter_username", "name", "description", "hsm", "edge_left", "edge_right",
                 "edge_bottom", "edge_top", "angle", "frames_pace", "created_at",
                 "characteristics")


def normalize(climbs_db: sqlite3.Connection, catalog_db: sqlite3.Connection,
              scope: HardwareScope, out: sqlite3.Connection) -> NormalizationReport:
    report = NormalizationReport()
    create(out, "climbs", "climb_stats", "upstream_climbs")
    rows = climbs_db.execute(
        f"SELECT {','.join(CLIMB_COLUMNS)} FROM board_climbs "
        "WHERE board_type='kilter' AND layout_id=? ORDER BY uuid", (LAYOUT_ID,)).fetchall()
    folded: Dict[str, str] = {}
    status = []
    emitted = []
    for row in rows:
        climb = dict(zip(CLIMB_COLUMNS, row))
        uuid = climb["uuid"]
        if not isinstance(uuid, str) or not uuid.strip():
            raise NormalizationError("climb row without a uuid")
        if uuid.casefold() in folded:
            raise NormalizationError(f"case-only duplicate uuids {folded[uuid.casefold()]!r} and {uuid!r}")
        folded[uuid.casefold()] = uuid
        report.upstream_rows += 1
        listed = climb["is_listed"] == 1
        status.append((uuid, "listed" if listed else "unlisted", None))
        if not listed:
            continue
        report.listed += 1
        if climb["is_draft"] == 1:
            report.exclude("draft")
            continue
        if climb["frames_count"] != 1 or "," in (climb["frames"] or ""):
            report.exclude("multi_frame")
            continue
        if climb["setter_username"] is None or climb["name"] is None or climb["created_at"] is None \
                or any(climb[edge] is None for edge in ("edge_left", "edge_right", "edge_bottom", "edge_top")):
            report.exclude("missing_required_field")
            continue
        frames, reason = normalize_frames(climb["frames"], scope)
        if frames is None:
            report.exclude(reason)
            continue
        if frames != climb["frames"]:
            report.role_rewritten += 1
        emitted.append((
            uuid, LAYOUT_ID, climb["setter_id"], climb["setter_username"], climb["name"],
            climb["description"] or "", climb["hsm"], climb["edge_left"], climb["edge_right"],
            climb["edge_bottom"], climb["edge_top"], climb["angle"], 1, climb["frames_pace"] or 0,
            frames, 0, 1, legacy_timestamp(climb["created_at"]), _no_match(climb["characteristics"]),
            climb["frames"],
        ))

    aliases: Dict[str, Tuple[str, str]] = {}  # casefold -> (exact alias, canonical)
    for alias, canonical in catalog_db.execute(
            "SELECT alias_uuid, canonical_uuid FROM board_climb_aliases "
            "WHERE board_type='kilter' ORDER BY alias_uuid, canonical_uuid"):
        if not isinstance(alias, str) or not isinstance(canonical, str):
            continue
        target = folded.get(canonical.casefold())
        if target is None:
            continue  # alias of a climb on another layout
        if alias == target:
            continue  # self-alias: the climb row already records this identity
        existing = folded.get(alias.casefold())
        if existing is not None:
            raise NormalizationError(f"alias {alias!r} of {target!r} collides with climb {existing!r}")
        previous = aliases.get(alias.casefold())
        if previous == (alias, target):
            continue  # exact duplicate row
        if previous is not None:
            raise NormalizationError(f"alias {alias!r} -> {target!r} conflicts with {previous[0]!r} -> {previous[1]!r}")
        aliases[alias.casefold()] = (alias, target)
        status.append((alias, "aliased", target))
        report.aliases += 1

    out.executemany(f"INSERT INTO climbs VALUES ({','.join('?' * 20)})", emitted)
    out.executemany("INSERT INTO upstream_climbs VALUES (?,?,?)", sorted(status))
    report.emitted = len(emitted)

    emitted_uuids = {row[0] for row in emitted}
    angles = set(scope.supported_angles)
    stats = []
    for row in climbs_db.execute(
            "SELECT climb_uuid, angle, display_difficulty, benchmark_difficulty, ascensionist_count, "
            "difficulty_average, quality_average, fa_username, fa_at FROM board_climb_stats "
            "WHERE board_type='kilter' ORDER BY climb_uuid, angle"):
        if row[0] not in emitted_uuids:
            continue
        if row[1] not in angles:
            report.exclude_stat("unsupported_angle")
        elif row[2] is None or row[5] is None or row[6] is None or row[4] is None:
            report.exclude_stat("missing_metric")
        else:
            stats.append(row)
    out.executemany("INSERT INTO climb_stats VALUES (?,?,?,?,?,?,?,?,?)", stats)
    report.stats_emitted = len(stats)
    return report
