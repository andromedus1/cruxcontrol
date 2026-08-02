---
id: idea-protected-whole-board-effects
created: 2026-08-02
updated: 2026-08-02
tags: [ui, ble]
---

Support whole-board decorative effects around a climb while keeping the climb itself
immediately recognizable. The climb's Start, Middle, Finish, and Foot-only holds use
the four regular reserved Kilter colors, remain static, and receive no animation. The
effect may use every other hold across the board, but its palette must avoid overlapping
or easily-confused colors so the four climbing roles remain visually distinct from the
surrounding spiral, ocean tide, or other effect.

Background-effect membership is independent of climb-role assignment: a user must not
need to mark every unused hold as a lit climb hold just to make it eligible for an effect.
Each effect recipe declares or derives its worst-case active-light reserve and frame rate.
Before playback, the editor accounts separately for route holds, static decorative lights,
and the effect reserve against the physically measured board-capacity profile. It explains
and refuses an unsafe combination without deleting or silently thinning saved design data.
The budget is multi-dimensional—simultaneously lit holds, serialized lights per frame,
requested FPS, and write pacing—not a guessed single hold-count ceiling. Sparse-frame
accounting may be used only if the physical omitted-light semantics probe proves it safe.
