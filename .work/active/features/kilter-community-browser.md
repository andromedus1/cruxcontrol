---
id: kilter-community-browser
kind: feature
stage: drafting
tags: [ui, data]
parent: null
depends_on: [epic-universal-board-platform-catalog-domain, epic-foundation-catalog-bootstrap]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Browse and light the legacy Kilter community catalog

## Brief

Make the older Kilter community library available for Andrew's Fullride 7x10 in
the working Android/web app. Add a Kilter library destination with explicit
download consent, source/freshness information, offline availability, name/grade/
angle filtering, paginated results and the existing board detail/control surface.
Keep local authoring, playlists and backups independent of catalog availability.

## Strategic decisions

- Andrew prioritized Kilter community access ahead of invited sharing and accepted
  an explicitly labeled older catalog first, followed by current-app coverage,
  on 2026-10-09. This does not establish current first-party catalog coverage.
- Only complete routes compatible with the installed Fullride placements may be
  displayed or lit. Never drop unsupported holds to make a climb fit.
- Reuse the approved responsive browser direction and current design system.
  Mock the new installation, availability and filtering states before production UI.
- Initial acquisition uses the existing privately restored snapshot and same-origin
  manifest. Do not commit community database binaries or publicly deploy them
  without the existing distribution gate. An unavailable download must leave local
  climbs and playlists fully usable.
- No new board manufacturer, Kilter account writeback, shared service, live sync or
  device migration belongs to this slice. Catalog-source absence must remain clear.

## Simplification opportunity

Compose the typed query adapter, existing board renderer and light controller.
Avoid another route editor or copying catalog rows into authored climb storage.

## Mockups

- Existing direction: `.mockups/screens/epic-climb-browser/option-hybrid.html`.
- Installation/filter refinement: `.mockups/screens/kilter-community-browser/index.html`
  (two options generated; selection pending).
- Option 1 — **Source in view**: `.mockups/screens/kilter-community-browser/option-1.html`.
  A persistent source strip keeps installation, progress, cancellation and recovery
  visible beside the older-snapshot label.
- Option 2 — **Catalog on demand**: `.mockups/screens/kilter-community-browser/option-2.html`.
  A compact source/status row opens catalog management in a dialog, leaving more
  room for browsing after installation.
- Both refine the approved list-first phone / split desktop direction with the
  existing design-system tokens, components and motion. A mock toolbar exposes
  not-installed, downloading, installed/offline, failed and unavailable states;
  no mock performs catalog downloads, storage or Bluetooth operations. Synthetic rows
  exercise name/grade/angle filters, pagination and accessible climb details.
- Source wording is **Legacy Kilter / older offline snapshot / no live updates**.
  No freshness date or production route count is asserted. The explicit download
  invitation uses the manifest's rounded 5.1 MB download and 12.4 MB catalog data.

## Acceptance boundary

Browse/filter/select and light installed compatible legacy climbs offline, with
truthful source labels and graceful unavailable/failed download states. Preserve
local authored records and playlist order through installation and browser reload.
The feature's detailed design and integration checks follow mock selection and the
catalog provider/storage contracts.
