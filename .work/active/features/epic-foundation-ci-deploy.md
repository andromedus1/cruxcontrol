---
id: epic-foundation-ci-deploy
kind: feature
stage: done
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

## Implementation Units

### Unit 1: CI workflow
**File**: `.github/workflows/ci.yml`
- Triggers: `pull_request` + `push` to `main`.
- **web jobs** (working-directory `web` or `-w @cruxcontrol/web`): `lint`, `typecheck`,
  `test`, `build`. Node 20+ (`.nvmrc`), `npm ci` at repo root (workspace), cache npm.
  These run NOW (no secrets needed) and are the CI-green gate.
- **`ml` job lane (stub)**: a minimal Python lane (e.g. `ruff --version` / `python -m
  compileall ml` or a clear placeholder step) so the lane exists for epic-grade-prediction.
  Non-blocking-minimal but real (no `expect(true)`-style fakery).
**Acceptance**:
- [ ] Workflow is valid (actionlint clean) and the web jobs pass with the current repo.
- [ ] Jobs run on PR and on push to main.

### Unit 2: Workers deploy job (gated)
**File**: `.github/workflows/ci.yml` (deploy job) + `web/wrangler.jsonc`
```jsonc
// web/wrangler.jsonc
{ "name": "cruxcontrol", "compatibility_date": "2026-06-01",
  "assets": { "directory": "./dist", "not_found_handling": "single-page-application" } }
```
- `deploy` job: `needs: [lint, typecheck, test, build]`, `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`, uses `cloudflare/wrangler-action@v3` with
  `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`,
  `workingDirectory: web`, `command: deploy`. **THE SECRET WALL** — this job needs the two
  secrets (token from the `Edit Cloudflare Workers` template). Author + validate the YAML;
  the deploy executes only once the user adds secrets. Guard so a missing secret produces a
  clear failure, not a silent half-deploy (document that secrets are required).
**Acceptance**:
- [ ] `wrangler.jsonc` is valid and points assets at `dist` with SPA fallback.
- [ ] deploy job is well-formed, `needs:` the CI jobs, main-push-only.

### Unit 3: Setup docs (the user's manual steps)
**File**: `docs/DEPLOY.md` (or a section) — exact steps: create the `Edit Cloudflare
Workers` API token, add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets,
and set branch protection on `main` (PRs required + CI checks must pass). Include the
`gh api` / `gh ruleset` command for branch protection so it's one copy-paste.
**Acceptance**:
- [ ] DEPLOY.md lists token creation, both secrets, and the branch-protection command.

## Implementation Order
1. Unit 1 (CI jobs) — real value now, gates everything.
2. Unit 2 (wrangler.jsonc + gated deploy job).
3. Unit 3 (DEPLOY.md setup steps).

## Testing
- `actionlint` on the workflow (install or use the Go binary if available; else careful
  YAML validation). The web jobs are "tested" by the fact that `lint`/`typecheck`/`test`/
  `build` already pass locally — the workflow just runs them in CI.
- No app-code tests here (infra/config feature).

## Risks
- **Secret wall (expected stop):** the deploy job can't run until the user provides
  secrets + sets branch protection. This is the flagged hand-off point, not a defect.
- **First CI run on the PR that adds the workflow** may behave slightly differently than
  local — **Fallback:** keep jobs simple (`npm ci` + the existing scripts), iterate if the
  first Actions run surfaces env differences.
- **Workers project name collision** — `cruxcontrol` must be unique on the account;
  adjustable in `wrangler.jsonc`.

## Implementation notes

Implemented 2026-06-14 on branch `feat/ci-deploy`. Authored three files plus this item.

**Files:**
- `.github/workflows/ci.yml` — CI + gated deploy.
- `web/wrangler.jsonc` — Workers Static Assets config (name `cruxcontrol`,
  `compatibility_date 2026-06-01`, `assets.directory ./dist`,
  `not_found_handling single-page-application`).
- `docs/DEPLOY.md` — user setup steps (token, secrets, branch protection).

**Job structure (deviation from the unit text, noted):** the design's Unit 2 wrote
`needs: [lint, typecheck, test, build]`, which assumed four separate jobs. The prompt
explicitly offered the simpler/cheaper option of one `web` job with sequential steps.
I took that: a single `web` job runs `npm ci` then lint → typecheck → test → build as
ordered steps (fail-fast within the job), so `deploy` declares `needs: [web]`. Same gate
semantics (any failing web step blocks deploy), one checkout + one `npm ci` instead of four.
The required status-check context is therefore the `web` job name —
`web (lint / typecheck / test / build)` — documented in DEPLOY.md's branch-protection command.

**Triggers:** `pull_request` (all branches) + `push` to `main`.

**ml lane:** real, minimal stub — `actions/setup-python@v5` (3.11) then
`python -m compileall ml`, labeled as a stub. `ml/` currently has only `README.md` +
`pyproject.toml` (no `.py` sources), so this compiles zero files and passes cleanly today;
it becomes a real smoke check once grade-prediction adds sources. No `expect(true)` fakery.
Chose `compileall` over `ruff` because ruff isn't a declared dependency yet (deps `[]`).

**deploy job (the secret wall):** `needs: [web]`,
`if: github.ref == 'refs/heads/main' && github.event_name == 'push'`; checkout →
setup-node (`node-version-file: .nvmrc`, `cache: npm`) → `npm ci` →
`npm run build -w @cruxcontrol/web` → `cloudflare/wrangler-action@v3`
(`apiToken`/`accountId` from secrets, `workingDirectory: web`, `command: deploy`). The two
secrets do not exist, so the deploy step would fail with a clear auth error — it cannot
silently half-deploy. This is the designed stop point.

**Validation performed:**
- `python3 -c "import yaml; yaml.safe_load(...)"` parses the workflow; verified jobs
  `[web, ml, deploy]`, `deploy.needs == [web]`, and the `if` expression.
- All four web scripts pass locally from repo root after `npm ci`:
  `lint`, `typecheck`, `test`, `build` (`-w @cruxcontrol/web`).
- `actionlint` not installed; validated keys/`needs`/`if`/expression syntax by hand.

**Stopped at the secret wall:** no real deploy was attempted; no secrets invented. The
deploy job is authored and valid YAML, gated to main-push, and inert until the user adds
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` and sets branch protection per DEPLOY.md.

## Review record

**Verdict: Approve with comments** (inline review, 2026-06-14; autopilot). Workflow YAML
parses (jobs: web, ml, deploy); `wrangler.jsonc` valid; the web CI scripts pass locally.

- **Important (fixed in review):** the deploy job originally ran on every push to main and
  would fail until secrets exist → a perpetually-red `main`. Added an opt-in gate
  `vars.ENABLE_DEPLOY == 'true'` so the deploy job is *skipped* (green) until the user adds
  secrets and flips the variable. Updated `docs/DEPLOY.md` with a new step 3 (`gh variable
  set ENABLE_DEPLOY --body true`) and renumbered the rest.
- **Secret wall (expected):** live deploy still requires `CLOUDFLARE_API_TOKEN` +
  `CLOUDFLARE_ACCOUNT_ID` (`Edit Cloudflare Workers` token) and `ENABLE_DEPLOY=true`;
  branch protection is a user admin step. All documented in DEPLOY.md. **This is the
  flagged hand-off — no live deploy was attempted.**
- ml lane is a real `compileall` stub (zero files today), honestly labeled.

Advanced `review → done`. NOTE: once this lands on main, CI runs on subsequent PRs;
branch protection should be set so the `web` check actually gates merges.
