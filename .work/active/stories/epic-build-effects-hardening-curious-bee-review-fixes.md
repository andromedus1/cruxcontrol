---
id: epic-build-effects-hardening-curious-bee-review-fixes
kind: story
stage: implementing
tags: [ui, ble, tests]
parent: epic-build-effects-hardening-curious-bee
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Make bee input and orientation safe through every waypoint

Clamp/reject invalid hover edits before they enter editor state. Keep stored codec
validation strict. Turn from incoming to outgoing orientation smoothly during each
hover, with a brief turn while departing when hover is zero/very short. Preserve
continuous center motion and palette/target/capacity behavior. Test actual neighboring
held poses and dense boundary samples for multiple seeds, periods and hover fractions,
including zero. Verify exact Body/Wings selected packed values before and after reload.

Root owns renderer, panel, focused tests and existing spatial browser test. Backup owner
continues disjoint persistence/UI work. Child closes on green verification; parent uses
standard single-pass fix-and-finish, no rereview.
