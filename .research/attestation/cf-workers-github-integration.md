---
source_handle: cf-workers-github-integration
fetched: 2026-06-14
source_url: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
provenance: source-direct
---

# Cloudflare Workers Builds — GitHub integration (PR previews)

## Summary

Cloudflare Workers Builds' native GitHub integration automatically builds and deploys
on push, generates a preview URL for builds that run `wrangler versions upload`, and
posts the build status as a comment on pull requests. This is the load-bearing source
confirming Workers (not just Pages) offers automatic per-PR preview deployments via the
native Git integration — relevant if preview wiring in GitHub Actions is later judged
not worth maintaining.

## Key passages

> "Cloudflare supports connecting your GitHub repository to your Cloudflare Worker, and
> will automatically deploy your code every time you push a change."

> "A preview URL will be provided for any builds which perform `wrangler versions upload`."

> "If a commit is on a pull request, Cloudflare will automatically post a comment on the
> pull request with the status of the build."
> — § GitHub integration / Pull request comment
