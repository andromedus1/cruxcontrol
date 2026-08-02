---
id: idea-board-game-effect-presets
created: 2026-08-02
updated: 2026-08-02
tags: [ui, ble]
---

Add playful whole-board background effect presets inspired by simple grid games:

- a Snake-style trail that moves around the board; and
- a simple Pac-Man-style chase/movement scene; and
- a bright beach ball that travels diagonally and bounces off the board edges.

These should follow the protected whole-board-effects idea so recognizable climbing
holds remain visually reserved and unobscured. The existing wave effect machinery may
be a useful motion primitive for moving the patterns across the hold grid. Snake and
the bouncing beach ball are especially useful first candidates: both can stay sparse,
move clearly around reserved climb holds, and expose practical animation-throughput
limits without requiring most LEDs to change every frame.
