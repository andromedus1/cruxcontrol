"""Copy Fullride 7x10 hardware from the Boardsesh catalog and pin it to the board definition."""
from __future__ import annotations

import importlib.util
import json
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, FrozenSet, Tuple

from .schema import LAYOUT_ID, PRODUCT_ID, PRODUCT_SIZE_ID, SET_IDS, create

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DEFINITION = (SCRIPTS_DIR.parent / "src" / "domain" / "boards" / "definitions"
                      / "kilter-fullride-7x10.generated.ts")
ROLE_NAMES = ("start", "middle", "finish", "foot")

_spec = importlib.util.spec_from_file_location(
    "export_fullride_definition", SCRIPTS_DIR / "export-fullride-definition.py")
assert _spec and _spec.loader
_exporter = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_exporter)


class HardwareMismatch(Exception):
    """Upstream hardware does not reproduce the pinned board definition."""


@dataclass(frozen=True)
class PinnedDefinition:
    revision: str
    angles: Tuple[int, ...]


@dataclass(frozen=True)
class HardwareScope:
    revision: str
    lit_placement_ids: FrozenSet[int]
    role_map: Dict[int, int]
    supported_angles: Tuple[int, ...]


def load_pinned(path: Path = DEFAULT_DEFINITION) -> PinnedDefinition:
    match = re.search(r"=\s*(\{.*\})\s*as const;", path.read_text(encoding="utf-8"), re.S)
    if not match:
        raise HardwareMismatch(f"cannot read generated definition {path}")
    data = json.loads(match.group(1))
    return PinnedDefinition(data["revision"], tuple(data["angles"]))


def _copy(catalog: sqlite3.Connection, out: sqlite3.Connection, table: str,
          where: str = "", params: tuple = ()) -> None:
    columns = [row[1] for row in out.execute(f"PRAGMA table_info({table})")]
    rows = catalog.execute(
        f"SELECT {','.join(columns)} FROM board_{table} WHERE board_type='kilter'"
        f"{' AND ' + where if where else ''} ORDER BY {columns[0]}", params).fetchall()
    out.executemany(f"INSERT INTO {table} VALUES ({','.join('?' * len(columns))})", rows)


def copy_hardware(catalog: sqlite3.Connection, out: sqlite3.Connection,
                  angles: Tuple[int, ...]) -> None:
    sets = ",".join(str(set_id) for set_id in SET_IDS)
    create(out, "products", "product_sizes", "products_angles", "layouts", "sets",
           "product_sizes_layouts_sets", "placement_roles", "holes", "placements", "leds",
           "difficulty_grades")
    _copy(catalog, out, "products", "id=?", (PRODUCT_ID,))
    _copy(catalog, out, "product_sizes", "id=? AND product_id=?", (PRODUCT_SIZE_ID, PRODUCT_ID))
    out.executemany("INSERT INTO products_angles VALUES (?,?)", [(PRODUCT_ID, angle) for angle in angles])
    _copy(catalog, out, "layouts", "id=?", (LAYOUT_ID,))
    _copy(catalog, out, "sets", f"id IN ({sets})")
    _copy(catalog, out, "product_sizes_layouts_sets", "product_size_id=?", (PRODUCT_SIZE_ID,))
    _copy(catalog, out, "placement_roles", "product_id=?", (PRODUCT_ID,))
    _copy(catalog, out, "holes", "product_id=?", (PRODUCT_ID,))
    _copy(catalog, out, "placements", f"layout_id=? AND set_id IN ({sets})", (LAYOUT_ID,))
    _copy(catalog, out, "leds", "product_size_id=?", (PRODUCT_SIZE_ID,))
    _copy(catalog, out, "difficulty_grades")


def role_map(catalog: sqlite3.Connection) -> Dict[int, int]:
    """Map every Kilter start/middle/finish/foot role id to the product-7 id of that name."""
    rows = catalog.execute(
        "SELECT id, product_id, name FROM board_placement_roles WHERE board_type='kilter' ORDER BY id").fetchall()
    target = {name: role_id for role_id, product_id, name in rows if product_id == PRODUCT_ID}
    if set(target) != set(ROLE_NAMES):
        raise HardwareMismatch(f"product {PRODUCT_ID} roles are {sorted(target)}, expected {list(ROLE_NAMES)}")
    return {role_id: target[name] for role_id, _, name in rows if name in target}


def verify_scope(hardware_db: Path, catalog: sqlite3.Connection,
                 pinned: PinnedDefinition) -> HardwareScope:
    try:
        extracted = _exporter.extract(hardware_db)
    except ValueError as error:
        raise HardwareMismatch(f"hardware projection failed: {error}") from error
    if extracted["revision"] != pinned.revision:
        raise HardwareMismatch(f"hardware revision {extracted['revision']} != pinned {pinned.revision}")
    return HardwareScope(
        revision=extracted["revision"],
        lit_placement_ids=frozenset(row["placement_id"] for row in extracted["placements"]),
        role_map=role_map(catalog),
        supported_angles=pinned.angles,
    )
