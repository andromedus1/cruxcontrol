---
source_handle: kilter-frames-db-schema
fetched: 2026-06-13
source_url: https://bazun.me/blog/kiterboard
provenance: source-direct
---

# Kilter Board frames format + SQLite schema (bazun.me / corroborated by Grip Connect docs)

Decoding reference for the Kilter `frames` string and the app's local SQLite tables. Page body returned HTTP 403 on direct fetch; content captured via search-engine extraction of the same page and cross-checked against stevie-ray.github.io/hangtime-grip-connect kilterboard device docs.

## Paraphrased summary

A climb's `frames` string is a concatenation of per-hold tokens of the form `pXXXXrXX`, where `p` precedes a placement_id and `r` precedes a role_id (e.g. `p1083r15p1117r15p1164r12...`). The app's SQLite DB resolves these: `holes` (hole id + x,y board coordinates), `placements` (placement_id → hole_id), `placement_roles` (role_id → meaning/LED color, encoding start/middle/finish/foot), and `leds` (hole_id → Bluetooth LED position).

## Key verbatim passages

- "a hold in a climb takes the form pxxxxrxx, where the x's are digits, and an entire climb is made up of those holds concatenated together."
- Example: `p1083r15p1117r15p1164r12...` = "(placement_id p + role_id r)".
- Tables: "holes (hole coordinates and id), leds (maps hole_id to the LED position ...), placements (placement_id to hole_id), and placement_roles (role_id to LED color)."
- "The database also tracks coordinates for each hole location on the board, which are essential for mapping the placement IDs to their actual physical positions on the climbing wall."

## Decoding pipeline (derived)

frames → regex split on `p(\d+)r(\d+)` → for each: placement_id → placements.hole_id → holes.(x,y); role_id → placement_roles (hand vs foot, start/finish). Yields a list of (x, y, role) holds = the geometric input for feature engineering.
