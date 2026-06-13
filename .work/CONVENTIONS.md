# Project Conventions

## Release mapping
tag-based

## Tag taxonomy
- ble          board communication: Web Bluetooth, Nordic UART packet protocol, LED commands
- data         catalog + sync pipeline: SQLite, frames encoding, kilterboardapp.com/sync
- ml           grade prediction: feature extraction, training, in-browser inference
- ui           climb browser, board renderer, route editor, logbook surfaces
- perf         throughput, latency, memory — routes to perf-design
- refactor     behavior-preserving structural change ONLY — fails the black-box test (any observable behavior change for callers) means NOT a refactor — routes to refactor-design
- infra        build tooling, deployment, CI, cloud resources
- security     auth, validation, secrets, supply chain
- needs-brief          design needs a curated domain brief first — routes to brief (research-pipeline)
- needs-research       domain needs a research campaign first — routes to research / deep-research / research-program (research-pipeline)

## Slug conventions
kebab-case. Children prefix the parent slug (e.g. `feature-ble-connect` under `epic-ble`).

## Stage overrides
None.

## Terminal-tier retention
delete-refs

## Gate config
gates_for_release: [security, tests, cruft, docs, patterns, infra]

## Design-skill routing
design_skill_routing:
  epic_design: research-pipeline:epic-design
  feature_design: research-pipeline:feature-design
