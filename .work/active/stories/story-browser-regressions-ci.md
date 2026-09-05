---
id: story-browser-regressions-ci
kind: story
stage: implementing
tags: [infra]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Gate the build on browser persistence and session checks

## Brief

Run the existing Chromium Playwright scenarios in the web CI job after the production
build. Andrew approved the review recommendations and wants continued progress toward
later dogfooding. Browser coverage protects saved climbs, restore behavior, playlist
membership/sharing and the screen-awake session control. Preserve the existing CI job
identity and deployment dependency so a browser failure prevents deployment.

## Design and acceptance

- Install the lockfile-selected Playwright Chromium browser and Linux system dependencies.
- Run the existing workspace e2e command against the freshly built app.
- CI must refuse focused tests and must start its own preview server rather than reusing
  an unknown one. Keep convenient local server reuse.
- Retain failure traces/screenshots as a bounded GitHub artifact; no user data is involved
  because scenarios use isolated synthetic browser profiles.
- Verify locally and through a pull-request CI run, using repository-owner authentication
  scoped to each command. Never change the user's global active GitHub account.
- Document the relevant CI behavior and project-specific GitHub access in existing docs.

## Simplification opportunity

Reuse the current web job, workspace command and six browser scenarios. Avoid a second
build job or new testing framework. Existing deploy `needs: [web]` inherits the new gate.

## Related work

Implements the browser-CI recommendation in `epic-build-effects-hardening` and clears
remote verification for `story-screen-wake-lock`. No database migration or production
animation changes are included.
