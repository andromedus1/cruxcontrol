---
source_handle: cf-pages-build-config
fetched: 2026-06-14
source_url: https://developers.cloudflare.com/pages/configuration/build-configuration/
provenance: source-direct
---

# Cloudflare Pages — Build configuration (success determined by exit code)

## Summary

Cloudflare's native Git-integration build runs a single configured build command and
marks the build (and therefore the deployment) succeeded or failed purely on that
command's exit code. The docs describe no separate lint/typecheck/test stage; success is
exit-code-only. This is the load-bearing source for the inference that the native Git
integration cannot gate a deploy on a real CI suite unless the suite is folded into the
build command itself.

## Key passages

> "You should provide a build command to tell Cloudflare Pages how to build your
> application." … "The build command is provided by your framework. For example, the
> Gatsby framework uses `gatsby build` as its build command."
> — § "Build commands and directories"

> "Any non-zero return code will cause a build to be marked as failed. An exit code of 0
> will cause the Pages build to be marked as successful."
> — § "Build commands and directories"
