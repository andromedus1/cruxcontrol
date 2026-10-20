---
id: epic-catalog-sync-private-publish
kind: feature
stage: done
tags: [infra, security]
parent: epic-catalog-sync
depends_on: [epic-catalog-sync-append-only-guards]
release_binding: null
gate_origin: null
created: 2026-10-19
updated: 2026-10-19
research_refs:
  - .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
---

# Scheduled Build and Private, Signed-In Catalog Publication

## Brief

A scheduled GitHub Actions workflow (weekly by default; cadence configurable and
intentionally relaxed) fetches the Boardsesh manifest once, runs normalization and
reconciliation, and, when every guard passes, publishes the new artifact and manifest
to private Google Cloud storage. Prior versions are retained and a last-known-good
pointer only advances on success. A tripped guard or failed run publishes nothing and
opens or updates a single GitHub issue with the diff report; logs and issues never
expose credentials or signed URLs.

Distribution is private: only signed-in users can read the catalog. Devices obtain it
through an authenticated endpoint that verifies the Firebase ID token the Android app
already holds for private backups, and returns the current manifest and a short-lived
download for the artifact. CI writes with a least-privilege identity (no long-lived keys
in the repo). Resources are namespaced apart from the live private-backup vault, which
holds real backups and must not be deleted, recreated or repurposed; infrastructure
changes go through reviewed, CI-applied paths, never a local apply.

It does **not** change the app's install flow (device update) or catalog presentation.

## Epic context

- Parent epic: `epic-catalog-sync`
- Position in epic: consumer of the guards; producer of the endpoint and manifest
  contract the device-update feature calls.

## Inherited design decisions

- Re-host privately behind the existing Firebase sign-in; no public catalog URL.
- Auto-publish when guards pass; tripped guard holds and notifies via GitHub issue.
- Cadence slower than daily is acceptable; fetch each Boardsesh artifact at most once
  per run and never more than daily.

## Research briefs

- [Current Kilter catalog sources](../../../.research/analysis/campaigns/kilter-current-catalog-sources/parent.md) §3 Terms and permissions (use mode c, re-hosting;
  setter attribution; no official-sourcing claim) and implementation notes 1–2, 9–10.

## Foundation references

- `docs/DEPLOY.md` (live private-backup resources; CI-only infrastructure).
- `prototypes/firebase-vault/README.md` (existing Firebase project, gateway, provisioning).
- `docs/ARCHITECTURE.md` §Intended independent preservation boundary.

## Design decisions

Operator answers, 2026-10-19:

- **Separate catalog service.** A new `privateCatalog` function, a new private bucket
  (`cruxcontrol-auth-20261010-catalog`) and new runtime/publisher identities in the same
  Firebase project. The live vault function, bucket and runtime identity are not
  modified, redeployed or granted anything.
- **Operator-run provisioning.** An `inspect`-by-default / explicit `provision`
  script with readback assertions, run by the operator with an isolated signed-in
  CLI configuration kept outside Git (the vault pattern). Agents make no cloud
  writes; CI holds no infrastructure-admin credential.
- **Keyless CI identity.** GitHub OIDC → Workload Identity Federation → a publisher
  service account limited to create + read on the catalog bucket (no delete or
  overwrite), accepted only for `andromedus1/cruxcontrol`, `refs/heads/main`, and the
  catalog-publish workflow file.
- **Guard holds open/update one GitHub issue** with counts and reasons only (no climb
  data); unchanged upstream ends the run quietly.

Derived (within settled scope):

- **Append-only storage.** Objects are immutable and created with
  `ifGenerationMatch=0`: `kilter-7x10/artifacts/kilter-7x10.v<N>.db.gz` then
  `kilter-7x10/manifests/v<NNNNNN>.json`. A manifest's presence publishes its version;
  "current" is the highest manifest version whose artifact exists. No pointer object
  is overwritten, so the publisher never needs delete.
- **Bootstrap.** The operator seeds version 1 with the existing private legacy
  artifact and manifest; CI's first run then builds v2 against it.
- **Workflow is inert until enabled.** Runs weekly (Mondays) and on manual dispatch,
  only when repository variable `CATALOG_PUBLISH_ENABLED == 'true'`, with WIF
  provider and service account taken from repository variables (not secrets; they
  are identifiers).
- **Download path streams through the function** (artifacts are ~5 MB), so no
  signing permission is needed; identity encoding, exact `Content-Length`, and the
  manifest's sha256 for the app to verify.
- **Admitted users.** The same single configured owner UID as the vault for now; the
  list form leaves room for invited members later.

## Architectural choice

Three small pieces with one storage contract between them: (1) a CI publisher that
reads the latest published version, runs the existing guarded build against it, and
uploads create-only objects; (2) a read-only catalog gateway that authenticates
Firebase users and serves the latest manifest and named artifacts; (3) an operator
provisioning script that creates and verifies the bucket, identities, IAM, WIF and
budget-neutral settings, plus a one-time bootstrap upload.

Alternatives: (B) extend the vault gateway — rejected by the operator to keep the
service holding real backups untouched; (C) public static hosting — rejected by the
epic's private-distribution decision; (D) signed URLs from the function — adds a
token-creator/signBlob permission for no benefit at this artifact size.

## Implementation Units

### Unit 1: Storage contract — `web/scripts/catalog/storage_layout.py`

```python
PREFIX = "kilter-7x10"
def artifact_object(version: int) -> str          # kilter-7x10/artifacts/kilter-7x10.v<N>.db.gz
def manifest_object(version: int) -> str          # kilter-7x10/manifests/v<NNNNNN>.json
def latest_version(object_names: Iterable[str]) -> Optional[int]
    """Highest N with both manifest and artifact present; ignores anything else."""
```
Shared by the publisher (Python) and mirrored in the gateway (one tested regex each,
cross-checked by a fixture list of object names used by both test suites).

### Unit 2: Publish workflow — `.github/workflows/catalog-publish.yml`, `web/scripts/catalog-publish.sh`

Steps: checkout → Python 3.11 → `google-github-actions/auth` (WIF) →
`setup-gcloud` → list bucket → download the latest manifest + artifact into a
previous dir → `build-catalog-snapshot.py --previous-dir … --report …` → by exit code:
0 = upload artifact then manifest with `--if-generation-match=0`, verify readback
sha256; 8 = done; 7 = open/update the "Catalog update held" issue with the report's
reasons and counts; other = fail. Permissions: `contents: read`, `id-token: write`,
`issues: write`. Concurrency group prevents overlapping runs. Nothing secret is
echoed.

### Unit 3: Catalog gateway — `services/private-catalog/gateway/`

```js
// handler.mjs
export function createCatalogHandler({ admittedUids, verifyToken, store }): (req, res) => Promise<void>
// GET /catalog-v1/manifest           -> 200 latest manifest JSON (schema 3 only) | 404
// GET /catalog-v1/artifacts/:file    -> 200 bytes (application/gzip, identity, exact length) | 404
// anything else -> 404/405; missing/invalid token -> 401; other uid -> 403
// store.mjs: listObjects(prefix), readObject(name) with generation pin; read-only
```
Node 22, `firebase-functions`/`firebase-admin`/`@google-cloud/storage`, esbuild
bundle, `node --test` suites with injected identity and storage (vault style).
`Cache-Control: private, no-store`; no CORS needed (native app origin) — confirm in
device-update.

### Unit 4: Provisioning — `services/private-catalog/provision.mjs`

`inspect` (default) prints current state; `provision` creates/reconciles: APIs
(storage, iam, iamcredentials, sts, cloudfunctions, run, cloudbuild, artifactregistry),
bucket (us-central1, uniform access, public-access prevention enforced, 7-day soft
delete, no lifecycle), `crux-catalog-reader` (bucket objectViewer + existing
auth-reader custom role) and `crux-catalog-publisher` (bucket objectCreator +
objectViewer only), WIF pool/provider with the attribute condition above, and
`workloadIdentityUser` for that principal set only. `bootstrap <dir>` uploads the
legacy v1 artifact + manifest create-only. Readback assertions reject public access,
unexpected bucket/IAM bindings, or a publisher able to delete. Pure plan/assert
functions are unit-tested; cloud calls are not run by agents.

### Unit 5: Function deploy preparation — `services/private-catalog/prepare.mjs`

Mirrors the vault `prepare-service.mjs`: builds the bundle, writes `firebase.json`
for the `privateCatalog` codebase only, records bundle/lock hashes and the
admitted-UID config outside Git. Operator deploys with the isolated Firebase CLI.

### Unit 6: Docs and runbook

`docs/DEPLOY.md` gains the catalog resources (namespaced, deletable without
touching the vault), the operator runbook (inspect → provision → bootstrap →
deploy → set repository variables → dispatch once), and the guard-hold procedure.
`docs/SPEC.md` §6 / `docs/ARCHITECTURE.md` roll forward.

## Implementation Order

1. Storage contract (shared, smallest) → 2. gateway with tests → 3. publisher
script + workflow (inert) → 4. provisioning plan/asserts with tests → 5. prepare
script → 6. docs/runbook.

## Testing

- Python: `latest_version` on mixed/partial listings; object naming.
- Gateway: auth matrix (none/invalid/revoked/other uid/owner), routes and methods,
  manifest selection ignores orphan manifests, artifact streaming headers and length,
  path traversal and unknown names rejected, store read errors → 503 without leakage.
- Provisioning: plan contents for a clean and a partially provisioned project;
  readback assertions fail on public members, delete-capable publisher, missing
  attribute condition.
- Workflow: shellcheck-clean script; exit-code routing exercised by a local dry-run
  mode that stubs `gcloud` with a fake bucket directory.
- Live verification (operator, after provisioning): first dispatch publishes v2;
  second dispatch reports unchanged; an owner-token GET returns the manifest; another
  account gets 403.

## Risks

- **WIF misconfiguration grants too much or nothing.** — Readback asserts the exact
  attribute condition and bindings; workflow stays inert until the operator enables it.
- **Same project as the vault.** — Separate names, identities and bucket; provisioning
  never touches vault resources, and inspect lists anything unexpected.
- **Boardsesh download size (~194 MB catalog artifact per run).** — Weekly cadence;
  one fetch per run.
- **Least sure:** first live WIF exchange and function cold-start behavior; both are
  verified in the operator's first dispatch before the device-update feature relies
  on them.

## Implementation notes

- Execution capability: inline, single owner; heterogeneous but tightly coupled through
  one storage contract (Python publisher, Node gateway, operator provisioning).
- Review weight: standard (project default).
- Files changed:
  - Storage contract: `web/scripts/catalog/storage_layout.py`,
    `prototypes/firebase-vault/catalog-gateway/contract.mjs`, shared
    `catalog-gateway/storage-layout.fixture.json` read by both test suites.
  - Publisher: `web/scripts/catalog-publish.sh` (gcloud or local-directory store),
    `web/scripts/catalog-storage.py`, `web/scripts/catalog-hold-issue.sh`,
    `.github/workflows/catalog-publish.yml` (inert until `CATALOG_PUBLISH_ENABLED`;
    actions pinned to commit SHAs; `id-token: write`, `issues: write`, `contents: read`).
  - Gateway: `prototypes/firebase-vault/catalog-gateway/{settings,contract,handler,gcs-store,index,build}.mjs`,
    `package.json`/`package-lock.json` (same dependency tree as the vault gateway).
  - Operator tooling: `prototypes/firebase-vault/{catalog-plan,provision-catalog,prepare-catalog}.mjs`.
  - CI: `.github/workflows/ci.yml` runs the catalog gateway and provisioning-plan tests
    in the existing firebase-vault job.
  - Docs: `docs/DEPLOY.md` (resources, runbook, held-update procedure), `docs/SPEC.md`
    §6, `docs/ARCHITECTURE.md` item 3. CLI prints "unchanged" instead of "held" for
    exit 8.
- Tests added: storage layout (3, Python; shared fixture), gateway contract (4) and
  handler (6: auth matrix, latest published manifest, artifact streaming headers and
  generation pinning, unpublished/traversal/method rejection, storage failures,
  length mismatch), provisioning plan (6: bucket, bucket IAM, project IAM, WIF
  condition, impersonation, vault isolation).
- Local end-to-end dry run (real 2026-10-19 data, directory-backed store seeded like
  the bootstrap): run 1 published v2 (artifact then manifest after sha256 readback);
  run 2 `unchanged`; run 3 with an older upstream `held` and wrote nothing. Hold issue
  body rendered with a stand-in `gh` (counts and reasons only).
- Discrepancies from design:
  - Gateway and operator tooling live in `prototypes/firebase-vault/` (separate
    `catalog-gateway/` package, `*-catalog.mjs` scripts) rather than a new
    `services/` tree, to reuse the operator's isolated `firebase-tools` sign-in, Node
    version and CI job. Cloud resources remain fully separate from the vault.
  - The WIF condition also pins the numeric repository id (`1212058430`) so a renamed
    or recreated repository cannot satisfy it.
  - `prepare-catalog.mjs` refuses output inside the Git checkout.
  - Bootstrapped v1 is a schema-2 manifest; the gateway serves only schema-3
    manifests, so `/catalog-v1/manifest` returns 503 until CI publishes v2 — the
    runbook dispatches the workflow immediately after bootstrap.
- Not verified here (operator steps, by design): provisioning, bootstrap, function
  deploy, first live WIF exchange, and live gateway auth. `shellcheck` is not installed
  locally; scripts were syntax-checked and exercised by the dry run.
- Adjacent issues parked: none.

## Review

- Effective weight: standard; one independent pass.
- Reviewer: Codex `gpt-6.1-sol` (high effort, security-first brief) via peeragent —
  cross-model, no cloud or GitHub calls. It ran the Python, plan and contract tests and
  the handler cases in-memory (its sandbox blocked local HTTP listen).
- Proposed verdict: Request changes. Receiver adjudication (all accepted):
  - **Blocker — interrupted publication blocked all later runs.** An uploaded artifact
    without its manifest kept `latest` unchanged, so every run retried the occupied
    version and failed create-only. Fixed: `next_version` skips burned numbers;
    builds require versions strictly greater than the previous (gaps allowed; this
    relaxes the guards feature's "previous + 1" to "strictly increasing"); the gateway
    already ignores manifest-less artifacts; bootstrap reruns reuse identical objects
    and refuse different ones. Regression: `test_publish_script.py` runs the real
    script against a directory store — publish, unchanged, burned v3 → v4, v5.
  - **Important — federated principal could hold project roles unnoticed.** Fixed:
    any member from the CI identity pool holding a project role, or any access on the
    vault bucket, is a readback problem. Test added.
  - **Important — extra catalog bucket readers passed inspection.** Fixed: strict member
    allowlist (catalog identities with exact roles plus GCS's default project
    convenience bindings). Test added.
  - **Important — order-sensitive provider mapping comparison.** Fixed: compared as
    sorted entries. Test added.
- Verification after fixes: Python 44 tests; provisioning plan 6; catalog gateway 10;
  vault gateway 17; real-data dry run republished v2.
- Closure: standard weight — blocker fixed and verified, no second pass.
