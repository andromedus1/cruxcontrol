---
id: epic-foundation-ci-deploy
kind: feature
stage: drafting
tags: [infra]
parent: epic-foundation
depends_on: [epic-foundation-scaffold]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-14
---

# CI + Cloudflare Workers (Static Assets) Deploy

## Brief

The distribution spine: continuous integration and static deployment so every feature
merges via PR with CI green and ships to a hosted, installable URL.

Covers: a GitHub Actions workflow (install → lint → typecheck → test → build, on PR and on
push to main; a separate `/ml` job lane stub), Cloudflare Workers (Static Assets) deploy
on merge to main via `cloudflare/wrangler-action` — gated behind the CI jobs with
`needs:` so a red check blocks the deploy — and branch-protection guidance (PRs required,
CI must pass,
no direct pushes/force-pushes to main). Does NOT generate the catalog snapshot (that's
catalog-bootstrap) or implement app features.

## Epic context
- Parent epic: `epic-foundation`
- Position: independent capability — depends only on the scaffold; parallel to sqlite-readpath and pwa-shell.

## Inherited design decisions
- Deploy target: Cloudflare Workers (Static Assets), custom-header-capable (`_headers`).
- Repo `andromedus1/cruxcontrol`; CI runs build/test/lint; branch protection enforces the PR/CI-green rule.
- Monorepo: CI has `/web` and `/ml` job lanes.

## Research briefs
- [cloudflare-deploy](../../../.research/briefs/cloudflare-deploy/parent.md) — **resolves the deploy path**: Workers Static Assets + GitHub Actions + wrangler-action, CI-gated.
- [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md) — §4 (hosting/PWA; its Pages recommendation is superseded by cloudflare-deploy).

## Foundation references
- `docs/ARCHITECTURE.md` — Conventions (static backendless distribution); Key Dependencies (static PWA host).
- Build process: PR & CI Checkpoints (build/test/docker/lint on every PR; apply on merge).

## Notes
- Cloudflare Workers deploy needs a CF account + API token (GitHub Actions secret) — flag
  as a setup prerequisite the user must provide; the workflow can be authored and validated
  (build/test) without the deploy secret, with the deploy step gated until the secret exists.
- Token: create from the **`Edit Cloudflare Workers`** API token template; secrets
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

## Design decisions

Resolved via the [cloudflare-deploy](../../../.research/briefs/cloudflare-deploy/parent.md)
research pass (2026-06-14), after an initial `--only-questions` pass left it open:

1. **Deploy target = Cloudflare Workers (Static Assets), not Pages.** Cloudflare
   officially recommends Workers over Pages for new static SPAs; Workers has full parity
   for our needs (Git builds, PR previews, GitHub Actions deploy, `_headers` for
   COOP/COEP). `wrangler.jsonc` carries `assets.directory` +
   `not_found_handling: single-page-application`.
2. **Deploy mechanism = GitHub Actions + `cloudflare/wrangler-action@v3`** (NOT the
   native Git integration). The deploy job declares `needs: [lint, typecheck, test]` so a
   red check blocks the deploy — the native integration only gates on the build command's
   exit code, which can't enforce a separate test suite. Config lives in git; running
   build/test in Actions also avoids Cloudflare's native build quota. `cloudflare/pages-action`
   is deprecated — `wrangler-action` is the unified, supported action.
3. **Previews** = per-PR/branch preview deploys via wrangler branch/version flags; the
   native Workers Git integration can be layered later for free previews if the Actions
   wiring isn't worth maintaining.

Open implementation sub-questions (for feature-design / implement): exact monorepo
`workingDirectory` vs `deploy web/dist`, preview-deploy wiring specifics, and verifying
the Workers Static Assets per-file size limit for the catalog snapshot.
