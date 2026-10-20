import json
import unittest
from pathlib import Path

from catalog.storage_layout import artifact_object, latest_version, manifest_object

FIXTURE = (Path(__file__).resolve().parents[3] / "prototypes" / "firebase-vault" / "catalog-gateway"
           / "storage-layout.fixture.json")


class StorageLayoutTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads(FIXTURE.read_text())

    def test_latest_version_matches_shared_cases(self):
        for case in self.fixture["cases"]:
            with self.subTest(names=case["names"]):
                self.assertEqual(latest_version(case["names"]), case["latest"])

    def test_object_names_match_shared_layout(self):
        for item in self.fixture["objects"]:
            self.assertEqual(artifact_object(item["version"]), item["artifact"])
            self.assertEqual(manifest_object(item["version"]), item["manifest"])

    def test_rejects_out_of_range_versions(self):
        for version in (0, -1, 1_000_000, True):
            with self.subTest(version=version), self.assertRaises(ValueError):
                artifact_object(version)


if __name__ == "__main__":
    unittest.main()
