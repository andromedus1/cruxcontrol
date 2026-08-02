---
id: epic-route-creation-editor-eyedropper
kind: story
stage: implementing
tags: [ui]
parent: epic-route-creation-editor-workspace
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Advanced Light eyedropper

## Brief

Add an Eyedropper tool to the climb editor. When active, tapping an assigned hold
copies its exact rendered light color into Advanced Light and switches to that tool,
ready to paint other holds. Semantic assignments resolve through the board's role
preset; custom assignments retain their exact packed API3 byte. An unassigned hold
does not change the current tool or draft.

## Simplification opportunity

Keep sampling at the editor composition boundary, which already has both assignments
and the board definition; do not duplicate role-color data in reducer state.

## Verification

- Custom and semantic colors can both be sampled exactly.
- Sampling does not modify or dirty the draft.
- The sampled Advanced Light value can be painted onto another hold.
- Sampling an unassigned hold is a no-op.
