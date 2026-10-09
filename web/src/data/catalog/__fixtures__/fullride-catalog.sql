-- Synthetic Fullride-only query fixture. These names and rows are fictional.
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

INSERT INTO difficulty_grades VALUES
  (10, 'V0', 1), (12, 'V1', 1), (18, 'V4', 1), (20, 'V5', 1),
  (22, 'V6', 1), (24, 'V7', 1), (30, 'hidden', 0);

INSERT INTO climbs VALUES
  ('a-good', 8, 'fixture setter', 'Amber move', 'Synthetic route', 'p4117r42p4118r43p4119r44p4120r45', 1, 0, 1),
  ('b-no-label', 8, '', 'No label route', '', 'p4117r42', 1, 0, 1),
  ('c-unsupported', 8, 'fixture', 'Unsupported hold', '', 'p999999r42', 1, 0, 1),
  ('d-draft', 8, 'fixture', 'Draft route', '', 'p4117r42', 1, 1, 1),
  ('e-unlisted', 8, 'fixture', 'Unlisted route', '', 'p4117r42', 1, 0, 0),
  ('f-multiframe', 8, 'fixture', 'Multi frame', '', 'p4117r42', 2, 0, 1),
  ('g-wrong-layout', 1, 'fixture', 'Original route', '', 'p1083r12', 1, 0, 1),
  ('h-literal_%_quote', 8, 'fixture', 'Quotes '' % _ literal', '', 'p4117r42', 1, 0, 1);

INSERT INTO climb_stats VALUES
  ('a-good', 40, 18.4, 17.7, 0, 123, 3.25),
  ('a-good', 50, 20.2, 19.9, NULL, 20, 2.5),
  ('b-no-label', 40, 11.2, 11.1, NULL, 0, 0),
  ('c-unsupported', 40, 12, 12, NULL, 4, 2),
  ('d-draft', 40, 12, 12, NULL, 4, 2),
  ('e-unlisted', 40, 12, 12, NULL, 4, 2),
  ('f-multiframe', 40, 12, 12, NULL, 4, 2),
  ('g-wrong-layout', 40, 12, 12, NULL, 4, 2),
  ('h-literal_%_quote', 40, 22, 22, NULL, 4, 2);
