-- Fictional layout-8 rows for bootstrap persistence and schema validation.
CREATE TABLE climbs (
  uuid TEXT PRIMARY KEY,
  layout_id INTEGER,
  setter_username TEXT,
  name TEXT,
  description TEXT,
  frames TEXT,
  frames_count INTEGER,
  is_draft INTEGER,
  is_listed INTEGER
);

CREATE TABLE climb_stats (
  climb_uuid TEXT,
  angle INTEGER,
  display_difficulty REAL,
  difficulty_average REAL,
  benchmark_difficulty REAL,
  ascensionist_count INTEGER,
  quality_average REAL,
  PRIMARY KEY (climb_uuid, angle)
);

CREATE TABLE difficulty_grades (
  difficulty INTEGER PRIMARY KEY,
  boulder_name TEXT,
  is_listed INTEGER
);

INSERT INTO climbs VALUES
  ('synthetic-valid', 8, 'fixture setter', 'Synthetic route', 'Fixture description', 'p4117r42', 1, 0, 1);
INSERT INTO climb_stats VALUES
  ('synthetic-valid', 40, 12, 11.5, NULL, 5, 2.5);
INSERT INTO difficulty_grades VALUES (12, 'V1', 1);
