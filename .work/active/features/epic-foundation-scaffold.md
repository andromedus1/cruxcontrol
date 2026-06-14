---
id: epic-foundation-scaffold
kind: feature
stage: review
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

## Design decisions

Resolved with judgment under autopilot (inheriting epic decisions):
- **Package manager**: npm with workspaces (`workspaces: ["web"]`). Ubiquitous, zero extra install, simplest CI. `/ml` is a sibling dir, NOT an npm workspace (Python).
- **React 19** (current stable) + **Vite 6** + **TypeScript 5** (strict). React for ecosystem depth per the brief.
- **Vitest** + **@testing-library/react** + **jsdom** for the web test env.
- **ESLint 9 flat config** + **Prettier**.
- **Node 20 LTS** (`engines` + `.nvmrc`).
- The data-layer **port** is an interface + a mock impl here; the real wa-sqlite adapter lands in `epic-foundation-sqlite-readpath`.

## Architectural choice

**Options considered:** (a) npm workspaces monorepo; (b) pnpm workspaces; (c) Nx/Turborepo.
Chose **(a) npm workspaces** — the repo has exactly one JS package (`/web`) plus a Python
dir (`/ml`); a build-orchestrator (Nx/Turbo) or pnpm is unearned complexity for a
two-directory layout, and npm is already present everywhere (CI, contributors). Revisit only
if `/web` later splits into multiple JS packages.

The **data-layer port** is defined here as a pure TypeScript interface with NO wa-sqlite
dependency, so the whole app compiles and tests against the port (via a mock) before the
Worker adapter exists — Ports & Adapters, and it unblocks `pwa-shell`/`ci-deploy` to build in
parallel without waiting on the SQLite Worker.

## Implementation Units

### Unit 1: Monorepo root
**Files**: `package.json` (root), `.gitignore`, `.nvmrc`, `README.md`
```jsonc
// package.json (root)
{
  "name": "cruxcontrol",
  "private": true,
  "workspaces": ["web"],
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "npm -w web run dev",
    "build": "npm -w web run build",
    "test": "npm -w web run test",
    "lint": "npm -w web run lint"
  }
}
```
**Implementation Notes**: `.gitignore` covers `node_modules/`, `web/dist/`, `*.local`, OPFS/test artifacts. `/ml` is referenced in README but not a workspace.
**Acceptance Criteria**:
- [ ] `npm install` at root installs the `web` workspace.
- [ ] `.gitignore` excludes `node_modules` and `web/dist`.

### Unit 2: Vite + React + TS app config
**Files**: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.node.json`, `web/index.html`
```typescript
// web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
```
**Implementation Notes**: `tsconfig.json` strict, `moduleResolution: "bundler"`, `jsx: "react-jsx"`. Vitest config lives in `vite.config.ts` (no separate vitest config). `web/package.json` scripts: `dev`/`build`/`preview`/`test`/`lint`/`format`/`typecheck`.
**Acceptance Criteria**:
- [ ] `npm run build` emits a static bundle to `web/dist/`.
- [ ] `npm run typecheck` passes with strict mode.

### Unit 3: App shell
**Files**: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/test-setup.ts`
```tsx
// web/src/App.tsx
export function App() {
  return (
    <main>
      <h1>CruxControl</h1>
      <p>Loading…</p>
    </main>
  );
}
```
**Implementation Notes**: `main.tsx` mounts `<App/>` to `#root`. `test-setup.ts` imports `@testing-library/jest-dom`. Keep the shell trivial — real UI is downstream epics.
**Acceptance Criteria**:
- [ ] `App.test.tsx` renders `<App/>` and asserts the "CruxControl" heading is present (passing test).

### Unit 4: Data-layer port + mock
**Files**: `web/src/data/port.ts`, `web/src/data/mock-port.ts`, `web/src/data/port.test.ts`
```typescript
// web/src/data/port.ts
export type SqlValue = string | number | null | Uint8Array;
export type Row = Record<string, SqlValue>;

/** Read-only access to the local Kilter catalog. Implemented by the wa-sqlite
 *  Worker adapter (epic-foundation-sqlite-readpath); mocked in tests. */
export interface CatalogPort {
  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}
```
**Implementation Notes**: `mock-port.ts` exports `MockCatalogPort` returning canned rows (constructor takes a `Map<string, Row[]>` or a default fixture) so UI/tests run with no Worker. NO wa-sqlite import in this unit.
**Acceptance Criteria**:
- [ ] `port.test.ts` exercises `MockCatalogPort.query(...)` returning seeded rows and `isReady()` → true.
- [ ] `port.ts` has zero runtime dependencies (interface + types only).

### Unit 5: Lint/format config
**Files**: `eslint.config.js` (root, flat), `.prettierrc.json`, `web/package.json` lint scripts
**Implementation Notes**: ESLint 9 flat config with `typescript-eslint` + `eslint-plugin-react-hooks`; Prettier for formatting. Lint targets `web/src`.
**Acceptance Criteria**:
- [ ] `npm run lint` passes clean on the scaffold.

### Unit 6: /ml placeholder
**Files**: `ml/README.md`, `ml/pyproject.toml`
**Implementation Notes**: Minimal `pyproject.toml` (project name `cruxcontrol-ml`, Python ≥3.11, no deps yet) + a README stating epic-grade-prediction fills this in. Establishes the monorepo layout only.
**Acceptance Criteria**:
- [ ] `ml/` exists with a valid `pyproject.toml` and README; not part of the npm workspace.

## Implementation Order
1. Unit 1 (root) — establishes the workspace.
2. Unit 2 (Vite/TS config) — app builds.
3. Unit 3 (app shell) — first passing test.
4. Unit 4 (port + mock) — the contract downstream depends on.
5. Unit 5 (lint/format) — quality gate green.
6. Unit 6 (/ml placeholder) — completes the monorepo shape.

## Testing
### Unit tests: `web/src/**/*.test.tsx?`
- `App.test.tsx` — renders the shell heading.
- `port.test.ts` — `MockCatalogPort` returns seeded rows; `isReady()`/`close()` behave.
### Integration
- Build smoke: `npm run build` produces `web/dist/index.html` (verified in implement + later by ci-deploy).

## Risks
- **React 19 / ESLint 9 flat-config churn** — both are current but evolve; pin exact versions in `package.json` and commit the lockfile. **Fallback**: drop to React 18.3 if a 19-specific issue blocks (the app shell uses no 19-only APIs).
- **Port shape vs wa-sqlite reality** — `query()` returns `Row[]`; if wa-sqlite's result shape needs columns/values separately, the adapter maps to this shape (the port stays consumer-shaped). Low risk — the port is intentionally minimal.

## Implementation notes (2026-06-13)

Implemented all 6 units. **Verification (all green):** `typecheck` ✓, `lint` ✓, `test` ✓
(4/4: App heading + MockCatalogPort seed/empty/close), `build` ✓ (→ `web/dist`, 194 kB / 60.85 kB gzip).

Files: root `package.json` (npm workspaces) · `.gitignore` · `.nvmrc` · `README.md` ·
`web/{package.json,vite.config.ts,tsconfig.json,index.html,eslint.config.js,.prettierrc.json}` ·
`web/src/{main,App,App.test,test-setup}.tsx?` · `web/src/data/{port,mock-port,port.test}.ts` ·
`ml/{pyproject.toml,README.md}` · `package-lock.json`.

**Deviations from the design (intentional):**
- **Lint/format config lives in `web/`** (`web/eslint.config.js`, `web/.prettierrc.json`),
  not repo root — cleaner with the JS tooling all in the `web` workspace.
- **Single `tsconfig.json`** (no project references / `tsc -b`); build is
  `tsc --noEmit && vite build` — less fragile than the references setup.
- **Vitest bumped 2 → 3** (`^3.0.0`, resolved 3.2.6) and `vite.config.ts` imports
  `defineConfig` from `vitest/config`. Vitest 2.1 nested its own Vite 5, conflicting with the
  app's Vite 6 `Plugin` types; Vitest 3 + Vite 6 is the matched pair and dedupes Vite to 6.4.3.
- Added `@eslint/js` + `globals` devDeps (needed by the flat config) and an
  `argsIgnorePattern: '^_'` no-unused-vars rule (intentionally-unused params like the mock's `_params`).

**Follow-up for gate-security (not blocking the scaffold):** `npm install` reports 6
advisories (2 moderate, 3 high, 1 critical) in the transitive dependency tree. Triage at the
release security gate (`aw:gate-security`) — likely deep dev-only transitive deps; do not
`audit fix --force` blindly (breaking changes).
