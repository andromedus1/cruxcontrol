---
id: epic-route-creation-kilter-screenshot-import
kind: feature
stage: drafting
tags: [data, ui]
parent: epic-route-creation
depends_on: [epic-route-creation-local-draft-library]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Import Kilter Climbs from Screenshots

## Brief

Import climbs Andrew previously built in the Kilter app from screenshots that show
the Fullride 7x10 climb marked with Kilter's colored hold rings. Read the text written
at the top of each screenshot as the climb name, identify the selected holds and their
roles, present uncertain interpretations for correction, and save confirmed results
through CruxControl's durable local climb repository.

The first real input set is the 16 PNG screenshots in `docs/set_boulders/`. The work
should produce a repeatable import path rather than a one-off manual transcription,
while keeping all image processing and saved climb data local to the user's device.
All 16 supplied climbs use the Fullride 7x10 at 40 degrees. The visible text written
at the top of each screenshot is the authoritative climb name.

## Simplification opportunity

Reuse the generated Fullride placement geometry, existing semantic role colors, and
local draft repository as the authorities for matching and persistence. Avoid a
second climb representation or a screenshot-specific storage path; discard image
processing intermediates after the user has reviewed the interpreted climb.
