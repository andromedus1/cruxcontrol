#!/usr/bin/env python3
"""Export the verified Kilter Fullride 7x10 controllable-placement definition."""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sqlite3
from typing import Any

PRODUCT_ID = 7
LAYOUT_ID = 8
PRODUCT_SIZE_ID = 17
SET_IDS = (26, 27)
ROLE_ALIASES = {
    "start": "start",
    "middle": "middle",
    "finish": "finish",
    "foot": "foot-only",
    "foot only": "foot-only",
}


def normalize_role(value: str) -> str:
    return " ".join(value.strip().lower().replace("-", " ").split())


def semantic_roles(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    discovered: dict[str, dict[str, Any]] = {}
    for row in rows:
        candidates = {ROLE_ALIASES.get(normalize_role(row["name"])), ROLE_ALIASES.get(normalize_role(row["full_name"]))}
        candidates.discard(None)
        if len(candidates) != 1:
            raise ValueError(f"unknown or ambiguous source role {row['id']}: {row['name']!r}/{row['full_name']!r}")
        semantic = candidates.pop()
        if semantic in discovered:
            raise ValueError(f"duplicate semantic role {semantic}")
        discovered[semantic] = {
            "semantic": semantic,
            "sourceId": row["id"],
            "name": row["name"],
            "fullName": row["full_name"],
            "ledColor": row["led_color"],
            "screenColor": row["screen_color"],
        }
    missing = set(ROLE_ALIASES.values()) - discovered.keys()
    if missing:
        raise ValueError(f"missing semantic roles: {', '.join(sorted(missing))}")
    return [discovered[key] for key in ("start", "middle", "finish", "foot-only")]


def extract(catalog: pathlib.Path) -> dict[str, Any]:
    source_hash = hashlib.sha256(catalog.read_bytes()).hexdigest()
    connection = sqlite3.connect(f"file:{catalog}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("BEGIN")
        size = connection.execute("SELECT * FROM product_sizes WHERE id=? AND product_id=?", (PRODUCT_SIZE_ID, PRODUCT_ID)).fetchone()
        if size is None:
            raise ValueError("missing product size scope")
        angles = [row[0] for row in connection.execute("SELECT angle FROM products_angles WHERE product_id=? ORDER BY angle", (PRODUCT_ID,))]
        roles = semantic_roles(list(connection.execute("SELECT * FROM placement_roles WHERE product_id=? ORDER BY position,id", (PRODUCT_ID,))))
        placeholders = ",".join("?" for _ in SET_IDS)
        params = (LAYOUT_ID, *SET_IDS)
        total_by_set = dict(connection.execute(f"SELECT set_id,count(*) FROM placements WHERE layout_id=? AND set_id IN ({placeholders}) GROUP BY set_id", params))
        invalid_scope = list(connection.execute(
            f"""
            SELECT p.id placement_id,p.hole_id,h.product_id hole_product_id
            FROM placements p
            LEFT JOIN holes h ON h.id=p.hole_id
            WHERE p.layout_id=? AND p.set_id IN ({placeholders})
              AND (h.id IS NULL OR h.product_id<>?)
            ORDER BY p.id
            """,
            (*params, PRODUCT_ID),
        ))
        if invalid_scope:
            placement_ids = ", ".join(str(row["placement_id"]) for row in invalid_scope)
            raise ValueError(f"missing or mismatched native hole scope for placements: {placement_ids}")
        query = f"""
          SELECT p.id placement_id,p.set_id,h.id hole_id,h.x,h.y,l.id led_id,l.position led_position
          FROM placements p
          JOIN holes h ON h.id=p.hole_id AND h.product_id=?
          JOIN leds l ON l.hole_id=h.id AND l.product_size_id=?
          WHERE p.layout_id=? AND p.set_id IN ({placeholders})
          ORDER BY p.id
        """
        rows = list(connection.execute(query, (PRODUCT_ID, PRODUCT_SIZE_ID, LAYOUT_ID, *SET_IDS)))
        if not rows:
            raise ValueError("empty controllable placement projection")
        emitted_by_set: dict[int, int] = {}
        seen_placements: set[int] = set(); seen_holes: set[int] = set(); seen_leds: set[int] = set()
        placements = []
        for row in rows:
            for field, seen in (("placement_id", seen_placements), ("hole_id", seen_holes), ("led_position", seen_leds)):
                if row[field] in seen:
                    raise ValueError(f"ambiguous or duplicate {field}: {row[field]}")
                seen.add(row[field])
            emitted_by_set[row["set_id"]] = emitted_by_set.get(row["set_id"], 0) + 1
            placements.append(dict(row))
        total = sum(total_by_set.values())
        excluded_by_set = {key: total_by_set.get(key, 0) - emitted_by_set.get(key, 0) for key in SET_IDS}
        bearing = {"bounds": [size["edge_left"], size["edge_right"], size["edge_bottom"], size["edge_top"]], "angles": angles, "roles": roles, "placements": placements}
        definition_hash = hashlib.sha256(json.dumps(bearing, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        return {
            **bearing,
            "sourceSha256": source_hash,
            "definitionSha256": definition_hash,
            "revision": f"kilter:7:8:17:{definition_hash[:12]}",
            "totalScoped": total,
            "emitted": len(placements),
            "excluded": total - len(placements),
            "totalBySet": total_by_set,
            "emittedBySet": emitted_by_set,
            "excludedBySet": excluded_by_set,
        }
    finally:
        connection.close()


def typescript(data: dict[str, Any]) -> str:
    serialized = json.dumps(data, indent=2, sort_keys=True, separators=(",", ": "))
    return f"""// Generated by: python web/scripts/export-fullride-definition.py --catalog <catalog.db> --out web/src/domain/boards/definitions/kilter-fullride-7x10.generated.ts
// Scope: product 7 / layout 8 / product size 17 / sets 26,27
// Source database SHA-256: {data['sourceSha256']}
// Projection: {data['totalScoped']} scoped / {data['emitted']} controllable / {data['excluded']} excluded
// Do not edit by hand.

export const generatedKilterFullride7x10 = {serialized} as const;
"""


def export(catalog: pathlib.Path, out: pathlib.Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(typescript(extract(catalog)), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    args = parser.parse_args()
    export(args.catalog, args.out)


if __name__ == "__main__":
    main()
