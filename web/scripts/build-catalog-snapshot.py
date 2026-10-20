#!/usr/bin/env python3
"""Build the Fullride 7x10 catalog artifact from Boardsesh's public snapshots.

Pipeline:
  1. Fetch the Boardsesh v1-gzip manifest and Kilter layout-8 artifact, plus the
     v1-catalog hardware artifact (one request each), or read them from --from-dir.
  2. Copy product 7 / layout 8 / size 17 / sets {26,27} hardware and require it to
     reproduce the generated board definition's layout revision.
  3. Keep listed single-frame climbs whose placements are all lit on size 17, mapping
     role codes to product-7 ids by name; record every layout-8 UUID's upstream status.
  4. VACUUM, gzip deterministically, and write a schema-3 manifest.

Outputs: <out-dir>/kilter-7x10.v<version>.db.gz and <out-dir>/manifest.json.
Current app builds install only schema-2 manifests, so do not write into
web/public/catalog until they support schema 3. --from-dir expects climbs-manifest.json,
catalog-manifest.json, climbs.db and catalog.db (gzip or plain SQLite).

Usage:
  python web/scripts/build-catalog-snapshot.py --version 2 --out-dir DIR [--from-dir DIR] [--report PATH]

The build date never acts as a freshness claim; the manifest records Boardsesh's
build time and table watermarks instead.

With --previous-dir, every climb the previous artifact could show is carried forward
(marked removed upstream when it disappears), the version becomes previous + 1, and
the update guards must pass before anything is written.

Exit codes: 0 built, 2 source error, 3 hardware mismatch, 4 normalization error,
5 size limit, 6 artifact already exists, 7 held by guards, 8 upstream unchanged,
9 previous artifact invalid.
"""
import argparse
import dataclasses
import datetime
import json
import pathlib
import sys
import tempfile

from catalog.artifact import GuardHold, SizeLimitError, Unchanged, build
from catalog.boardsesh_source import SourceError, UrllibFetcher, fetch_inputs, load_inputs
from catalog.hardware import HardwareMismatch, load_pinned
from catalog.normalize_climbs import NormalizationError
from catalog.previous import PreviousArtifactError, load_previous

EXIT_CODES = (
    (Unchanged, 8),
    (GuardHold, 7),
    (PreviousArtifactError, 9),
    (SourceError, 2),
    (HardwareMismatch, 3),
    (NormalizationError, 4),
    (SizeLimitError, 5),
    (FileExistsError, 6),
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--version", type=int, default=None,
                        help="Required for a first build; otherwise defaults to previous + 1 and must exceed it.")
    parser.add_argument("--previous-dir", type=pathlib.Path, default=None,
                        help="Directory with the previously published manifest.json and artifact; "
                             "its climbs are carried forward and the update guards apply.")
    parser.add_argument("--generated-on", default=datetime.date.today().isoformat(),
                        help="Build date; does not imply source freshness.")
    parser.add_argument("--from-dir", type=pathlib.Path, default=None,
                        help="Read snapshot inputs offline instead of fetching.")
    parser.add_argument("--out-dir", type=pathlib.Path, required=True,
                        help="Output directory. Not defaulted: web/public/catalog holds the schema-2 "
                             "manifest current app builds install.")
    parser.add_argument("--definition", type=pathlib.Path, default=None,
                        help="Generated board definition to pin hardware against (tests only).")
    parser.add_argument("--report", type=pathlib.Path, default=None,
                        help="Write the normalization report and manifest as JSON.")
    args = parser.parse_args()

    try:
        with tempfile.TemporaryDirectory() as tmp:
            work = pathlib.Path(tmp)
            previous = load_previous(args.previous_dir, work) if args.previous_dir else None
            if previous is None and args.version is None:
                parser.error("--version is required without --previous-dir")
            inputs = load_inputs(args.from_dir, work) if args.from_dir else fetch_inputs(UrllibFetcher(), work)
            pinned = load_pinned(args.definition) if args.definition else load_pinned()
            result = build(inputs, pinned, args.out_dir, work, args.version, args.generated_on, previous)
    except tuple(error for error, _ in EXIT_CODES) as error:
        code = next(code for kind, code in EXIT_CODES if isinstance(error, kind))
        label = "unchanged" if isinstance(error, Unchanged) else "held" if isinstance(error, GuardHold) else "error"
        print(f"{label} ({type(error).__name__}): {error}",
              file=sys.stderr)
        if isinstance(error, GuardHold) and args.report:
            args.report.write_text(json.dumps({
                "verdict": dataclasses.asdict(error.verdict),
                "reconcile": dataclasses.asdict(error.reconciled),
            }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return code

    report = dataclasses.asdict(result.report)
    if args.report:
        reconciled = dataclasses.asdict(result.reconciled) if result.reconciled else None
        args.report.write_text(json.dumps({"manifest": result.manifest, "report": report,
                                           "reconcile": reconciled},
                                          indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest = result.manifest
    print(f"Wrote {result.artifact_path} ({manifest['bytesGzipped']} bytes, raw {manifest['bytesRaw']})")
    print(f"  sha256 {manifest['sha256']}  revision {manifest['layoutRevision']}")
    print(f"  upstream {report['upstream_rows']}  listed {report['listed']}  emitted {report['emitted']}"
          f"  aliases {report['aliases']}  role-rewritten {report['role_rewritten']}")
    print(f"  excluded {report['excluded']}  stats {report['stats_emitted']} (excluded {report['excluded_stats']})")
    print(f"  version {manifest['version']}  climbs {manifest['climbCount']}  "
          f"removed upstream {manifest['removedUpstreamCount']}  changes {manifest['changes']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
