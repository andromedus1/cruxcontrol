import importlib.util
import pathlib
import sqlite3
import tempfile
import unittest

MODULE_PATH = pathlib.Path(__file__).with_name("export-fullride-definition.py")
SPEC = importlib.util.spec_from_file_location("export_fullride_definition", MODULE_PATH)
assert SPEC and SPEC.loader
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


SCHEMA = """
CREATE TABLE product_sizes(id INTEGER, product_id INTEGER, edge_left INTEGER, edge_right INTEGER, edge_bottom INTEGER, edge_top INTEGER);
CREATE TABLE products_angles(product_id INTEGER, angle INTEGER);
CREATE TABLE placement_roles(id INTEGER, product_id INTEGER, position INTEGER, name TEXT, full_name TEXT, led_color TEXT, screen_color TEXT);
CREATE TABLE placements(id INTEGER, layout_id INTEGER, hole_id INTEGER, set_id INTEGER);
CREATE TABLE holes(id INTEGER, product_id INTEGER, x INTEGER, y INTEGER);
CREATE TABLE leds(id INTEGER, product_size_id INTEGER, hole_id INTEGER, position INTEGER);
"""


class GeneratorTests(unittest.TestCase):
    def database(self, directory: str, reverse: bool = False, role_offset: int = 0) -> pathlib.Path:
        path = pathlib.Path(directory) / ("reverse.db" if reverse else "fixture.db")
        connection = sqlite3.connect(path)
        connection.executescript(SCHEMA)
        connection.execute("INSERT INTO product_sizes VALUES(17,7,-44,44,24,144)")
        for angle in ([10, 5, 0] if reverse else [0, 5, 10]):
            connection.execute("INSERT INTO products_angles VALUES(7,?)", (angle,))
        roles = [(42, 1, "start", "Start", "00FF00"), (43, 2, "middle", "Middle", "00FFFF"), (44, 3, "finish", "Finish", "FF00FF"), (45, 4, "foot", "Foot Only", "FFA500")]
        for role_id, position, name, full_name, color in reversed(roles) if reverse else roles:
            connection.execute("INSERT INTO placement_roles VALUES(?,?,?,?,?,?,?)", (role_id + role_offset, 7, position, name, full_name, color, color))
        rows = [(1, 8, 11, 26, -40, 28, 101, 0), (2, 8, 12, 27, 40, 140, 102, 1), (3, 8, 13, 26, 52, 4, None, None)]
        for placement_id, layout_id, hole_id, set_id, x, y, led_id, led_position in reversed(rows) if reverse else rows:
            connection.execute("INSERT INTO holes VALUES(?,?,?,?)", (hole_id, 7, x, y))
            connection.execute("INSERT INTO placements VALUES(?,?,?,?)", (placement_id, layout_id, hole_id, set_id))
            if led_id is not None:
                connection.execute("INSERT INTO leds VALUES(?,?,?,?)", (led_id, 17, hole_id, led_position))
        connection.commit()
        connection.close()
        return path

    def test_projects_only_size_led_joins_with_auditable_counts(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = generator.extract(self.database(tmp))
            self.assertEqual((data["totalScoped"], data["emitted"], data["excluded"]), (3, 2, 1))
            self.assertEqual(data["excludedBySet"], {26: 1, 27: 0})
            self.assertEqual([row["placement_id"] for row in data["placements"]], [1, 2])

    def test_role_ids_do_not_define_semantics(self):
        with tempfile.TemporaryDirectory() as tmp:
            ordinary = generator.extract(self.database(tmp))
            alternate_dir = pathlib.Path(tmp) / "alternate"
            alternate_dir.mkdir()
            alternate = generator.extract(self.database(str(alternate_dir), role_offset=100))
            self.assertEqual([role["semantic"] for role in ordinary["roles"]], [role["semantic"] for role in alternate["roles"]])
            self.assertNotEqual([role["sourceId"] for role in ordinary["roles"]], [role["sourceId"] for role in alternate["roles"]])

    def test_rejects_missing_unknown_and_duplicate_semantics(self):
        row = lambda role_id, name, full_name: {"id": role_id, "name": name, "full_name": full_name, "led_color": "000000", "screen_color": "000000"}
        valid = [row(1, "start", "Start"), row(2, "middle", "Middle"), row(3, "finish", "Finish"), row(4, "foot", "Foot Only")]
        with self.assertRaisesRegex(ValueError, "missing semantic"):
            generator.semantic_roles(valid[:-1])
        with self.assertRaisesRegex(ValueError, "unknown or ambiguous"):
            generator.semantic_roles(valid + [row(5, "bonus", "Bonus")])
        with self.assertRaisesRegex(ValueError, "duplicate semantic"):
            generator.semantic_roles(valid + [row(5, "start", "Start")])

    def test_row_insertion_order_does_not_change_definition_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = generator.extract(self.database(tmp))
            reverse_dir = pathlib.Path(tmp) / "reverse"
            reverse_dir.mkdir()
            second = generator.extract(self.database(str(reverse_dir), reverse=True))
            for volatile in ("sourceSha256",):
                first.pop(volatile)
                second.pop(volatile)
            self.assertEqual(first, second)

    def test_rejects_ambiguous_led_joins(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.database(tmp)
            connection = sqlite3.connect(path)
            connection.execute("INSERT INTO leds VALUES(999,17,11,9)")
            connection.commit()
            connection.close()
            with self.assertRaisesRegex(ValueError, "ambiguous or duplicate"):
                generator.extract(path)

    def test_rejects_placements_outside_the_native_product_scope(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.database(tmp)
            connection = sqlite3.connect(path)
            connection.execute("UPDATE holes SET product_id=99 WHERE id=11")
            connection.commit()
            connection.close()
            with self.assertRaisesRegex(ValueError, "native hole scope"):
                generator.extract(path)


if __name__ == "__main__":
    unittest.main()
