---
id: epic-universal-board-platform-installation-contracts
kind: feature
stage: drafting
tags: [data]
parent: epic-universal-board-platform
depends_on: [epic-universal-board-platform-domain-definition]
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Installation Registry and Adapter Contracts

## Brief

Define the typed composition boundary that binds a configured board installation to
one immutable board definition and compatible catalog-provider and controller-profile
ports. Capabilities are explicit so consumers can discover whether the active
installation can browse, control, create, publish, import, or sync without coupling to
Kilter-specific infrastructure.

Deliver the minimal single-installation Kilter composition needed by the first
milestone and test substitutes for downstream work. This feature does not build board
inventory/setup UI, multiple installed catalogs, a dynamic plugin loader, Bluetooth
transport behavior, Kilter packet encoding, catalog acquisition, or non-Kilter
adapters.

## Epic context

- Parent epic: `epic-universal-board-platform`
- Position in epic: composition feature — consumes the domain definition and exposes
  the stable seams used by board control and later provider work.

## Inherited design decisions

- Board definition, catalog provider, and controller profile remain independent axes
  joined by an explicit installation.
- Use explicit typed registries and adapters; do not build a dynamic plugin framework
  before multiple real implementations demonstrate the need.
- First-milestone cardinality is one configured Fullride 7x10 installation, while the
  contract avoids hard-coding that restriction into downstream consumers.
- Provider import, publish, authentication, redistribution, and controller support are
  explicit capabilities rather than inferred behavior.

## Research briefs

- `.research/analysis/landscapes/climbing-board-ecosystem.md` — grounds the three-axis
  composition and explicit capability posture.
- `docs/briefs/board-control-web-bluetooth.md` — grounds the controller/transport seam
  and hardware-free adapter testing.
- `docs/briefs/hardware-and-protocol.md` — grounds the first controller-profile family
  without placing protocol logic in the registry.

## Foundation references

- `docs/ARCHITECTURE.md` — Board Domain & Installation Registry, Catalog Providers,
  and Controller Profiles & Transports.
- `docs/SPEC.md` — Board Inventory & Setup capability and `BoardInstallation` model.
- `docs/PRINCIPLES.md` — Separate the three changing axes; isolate external systems.

