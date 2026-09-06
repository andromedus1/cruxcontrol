---
id: idea-vite-dev-flag-alias
created: 2026-09-05
updated: 2026-09-05
tags: [infra, tests]
---

The new real development-server browser test reproduces an update-error banner after
local runtime opens at d4d0a3a. register-sw aliases import.meta before reading env.DEV,
so Vite does not substitute the development flag and the disabled worker is still
registered. This is incomplete verification of the accepted development-startup fix.
