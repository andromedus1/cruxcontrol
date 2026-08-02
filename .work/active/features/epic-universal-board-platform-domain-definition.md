---
id: epic-universal-board-platform-domain-definition
kind: feature
stage: drafting
tags: [data]
parent: epic-universal-board-platform
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Namespaced Identity and Fullride Board Definition

## Brief

Define the provider-neutral identities and immutable board/layout definition model
that downstream rendering, editing, persistence, and control use. Deliver the Kilter
Fullride 7x10 as the first concrete definition, including its geometry, placements,
role metadata, angle rules, and placement-to-LED information from the verified local
catalog/reference material.

This feature prevents bare Kilter IDs and layout constants from escaping into product
features. It does not build a renderer, route editor, controller encoder, board setup
screen, or any non-Kilter definition.

## Epic context

- Parent epic: `epic-universal-board-platform`
- Position in epic: foundation feature — installation composition and catalog
  projection depend on its identity and definition vocabulary.

## Inherited design decisions

- Implement only the low-cost seams needed to keep Kilter assumptions contained;
  defer dynamic plugins and every non-Kilter adapter.
- The home Kilter Fullride 7x10 is the only required physical-board fixture.
- Board definitions are immutable and definition-driven; namespaced identity crosses
  module boundaries instead of bare vendor IDs.
- Provider-native identifiers and revisions remain available beside normalized fields.

## Research briefs

- `.research/analysis/landscapes/climbing-board-ecosystem.md` — grounds the independent
  board-definition axis and warns against assuming protocol universality.
- `docs/briefs/data-model.md` — grounds Fullride products/layouts/sizes, placement and
  hole identity, roles, coordinates, and LED mapping.
- `docs/briefs/hardware-and-protocol.md` — grounds Fullride hardware geometry and LED
  addressing constraints.
- `docs/kilter_fullride_7x10.png` — preserved visual reference for later renderer
  alignment; catalog coordinates remain authoritative.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Domain & Installation Registry; namespaced immutable
  identity and three-axis composition conventions.
- `docs/SPEC.md` — Domain Model (`BoardDefinition`, `ProviderClimbId`, roles and
  layouts) and Kilter-first acceptance scope.
- `docs/PRINCIPLES.md` — Separate the three changing axes; preserve before normalizing.

