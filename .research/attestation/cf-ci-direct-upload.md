---
source_handle: cf-ci-direct-upload
fetched: 2026-06-14
source_url: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
provenance: source-direct
---

# Cloudflare — Use Direct Upload with continuous integration (GitHub Actions)

## Summary

Cloudflare's official guide for deploying via continuous integration documents the
canonical GitHub Actions workflow using `cloudflare/wrangler-action@v3` with a
`pages deploy` command, the two required secrets (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`), the exact API token permission scope (Account → Cloudflare
Pages → Edit), and the branch-triggering behavior. This is the load-bearing source for
the GitHub-Actions deploy recipe and its secret/permission surface.

## Key passages

> ```yaml
> on: [push]
> jobs:
>   deploy:
>     runs-on: ubuntu-latest
>     permissions:
>       contents: read
>       deployments: write
>     name: Deploy to Cloudflare Pages
>     steps:
>       - name: Checkout
>         uses: actions/checkout@v6
>       - name: Deploy
>         uses: cloudflare/wrangler-action@v3
>         with:
>           apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
>           accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
>           command: pages deploy YOUR_DIRECTORY_OF_STATIC_ASSETS --project-name=YOUR_PROJECT_NAME
>           gitHubToken: ${{ secrets.GITHUB_TOKEN }}
> ```
> — § "Set up a workflow"

> "Under **Permissions**, select _Account_, _Cloudflare Pages_ and _Edit_"
> — § "Generate an API Token" (step 5)

> "This workflow automatically triggers on the current git branch, unless you add a
> `branch` option to the `with` section."
> — § Direct Upload with CI/CD
