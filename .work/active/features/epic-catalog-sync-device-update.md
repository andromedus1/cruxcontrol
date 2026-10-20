---
id: epic-catalog-sync-device-update
kind: feature
stage: implementing
tags: [data, security]
parent: epic-catalog-sync
depends_on: [epic-catalog-sync-snapshot-normalize, epic-catalog-sync-private-publish]
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Signed-In Catalog Update Check and Atomic Install on Android

## Brief

Let the Android app learn about and install newer catalog versions from the private
endpoint. The app checks occasionally (and on demand from Manage) while signed in,
compares the offered version with the installed receipt, and shows a summary prompt
(for example new and removed-upstream counts). Installing is an explicit tap. The
existing A/B OPFS install verifies hash, sizes and schema, swaps only on success,
keeps the current catalog on any failure, and never installs a lower version.

This extends today's same-origin, install-once flow (schema-3 manifest parsing lands
earlier, in \`catalog-semantics\`): the bootstrap path gains an authenticated remote origin
(a compiled, validated endpoint in the style of the vault config), and `service.ts`
re-checks for offers when a catalog is already installed. The bundled older snapshot
remains a valid offline seed. Catalog work stays fully separate from the personal
library: playlists, authored climbs and backups are never read or written by the
update path.

It does **not** cover the web/PWA or iOS clients (no sign-in there yet), and does not
change how climbs display (catalog semantics).

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: consumer of the artifact contract and of the private endpoint.

## Inherited design decisions

- Prompt, then tap to install; current catalog stays until the new one verifies.
- Private, signed-in distribution; Android first.
- Personal library untouched by catalog updates.

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) implementation notes 1–2 (manifest resolution,
  integrity without a publisher hash — supplied by our own artifact).

## Foundation references

- `docs/SPEC.md` §2 (explicit consent before download; catalog absence leaves the
  library available) and §10 Private Library Preservation.
- `docs/ARCHITECTURE.md` Module Map 2 (A/B OPFS slots, receipts).
- Existing code: `web/src/data/catalog/bootstrap.ts`, `manifest.ts`,
  `web/src/data/sqlite/catalog-install.ts`, `catalog-receipt.ts`,
  `web/src/catalog/service.ts`; Android `CatalogAssetWebViewClient.java`,
  `scripts/android-vault-config.mjs`.

## Design decisions

Operator answers, 2026-10-20:

- **Check cadence**: automatic checks at most every 3.5 days (twice a week, matching
  the weekly publish), when the catalog opens or the app returns to the foreground
  while signed in; **Check now** in Manage always checks.
- **Prompt**: a slim catalog banner ("New catalog: 1,261 new climbs · 23 removed ·
  Later · Install") plus details and the install button in Manage. **Later** hides the
  banner until a newer version appears; Manage still offers the install.
- **Signed out**: Manage shows "Sign in to get catalog updates"; nothing elsewhere.
  The installed catalog keeps working offline.

Derived (within settled scope):

- **Tokens never reach JavaScript.** A native `PrivateCatalog` plugin calls the
  `privateCatalog` endpoint with the Firebase session the vault already uses, stores
  the manifest and the artifact in app-private storage, and verifies size and SHA-256
  against the manifest and the `X-Catalog-SHA256` header. The existing
  `CatalogAssetWebViewClient` serves those files at same-origin
  `/catalog/private/manifest.json` and `/catalog/private/<file>`, so the web installer
  keeps its same-origin, hash-checked, A/B-slot path.
- **Never downgrade**: an update must have a higher `version` than the installed
  receipt, schema 3, and the installed definition's `layoutRevision`.
- **Endpoint is compiled in** (like `VAULT_ENDPOINT`) and enabled only when native
  auth is configured (release builds); debug and web builds report `unconfigured`.
- **First install**: when signed in and a remote version exists, it is offered instead
  of the bundled legacy snapshot; signed out, the bundled offer stays.
- **Library isolation**: the update path never reads or writes climbs, playlists or
  backups; a failed or cancelled update leaves the installed catalog active.
- The phone's last-check time and dismissed version are per-device conveniences
  (local storage); losing them only causes an earlier check or a re-shown banner.

## Architectural choice

Native fetch + same-origin serving (chosen) keeps credentials in the native layer that
already owns them, reuses the vault's session/epoch and transfer patterns, and leaves
the proven web install pipeline untouched apart from a base path. Alternatives:
(B) JS obtains an ID token and fetches cross-origin — needs CORS on the gateway and
exposes tokens to the WebView; (C) bundle each new catalog into an APK update —
every weekly catalog would need a phone reinstall.

## Contract

```ts
// web/src/catalog/update-source.ts
export type CatalogUpdateCheck =
  | { readonly status: 'unconfigured' | 'signed-out' | 'none' }
  | { readonly status: 'available'; readonly version: number };
export interface CatalogUpdateSource {
  /** Ask the private endpoint for its latest version and stage its manifest natively. */
  check(): Promise<CatalogUpdateCheck>;
  /** Download and verify that version's artifact into app-private storage. */
  prepare(version: number): Promise<void>;
}
export const noCatalogUpdates: CatalogUpdateSource; // web/PWA default: always 'unconfigured'
```

Native plugin `PrivateCatalog` (Android): `check()` → `{status, version?}`;
`prepare({version})` → resolves after the artifact is verified and atomically moved
into place; errors are bounded codes (`AUTH_REQUIRED`, `NOT_ADMITTED`, `NETWORK`,
`INTEGRITY`, `UNAVAILABLE`). Served paths: exact `GET /catalog/private/manifest.json`
and `GET /catalog/private/kilter-7x10.v<N>.db.gz` (only the staged version).

## Implementation Units

### Unit 1 (story `…-native`): Android plugin and same-origin serving
- `prototypes/ios/android/app/src/main/java/.../PrivateCatalogPlugin.java` (new):
  single transfer queue, session uid/epoch checks (vault pattern), 15 s connect /
  60 s read timeouts, 16 KiB manifest cap, artifact cap = manifest `bytesGzipped` ≤
  8 MiB, streaming SHA-256, temp file + atomic rename under `noBackupFilesDir/catalog/`,
  keeps only the staged manifest, the newest prepared artifact and none older.
- `PrivateCatalogFiles.java` (new, pure file/validation logic for JVM tests).
- `CatalogAssetWebViewClient.java`: serve the two private paths from those files
  (identity encoding, `no-store`), bundled behavior unchanged.
- `MainActivity.java`: register the plugin.
- JVM tests in `android/app/src/test/...`: manifest validation, size/hash mismatch,
  path selection, cleanup.

### Unit 2 (story `…-service`): update flow in the catalog service
- `web/src/catalog/update-source.ts` (contract above).
- `web/src/data/catalog/bootstrap.ts`: base path parameter (`/catalog/` or
  `/catalog/private/`), same-origin and redirect rules unchanged.
- `web/src/catalog/service.ts`: `update` snapshot state
  (`{ offer, changes, dismissed }`), `checkForUpdate({ force })` with the 3.5-day
  cadence, `installUpdate()` (prepare → existing verified install → A/B swap),
  `dismissUpdate()`, downgrade/layout refusal, signed-out/unconfigured states.
- `prototypes/ios/src/native-private-catalog.ts` + `runtime.ts` wiring; web runtime
  passes `noCatalogUpdates`. Foreground resume triggers the cadence check.
- Unit tests for every state transition, cadence, refusal, failure retaining the
  installed catalog.

### Unit 3 (story `…-ui`): banner and Manage
- `CatalogBrowser.tsx`: update banner (counts from `changes`, Later, Install, progress,
  error with retry), accessible as a polite status region.
- `CatalogManageDialog.tsx`: installed vs available version and build dates, Check now,
  last checked, signed-out hint, install button.
- Component tests; existing catalog e2e stays green.

### Unit 4: docs and checks
- `docs/SPEC.md` §2/§6, `docs/ARCHITECTURE.md` (catalog providers, Android shell),
  `prototypes/ios/README.md` catalog section; also this epic's runbook gap
  (`docs/DEPLOY.md`: run `npm --prefix functions ci --ignore-scripts` in the prepared
  package before `firebase deploy`).

## Implementation Order

Native (contract producer) → service → UI → docs. Stories carry the same order.

## Testing

- JVM: `PrivateCatalogFiles` validation and cleanup; header/hash mismatch rejected.
- Vitest: service update state machine, cadence (3.5 days, force), dismiss/re-show on
  newer version, downgrade and layout refusal, failure keeps active catalog, web
  `unconfigured`; native adapter maps plugin errors.
- Component tests for banner and Manage states.
- Android compile in CI; an emulator smoke against a stubbed endpoint is optional.
- Live acceptance happens in the operator's phone update: fresh validated backup, same-key
  update, library verified, then Check now → Install v2 → verify catalog version and
  library unchanged.

## Risks

- **Session/epoch races** during sign-out mid-download. — Reuse the vault's epoch check
  before the atomic rename; discard otherwise.
- **WebView intercept serving stale files.** — Exact-path, version-named files; the
  manifest names the only servable artifact.
- **Least sure**: first-install preference between bundled and remote offers on a
  signed-in device with no catalog yet; covered by service tests and the live update.
