# Deploy

CruxControl ships as a static SPA to **Cloudflare Workers (Static Assets)**. CI
(`.github/workflows/ci.yml`) runs lint / typecheck / test / build on every PR and
on push to `main`; the `deploy` job runs **only on push to `main`** and **only
after the `web` CI lane is green** (`needs: [web]`).

The deploy job is inert until you complete the one-time setup below. Without the
two repo secrets it will fail with a clear authentication error — it cannot do a
silent half-deploy.

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

## 3. Protect the `main` branch

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

## 4. Verify

After the secrets exist and branch protection is on, merge a PR to `main`. The
`web` lane runs, and on success the `deploy` job builds `web/dist` and runs
`wrangler deploy` against Cloudflare Workers. The app is then live at the
Worker's `*.workers.dev` URL (or a custom domain you bind in Cloudflare).
