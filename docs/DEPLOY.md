---
description: Read when configuring deployment or maintaining the live private-backup resources
type: planning
kind: planning
updated: 2026-10-18
summary: >
  Operator runbook for the CI-gated Cloudflare Workers Static Assets deployment,
  including secrets, opt-in enablement, branch protection, and verification, plus
  preservation requirements for the live Android private-backup resources.
decisions:
  - "Deploy only from a green main-branch CI run after explicit ENABLE_DEPLOY opt-in."
  - "Use least-scope Cloudflare credentials stored as GitHub repository secrets."
  - "Protect main and ship application changes through pull requests."
---

# Deploy

CruxControl is configured to deploy as a static SPA to **Cloudflare Workers (Static Assets)**. CI
(`.github/workflows/ci.yml`) runs lint / typecheck / test / build on every PR and
on push to `main`; the `deploy` job runs **only on push to `main`**, **only
after the `web` CI lane is green** (`needs: [web]`), and **only once you opt in**
by setting the repo variable `ENABLE_DEPLOY=true` (step 3 below).

The deploy job is inert until you complete the one-time setup below. The
`ENABLE_DEPLOY` gate keeps `main` green until you're ready — without it the deploy
job is simply skipped (not failed). Once enabled, a missing secret fails with a
clear authentication error rather than a silent half-deploy.

## Live private-backup resources

The Android vault is separate from static-site deployment. Its proof-named resources
hold Andrew's real `library-v1` backups: project `cruxcontrol-auth-20261010`, bucket
`cruxcontrol-auth-20261010-vault-proof`, service account
`crux-vault-proof@cruxcontrol-auth-20261010.iam.gserviceaccount.com` and function
`privateVaultProof`. Do not delete/recreate them or detach billing as prototype
cleanup. Replacement or renaming requires verified backup migration and an app
endpoint update before the old service is retired; the installed Android app uses
a compiled endpoint. See the [vault operations guide](../prototypes/firebase-vault/README.md).

Keep verified owner-controlled library exports and signing recovery material outside
the checkout. Git-ignored `.private-signing/` and `.private-firebase/` are not safe
from `git clean -fdx` or `git clean -X`; preserve their necessary contents before
any checkout cleanup.

## Private catalog publication

The Kilter catalog is re-hosted privately in the same Firebase project but in
separate, catalog-named resources: bucket `cruxcontrol-auth-20261010-catalog`, reader
`crux-catalog-reader@…` (function runtime), publisher `crux-catalog-publisher@…` (CI
only, create + read on the catalog bucket, no delete), workload identity pool
`github-actions` / provider `cruxcontrol-catalog`, and function `privateCatalog`
(codebase `private-catalog`). None of them has access to the vault bucket, and
provisioning never modifies vault resources. Catalog objects are immutable: a version
is published once `kilter-7x10/manifests/v<NNNNNN>.json` exists beside its artifact.

The scheduled workflow `.github/workflows/catalog-publish.yml` is inert until enabled.
One-time operator setup, using the isolated Firebase CLI configuration kept outside
Git (see the [vault operations guide](../prototypes/firebase-vault/README.md)):

1. Inspect, then provision, then inspect again (expect no problems):
   `XDG_CONFIG_HOME=/outside/git/firebase-cli-config node prototypes/firebase-vault/provision-catalog.mjs /outside/git/catalog-evidence cruxcontrol-auth-20261010 inspect`
   (repeat with `provision`, then `inspect`).
2. Bootstrap version 1 from the private legacy artifact directory (manifest and
   `kilter-7x10.v1.db.gz`): same command with `bootstrap /path/to/legacy-catalog`.
3. Build the gateway (`npm --prefix prototypes/firebase-vault/catalog-gateway ci --ignore-scripts && npm --prefix prototypes/firebase-vault/catalog-gateway test`),
   prepare a deploy package outside Git with
   `node prototypes/firebase-vault/prepare-catalog.mjs /outside/git/auth-evidence/session.json /outside/git/new-catalog-package cruxcontrol-auth-20261010`,
   and deploy only that codebase from the package directory:
   `firebase deploy --only functions:private-catalog --project cruxcontrol-auth-20261010`.
4. Set repository variables (identifiers, not secrets): `CATALOG_BUCKET`,
   `CATALOG_PUBLISHER_SA`, `CATALOG_WIF_PROVIDER`
   (`projects/839726977905/locations/global/workloadIdentityPools/github-actions/providers/cruxcontrol-catalog`),
   then `CATALOG_PUBLISH_ENABLED=true`.
5. Dispatch the workflow once (expect `published`, version 2), dispatch again (expect
   `unchanged`), and confirm the owner's token reads `/catalog-v1/manifest` while
   another account receives 403.

**Held updates.** When the safety checks hold a build (a previously visible climb
would be lost, present climbs fall more than 2%, more than 250 are newly removed, or
upstream is older or changed layout), nothing is published and one "Catalog update
held by safety checks" issue is opened or updated with counts and reasons. Review the
upstream change; if it is legitimate, adjust the thresholds in
`web/scripts/catalog/guards.py` through a reviewed change. Never delete published
versions to force an update.

## 1. Create a Cloudflare API token

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token**.
2. Use the **`Edit Cloudflare Workers`** template.
3. Scope it to the account that will host the Worker; create the token and copy it
   (shown once).
4. Note your **Account ID** (Workers & Pages → account home, right sidebar).

## 2. Add the repo secrets

Add both secrets to the GitHub repo (`andromedus1/cruxcontrol`). Via the UI:
**Settings → Secrets and variables → Actions → New repository secret**. Or via `gh`:

```sh
gh secret set CLOUDFLARE_API_TOKEN   --repo andromedus1/cruxcontrol   # paste the token
gh secret set CLOUDFLARE_ACCOUNT_ID  --repo andromedus1/cruxcontrol   # paste the account id
```

| Secret                  | Source                                              |
| ----------------------- | --------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | The `Edit Cloudflare Workers` token from step 1     |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                               |

The Worker name is `cruxcontrol` (see `web/wrangler.jsonc`); it must be unique on
the account. Change it there if it collides.

## 3. Enable deploys (opt-in variable)

The `deploy` job is gated on a repo **variable** so `main` stays green until you're
ready. Once the secrets above exist, flip it on:

```sh
gh variable set ENABLE_DEPLOY --body true --repo andromedus1/cruxcontrol
```

Until `ENABLE_DEPLOY=true`, the deploy job is skipped on every push to `main`
(green, not red). Set it back to `false` (or delete it) to pause deploys.

## 4. Protect the `main` branch

Require PRs and require the CI checks to pass before merge (no direct or
force-pushes to `main`). The status check name is **`web (lint / typecheck /
test / build)`** — the `name:` of the `web` job. Copy-paste:

```sh
gh api -X PUT repos/andromedus1/cruxcontrol/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{ "context": "web (lint / typecheck / test / build)" }]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

> The status check only appears in GitHub's list after the workflow has run at
> least once. If the API rejects the context as unknown, open one PR first so the
> `web` job reports, then apply the protection rule.

## 5. Verify

After the secrets exist, `ENABLE_DEPLOY=true` is set, and branch protection is on,
merge a PR to `main`. The
`web` lane runs, and on success the `deploy` job builds `web/dist` and runs
`wrangler deploy` against Cloudflare Workers. The app is then live at the
Worker's `*.workers.dev` URL (or a custom domain you bind in Cloudflare).
