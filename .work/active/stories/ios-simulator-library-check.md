---
id: ios-simulator-library-check
kind: story
stage: implementing
tags: [infra, ui]
parent: null
depends_on: [ios-simulator-build-smoke]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Exercise the native simulator library workflow

## Brief

Continue Andrew's authorized iPhone preparation after native startup succeeds.
Exercise the existing prototype guide's interactive checklist in the isolated
simulator with synthetic records. Record actual outcomes and file concrete gaps;
this proof does not select a production storage, authentication or BLE solution.

## Bounded approach and acceptance

- Install a local simulator interaction tool if needed; Maestro's official CLI
  documentation supports accessibility-driven Xcode simulator interactions.
  Keep tool output and temporary interaction flows outside Git. Use no cloud runs.
- Exercise navigation, create/edit/grade/save and relaunch through the actual
  packaged WKWebView. Attempt the existing synthetic backup restore/export
  checklist through normal UI; inspect saved content where file handling works.
- Record success and failure precisely, with reproducible steps and screenshots
  outside Git. Park verified application gaps before repair; never replace a
  failing native operation with browser-only evidence.
- Use only the isolated synthetic simulator, never Andrew's phone or personal
  browser storage. No clear-data/reset shortcuts.
- Update the prototype guide and iOS epic's evidence through the documentation
  workflow. Full native acceptance remains open for unexercised or failing checks.

## Simplification and execution

Reuse the packaged prototype, existing fixture and checklist. No second native
shell, production testing framework or app-only test hook. Current host owns
the cohesive verification; standard bounded inline story review. The native
startup dependency has verified implementation at review. Tooling installation
is covered by the migration/resumption instruction; no strategic question remains.

Grounding: [Maestro CLI installation](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli)
and [iOS interaction model](https://docs.maestro.dev/get-started/supported-platform/ios),
checked 2026-10-09. This selects a local verification tool only.

## Native interaction evidence (2026-10-09)

- Installed Maestro2.11.0 through its official Homebrew tap (including OpenJDK27).
  Runs use an explicit isolated simulator and command-scoped Xcode/JDK settings;
  analytics/update checks are disabled and no cloud runs are used. Scratch flows,
  screenshots and hierarchy output stay under `/tmp/cruxcontrol-native-*`.
- Actual packaged WKWebView: created `Simulator grade check`, entered gradeV4
  separately, returned after save, terminated/relaunched, and verified the draft
  still displays its exact name,40degree angle andV4 grade. Normal startup showed
  disconnected; explicit Connect changed to Bluetooth unavailable on the simulator.
- Found and parked editor focus zoom. The scoped
  [font repair](story-fix-ios-editor-focus-zoom.md) corrects an undefined typography
  token; its actual native after-update check is pending.
- Download library backup reports started but creates no file/sheet. Native log
  proves LaunchServices rejects its blob URL with Code115. The scoped
  [native export feature](../features/epic-ios-controller-bridge-backup-export.md)
  owns that repair and the complete inspected export/restore round trip.
- Served only the committed synthetic fixture on loopback port8792, downloaded
  through simulator Safari, then selected it using the normal app file picker.
  Review showed4climbs (1inTrash) and2playlists; explicit Add restored them. The
  previously created synthetic V4 draft remained. Actual destinations show2finished,
  2drafts,1Trash and2lists. No JavaScript/storage injection supplied these records.
- Opened Prototype ordered and verified B first (Move up disabled) then A last
  (Move down disabled), matching the fixture's membership order. Pre-update native
  hierarchies are `/tmp/cruxcontrol-native-list-before-{a,b}.json`.
- Before native font-update installation, terminated the app and cold-copied its
  isolated synthetic data container to `/tmp/cruxcontrol-native-before-font-update`.
  This is diagnostic simulator evidence, not a successful app backup export.

Not yet established: full native exported-record comparison, restore into a second
simulator, update preservation, mixed-list missing reference/effect interaction,
landscape, physical BLE, durable storage pressure or authentication.
