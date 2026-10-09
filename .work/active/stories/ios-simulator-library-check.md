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
