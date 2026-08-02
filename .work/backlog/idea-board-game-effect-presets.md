---
id: idea-board-game-effect-presets
created: 2026-08-02
updated: 2026-08-02
tags: [ui, ble]
---

Add playful whole-board background effect presets inspired by simple grid games:

- a Snake-style trail that moves around the board; and
- a simple Pac-Man-style chase/movement scene; and
- a bright beach ball that travels diagonally and bounces off the board edges;
- a Pong-style ball ricocheting between two sparse paddles, optionally with a minimal
  score/serve beat; and
- an occasional flock of birds that crosses the background in a loose shifting formation,
  with calm empty intervals between fly-bys rather than constant visual noise.

These should follow the protected whole-board-effects idea so recognizable climbing
holds remain visually reserved and unobscured. The existing wave effect machinery may
be a useful motion primitive for moving the patterns across the hold grid. Snake and
the bouncing beach ball are especially useful first candidates: both can stay sparse,
move clearly around reserved climb holds, and expose practical animation-throughput
limits without requiring most LEDs to change every frame.

Each recipe must declare its worst-case active-light footprint. On the measured API-2
controller path, omitted lights replace rather than update the existing scene, so every
frame must include the complete route + static decoration + effect and stay within the
127-light ceiling. Pong, a short snake, one Pac-Man figure, a small beach ball, and a
sparse bird flock are attractive because their reserved footprints are predictable even
though the whole scene must be retransmitted.
