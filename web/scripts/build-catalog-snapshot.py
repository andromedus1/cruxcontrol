#!/usr/bin/env python3
"""Generate the pruned Fullride 7x10 Kilter catalog snapshot.

Pipeline (proven 2026-06-14):
  1. BoardLib downloads the full shared Kilter catalog (~198 MB) from Aurora.
  2. Prune to the Fullride 7x10: product 7 (Homewall), layout 8, product_size 17
     ("7x10 Full Ride LED Kit"), sets {26 Mainline, 27 Auxiliary}.
  3. VACUUM, gzip, and emit manifest.json (version + sha256 + sizes).

Output (gitignored binaries; manifest is committed):
  web/public/catalog/kilter-7x10.v<version>.db.gz
  web/public/catalog/manifest.json

Usage:
  pip install boardlib Pillow
  python web/scripts/build-catalog-snapshot.py --version 1

The snapshot is regenerated periodically (the catalog grows); bump --version and
the client re-fetches when manifest.version changes. The pruned snapshot is ~5 MB
gzipped, which fits Cloudflare Workers Static Assets' per-file limit, so it ships
as a same-origin static asset under web/public/catalog/.
"""
import argparse
import gzip
import hashlib
import json
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile

# Fullride 7x10 identity (verified against the live catalog 2026-06-14).
PRODUCT_ID = 7        # Kilter Board Homewall
LAYOUT_ID = 8         # Kilter Board Homewall (Fullride) layout
PRODUCT_SIZE_ID = 17  # "7x10" Full Ride LED Kit
SET_IDS = (26, 27)    # Mainline, Auxiliary

CLIMB_WHERE = "layout_id=? AND is_listed=1 AND is_draft=0 AND frames_count=1"

# table -> WHERE filter (None = keep all rows). User/cache tables are dropped.
def keep_tables():
    setlist = ",".join(str(s) for s in SET_IDS)
    return {
        "climbs": (CLIMB_WHERE, (LAYOUT_ID,)),
        "climb_stats": (
            f"climb_uuid IN (SELECT uuid FROM climbs WHERE {CLIMB_WHERE})",
            (LAYOUT_ID,),
        ),
        "placements": (f"layout_id=? AND set_id IN ({setlist})", (LAYOUT_ID,)),
        "holes": (None, ()),
        "leds": ("product_size_id=?", (PRODUCT_SIZE_ID,)),
        "placement_roles": ("product_id=?", (PRODUCT_ID,)),
        "difficulty_grades": (None, ()),
        "products": ("id=?", (PRODUCT_ID,)),
        "product_sizes": ("id=?", (PRODUCT_SIZE_ID,)),
        "products_angles": ("product_id=?", (PRODUCT_ID,)),
        "layouts": ("id=?", (LAYOUT_ID,)),
        "sets": (f"id IN ({setlist})", ()),
        "product_sizes_layouts_sets": ("product_size_id=?", (PRODUCT_SIZE_ID,)),
    }


def prune(full_db: str, pruned_db: str) -> None:
    src = sqlite3.connect(full_db)
    src.row_factory = sqlite3.Row
    dst = sqlite3.connect(pruned_db)
    for table, (where, params) in keep_tables().items():
        create = src.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()[0]
        dst.execute(create)
        sql = f"SELECT * FROM {table}" + (f" WHERE {where}" if where else "")
        rows = src.execute(sql, params).fetchall()
        if rows:
            cols = rows[0].keys()
            ph = ",".join("?" * len(cols))
            dst.executemany(
                f"INSERT INTO {table} ({','.join(cols)}) VALUES ({ph})",
                [tuple(r) for r in rows],
            )
        print(f"  {table}: {len(rows)} rows")
    dst.commit()
    dst.execute("VACUUM")
    dst.commit()
    dst.close()
    src.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", type=int, default=1)
    ap.add_argument(
        "--out-dir",
        default=str(pathlib.Path(__file__).resolve().parents[1] / "public" / "catalog"),
    )
    ap.add_argument(
        "--full-db",
        default=None,
        help="Reuse an already-downloaded full catalog instead of re-downloading.",
    )
    args = ap.parse_args()
    out = pathlib.Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        full_db = args.full_db or str(pathlib.Path(tmp) / "kilter-full.db")
        if not args.full_db:
            print("Downloading full Kilter catalog via BoardLib...")
            subprocess.run(["boardlib", "database", "kilter", full_db], check=True)
        pruned = str(pathlib.Path(tmp) / "pruned.db")
        print("Pruning to Fullride 7x10...")
        prune(full_db, pruned)

        gz_name = f"kilter-7x10.v{args.version}.db.gz"
        gz_path = out / gz_name
        with open(pruned, "rb") as f_in, gzip.open(gz_path, "wb", compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)
        raw = pathlib.Path(pruned).stat().st_size
        gz = gz_path.stat().st_size
        sha = hashlib.sha256(gz_path.read_bytes()).hexdigest()

        (out / "manifest.json").write_text(
            json.dumps(
                {
                    "version": args.version,
                    "board": "kilter-fullride-7x10",
                    "file": gz_name,
                    "compression": "gzip",
                    "sha256": sha,
                    "bytesGzipped": gz,
                    "bytesRaw": raw,
                    "generatedFrom": "boardlib database kilter (full) -> prune product7/layout8/size17/sets{26,27} -> vacuum -> gzip",
                    "filter": "climbs WHERE layout_id=8 AND is_listed=1 AND is_draft=0 AND frames_count=1",
                },
                indent=2,
            )
            + "\n"
        )
        print(f"Wrote {gz_path} ({gz} bytes, raw {raw}) sha256={sha}")
        if gz > 25 * 1024 * 1024:
            print("WARNING: snapshot exceeds 25 MiB — Workers Static Assets per-file limit; host on R2 instead.")


if __name__ == "__main__":
    main()
