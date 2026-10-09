---
id: custom-climb-grade-visibility
kind: story
stage: implementing
tags: [ui]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Make the custom-climb grade easy to find

## Brief

Andrew currently puts difficulty in climb names because the editor appears to offer
only Name and Angle. Grade already exists as optional `metadata.grade`, is edited
under collapsed Optional details, and survives storage, sharing and whole-library
backup. Move that existing field into the main Climb details group with Name and
Angle, keeping Description and Setter notes in Optional details. Add a short input
example so its purpose is clear. Existing list and detail already display grades.

## Strategic decisions

Keep optional free-text grades and all existing metadata contracts. No inferred grade,
name parsing/rewriting, mass library migration, schema change, new filtering system,
or grade-prediction dependency. User-authored names stay exactly as saved.

## Simplification opportunity

Reuse the existing grade input, reducer and metadata path. No second grade property.

## Implementation and acceptance

- Move the existing Grade input immediately after Angle, label it Grade (optional),
  and show an example such as V4 or 6B in its placeholder.
- No new visual component or layout: this cleanly reuses the current field pattern,
  so the project mockup exception applies.
- Verify the rendered grade is visible with Optional details collapsed, editing still
  saves through the existing metadata path, and a saved grade appears in list/detail.
- Existing ungraded climbs, names, descriptions and setter notes remain valid.
- Run the focused editor suite and a synthetic browser interaction. This presentation
  change requires no new database tests. Standalone bounded inline review after checks.

## Execution

Host owns this small, independent editor change while catalog work continues. No
catalog/app/runtime files are needed. Review weight standard, standalone inline lane.
