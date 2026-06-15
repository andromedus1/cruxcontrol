-- Small Kilter-subset seed for the catalog read-path tests.
--
-- Diffable SQL (preferred over a committed binary .db) loaded into an in-memory
-- VFS by catalog-db.test.ts. Columns mirror the real Kilter schema documented in
-- docs/briefs/data-model.md; only the subset the read path queries is included
-- (climbs, climb_stats, difficulty_grades). Holds/placements/leds are out of
-- scope for this feature.

-- Published climbing problems. (data-model.md §"Climb Data")
CREATE TABLE climbs (
  uuid            TEXT PRIMARY KEY,
  layout_id       INTEGER,
  setter_id       INTEGER,
  setter_username TEXT,
  name            TEXT,
  description     TEXT,
  frames          TEXT,
  frames_count    INTEGER,
  frames_pace     INTEGER,
  is_draft        INTEGER,
  is_listed       INTEGER,
  edge_left       INTEGER,
  edge_right      INTEGER,
  edge_bottom     INTEGER,
  edge_top        INTEGER
);

-- Aggregated statistics per climb per angle. Keyed by (climb_uuid, angle).
-- (data-model.md §"The climb_stats Table")
CREATE TABLE climb_stats (
  climb_uuid           TEXT,
  angle                INTEGER,
  display_difficulty   REAL,
  difficulty_average   REAL,
  benchmark_difficulty REAL,
  ascensionist_count   INTEGER,
  quality_average      REAL,
  PRIMARY KEY (climb_uuid, angle)
);

-- Grade label lookup. (data-model.md §"The difficulty_grades Table")
CREATE TABLE difficulty_grades (
  difficulty   INTEGER PRIMARY KEY,
  boulder_name TEXT,
  is_listed    INTEGER
);

INSERT INTO climbs
  (uuid, layout_id, setter_id, setter_username, name, description, frames,
   frames_count, frames_pace, is_draft, is_listed,
   edge_left, edge_right, edge_bottom, edge_top)
VALUES
  ('climb-a', 1, 100, 'setter_one', 'Crimp Ladder', 'Thin and techy',
   'p1083r15p1164r12p1185r12p1233r13p1392r14', 1, 0, 0, 1, 4, 140, 0, 152),
  ('climb-b', 1, 101, 'setter_two', 'Sloper Slap', 'Powerful slopers',
   'p1117r15p1282r13p1303r13p1372r13p1505r14', 1, 0, 0, 1, 8, 136, 4, 148),
  ('climb-c', 1, 100, 'setter_one', 'Footwork Drill', 'Precise feet',
   'p1083r15p1164r12p1505r14', 1, 0, 0, 1, 12, 120, 8, 140);

INSERT INTO climb_stats
  (climb_uuid, angle, display_difficulty, difficulty_average,
   benchmark_difficulty, ascensionist_count, quality_average)
VALUES
  -- climb-a: benchmarked at 40 (display == benchmark), community-only at 50.
  ('climb-a', 40, 18.0, 17.8, 18.0, 1240, 2.9),
  ('climb-a', 50, 20.4, 20.4, NULL, 312, 2.7),
  -- climb-b: never benchmarked (benchmark_difficulty NULL → display == average).
  ('climb-b', 40, 22.1, 22.1, NULL, 88, 3.4),
  -- climb-c: easy, benchmarked.
  ('climb-c', 40, 12.0, 11.6, 12.0, 4502, 2.5);

INSERT INTO difficulty_grades (difficulty, boulder_name, is_listed)
VALUES
  (10, 'V0', 1),
  (12, 'V1', 1),
  (14, 'V2', 1),
  (16, 'V3', 1),
  (18, 'V4', 1),
  (20, 'V5', 1),
  (22, 'V6', 1),
  (24, 'V7', 1);
