---
id: epic-foundation-ci-deploy
kind: feature
stage: drafting
tags: [infra, needs-research]
parent: epic-foundation
depends_on: [epic-foundation-scaffold]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-14
---

# CI + Cloudflare Pages Deploy

## Brief

The distribution spine: continuous integration and static deployment so every feature
merges via PR with CI green and ships to a hosted, installable URL.

Covers: a GitHub Actions workflow (install → lint → typecheck → test → build, on PR and on
push to main; a separate `/ml` job lane stub), Cloudflare Pages deploy on merge to main
(static `/web` build output), and branch-protection guidance (PRs required, CI must pass,
no direct pushes/force-pushes to main). Does NOT generate the catalog snapshot (that's
catalog-bootstrap) or implement app features.

## Epic context
- Parent epic: `epic-foundation`
- Position: independent capability — depends only on the scaffold; parallel to sqlite-readpath and pwa-shell.

## Inherited design decisions
- Deploy target: Cloudflare Pages (free, fast, custom-header-capable).
- Repo `andromedus1/cruxcontrol`; CI runs build/test/lint; branch protection enforces the PR/CI-green rule.
- Monorepo: CI has `/web` and `/ml` job lanes.

## Research briefs
- [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md) — §4 (hosting: Cloudflare Pages, static deploy).

## Foundation references
- `docs/ARCHITECTURE.md` — Conventions (static backendless distribution); Key Dependencies (static PWA host).
- Build process: PR & CI Checkpoints (build/test/docker/lint on every PR; apply on merge).

## Notes
- Cloudflare Pages needs a CF account + project + API token (GitHub Actions secret) — flag
  as a setup prerequisite the user must provide; the workflow can be authored and validated
  (build/test) without the deploy secret, with the deploy step gated until the secret exists.

## Design decisions

Captured during `feature-design --only-questions` (2026-06-14):

1. **Deploy mechanism = OPEN — pending research.** The choice between (a) GitHub
   Actions + wrangler/cloudflare-pages-action (CI gates deploy; config in-repo) and
   (b) Cloudflare's native Git integration (CF builds/deploys on push; config in CF
   dashboard) is not yet decided. User asked for a deeper research pass on the best
   path for a distributable static PWA before locking it. Feature tagged
   `[needs-research]`; resolve via `/research` (deploy-mechanism brief) then design.
   Open sub-questions for the research: monorepo `/web` subdir build, preview
   deployments per-PR, how CI-green gates the deploy, and secret/permission surface.
