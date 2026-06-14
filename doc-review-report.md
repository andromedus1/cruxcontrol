# Doc Review Report

**Project:** CruxControl
**Date:** 2026-06-13
**Documents reviewed:** 4 system-level (VISION.md, SPEC.md, ARCHITECTURE.md, AGENTS.md). No module-level planning docs yet; no roadmap (substrate-based — work in `.work/`). Briefs out of scope (lint handles those).
**Passes run:** 1 system-level (fresh-context Sonnet reviewer) + 1 fresh re-audit.
**Issues found (initial):** Critical 0 / High 4 / Medium 3 / Low 2 / Info 1 — all fixed (High + Medium) or noted (Low/Info).

## Pass 1: System-Level

The dominant theme was **rolling-foundation drift**: `epic-foundation`'s decisions (React+Vite, wa-sqlite) were made and implemented, but `ARCHITECTURE.md` still described the framework as undecided and listed `sql.js`.

### High (4) — all FIXED
- **H-1 Framework "not yet chosen"** — `ARCHITECTURE.md` said the framework was deferred; it is React 19 + Vite 6 + TypeScript, implemented in `web/`. → Replaced with the actual decision + brief reference.
- **H-2 `sql.js or OPFS-backed`** — Module Map §1 + frontmatter `decisions[0]` named the rejected approach. → Changed to `wa-sqlite OPFSCoopSyncVFS in a Web Worker (IndexedDB fallback)`.
- **H-3 Key Dependencies stale/incomplete** — listed `sql.js / OPFS` and `ONNX.js / TF.js`; omitted React/Vite + vite-plugin-pwa. → Replaced sql.js row with wa-sqlite; added React+Vite, vite-plugin-pwa rows; ONNX row corrected to ONNX Runtime Web (WASM); Cloudflare Pages named as the host.
- **H-4 Orphaned table row** — the "Static PWA host" row sat outside the table (broken render). → Merged into the Key Dependencies table.

### Medium (3) — all FIXED
- **M-1** SPEC `decisions[0]` said "seven areas"; there are eight (Playlists added). → "eight areas".
- **M-2** VISION + SPEC phrased distribution robustness as a still-pending "framework-selection criterion". → reworded to "the criterion by which the framework (React + Vite) was chosen".
- **M-3** ARCHITECTURE Conventions "Ports & adapters" omitted the Data Layer / `CatalogPort`. → added.

### Low (2) — noted, not blocking
- **L-1** Two independent occurrences of the stale `sql.js` text (body + frontmatter) — both fixed under H-2.
- **L-2** ARCHITECTURE frontmatter `decisions[4]` framework phrasing sharpened to name React + Vite.

### Info (1)
- **I-1** SPEC/VISION list Netlify/Vercel as host alternatives while the epic pinned Cloudflare Pages. Acceptable for vision/spec (they define an acceptable *class*); ARCHITECTURE now names Cloudflare Pages as the current choice.

## Clean Areas
- VISION non-goals / audience / principles — consistent and current.
- SPEC body (capabilities, domain model incl. Playlist, constraints) — fully consistent with the ARCHITECTURE module map.
- ARCHITECTURE modules 2–9, data flow, biggest risks — accurate.
- AGENTS.md — operational substrate instructions only; no stack claims; clean.
- `web/src/data/port.ts` — code was ahead of the docs (correct CatalogPort + wa-sqlite), not behind.

## Cross-reference integrity
All `docs/briefs/*` and `docs/architecture/history/north-star.md` references resolve. CLAUDE.md → AGENTS.md symlink intact.

## Frontmatter compliance
All 4 docs have `description`, `type: planning`, `kind: planning`, `updated` — fully compliant.

## Provenance Summary
Briefs are out of scope for doc-review (knowledge-index lint covers them). The `.research/` corpus is `/brief` (5) + `/deep-research` (1 campaign, 6 specialist briefs + parent + report), all `updated: 2026-06-13`. No refresh candidates (single research pass, all current).

## Re-audit (auto-fix loop — exit gate)

Per the doc-review contract, fresh full audits were dispatched after each fix round; the
loop exits only on an independent audit returning 0 Critical / 0 High. It converged in
3 iterations, each surfacing correlated drift the prior fix exposed:

- **Iteration 1** (initial): 0C / 4H / 3M / 2L / 1I → fixed all H + M.
- **Iteration 2**: 0C / 1H / 2M → residual `ONNX.js / TF.js` in frontmatter + Module §9 (missed by the deps-table fix); "deps listed but not installed" ambiguity. Fixed: ONNX naming, added the intended-dependency-set note.
- **Iteration 3**: 0C / 1H / 1M → Cloudflare Pages hedge in Conventions ("e.g. … / Netlify / Vercel") contradicting the rest; TF.js name leaked into the deps table. Fixed both.
- **Iteration 4 (exit gate): 0 Critical / 0 High — CLEAN** across all 11 checks (stale-tech, rolling-foundation prose, host consistency, capabilities count, module map, cross-doc consistency, deps honesty, cross-references, frontmatter, tables, AGENTS).

**Outcome: PASS.** Foundation docs are internally consistent and aligned with the
implemented code. The Low/Info items (history link label; 9-modules-vs-8-capabilities, which
is intentional — Data Layer is infra) were addressed or noted; none blocking.

Knowledge-index detail layer was updated in-step for the changed `decisions:` (SPEC capability
count; ARCHITECTURE stack + ONNX decisions).
