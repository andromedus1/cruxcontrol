---
source_handle: cf-workers-github-actions
fetched: 2026-06-14
source_url: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
provenance: source-direct
---

# Cloudflare Workers — Deploy with GitHub Actions

## Summary

Cloudflare's official Workers CI/CD documentation confirms Workers can be deployed from
GitHub Actions using Cloudflare's official `cloudflare/wrangler-action@v3`. This is the
load-bearing source establishing that the same GitHub-Actions + wrangler-action deploy
path used for Pages also works for Workers Static Assets — so adopting Workers does not
sacrifice the CI-gated GitHub Actions mechanism.

## Key passages

> "You can deploy Workers with GitHub Actions."

> "Cloudflare provides an official action for deploying Workers. Refer to the following
> example workflow which deploys your Worker on push to the `main` branch."
> (example workflow uses `uses: cloudflare/wrangler-action@v3`)
> — § GitHub Actions

> "To create an API token to authenticate Wrangler in your CI job:
> 1. In the Cloudflare dashboard, go to the **Account API tokens** page.
> 2. Select **Create Token**.
> 3. Under **Permission policies**, open the **Custom** dropdown and select **Edit
> Cloudflare Workers**."
> — § API token

> `CLOUDFLARE_ACCOUNT_ID` — "Set to the Cloudflare account ID for the account on which
> you want to deploy your Worker."
> — § API token
