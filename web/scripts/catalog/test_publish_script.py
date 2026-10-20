import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from catalog import fixtures
from catalog.boardsesh_source import load_inputs
from catalog.storage_layout import artifact_object, latest_version, manifest_object
from catalog.test_catalog_build import fixture_pin
from catalog.test_reconcile_guards import CLIMBS, T0, T1, T2

SCRIPT = Path(__file__).resolve().parents[1] / "catalog-publish.sh"


@unittest.skipUnless(shutil.which("bash"), "bash required")
class PublishScriptTests(unittest.TestCase):
    """Runs catalog-publish.sh against a directory-backed store and synthetic inputs."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.store = self.root / "store"
        legacy = fixtures.legacy_previous(self.root / "legacy", [("LEGACY1", "p101r42p102r43")])
        manifest = json.loads((legacy / "manifest.json").read_text())
        for name, source in ((artifact_object(1), legacy / manifest["file"]), (manifest_object(1), legacy / "manifest.json")):
            (self.store / name).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(source, self.store / name)
        # Pin hardware to the synthetic fixture rather than the real board definition.
        work = self.root / "pin"
        work.mkdir()
        inputs = load_inputs(fixtures.source_dir(work / "src"), work)
        pinned = fixture_pin(inputs.catalog_db, work)
        self.definition = self.root / "definition.ts"
        self.definition.write_text("export const generatedKilterFullride7x10 = "
                                   + json.dumps({"revision": pinned.revision, "angles": list(pinned.angles)})
                                   + " as const;\n")
        self.runs = 0

    def publish(self, built_at):
        self.runs += 1
        source = fixtures.source_dir(self.root / f"src{self.runs}", climbs=CLIMBS, built_at=built_at)
        output = self.root / f"github-output-{self.runs}"
        env = dict(os.environ, CATALOG_STORE_DIR=str(self.store), CATALOG_FROM_DIR=str(source),
                   CATALOG_DEFINITION=str(self.definition), GITHUB_OUTPUT=str(output))
        env.pop("CATALOG_BUCKET", None)
        completed = subprocess.run(["bash", str(SCRIPT)], env=env, capture_output=True, text=True, check=False)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        outputs = dict(line.split("=", 1) for line in output.read_text().splitlines())
        return outputs["result"]

    def names(self):
        return sorted(str(path.relative_to(self.store)) for path in self.store.rglob("*") if path.is_file())

    def test_publish_unchanged_and_recovery_from_burned_version(self):
        self.assertEqual(self.publish(T0), "published")
        self.assertEqual(latest_version(self.names()), 2)
        self.assertEqual(self.publish(T0), "unchanged")

        # Simulate an interrupted publication: v3 artifact uploaded, manifest never written.
        shutil.copy(self.store / artifact_object(2), self.store / artifact_object(3))
        self.assertEqual(self.publish(T1), "published")
        names = self.names()
        self.assertEqual(latest_version(names), 4)
        self.assertIn(artifact_object(3), names)
        self.assertNotIn(manifest_object(3), names)
        manifest = json.loads((self.store / manifest_object(4)).read_text())
        self.assertEqual((manifest["version"], manifest["file"]), (4, "kilter-7x10.v4.db.gz"))
        self.assertEqual(self.publish(T2), "published")
        self.assertEqual(latest_version(self.names()), 5)


if __name__ == "__main__":
    unittest.main()
