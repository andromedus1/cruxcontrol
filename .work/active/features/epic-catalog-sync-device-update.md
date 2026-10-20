---
id: epic-catalog-sync-device-update
kind: feature
stage: review
tags: [data, security]
parent: epic-catalog-sync
depends_on: [epic-catalog-sync-snapshot-normalize, epic-catalog-sync-private-publish]
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-20
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

## Implementation notes

- Execution capability: inline, single owner, stories in order (native → service →
  UI → docs); one commit per story. Review not run here (left for `/agile-workflow:review`).
- Files:
  - Native: `PrivateCatalogPlugin.java`, `PrivateCatalogFiles.java` (pure),
    `CatalogAssetWebViewClient.java` (private paths), `MainActivity.java`,
    `app/build.gradle` (`testImplementation 'org.json:json:20240303'`: android.jar's
    org.json is a stub on the JVM), `PrivateCatalogFilesTest.java`.
  - Web: `web/src/catalog/update-source.ts`, `service.ts`, `presentation.ts`,
    `CatalogBrowser.tsx`, `CatalogManageDialog.tsx`, `catalog.css`,
    `web/src/data/catalog/bootstrap.ts`, `web/src/app/create-runtime.ts`.
  - Android shell: `prototypes/ios/src/native-private-catalog.ts`, `runtime.ts`.
  - Docs: `docs/SPEC.md` §2/§6, `docs/ARCHITECTURE.md` (summary, Catalog Providers,
    module flow, offline/network paragraph), `prototypes/ios/README.md` (signed-in
    catalog updates), `docs/DEPLOY.md` catalog step 3 (`npm --prefix functions ci
    --ignore-scripts` in the prepared package before `firebase deploy`).
- Tests added: JVM `PrivateCatalogFilesTest` (10: manifest contract, header/hash/size
  mismatch and bounded codes, path selection, staged-only serving, stale/corrupt commit,
  cleanup, failed restage); service (14 update cases: unconfigured web, lazy storage,
  cadence/force, dismiss until newer, never downgrade, layout/version refusal,
  signed-out and failed checks, offline re-offer, install via private path, failures
  keep the active catalog, cancel, remote-first first install, bundled fallbacks,
  dropped remote offer); bootstrap base path (2); preferences (3); native adapter (3);
  runtime wiring + resume (1); CatalogBrowser banner (4); Manage updates (4);
  presentation summary (1). Stale type-only fixtures in four existing test helpers gained
  the `update` field and new methods.
- Discrepancies from design (engineering detail, within the decisions):
  - Contract kept exactly; additions: `CatalogUpdateError` (bounded codes →
    `signed-out`, `not-admitted`, `network`, `integrity`, `unavailable`), a preference
    store, and an error `action` (`check` | `install`) so Retry repeats the right step.
  - Cadence counts only completed endpoint checks (`available`/`none`). Signed-out,
    unconfigured or failed checks do not advance it, so those re-ask on the next open;
    signed-out and unconfigured answers are native-only and make no request.
  - A third per-device preference, `stagedVersion`, lets a not-yet-due open re-offer an
    already staged version from `/catalog/private/manifest.json` without contacting the
    endpoint; otherwise a restart would hide an offer until the next due check.
  - Native maps `AUTH_CHANGED` (sign-out/account change mid-transfer) to
    `AUTH_REQUIRED`, token-refresh failures to `UNAVAILABLE`, deadline expiry to
    `NETWORK`; gateway 404 on the manifest means `none`. `prepare` only prepares the
    version the last check staged, and reuses an already verified artifact.
  - Cancel during native preparation cannot abort the native transfer; the result is
    discarded on the web side (a verified artifact stays staged for a retry).
  - Banner counts are the offered manifest's `changes` (relative to the previous
    published version), as decided; a device that skipped versions sees that version's
    delta, not the cumulative one. Restored climbs are listed only when non-zero.
  - While the new slot installs, the browse list is hidden briefly (existing worker
    behavior); the old catalog stays active unless the new one passes.
  - Check failures appear only in Manage; the banner shows offers, progress and install
    failures.
- Verification: see the PR description for exact local results (web lint, typecheck,
  991 tests, build, PWA check, e2e; prototype lint and 114 tests + 11 package-script
  tests; Python 44; local Android compile and JVM tests with JDK 21 / SDK 36).
- Parked / unresolved:
  - `docs/SPEC.md` §6 still says the publish workflow "stays disabled until the operator
    provisions those resources"; the gateway is live, but whether publishing is enabled
    was not verified here, so the sentence was left for the docs gate.
  - Live acceptance (Check now → Install v2 on the phone with a fresh validated backup)
    remains the operator's step; no device or live endpoint was touched.
