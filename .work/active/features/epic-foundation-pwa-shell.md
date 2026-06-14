---
id: epic-foundation-pwa-shell
kind: feature
stage: drafting
tags: []
parent: epic-foundation
depends_on: [epic-foundation-scaffold]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Offline-First PWA Shell

## Brief

Make the app an installable, offline-first PWA. After this feature the app shell loads
instantly offline and can be installed to the home screen / desktop.

Covers: `vite-plugin-pwa` (Workbox) setup, the web app manifest (name, icons, `start_url`,
`display: standalone`, theme/background), a service worker that precaches the app shell
(cache-first, versioned) and uses network-first for any API calls, an install prompt hook
(`beforeinstallprompt`) with a manual-instructions fallback, and a Lighthouse-installability
check. Explicitly does NOT route the multi-MB `kilter.db` through the SW cache — that lives
in OPFS (catalog-bootstrap). Independent of the SQLite read path; can be built in parallel.

## Epic context
- Parent epic: `epic-foundation`
- Position: independent capability — depends only on the scaffold; parallel to sqlite-readpath and ci-deploy.

## Inherited design decisions
- `vite-plugin-pwa` for manifest + service worker.
- Do NOT cache `kilter.db` in the service worker (OPFS owns it).
- Offline-first: app shell works with no network.

## Research briefs
- [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md) — §4 (PWA + hosting strategy).

## Foundation references
- `docs/ARCHITECTURE.md` — Conventions (offline-first; static backendless distribution).
- `docs/SPEC.md` — Constraints (Distributable PWA, offline-first).
