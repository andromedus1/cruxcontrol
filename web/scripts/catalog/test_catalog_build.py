import gzip
import json
import re
import sqlite3
import tempfile
import unittest
from pathlib import Path

from catalog import artifact, fixtures
from catalog.boardsesh_source import (
    MANIFEST_CATALOG_URL, MANIFEST_GZIP_URL, ArtifactEntry, SourceError, UpstreamUnchanged, fetch_inputs,
    load_inputs, materialize, parse_catalog_entry, parse_climbs_entry)
from catalog.hardware import (
    HardwareMismatch, PinnedDefinition, _exporter, copy_hardware, load_pinned, verify_scope)
from catalog.normalize_climbs import NormalizationError, legacy_timestamp, normalize, normalize_frames
from catalog.hardware import HardwareScope

WEB = Path(__file__).resolve().parents[2]
EXAMPLE_MANIFEST = WEB / "src" / "data" / "catalog" / "__fixtures__" / "manifest-v3.example.json"
INSTALL_TS = WEB / "src" / "data" / "sqlite" / "catalog-install.ts"
SCOPE = HardwareScope("rev", frozenset({101, 102, 103}),
                      {12: 42, 13: 43, 14: 44, 15: 45, 42: 42, 43: 43, 44: 44, 45: 45}, fixtures.ANGLES)


def fixture_pin(catalog_path: Path, work: Path) -> PinnedDefinition:
    """The revision the synthetic hardware produces, so perturbations can be detected."""
    hardware = work / "pin.sqlite3"
    catalog = sqlite3.connect(catalog_path)
    out = sqlite3.connect(hardware)
    copy_hardware(catalog, out, fixtures.ANGLES)
    out.commit(); out.close(); catalog.close()
    return PinnedDefinition(_exporter.extract(hardware)["revision"], fixtures.ANGLES)


def app_required_columns():
    """Parse KILTER_CATALOG_REQUIRED_COLUMNS from the app so the contract cannot drift."""
    block = re.search(r"KILTER_CATALOG_REQUIRED_COLUMNS = \{(.*?)\} as const", INSTALL_TS.read_text(), re.S).group(1)
    return {table: re.findall(r"'([a-z_]+)'", columns)
            for table, columns in re.findall(r"(\w+): \[(.*?)\]", block, re.S)}


class FramesTests(unittest.TestCase):
    def test_rewrites_product_one_roles_by_name(self):
        self.assertEqual(normalize_frames("p101r12p102r13p103r15", SCOPE), ("p101r42p102r43p103r45", None))

    def test_keeps_product_seven_roles(self):
        self.assertEqual(normalize_frames("p101r42p103r44", SCOPE), ("p101r42p103r44", None))

    def test_exclusion_reasons(self):
        cases = {
            "p104r42": "unlit_placement",
            "p101r99": "unknown_role",
            "p101r42p101r43": "duplicate_placement",
            "p101x42": "unparsable_frames",
            "p101r42 ": "unparsable_frames",
            "": "unparsable_frames",
        }
        for frames, reason in cases.items():
            with self.subTest(frames=frames):
                self.assertEqual(normalize_frames(frames, SCOPE), (None, reason))

    def test_legacy_timestamp(self):
        self.assertEqual(legacy_timestamp("2024-08-06T04:50:54.912959Z"), "2024-08-06 04:50:54.912959")
        self.assertEqual(legacy_timestamp("2021-01-28 20:51:35.716379"), "2021-01-28 20:51:35.716379")


class HardwareTests(unittest.TestCase):
    def test_generated_definition_is_readable(self):
        pinned = load_pinned()
        self.assertRegex(pinned.revision, r"^kilter:7:8:17:[0-9a-f]{12}$")
        self.assertIn(40, pinned.angles)

    def test_pin_reproduces_and_rejects_perturbations(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            pinned = fixture_pin(fixtures.catalog_db(work / "good.db"), work)
            for name, options in (("led", {"led_shift": 7}), ("role", {"rename_role": "foot"}),
                                  ("placement", {})):
                with self.subTest(perturbation=name):
                    catalog = sqlite3.connect(fixtures.catalog_db(work / f"{name}.db", **options))
                    if name == "placement":
                        catalog.execute("DELETE FROM board_placements WHERE id=102")
                    hardware = work / f"{name}-hw.sqlite3"
                    out = sqlite3.connect(hardware)
                    copy_hardware(catalog, out, fixtures.ANGLES)
                    out.commit(); out.close()
                    with self.assertRaises(HardwareMismatch):
                        verify_scope(hardware, catalog, pinned)

    def test_role_map_and_lit_placements(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            catalog_path = fixtures.catalog_db(work / "c.db")
            pinned = fixture_pin(catalog_path, work)
            scope = verify_scope(work / "pin.sqlite3", sqlite3.connect(catalog_path), pinned)
            self.assertEqual(scope.role_map, SCOPE.role_map)
            self.assertEqual(scope.lit_placement_ids, frozenset({101, 102, 103}))


class NormalizeTests(unittest.TestCase):
    def run_normalize(self, climbs=()):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        work = Path(tmp.name)
        climbs_conn = sqlite3.connect(fixtures.climbs_db(work / "k.db", climbs))
        catalog_conn = sqlite3.connect(fixtures.catalog_db(work / "c.db"))
        out = sqlite3.connect(":memory:")
        return normalize(climbs_conn, catalog_conn, SCOPE, out), out

    def test_emits_only_app_compatible_climbs_with_counted_exclusions(self):
        report, out = self.run_normalize()
        rows = dict(out.execute("SELECT uuid, frames FROM climbs"))
        self.assertEqual(rows, {"LEGACY1": "p101r42p102r43", "0b6e-new-uuid": "p101r42p103r45"})
        self.assertEqual(report.excluded, {"unlit_placement": 2, "multi_frame": 1, "duplicate_placement": 1,
                                           "unparsable_frames": 1, "missing_required_field": 1})
        self.assertEqual((report.upstream_rows, report.listed, report.emitted, report.role_rewritten),
                         (9, 8, 2, 1))

    def test_preserves_upstream_frames_uuid_spelling_and_flags(self):
        _, out = self.run_normalize()
        row = out.execute("SELECT upstream_frames, created_at, is_nomatch, setter_id, is_listed, is_draft "
                          "FROM climbs WHERE uuid='0b6e-new-uuid'").fetchone()
        self.assertEqual(row, ("p101r12p103r15", "2026-04-01 10:00:00.5", 0, None, 1, 0))
        self.assertEqual(out.execute("SELECT is_nomatch FROM climbs WHERE uuid='LEGACY1'").fetchone(), (1,))

    def test_records_every_upstream_identity(self):
        _, out = self.run_normalize()
        status = {uuid: (state, canonical) for uuid, state, canonical in out.execute("SELECT * FROM upstream_climbs")}
        self.assertEqual(status["UNLISTED1"], ("unlisted", None))
        self.assertEqual(status["ALIAS1"], ("aliased", "LEGACY1"))
        self.assertNotIn("ORPHAN", status)
        self.assertEqual(len(status), 10)

    def test_stats_only_for_emitted_climbs_and_supported_angles(self):
        report, out = self.run_normalize()
        stats = list(out.execute("SELECT climb_uuid, angle FROM climb_stats ORDER BY 1, 2"))
        self.assertEqual(stats, [("0b6e-new-uuid", 40), ("LEGACY1", 40)])
        self.assertEqual(report.excluded_stats, {"unsupported_angle": 2, "missing_metric": 1})

    def alias_conflict(self, rows):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        work = Path(tmp.name)
        catalog = sqlite3.connect(fixtures.catalog_db(work / "c.db"))
        catalog.executemany("INSERT INTO board_climb_aliases VALUES('kilter',?,?,'kilter','x','x')", rows)
        catalog.commit()
        return normalize(sqlite3.connect(fixtures.climbs_db(work / "k.db")), catalog, SCOPE,
                         sqlite3.connect(":memory:"))

    def test_alias_identity_conflicts_are_fatal(self):
        cases = {
            "case variant": [("alias1", "LEGACY1")],                 # vs fixture ALIAS1
            "two canonicals": [("ALIAS1", "0b6e-new-uuid")],
            "collides with climb": [("legacy1", "0b6e-new-uuid")],
        }
        for label, rows in cases.items():
            with self.subTest(case=label), self.assertRaises(NormalizationError):
                self.alias_conflict(rows)

    def test_self_and_duplicate_aliases_are_ignored(self):
        report = self.alias_conflict([("LEGACY1", "LEGACY1"), ("ALIAS1", "LEGACY1")])
        self.assertEqual(report.aliases, 1)

    def test_case_only_duplicate_uuid_is_fatal(self):
        with self.assertRaises(NormalizationError):
            self.run_normalize([("abc", "p101r42", 1, 1, "x"), ("ABC", "p102r42", 1, 1, "y")])


class SourceTests(unittest.TestCase):
    def entry(self, size, raw):
        return ArtifactEntry("https://x", size, raw, "2026-10-19T00:00:00Z", 13, {})

    def test_gzip_and_plain_bodies_materialize_identically(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            raw = fixtures.climbs_db(work / "k.db").read_bytes()
            packed = gzip.compress(raw, mtime=0)
            materialize(packed, self.entry(len(packed), len(raw)), work / "a.db")
            materialize(raw, self.entry(len(packed), len(raw)), work / "b.db")
            self.assertEqual((work / "a.db").read_bytes(), (work / "b.db").read_bytes())

    def test_rejects_inconsistent_bodies(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            raw = fixtures.climbs_db(work / "k.db").read_bytes()
            packed = gzip.compress(raw, mtime=0)
            cases = {
                "gzip length": (packed, self.entry(len(packed) + 1, len(raw))),
                "raw length": (raw, self.entry(1, len(raw) - 1)),
                "magic": (b"<html>" + raw, self.entry(1, len(raw) + 6)),
            }
            for label, (body, entry) in cases.items():
                with self.subTest(case=label), self.assertRaises(SourceError):
                    materialize(body, entry, work / "out.db")

    def test_manifest_parsing_fails_closed(self):
        climbs, catalog = fixtures.manifests(1, 2, 3, 4)
        self.assertEqual(parse_climbs_entry(climbs).uncompressed_bytes, 2)
        self.assertEqual(parse_catalog_entry(catalog).bytes, 3)
        broken = [
            dict(climbs, formatVersion=3),
            dict(climbs, entries=[]),
            dict(climbs, entries=[dict(climbs["entries"][0], url="http://plain")]),
            dict(climbs, entries=[dict(climbs["entries"][0], bytes=0)]),
        ]
        for manifest in broken:
            with self.subTest(manifest=manifest), self.assertRaises(SourceError):
                parse_climbs_entry(manifest)
        with self.assertRaises(SourceError):
            parse_catalog_entry(dict(catalog, formatVersion=2))
        with self.assertRaises(SourceError):
            parse_climbs_entry(dict(climbs, entries=[dict(climbs["entries"][0], schemaVersion=14)]))
        with self.assertRaises(SourceError):
            parse_catalog_entry(dict(catalog, artifact=dict(catalog["artifact"], schemaVersion=2)))

    def test_unchanged_upstream_fetches_only_the_small_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = fixtures.source_dir(Path(tmp) / "src")
            climbs_manifest = json.loads((src / "climbs-manifest.json").read_text())
            catalog_manifest = json.loads((src / "catalog-manifest.json").read_text())
            bodies = {MANIFEST_GZIP_URL: json.dumps(climbs_manifest).encode(),
                      MANIFEST_CATALOG_URL: json.dumps(catalog_manifest).encode(),
                      climbs_manifest["entries"][0]["url"]: (src / "climbs.db").read_bytes(),
                      catalog_manifest["artifact"]["url"]: (src / "catalog.db").read_bytes()}

            class Recording:
                def __init__(self):
                    self.urls = []

                def get(self, url):
                    self.urls.append(url)
                    return bodies[url]

            fetcher = Recording()
            # Same instant, different spelling: still unchanged, and no artifact is downloaded.
            with self.assertRaises(UpstreamUnchanged):
                fetch_inputs(fetcher, Path(tmp), unchanged_since="2026-10-19T18:38:11.515000Z")
            self.assertEqual(fetcher.urls, [MANIFEST_GZIP_URL])

            fetcher = Recording()
            fetch_inputs(fetcher, Path(tmp), unchanged_since="2026-10-12T18:38:11.515Z")
            self.assertEqual(len(fetcher.urls), 4)

    def test_offline_inputs_require_every_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = fixtures.source_dir(Path(tmp) / "src")
            (src / "catalog.db").unlink()
            with self.assertRaises(SourceError):
                load_inputs(src, Path(tmp))


class BuildTests(unittest.TestCase):
    def build(self, version=2, gzip_climbs=True, out_name="out"):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        src = fixtures.source_dir(root / "src", gzip_climbs=gzip_climbs)
        work = root / f"work-{out_name}"
        work.mkdir()
        inputs = load_inputs(src, work)
        pinned = fixture_pin(inputs.catalog_db, work)
        return artifact.build(inputs, pinned, root / out_name, work, version, "2026-10-19"), root

    def test_build_is_deterministic(self):
        first, _ = self.build(out_name="a")
        second, _ = self.build(out_name="b")
        self.assertEqual(first.manifest["sha256"], second.manifest["sha256"])

    def test_artifact_passes_app_install_checks(self):
        result, root = self.build()
        raw = gzip.decompress(result.artifact_path.read_bytes())
        self.assertEqual(len(raw), result.manifest["bytesRaw"])
        db_path = root / "check.sqlite3"
        db_path.write_bytes(raw)
        db = sqlite3.connect(db_path)
        page = db.execute("PRAGMA page_count").fetchone()[0] * db.execute("PRAGMA page_size").fetchone()[0]
        self.assertEqual(page, result.manifest["bytesRaw"])
        self.assertEqual(db.execute("PRAGMA integrity_check").fetchone(), ("ok",))
        for table, columns in app_required_columns().items():
            present = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
            self.assertTrue(set(columns) <= present, table)
        self.assertEqual(db.execute("SELECT COUNT(*), SUM(layout_id != 8) FROM climbs").fetchone(), (2, 0))
        meta = dict(db.execute("SELECT key, value FROM catalog_meta"))
        self.assertEqual(meta["source"], "boardsesh-kilter")
        self.assertEqual(json.loads(meta["normalization"])["emitted"], 2)

    def test_manifest_matches_committed_example_contract(self):
        result, _ = self.build()
        example = json.loads(EXAMPLE_MANIFEST.read_text())
        self.assertEqual(sorted(result.manifest), sorted(example))
        self.assertEqual(result.manifest["schemaVersion"], 3)
        self.assertEqual(result.manifest["file"], "kilter-7x10.v2.db.gz")
        self.assertEqual(result.manifest["climbCount"], 2)

    def test_refuses_overwrite_and_oversize(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        inputs = load_inputs(fixtures.source_dir(root / "src"), root)
        pinned = fixture_pin(inputs.catalog_db, root)
        artifact.build(inputs, pinned, root / "out", root, 3, "2026-10-19")
        with self.assertRaises(FileExistsError):
            artifact.build(inputs, pinned, root / "out", root, 3, "2026-10-19")
        original = artifact.COMPRESSED_LIMIT
        artifact.COMPRESSED_LIMIT = 10
        self.addCleanup(setattr, artifact, "COMPRESSED_LIMIT", original)
        with self.assertRaises(artifact.SizeLimitError):
            artifact.build(inputs, pinned, root / "out", root, 4, "2026-10-19")
        self.assertFalse((root / "out" / "kilter-7x10.v4.db.gz").exists())


if __name__ == "__main__":
    unittest.main()
