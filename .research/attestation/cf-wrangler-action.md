---
source_handle: cf-wrangler-action
fetched: 2026-06-14
source_url: https://github.com/cloudflare/wrangler-action
provenance: source-direct
---

# cloudflare/wrangler-action — official deploy action

## Summary

`cloudflare/wrangler-action` is Cloudflare's official GitHub Action for running Wrangler
commands, supporting both Workers and Pages deployments. Its README documents a
`workingDirectory` input for running from a monorepo subdirectory, and shows
`pages deploy` with a `--branch` flag for preview/branch deploys. This is the
load-bearing source for the monorepo (`/web`) deploy ergonomics and the action surface.

## Key passages

> "If you want to deploy your Pages project with GitHub Actions rather than the built-in
> continous integration (CI), then this is a great way to do it."
> — § Pages deployment

> "Optionally, you can also pass a `workingDirectory` key to the action. This will allow
> you to specify a subdirectory of the repo to run the Wrangler command from."
> ```yaml
> workingDirectory: "subfoldername"
> ```
> — § Additional configuration / workingDirectory

> ```yaml
> command: |
>   pages project list
>   pages deploy .vercel/output/static --project-name=demo-actions --branch=test
> ```
> — README example
