---
id: epic-build-effects-hardening-curious-bee-review-fixes
kind: story
stage: done
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

## Fix evidence

Reproduced all four seed orientation regressions and the invalid-hover editor crash
before editing. Shape numeric inputs now enforce their displayed finite min/max bounds
before updating recipes. Bee orientation eases through the shortest incoming/outgoing
angle during hover, or the first quarter of departure for zero/short hover, without
changing center trajectories. Dense samples on both sides of all six boundaries and
actual held poses across 61s/120s/179999ms tours pass for seeds 0/7/17/42 and hover
0/.01/.4/.8. Body/Wings controls assert exact packed palette [244,71] and rendered labels;
real browser save/reopen assertions now require the same ordered values.

Focused renderer/editor verification: 36 tests pass. Full integrated checks await the
concurrent backup wave; no rereview is needed under standard review weight.

Verified independently of unfinished backup files in a detached 972d04c checkout:
lint/typecheck/build pass; full Vitest 513 pass, one existing optional private-source
test skips because its untracked local images are absent; all 8 real browser scenarios
pass on dedicated port 4175. Exact Body/Wings values survive save and reopen.
