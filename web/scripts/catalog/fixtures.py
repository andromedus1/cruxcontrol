"""Synthetic Boardsesh-shaped snapshot inputs for offline tests."""
from __future__ import annotations

import gzip
import json
import sqlite3
from pathlib import Path
from typing import Iterable, Optional, Sequence, Tuple

ANGLES = (0, 40)

CATALOG_SCHEMA = """
CREATE TABLE board_products(board_type, id, name, is_listed, password, min_count_in_frame, max_count_in_frame);
CREATE TABLE board_product_sizes(board_type, id, product_id, edge_left, edge_right, edge_bottom, edge_top, name, description, image_filename, position, is_listed);
CREATE TABLE board_layouts(board_type, id, product_id, name, instagram_caption, is_mirrored, is_listed, password, created_at);
CREATE TABLE board_sets(board_type, id, name, hsm);
CREATE TABLE board_product_sizes_layouts_sets(board_type, id, product_size_id, layout_id, set_id, image_filename, is_listed);
CREATE TABLE board_placement_roles(board_type, id, product_id, position, name, full_name, led_color, screen_color);
CREATE TABLE board_holes(board_type, id, product_id, name, x, y, mirrored_hole_id, mirror_group);
CREATE TABLE board_placements(board_type, id, layout_id, hole_id, set_id, default_placement_role_id);
CREATE TABLE board_leds(board_type, id, product_size_id, hole_id, position);
CREATE TABLE board_difficulty_grades(board_type, difficulty, boulder_name, route_name, is_listed);
CREATE TABLE board_climb_aliases(board_type, alias_uuid, canonical_uuid, source, first_seen_at, last_seen_at);
"""

CLIMBS_SCHEMA = """
CREATE TABLE board_climbs(uuid PRIMARY KEY, board_type, layout_id, setter_id, setter_username, name,
  description, hsm, edge_left, edge_right, edge_bottom, edge_top, angle, frames_count, frames_pace,
  frames, is_draft, is_listed, created_at, characteristics);
CREATE TABLE board_climb_stats(board_type, climb_uuid, angle, display_difficulty, benchmark_difficulty,
  ascensionist_count, difficulty_average, quality_average, fa_username, fa_at);
"""

# placement id -> (hole id, set id, lit on size 17?)
PLACEMENTS = {101: (1, 26, True), 102: (2, 26, True), 103: (3, 27, True), 104: (4, 26, False),
              105: (5, 28, True)}


def catalog_db(path: Path, led_shift: int = 0, rename_role: Optional[str] = None) -> Path:
    connection = sqlite3.connect(path)
    connection.executescript(CATALOG_SCHEMA)
    k = "kilter"
    connection.execute("INSERT INTO board_products VALUES(?,7,'Kilter Board Homewall',1,NULL,NULL,NULL)", (k,))
    connection.execute("INSERT INTO board_product_sizes VALUES(?,17,7,-44,44,24,144,'7x10','Full Ride','s.png',1,1)", (k,))
    connection.execute("INSERT INTO board_layouts VALUES(?,8,7,'Kilter Board Homewall','',0,1,NULL,'2020-10-02')", (k,))
    for set_id, name in ((26, "Mainline"), (27, "Auxiliary"), (28, "Mainline Kickboard")):
        connection.execute("INSERT INTO board_sets VALUES(?,?,?,0)", (k, set_id, name))
    connection.execute("INSERT INTO board_product_sizes_layouts_sets VALUES(?,55,17,8,26,'a.png',1)", (k,))
    connection.execute("INSERT INTO board_product_sizes_layouts_sets VALUES(?,56,17,8,27,'b.png',1)", (k,))
    roles = [("start", "Start"), ("middle", "Middle"), ("finish", "Finish"), ("foot", "Foot Only")]
    for offset, product in ((12, 1), (42, 7)):
        for index, (name, full) in enumerate(roles):
            if product == 7 and rename_role == name:
                name = full = "toe"
            connection.execute("INSERT INTO board_placement_roles VALUES(?,?,?,?,?,?,'00FF00','00FF00')",
                               (k, offset + index, product, index + 1, name, full))
    for placement, (hole, set_id, lit) in PLACEMENTS.items():
        connection.execute("INSERT INTO board_holes VALUES(?,?,7,?,?,?,NULL,0)", (k, hole, f"h{hole}", hole * 8, 40))
        connection.execute("INSERT INTO board_placements VALUES(?,?,8,?,?,NULL)", (k, placement, hole, set_id))
        if lit:
            connection.execute("INSERT INTO board_leds VALUES(?,?,17,?,?)", (k, 900 + hole, hole, hole + led_shift))
    connection.execute("INSERT INTO board_difficulty_grades VALUES(?,16,'6a/V3','6a',1)", (k,))
    connection.execute("INSERT INTO board_climb_aliases VALUES(?,'ALIAS1','LEGACY1','backfill','x','x')", (k,))
    connection.execute("INSERT INTO board_climb_aliases VALUES(?,'ORPHAN','NOPE','backfill','x','x')", (k,))
    connection.commit()
    connection.close()
    return path


Climb = Tuple[str, str, int, int, Optional[str]]  # uuid, frames, listed, frames_count, setter


def default_climbs() -> Sequence[Climb]:
    return (
        ("LEGACY1", "p101r42p102r43", 1, 1, "alice"),           # legacy roles, kept
        ("0b6e-new-uuid", "p101r12p103r15", 1, 1, "bob"),       # new backend roles, rewritten
        ("UNLISTED1", "p101r42", 0, 1, "carol"),                 # status only
        ("UNLIT1", "p104r42", 1, 1, "dan"),                       # placement 104 has no LED
        ("KICK1", "p105r42", 1, 1, "erin"),                       # set 28 is out of scope
        ("MULTI1", 'p101r42,"p102r43', 1, 2, "fay"),              # multi-frame
        ("DUP1", "p101r42p101r43", 1, 1, "gus"),                  # duplicate placement
        ("BAD1", "p101x42", 1, 1, "hal"),                         # unparsable
        ("NOSETTER", "p102r43", 1, 1, None),                      # missing setter
    )


def climbs_db(path: Path, climbs: Iterable[Climb] = (), no_stats: Sequence[str] = ()) -> Path:
    connection = sqlite3.connect(path)
    connection.executescript(CLIMBS_SCHEMA)
    for uuid, frames, listed, frames_count, setter in (climbs or default_climbs()):
        connection.execute(
            "INSERT INTO board_climbs VALUES(?,'kilter',8,NULL,?,?,'',NULL,-20,20,30,120,NULL,?,0,?,0,?,?,?)",
            (uuid, setter, f"Climb {uuid}", frames_count, frames, listed, "2026-04-01T10:00:00.5Z",
             '["no_match"]' if uuid == "LEGACY1" else None))
        for angle in (() if uuid in no_stats else (40, 45)):
            connection.execute(
                "INSERT INTO board_climb_stats VALUES('kilter',?,?,16.0,NULL,3,16.2,4.5,'fa','2026-04-02')",
                (uuid, angle))
    connection.execute("INSERT INTO board_climb_stats VALUES('kilter','LEGACY1',0,NULL,NULL,1,NULL,NULL,NULL,NULL)")
    connection.commit()
    connection.close()
    return path


def manifests(climbs_size: int, climbs_raw: int, catalog_size: int, catalog_raw: int,
              built_at: str = "2026-10-19T18:38:11.515Z") -> Tuple[dict, dict]:
    climbs = {"formatVersion": 2, "generatedAt": "2026-10-19T19:00:00Z", "entries": [{
        "boardType": "kilter", "layoutId": 8, "url": "https://example.test/k8.db",
        "bytes": climbs_size, "uncompressedBytes": climbs_raw, "contentEncoding": "gzip",
        "builtAt": built_at, "schemaVersion": 13,
        "tables": {"board_climbs": {"rowCount": 9, "watermarkUpdatedAt": "2026-10-19T18:31:55Z"}},
    }]}
    catalog = {"formatVersion": 1, "generatedAt": "2026-10-19T07:31:59Z", "artifact": {
        "url": "https://example.test/catalog.db", "bytes": catalog_size, "uncompressedBytes": catalog_raw,
        "builtAt": "2026-10-19T07:29:53Z", "schemaVersion": 1, "tables": {},
    }}
    return climbs, catalog


def source_dir(path: Path, gzip_climbs: bool = False, climbs: Iterable[Climb] = (),
               built_at: str = "2026-10-19T18:38:11.515Z", no_stats: Sequence[str] = (),
               **catalog_options) -> Path:
    """Write an offline --from-dir input set."""
    path.mkdir(parents=True, exist_ok=True)
    raw_climbs = climbs_db(path / "climbs.raw", climbs, no_stats).read_bytes()
    raw_catalog = catalog_db(path / "catalog.raw", **catalog_options).read_bytes()
    climbs_body = gzip.compress(raw_climbs, mtime=0) if gzip_climbs else raw_climbs
    (path / "climbs.db").write_bytes(climbs_body)
    (path / "catalog.db").write_bytes(raw_catalog)
    climbs_manifest, catalog = manifests(len(climbs_body), len(raw_climbs), len(raw_catalog),
                                         len(raw_catalog), built_at)
    (path / "climbs-manifest.json").write_text(json.dumps(climbs_manifest))
    (path / "catalog-manifest.json").write_text(json.dumps(catalog))
    return path


def legacy_previous(path: Path, climbs: Sequence[Tuple[str, str]], version: int = 1) -> Path:
    """A schema-2 (Aurora-era) previous artifact dir with the given (uuid, frames) climbs."""
    import hashlib
    path.mkdir(parents=True, exist_ok=True)
    db = path / "legacy.sqlite3"
    connection = sqlite3.connect(db)
    connection.executescript("""
CREATE TABLE climbs (uuid TEXT PRIMARY KEY, layout_id INT, setter_id INT, setter_username TEXT,
  name TEXT, description TEXT, hsm INT, edge_left INT, edge_right INT, edge_bottom INT, edge_top INT,
  angle INT, frames_count INT, frames_pace INT, frames TEXT, is_draft BOOLEAN, is_listed BOOLEAN,
  created_at TEXT, is_nomatch BOOLEAN);
CREATE TABLE climb_stats (climb_uuid TEXT, angle INT, display_difficulty FLOAT, benchmark_difficulty FLOAT,
  ascensionist_count INT, difficulty_average FLOAT, quality_average FLOAT, fa_username TEXT, fa_at TEXT,
  PRIMARY KEY (climb_uuid, angle));
""")
    for uuid, frames in climbs:
        connection.execute("INSERT INTO climbs VALUES(?,8,1,'legacy','Old '||?,'',1,-20,20,30,120,NULL,1,0,?,0,1,"
                           "'2021-01-01 00:00:00.000000',0)", (uuid, uuid, frames))
        connection.execute("INSERT INTO climb_stats VALUES(?,40,14.0,NULL,7,14.0,2.5,'fa','2021-01-02')", (uuid,))
    connection.commit()
    connection.close()
    raw = db.read_bytes()
    body = gzip.compress(raw, mtime=0)
    name = f"kilter-7x10.v{version}.db.gz"
    (path / name).write_bytes(body)
    (path / "manifest.json").write_text(json.dumps({
        "schemaVersion": 2, "version": version, "board": "kilter-fullride-7x10", "file": name,
        "compression": "gzip", "sha256": hashlib.sha256(body).hexdigest(), "bytesGzipped": len(body),
        "bytesRaw": len(raw), "generatedOn": "2026-06-14", "source": "legacy-aurora-kilter",
        "sourceDataThrough": None, "generatedFrom": "test", "filter": "test",
    }))
    return path
