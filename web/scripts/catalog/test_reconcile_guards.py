import json
import sqlite3
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from catalog import artifact, fixtures
from catalog.boardsesh_source import load_inputs
from catalog.guards import MAX_NEWLY_REMOVED, evaluate
from catalog.previous import PreviousArtifact, PreviousArtifactError, load_previous
from catalog.reconcile import ReconcileReport
from catalog.test_catalog_build import fixture_pin

T0 = "2026-10-19T18:38:11.515Z"
T1 = "2026-10-26T18:38:11.515Z"
T2 = "2026-11-02T18:38:11.515Z"
# Enough ordinary climbs that one removal stays under the 2% present-drop limit.
BULK = tuple((f"BULK{i:02d}", "p101r42p103r44", 1, 1, "z") for i in range(60))
CLIMBS = tuple(fixtures.default_climbs()) + BULK
WITHOUT_LEGACY = tuple(climb for climb in CLIMBS if climb[0] != "LEGACY1")


def previous(source_built_at=T0, revision="rev", version=1):
    return PreviousArtifact(Path("unused"), {}, version, 3, source_built_at, revision)


class GuardTests(unittest.TestCase):
    def verdict(self, built_at=T1, revision="rev", **fields):
        report = replace(ReconcileReport(1, previous_present=1000, present=1000), **fields)
        return evaluate(report, previous(), built_at, revision)

    def test_publishes_ordinary_change(self):
        self.assertEqual(self.verdict(present=1100, added=100, removed=5).reasons, ())

    def test_unchanged_upstream_is_not_a_failure(self):
        verdict = self.verdict(built_at=T0)
        self.assertEqual((verdict.publish, verdict.unchanged), (False, True))

    def test_present_drop_threshold(self):
        self.assertTrue(self.verdict(present=980).publish)
        self.assertFalse(self.verdict(present=979).publish)

    def test_newly_removed_threshold(self):
        self.assertTrue(self.verdict(removed=MAX_NEWLY_REMOVED).publish)
        self.assertFalse(self.verdict(removed=MAX_NEWLY_REMOVED + 1).publish)

    def test_build_times_compare_as_instants(self):
        self.assertTrue(self.verdict(built_at="2026-10-19T18:38:11.515000Z").unchanged)
        self.assertTrue(self.verdict(built_at="2026-10-19T20:38:11.515+02:00").unchanged)
        older = self.verdict(built_at="2026-10-19T18:38:11Z")
        self.assertEqual((older.publish, older.unchanged), (False, False))
        self.assertFalse(self.verdict(built_at="yesterday").publish)

    def test_other_holds(self):
        for label, kwargs in (("lost", {"lost": ["X"]}), ("case", {"case_changed": ["X"]}),
                              ("older", {"built_at": "2026-10-01T00:00:00Z"}),
                              ("revision", {"revision": "other"})):
            with self.subTest(hold=label):
                verdict = self.verdict(**kwargs)
                self.assertFalse(verdict.publish)
                self.assertFalse(verdict.unchanged)


class ReconcileBuildTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.runs = 0

    def build(self, climbs, built_at, previous_dir=None, version=None, date="2026-10-19", no_stats=(),
              stats_angles=None, legacy_baseline=None):
        self.runs += 1
        work = self.root / f"work{self.runs}"
        work.mkdir()
        inputs = load_inputs(fixtures.source_dir(work / "src", climbs=climbs, built_at=built_at,
                                                 no_stats=no_stats, stats_angles=stats_angles), work)
        prior = load_previous(previous_dir, work) if previous_dir else None
        baseline = None
        if legacy_baseline:
            (work / "baseline").mkdir()
            baseline = load_previous(legacy_baseline, work / "baseline")
        out = self.root / f"out{self.runs}"
        result = artifact.build(inputs, fixture_pin(inputs.catalog_db, work), out, work, version, date, prior,
                                legacy_baseline=baseline)
        return result, out

    def rows(self, result, sql):
        import gzip
        db = self.root / f"check{self.runs}.sqlite3"
        db.write_bytes(gzip.decompress(result.artifact_path.read_bytes()))
        return list(sqlite3.connect(db).execute(sql))

    def test_removed_climb_is_carried_marked_and_restored(self):
        v1, out1 = self.build(CLIMBS, T0, version=1)
        self.assertEqual(v1.manifest["changes"], {"added": 62, "removed": 0, "restored": 0})

        v2, out2 = self.build(WITHOUT_LEGACY, T1, out1, date="2026-10-26")
        self.assertEqual(v2.manifest["version"], 2)
        self.assertEqual((v2.manifest["removedUpstreamCount"], v2.manifest["changes"]["removed"]), (1, 1))
        self.assertEqual(self.rows(v2, "SELECT uuid, is_listed, upstream_removed_at FROM climbs "
                                       "WHERE uuid IN ('0b6e-new-uuid', 'LEGACY1') ORDER BY uuid"),
                         [("0b6e-new-uuid", 1, None), ("LEGACY1", 1, "2026-10-26")])
        self.assertEqual(v2.manifest["climbCount"], 62)
        self.assertEqual(self.rows(v2, "SELECT angle FROM climb_stats WHERE climb_uuid='LEGACY1'"), [(40,)])

        v3, out3 = self.build(WITHOUT_LEGACY, T2, out2, date="2026-11-02")
        self.assertEqual(self.rows(v3, "SELECT upstream_removed_at FROM climbs WHERE uuid='LEGACY1'"),
                         [("2026-10-26",)])
        self.assertEqual(v3.manifest["changes"]["removed"], 0)

        v4, _ = self.build(CLIMBS, "2026-11-09T18:38:11.515Z", out3, date="2026-11-09")
        self.assertEqual(self.rows(v4, "SELECT upstream_removed_at FROM climbs WHERE uuid='LEGACY1'"), [(None,)])
        self.assertEqual(v4.manifest["changes"]["restored"], 1)
        self.assertEqual(json.loads(self.rows(v4, "SELECT value FROM catalog_meta WHERE key='reconcile'")[0][0])["lost"], [])

    def test_present_climb_losing_its_stats_keeps_previous_stats(self):
        _, out1 = self.build(CLIMBS, T0, version=1)
        v2, _ = self.build(CLIMBS, T1, out1, date="2026-10-26", no_stats=("LEGACY1",))
        self.assertEqual((v2.reconciled.stats_kept, v2.reconciled.lost), (1, []))
        self.assertEqual(self.rows(v2, "SELECT climb_stats.angle, upstream_removed_at FROM climb_stats JOIN climbs "
                                       "ON uuid = climb_uuid WHERE uuid='LEGACY1'"), [(40, None)])

    def test_angle_losing_its_stats_keeps_the_previous_row(self):
        _, out1 = self.build(CLIMBS, T0, version=1)
        # Upstream keeps LEGACY1 at 0 degrees but drops its 40-degree stats.
        v2, _ = self.build(CLIMBS, T1, out1, date="2026-10-26", stats_angles={"LEGACY1": (0,)})
        self.assertEqual((v2.reconciled.stats_kept, v2.reconciled.lost), (1, []))
        self.assertEqual(self.rows(v2, "SELECT angle FROM climb_stats WHERE climb_uuid='LEGACY1' ORDER BY angle"),
                         [(0,), (40,)])

    def test_legacy_previous_carries_only_app_visible_climbs(self):
        legacy = fixtures.legacy_previous(self.root / "legacy",
                                          [("LEGACY1", "p101r42p102r43"), ("OLD1", "p102r42p103r45"),
                                           ("OLDUNLIT", "p104r42")])
        result, _ = self.build(fixtures.default_climbs(), T0, legacy)
        self.assertEqual(result.manifest["version"], 2)
        self.assertEqual(self.rows(result, "SELECT uuid, upstream_frames, upstream_removed_at FROM climbs "
                                           "WHERE upstream_removed_at IS NOT NULL"),
                         [("OLD1", "p102r42p103r45", "2026-10-19")])
        # Aurora-era 1-3 ratings are rescaled to the artifact's declared 0-5 scale.
        (quality,), = self.rows(result, "SELECT quality_average FROM climb_stats WHERE climb_uuid='OLD1'")
        self.assertAlmostEqual(quality, 2.5 * 5 / 3)
        self.assertEqual(result.reconciled.previous_present, 2)
        self.assertEqual(result.reconciled.lost, [])

    def corrupt_like_prefix_v2(self, out_dir, legacy_quality, drop_pair):
        """Rewrite a published artifact the way pre-fix builds left v2: carried legacy ratings
        unscaled and one previously usable (climb, angle) pair missing."""
        import gzip, hashlib
        manifest = json.loads((out_dir / "manifest.json").read_text())
        path = out_dir / manifest["file"]
        db = self.root / f"corrupt{self.runs}.sqlite3"
        db.write_bytes(gzip.decompress(path.read_bytes()))
        connection = sqlite3.connect(db)
        for uuid, quality in legacy_quality.items():
            connection.execute("UPDATE climb_stats SET quality_average=? WHERE climb_uuid=?", (quality, uuid))
        connection.execute("DELETE FROM climb_stats WHERE climb_uuid=? AND angle=?", drop_pair)
        connection.commit()
        connection.execute("VACUUM")
        connection.close()
        raw = db.read_bytes()
        body = gzip.compress(raw, mtime=0)
        path.write_bytes(body)
        manifest.update(sha256=hashlib.sha256(body).hexdigest(), bytesGzipped=len(body), bytesRaw=len(raw))
        (out_dir / "manifest.json").write_text(json.dumps(manifest))

    def test_legacy_baseline_repairs_a_prefix_v2_once(self):
        legacy = fixtures.legacy_previous(self.root / "legacy",
                                          [("LEGACY1", "p101r42p102r43"), ("OLD1", "p102r42p103r45")])
        _, out2 = self.build(fixtures.default_climbs(), T0, legacy)
        # Pre-fix v2: OLD1 (carried) kept the raw 2.5/3 rating; LEGACY1 lost its 40-degree pair.
        self.corrupt_like_prefix_v2(out2, {"OLD1": 2.5}, ("LEGACY1", 40))
        # Upstream still lists LEGACY1, but only with 0-degree stats (as for the real v2 pairs).
        upstream, angles = fixtures.default_climbs(), {"LEGACY1": (0,)}
        v3, out3 = self.build(upstream, T1, out2, date="2026-10-26", stats_angles=angles, legacy_baseline=legacy)
        (quality,), = self.rows(v3, "SELECT quality_average FROM climb_stats WHERE climb_uuid='OLD1'")
        self.assertAlmostEqual(quality, 2.5 * 5 / 3)
        self.assertEqual(self.rows(v3, "SELECT angle, quality_average FROM climb_stats "
                                       "WHERE climb_uuid='LEGACY1' ORDER BY angle"),
                         [(0, 4.5), (40, 2.5 * 5 / 3)])
        self.assertEqual((v3.reconciled.legacy_rescaled, v3.reconciled.legacy_restored), (1, 1))
        # Idempotent: a later build with the same baseline changes nothing further.
        v4, _ = self.build(upstream, T2, out3, date="2026-11-02", stats_angles=angles, legacy_baseline=legacy)
        self.assertEqual((v4.reconciled.legacy_rescaled, v4.reconciled.legacy_restored), (0, 0))
        (quality,), = self.rows(v4, "SELECT quality_average FROM climb_stats WHERE climb_uuid='OLD1'")
        self.assertAlmostEqual(quality, 2.5 * 5 / 3)

    def test_unchanged_and_held_builds_write_nothing(self):
        _, out1 = self.build(CLIMBS, T0, version=1)
        with self.assertRaises(artifact.Unchanged):
            self.build(CLIMBS, T0, out1)
        nothing_lit = [("NEW9", "p104r42", 1, 1, "x")]
        with self.assertRaises(artifact.GuardHold) as held:
            self.build(nothing_lit, T1, out1)
        self.assertIn("fell from 62 to 0", str(held.exception))
        self.assertFalse(any((self.root / f"out{run}").exists() for run in (2, 3)))

    def test_versions_strictly_increase_and_may_skip_burned_numbers(self):
        _, out1 = self.build(CLIMBS, T0, version=1)
        for stale in (1, 0):
            with self.assertRaises(ValueError):
                self.build(CLIMBS, T1, out1, version=stale)
        skipped, _ = self.build(CLIMBS, T1, out1, version=3)
        self.assertEqual(skipped.manifest["version"], 3)
        with self.assertRaises(ValueError):
            self.build(CLIMBS, T1)

    def test_previous_artifact_must_match_its_manifest(self):
        legacy = fixtures.legacy_previous(self.root / "legacy", [("OLD1", "p102r42")])
        manifest = json.loads((legacy / "manifest.json").read_text())
        for label, change in (("sha", {"sha256": "0" * 64}), ("schema", {"schemaVersion": 4}),
                              ("source", {"source": "boardsesh-kilter"}),
                              ("schema 3 without guard metadata",
                               {"schemaVersion": 3, "source": "boardsesh-kilter", "layoutRevision": "r"})):
            with self.subTest(case=label):
                (legacy / "manifest.json").write_text(json.dumps(dict(manifest, **change)))
                with self.assertRaises(PreviousArtifactError):
                    load_previous(legacy, self.root)


if __name__ == "__main__":
    unittest.main()
