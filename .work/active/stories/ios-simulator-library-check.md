---
id: ios-simulator-library-check
kind: story
stage: done
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
  [font repair](../../archive/story-fix-ios-editor-focus-zoom.md) corrects an undefined typography
  token; its actual native after-update check passed.
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

- Native font-update build/install/launch passed without uninstall/reset. Post-update
  UI retains2finished,2drafts,1Trash,2lists and the exact named V4 draft. Focused
  Name/Grade no longer zoom horizontally. Returned through the normal detail dialog
  and verified Prototype ordered still renders B above A with first/last move controls
  disabled appropriately. Evidence: `/tmp/cruxcontrol-native-list-after-update.json`
  and `/tmp/cruxcontrol-ios-font-fix/`. This is one synthetic native update check;
  it does not establish storage-pressure durability or physical-device behavior.

- Native mixed playlist play-through passed in original order: finished A, draft,
  Trash, then missing local reference. The final position explains that the missing
  climb retains its list position until removed. Evidence: scratch flow and log
  `/tmp/cruxcontrol-native-mixed-next.yaml` and `.log`, plus its screenshot under
  `/tmp/cruxcontrol-native-maestro-mixed-next/`.

- The native export repair passed cancellation, cache cleanup, actual Save to Files
  inspection, and restore/relaunch/re-export in a separate empty simulator.
  Production-codec canonical comparison matches all five records and both ordered
  playlists exactly across the round trip, including the fixture effect recipe,
  Trash and missing-reference membership. The native export feature owns the
  complete implementation/review evidence.

Not yet established: native effect playback interaction, landscape, physical BLE,
durable storage pressure or authentication. These remain explicit prototype
acceptance gaps; this bounded simulator-check story did not promise those outcomes.

## Bounded inline review (2026-10-09)

Approve the scoped synthetic verification after real native interaction and saved
file comparison. The evidence distinguishes simulator proof, browser tests and
physical-device requirements, and concrete encountered app bugs were separately
parked/scoped before repair. No independent story reviewer ran. Prototype documentation is aligned in `9b009c7`. Required aggregate CI passed
at `b10cd97` (run 37975046470: web, iOS prototype, ML; deploy skipped), covering
the tested native implementation. No unresolved findings remain for this story.
