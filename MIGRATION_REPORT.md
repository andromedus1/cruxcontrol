# Migration Report — agile-workflow substrate bootstrap

**Date:** 2026-06-13
**Mode:** bootstrap
**Source shape:** greenfield (foundation docs only, no source code, no prior tracking)

## Foundation docs (detected, preserved)

- `docs/VISION.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md` — produced just before
  bootstrap by reshaping the original combined ideation doc.
- `docs/briefs/hardware-and-protocol.md`, `docs/briefs/data-model.md` — domain
  research briefs (`kind: research`).
- `docs/architecture/history/north-star.md` — the original ideation doc, retired
  to history (`kind: historical`, superseded by VISION/SPEC/ARCHITECTURE).

## Artifact inventory (Phase 1.7)

No legacy tracking docs, agent entrypoints, skill roots, or rules trees existed
prior to bootstrap. No convergence candidates. `cleanup_scope: preserve-only`.

## Items seeded

None — greenfield. The `.work/` skeleton is empty. Run
`/research-pipeline:epicize` to seed epics from the foundation docs.

## Entrypoint model

`agents-canonical` (no prior `CLAUDE.md`/`AGENTS.md`). Created:
- `AGENTS.md` — canonical instruction file with the slim agile-workflow section.
- `CLAUDE.md` → `AGENTS.md` symlink (Claude Code compatibility pointer).
- `.agents/rules/agile-workflow.md` — plugin-managed behavioral rules.

## Conventions chosen

- **Release mapping:** tag-based
- **Tag taxonomy:** ble, data, ml, ui, perf, refactor, infra, security
  (+ needs-brief / needs-research routing tags)
- **Gate config:** security → tests → cruft → docs → patterns → infra
- **Terminal-tier retention:** delete-refs
- **Design-skill routing:** research-pipeline:epic-design /
  research-pipeline:feature-design (research-pipeline plugin installed)
- **Slug conventions:** kebab-case, child slugs prefix the parent slug

## Cleanup / reference-integrity actions

None required — nothing legacy to move or remove. (A `CLAUDE.md` symlink was
inadvertently created in the agile-workflow plugin directory during bootstrap
and immediately removed; the plugin repo is unaffected.)

## work-view

Installed prebuilt `aarch64-apple-darwin` binary, `work-view 0.11.3`, at
`.work/bin/work-view`.

## Next steps

1. `/research-pipeline:epicize` — decompose the architecture + briefs into epics
   (this maps the retired Phase 0–3 roadmap into epic items with `depends_on`
   chains).
2. `/research-pipeline:knowledge-index` — regenerate the knowledge index so the
   foundation docs, briefs, and epics are all indexed.
3. Per epic: `/research-pipeline:epic-design` → `/research-pipeline:feature-design`
   → `/agile-workflow:implement-orchestrator` → `/agile-workflow:review`.
