---
id: epic-foundation-scaffold
kind: feature
stage: drafting
tags: []
parent: epic-foundation
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# Monorepo Scaffold + App Skeleton

## Brief

Stand up the monorepo and a running React + Vite + TypeScript client app skeleton with
build/test/lint tooling. After this feature, `npm run dev` serves a trivial app, `npm run
build` produces a static bundle, `npm test` runs a (passing) test, and lint/format are
wired. This is the foundation every other feature builds on.

Covers: monorepo layout (`/web` TypeScript PWA + `/ml` Python placeholder), Vite + React +
TS config, Vitest, ESLint + Prettier, a minimal app shell (loading/empty state), and the
data-layer **port interface** stub (an async `query(sql, params)` contract the SQLite
feature will implement). Does NOT cover the actual SQLite worker (sqlite-readpath),
CI/deploy (ci-deploy), the PWA service worker (pwa-shell), or the catalog (catalog-bootstrap).

## Epic context
- Parent epic: `epic-foundation`
- Position: foundation feature — every other foundation feature depends on this skeleton.

## Inherited design decisions
- Monorepo `/web` (TS PWA) + `/ml` (Python); model artifacts later export to `/web/public`.
- React + Vite, client-only SPA, TypeScript throughout `/web`.
- Vitest for tests (pairs with Vite).
- Define the data-layer port (async query interface) here so the rest of the app depends
  on the port, never on wa-sqlite directly (Ports & Adapters).

## Research briefs
- [foundation-pwa-sqlite.md](../../../docs/briefs/foundation-pwa-sqlite.md) — framework + stack rationale.

## Foundation references
- `docs/ARCHITECTURE.md` — Module Map §1 (Data Layer), Conventions (ports & adapters).
