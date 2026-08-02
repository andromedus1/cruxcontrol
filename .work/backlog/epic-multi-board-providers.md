---
id: epic-multi-board-providers
kind: epic
stage: drafting
tags: [data, ble, needs-research]
parent: null
depends_on: [epic-universal-board-platform, epic-board-control, epic-catalog-sync, epic-climb-browser]
release_binding: null
gate_origin: null
research_refs:
  - .research/analysis/landscapes/climbing-board-ecosystem.md
created: 2026-08-02
updated: 2026-08-02
---

# Multi-Board Providers: Aurora Family and MoonBoard

## Brief

Expand the proven Kilter vertical slice to additional climbing-board communities
through separately verified definitions, catalogs, and controller profiles. Start
with Aurora-family boards where protocol and schema reuse is evidenced; treat
MoonBoard as a distinct provider/controller family.

Provider support is capability-based: browse-only is valid when safe catalog access
exists but publish, sync, or control does not.

## Research gate

Before decomposition, run a provider research program covering current API/export
surfaces, acquisition authority and redistribution constraints, controller generations,
native grades/layout semantics, identity, and catalog distribution feasibility. No
adapter may bypass access controls or infer redistribution permission from technical
reachability.

## Design decisions

- **Delivery status**: deferred until the Kilter Fullride 7x10 product loop is
  complete and in regular use. Andrew's home-board usage dominates; universal-board
  implementation must not delay it. — confirmed 2026-08-02.
- **Future order**: research and implement Aurora-family providers before MoonBoard;
  MoonBoard remains a separate acquisition/controller track.

## Anticipated child features

Deferred until the research gate is complete.
