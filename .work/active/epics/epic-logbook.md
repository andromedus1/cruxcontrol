---
id: epic-logbook
kind: epic
stage: drafting
tags: [ui, data]
parent: null
depends_on: [epic-climb-browser]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-08-02
---

# Logbook & Sessions

## Mockups

- Inherits locked design system: `.mockups/design-system/`

## Design decisions

- **First-milestone persistence**: attempts, sends, notes, and session grouping are
  local-first and exportable.
- **Provider synchronization**: account-backed logbook sync is deferred.

## Brief

The data-ownership capability: log ascents and attempts with grade votes and quality
ratings, a session mode that tracks attempts and shows real-time stats, and a full
searchable logbook with analytics. The logbook is stored locally as the source of
truth for personal data; syncing to the Kilter API is optional.

When done, a user can log sends/attempts against browsed climbs, run a tracked
session, and review their history + analytics — all working offline. It does NOT own
the catalog or browser (consumes epic-climb-browser); optional ascent sync consumes
the authenticated path from epic-catalog-sync.

## Research briefs

- `docs/briefs/data-model.md` — Ascent/Bid shapes and the auth-gating of personal data.
- Optional ascent sync auth: covered by the **epic-catalog-sync** `[needs-brief]`.
  Local logbook storage + analytics need no external research (local-first design
  decision, handled at feature-design). No new brief required.

## Foundation references

- `docs/ARCHITECTURE.md` — Module Map §7 (Logbook & Sessions); Conventions (logbook is
  source of truth for personal data; data ownership).
- `docs/SPEC.md` — Capability 4 (Logbook & Session Tracking); Constraints (data
  ownership, offline-first).

## Anticipated child features

Provisional:
- Local logbook store (ascents/attempts, grade votes, quality)
- Session mode with real-time stats
- Logbook history + search + analytics
- Optional ascent sync to the Kilter API
