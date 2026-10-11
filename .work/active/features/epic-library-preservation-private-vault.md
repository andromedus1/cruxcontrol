---
id: epic-library-preservation-private-vault
kind: feature
stage: done
tags: [data, security, infra]
research_refs: [independent-library-preservation, native-backup-service-costs]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-11
---

# Access private backups through a recoverable account

## Current checkpoint

The bounded Firebase service proof is deployed and passes live synthetic storage,
restricted runtime permissions, account isolation, native exact-byte readback and
operator-assisted recovery into a separate installation. Billing is enabled with
a project-scoped $5 monthly alert budget. The 25 MiB download proof exposed and
fixed an Android heap exhaustion in the proof bridge by streaming to a native
cache file. See the final live-evidence section for limits and reproducible paths.

Stage is **done** after verified fixes and required CI: the application vault service and native account/file
transport are implemented and verified on synthetic emulators. Actual adapter
acceptance covers restart of sealed files, immutable retry/conflict, independent
account discovery and exact readback for structured and exact-25-MiB libraries.
Configured release and unconfigured CI packaging checks pass. The three original child
checkpoints are done; the completed independent review and root regression added a
bounded fix checkpoint before closure.
Automatic scheduling/revision acknowledgement and account/cloud recovery UI
belong to the dependent automatic-backup feature. Real authoring is not admitted.
Earlier setup checkpoints below describe evidence at those points and are
superseded by the current implementation and acceptance records.

## Brief

Prove native Android account sign-in, return, session renewal, owner-only authorization and recovery without the old phone. Select the smallest service implementation supported by that proof, with immutable complete snapshots, independent discovery and authenticated readback. Account-protected service-managed encryption is approved; end-to-end encryption and a separate owner key are not required.

Reuse the verified preservation comparison. Compare actual native authentication before choosing hosting; do not infer a workable session from storage primitives. Prepare reviewable configuration, retention/capacity limits and costs before provisioning. Offline authoring remains available during sign-out/outage. Existing backups must be discoverable without a local installation secret; empty/stale clients have no authority to delete or replace them. Sharing membership never authorizes private backup access.

## Epic context

- Parent: `epic-library-preservation` — Android dogfood with parity, independent backup and the older Kilter catalog.
- Inherit the parent’s settled no-interim-PWA, offline-use, dual-backup and account-recovery decisions.
- User target: a private dogfood build in the next few days, contingent on demonstrated platform and recovery behavior rather than an unverified date promise.

## Grounding

- [Preservation comparison](../../../.research/analysis/briefs/independent-library-preservation.md).
- [Specification](../../../docs/SPEC.md), especially private library preservation and current wall-session capabilities.
- [Architecture](../../../docs/ARCHITECTURE.md), especially runtime composition, native transport and independent preservation.
- [Existing native shell](../../../prototypes/ios/README.md); Android uses native library storage, with off-device recovery requiring the separate preservation service.

## Mockups

- Inherit [library preservation](../../../.mockups/flows/library-preservation/index.html) where backup surfaces apply.
- Existing editor, library, playlist and Kilter browser reuse their current UI; mock only genuinely new structure.
- Andrew’s 2026-10-10 instruction to proceed supplies authorization to continue this prepared direction; no new UI redesign milestone.

## Owner cost direction

Andrew answered the budget question on 2026-10-10: prefer cheaper options when
otherwise comparable; an option costing as much as USD 25/month needs a concrete
justification. This resolves the budget-direction question, not provider selection
or paid activation. Evaluate the already-researched usage-priced Firebase candidate
before committing to a fixed monthly plan. Compare measured storage/operation use,
account recovery, service availability, maintenance burden and billing exposure.
Do not present a free allowance as a guaranteed zero bill or a budget alert as a
hard cap. A USD 25/month choice needs a demonstrated benefit for this app.

Google Drive is Andrew's chosen destination for the separate Android signing-key
backup. That answer does not select Drive as the app's automatic climb-backup service.

## Candidate proof and operating proposal

Supabase remains an alternative native authentication candidate, not a selected
production service. Its rotating sessions and native redirect documentation address a known
gap in the Cloudflare Access candidate. Compare actual Android sign-in, secure
session persistence, renewal after app restart and account recovery before locking
the architecture. No Supabase project or paid plan has been provisioned; the
Firebase authentication proof below has separate setup evidence.

The proposed private configuration is one project, one non-public snapshot bucket,
and owner-scoped authenticated insert/list/read. Do not grant client update/delete
or expose a service-role credential. Use unique immutable object names, bounded
complete-library files, authenticated byte readback and retained prior versions.
Initial retention keeps copies rather than deleting them automatically; capacity
admission must pause visibly before the configured storage ceiling. Neither an
untrusted filename nor a provider's successful PUT is a verified recovery receipt.
Prove denied anonymous/other-owner access and denied overwrite/delete through the
actual API, not only by reading the policy SQL.

For account access, evaluate GitHub OAuth with PKCE and an explicit native return
path using Andrew's existing account; this avoids depending on a new production
email delivery service. Email OTP remains an alternative if preferred, but production
SMTP must then be configured and verified. Keep tokens in an OS-protected native
store excluded from automatic OS restoration, never WebView localStorage or exports.
Only synthetic snapshots enter the service during this proof.

**Cost boundary, checked 2026-10-10:** a free project can support the technical
proof, but pauses after one inactive week and has 1 GB file storage. The proposed
non-pausing operating tier is Pro, currently from USD 25/month for one project;
included file storage is 100 GB. Keep default spend control and no extra project,
compute upgrade, custom domain or add-on. This is a proposal, not spending approval
or an all-inclusive guarantee: applicable taxes, excluded usage categories and any
email service need explicit treatment before paid activation. Provider database
backups do not back up Storage object bytes; application snapshot retention and the
portable-file recovery path remain separate responsibilities.

Primary documentation checked for this proposal:
- [Sessions](https://supabase.com/docs/guides/auth/sessions) and
  [native redirects](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).
- [Storage authorization](https://supabase.com/docs/guides/storage/security/access-control).
- [Pricing](https://supabase.com/pricing) and
  [cost control](https://supabase.com/docs/guides/platform/cost-control).
- [Production email limits](https://supabase.com/docs/guides/auth/auth-smtp) and
  [database backup scope](https://supabase.com/docs/guides/platform/backups).

Provider selection remains open. Firebase's real native account proof has now
passed as recorded below; the Supabase account proposal above is an alternative,
not an executed proof. Do not advance this feature to implementation on the
strength of storage documentation alone.

### Usage-priced candidate

The focused [native service cost assessment](../../../.research/analysis/briefs/native-backup-service-costs.md)
adds Firebase native Authentication plus Cloud Storage as another proof candidate.
Its documented Capacitor 8 path and renewable native sessions warrant testing, but
native sign-in does not automatically authenticate a WebView SDK. Keep identity and
object access on the demonstrated native path; inspect token persistence and OS
backup exclusions before claiming secure recovery.

Firebase Storage requires a Blaze billing account even within eligible no-cost
allowances. A US-region bucket can use those allowances; overages are chargeable,
and Storage budget alerts are not a hard cap. No billing account is linked; the
isolated authentication proof project below has been created. The answered budget question establishes a cheaper-first operating
constraint, not provider selection or permission to activate billing. The source review passed
after bounded wording/citation corrections; native account evidence is recorded
below, while live storage and library recovery remain pending.

### Native authentication proof setup

Start with Firebase's Google sign-in on the no-cost Spark plan, without linking
billing. This tests the cheaper-first candidate; it does not select the production
backup provider. Firebase documents social sign-in as no-cost and requires the
Android package and signing SHA-1 for Google sign-in. Storage setup remains a
separate billed-service decision after the account proof.

- Prepare a dedicated CruxControl authentication proof project, ID
  `cruxcontrol-auth-20261010`. Use only synthetic
  libraries and explicitly target this project in commands. No other projects,
  billing, Analytics, Hosting or Storage are needed for the initial sign-in test.
- Android package: `io.github.andromedus1.cruxcontrol.prototype`. Existing release
  certificate SHA-1, verified from release15:
  `3e4510ae0eeabbfbf7397ebf6b9d66a9ec134c07`. Keep the established signing identity.
- Firebase CLI 15.33.0 is installed locally under ignored `.private-firebase/`.
  A command-scoped `XDG_CONFIG_HOME` keeps its credentials/configuration in that
  private project directory; Gemini and usage telemetry are disabled. No CLI
  token, service credential or downloaded app configuration belongs in Git.
- Project/app registration and Google provider configuration are complete.
  Browser login for the operator CLI is service setup access; native acceptance
  is recorded separately below. Do not advance
  this feature from drafting until the required design and native proof are ready.

Setup references checked 2026-10-10:
[Spark and social sign-in](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans),
[CLI authentication](https://firebase.google.com/docs/cli#log_in_and_test_the_firebase_cli),
[Android Google sign-in setup](https://firebase.google.com/docs/auth/android/google-signin).

### Account setup checkpoint

The dedicated Firebase project and Android app are registered. Andrew completed
Google two-factor enrollment and then accepted Firebase terms through the official
[direct terms workflow](https://console.firebase.google.com/?forceCheckTos=true).
Activation succeeded immediately after terms acceptance; the prior HTTP 403 is
resolved. Required IAM permissions had already been verified. The welcome page
alone did not establish terms acceptance or project activation.

The Android app uses the retained signing certificate's SHA-1 and SHA-256. Firebase
CLI `deploy --only auth` configured Google sign-in with the proof display name and
the operator's chosen support account; the CLI also created its default Web app
registration for OAuth provisioning. No website was deployed. A readback confirms
Google enabled, anonymous/email/password/phone disabled, and an OAuth client
configured. A fresh billing read confirms no linked billing account and
`billingEnabled=false`. Private configuration and readback evidence remain in
ignored `.private-firebase/`; `auth-proof/provider-setup.json` contains sanitized
setup checks. No Storage bucket or library backup service is configured yet.

Provider configuration follows the official
[Firebase CLI authentication setup](https://firebase.google.com/docs/auth/configure-providers-cli).
The initial longer project ID was rejected before creation; only the shorter ID
above was created.

### Bounded native authentication spike

Resolve the highest-risk unknown before the production vault design: actual native
Google sign-in and renewable account identity in the existing Capacitor Android
shell. Execution is inline/direct-read; the small known native integration surface
does not need exploratory delegation. Settled user direction supplies the account,
encryption, offline-use and cost constraints; no product question is reopened.

Options considered: the documented Capawesome Firebase bridge offers broad provider
support but exposes credential/token methods to JavaScript; a narrow native bridge
over Firebase Auth plus Android Credential Manager can return only identity and
verification metadata; a WebView auth SDK introduces a separate persistence/session
boundary. Use the narrow native bridge for the feasibility test. This adds no
custom OAuth protocol or token store: Firebase's native SDK owns the session.
Inspect its actual persistence; do not claim Android Keystore encryption without
evidence. Keep the existing OS-backup exclusions and logging policy.

Proof-only units, all excluded from the daily-use release variant:

- `prototypes/ios/android/app/src/signedProof/java/io/github/andromedus1/cruxcontrol/prototype/AuthProofActivity.java`
  extends the existing activity and registers the test bridge. Invoke explicitly
  on an isolated emulator. Existing shared app screens are reused; the only sign-in
  UI is Google's provider-owned dialog, not a new product surface.
- Adjacent `NativeAuthProofPlugin.java` exposes `status(PluginCall)`,
  `signIn(PluginCall)`, `verifySession(PluginCall)` and `signOut(PluginCall)`.
  Status is `{signedIn:boolean, uid?:string, email?:string}`; verified status adds
  native token issuance/expiration times, never the token or provider credential.
  `verifySession` requires a current user and a forced server refresh; sign-out
  clears Firebase and Credential Manager state. Failures use bounded codes and
  no raw provider exception details in the bridge.
- Proof manifest and `signedProofImplementation` dependencies isolate activity,
  plugin and native Firebase libraries. Private app configuration is a generated,
  ignored proof asset; no credentials or account state enter source control.
- `prototypes/ios/scripts/android-auth-proof.mjs` is an explicit emulator-only
  operator driver with bounded native calls and metadata-only private evidence.
  It never imports CLI credentials into the app, resets a phone, or writes library
  contents. Human Google authentication occurs directly in Google's UI.

Acceptance: signed build compiles; release packaging excludes proof activity,
bridge and configuration; Google sign-in returns to the app; force-stop/relaunch
retains the same native user; forced refresh succeeds; sign-out makes refresh fail
and remains signed out after relaunch; a separate empty emulator installation can
sign into the same account without copying app state; inspect native token storage
and confirm no token persistence in WebView/library/export or OS backup eligibility.
No mocked auth or CLI login can satisfy these checks. Immutable storage isolation,
authenticated snapshot readback and full-library recovery remain subsequent proofs.

Risks: console/provider setup and interactive Google login may require Andrew;
emulator Play Services must support Credential Manager; native SDK persistence may
not meet the intended boundary. If any fails, record the actual limitation and
revisit the bridge/provider before selecting a production service. Keep this feature
drafting while this feasibility evidence and the full vault design remain incomplete.

### Native spike preparation evidence

- Added the proof activity/bridge and emulator operator commands above, plus
  `prepare-android-auth-proof.mjs` to select only app configuration fields from the
  explicit proof project's Android registration. No application account or CLI
  credential is bundled. This is a feasibility spike during design, not completion
  of the production vault feature or an advance to implementing.
- SignedProof16 and release16 compile with Firebase Auth 25.0.0 (BoM35.0.0),
  Android Credential Manager1.3.0 and Google ID1.1.1 in the proof variant only.
  Both APKs were built without an auth configuration asset. Dex and merged-manifest
  inspection confirms release16 excludes the proof plugin/activity, Firebase Auth
  and the proof asset, remains non-debuggable, and keeps `allowBackup=false`.
  Private APK hashes and inspection results: `.private-firebase/release-isolation.json`.
- A newly created isolated API36 emulator received only signedProof16. Launching
  the explicit proof activity and calling native `status` returns the expected
  `AUTH_NOT_CONFIGURED` failure. The runner now waits for WebView startup before
  attaching; an early first attach was a harness timing failure, not an auth result.
  Evidence: `.private-firebase/auth-proof/not-configured.json`. No physical device
  or existing preservation emulator was modified.
- Inspected the pinned Auth25.0.0 AAR's storage helper bytecode. It writes encrypted
  native SharedPreferences values and configures an Android Keystore URI for its
  crypto keyset. Legacy plaintext reads and key-initialization failure branches
  exist. This is SDK-code evidence only: real persisted session bytes, key behavior,
  token/log isolation and restart/renewal must still be checked after real sign-in.
  Do not infer a successful device encryption or persistence result from this audit.
- Script syntax and `git diff --check` pass. Documentation describes explicit
  emulator operation and pending acceptance. No production UI changed, so inherited
  preservation mocks remain sufficient. Standard feature review and final CI closure
  remain with the eventual integrated feature; no completed-auth claim is made here.
- All CI lanes passed for the native spike commit `9ed5850` in
  [run 38092380128](https://github.com/andromedus1/cruxcontrol/actions/runs/38092380128).
- SignedProof17 built from clean tracked source `896408a`, with private proof
  configuration and the packaged catalog validated. APK SHA-256:
  `8d41fd30eba5b80624ac2adf1d04633374b7fed4880d7a43112c57656a40dd9d`.
  Signature verification matches the retained certificate. It updated only the
  isolated authentication emulator. The native `signIn` call opened Google's
  account chooser; completed native acceptance is recorded below. The runner
  now waits for Capacitor's bridge as well as the WebView target after an early
  status invocation failed before sign-in. No native operation is retried by that
  readiness check.
- Release17 also compiled with the private proof asset present in the source tree.
  APK and merged-manifest inspection still exclude the asset, proof activity,
  bridge and Firebase Auth classes; `debuggable=false` and `allowBackup=false`.
  Evidence: `.private-firebase/release-isolation17.json`. This repeats isolation
  with real configuration present, rather than relying on the unconfigured build.

### Native session acceptance

SignedProof17 on the isolated API36 authentication emulator passed:

- Sign-in with the expected Google account, confirmed by native status and a real
  forced server refresh. The first operator invocation timed out while interactive
  Google account setup was unfinished; that is an evidence-capture timeout, not
  an authentication rejection. Subsequent native status and refresh establish the
  completed session.
- A full app force-stop and cold launch retain the same Firebase user. Forced
  refresh succeeds again, with a new issue time and later expiration.
- Sign-out returns signed-out status and removes native user/token preference
  entries. Forced refresh then rejects with `AUTH_REQUIRED`; cold launch remains
  signed out.
- A new sign-in prompt canceled with Android Back returns `AUTH_CANCELED` and
  leaves the app signed out.
- Actual native user and token-response preference values have the SDK's
  `ENCRYPTED:` encoding. Inspection of 49 app preference/database/WebView files and
  the app process log found no JWT-shaped tokens. This is a bounded inspection,
  not proof that arbitrary secrets can never leak. The pinned SDK's inspected
  code configures Android Keystore for this crypto boundary; physical hardware
  key protection has not been tested on the owner's phone.

Private evidence is under `.private-firebase/auth-proof/`, summarized by
`native-session-summary.json`; account identifiers and raw token values stay out
of Git. The operator README now waits for activity launch (`am start -W`) before
attaching: an immediate probe after asynchronous launch can run before the app
process exists. That harness timing error is separate from restart persistence.

A second AVD was created from the installed system image, without copying either
app data or credentials. Before install, CruxControl and Google accounts were
absent; after installing the same signedProof17 APK, native status is signed out.
Andrew completed Google sign-in there. Native status and forced server refresh
confirm the same Firebase UID and expected account as the first installation;
forced refresh also passes after a full app restart. The separate-installation
account-access proof passes. The first emulator is stopped with its signed-out
state preserved. No library snapshot has been uploaded or recovered; those remain
separate required proofs. Feature stage remains drafting while live storage
authorization/readback and the complete production vault design are unfinished.

### Bounded proof: immutable storage authorization

Use the demonstrated native Firebase identity for a small synthetic storage proof
before selecting the complete production vault. Compare direct native Storage SDK
plus owner-scoped Rules, an application proxy, and the existing Supabase alternative.
The direct SDK is the smallest candidate now that native account recovery works;
a proxy adds a separate authentication/runtime boundary, and Supabase still needs
its own native proof. None is production-selected until actual storage and recovery
acceptance pass.

Prepared a reviewable Storage Rules prototype and local emulator tests in
`prototypes/firebase-vault/` without any billed-service activation. Intended scope:
one explicitly admitted account, synthetic whole-library JSON only. The proposed
live bucket has not been created. Intended client rights: create/list/get;
no update/delete or public download URLs. Limit the proof
to 32 immutable slots of at most the existing 25 MiB portable-file maximum (800 MiB
total through these rules). No automatic pruning; exhaustion stops new uploads.
This deliberately small proof pool is not the dogfood retention policy.

Rules must deny unauthenticated and other-account access, alternate owner paths,
root enumeration, overwrite/delete, extra path depth, out-of-pool slots, empty or
oversized uploads and wrong content type. Tests run only against a local
`demo-cruxcontrol-vault` project with synthetic identities. Local rule tests do not
substitute for real native readback or live cross-account denial. A local-only
helper can render an owner UID into private configuration; it does not validate
the evidence's provenance, authenticate with the cloud or deploy anything. No
owner-specific storage configuration has been deployed. Native object access and
exact-byte recovery require resolution of the findings below and the provider's
billing prerequisite. No billed resource is created by this preparation.

### Storage proof findings and next acceptance gate

The direct-SDK Rules candidate is **not accepted for immutable backups**. Local
Storage emulator 15.33.0 / rules runtime 1.1.3 produced nine passing checks and one
failed competing-create check:

- Owner discovery/exact-byte readback, ordinary anonymous/other-account denial,
  sequential overwrite/metadata/delete denial, path boundaries, 32-slot exhaustion,
  size/type/metadata shape and local rule-rendering validation pass.
- `allow create` alone does not prohibit overwriting bytes at an existing name.
  Adding `resource == null` fixes the sequential case, matching the provider's
  [documented immutable-file example](https://firebase.google.com/docs/reference/security/storage).
  Two concurrent uploads to the same empty slot nevertheless both commit in the
  local emulator. Its upload handler evaluates authorization before replacing the
  stored object. This is evidence about the emulator, **not a verified live-service
  race**. The expected single-winner assertion stays executable as a named test
  todo linked here. A green regression job with this todo does not pass immutable
  storage acceptance.
- A separate passing test exposes another boundary: provider download tokens
  create a bearer URL that reads bytes without account sign-in, even while ordinary
  anonymous SDK reads fail. The token is handled outside the custom metadata seen
  by Rules, so filtering allowed metadata names does not eliminate that mechanism.
  Do not characterize this as a public bucket or claim all reads require identity.
- Rules check declared content type, size and digest syntax, not valid backup JSON
  or a matching digest. Recovery must verify actual bytes and the backup schema.
  The size-boundary test intentionally uses invalid JSON to expose that limit.

Test fixtures use synthetic identities and loopback-only endpoints. Nested fixture
cleanup is explicit because the pinned rules test helper clears root items only;
that harness defect was corrected without weakening policy assertions. No owner
library was used. No billing was linked and no bucket or backup was created.

Next resolve atomic admission and authenticated reads before selecting or deploying
the storage boundary. A small authenticated service using Google Cloud Storage's
`ifGenerationMatch=0` is a candidate: the documented precondition rejects writes
when a live object already exists, including unsafe retries. A service identity
with bucket-scoped Object Creator and Object Viewer roles can create/list/read
without delete or overwrite permissions. These are documented building blocks,
not an implemented or accepted service. See
[request preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions)
and [IAM roles](https://docs.cloud.google.com/storage/docs/access-control/iam-roles).
Compare the added runtime/authentication boundary with testing the direct SDK
against the live service; retain the existing Supabase alternative. Verify
identity validation, no bearer URL issuance, atomic concurrent creation,
interrupted upload/retry, live account isolation and native full-library recovery.
Prepare concrete deployment configuration and revised costs before requesting
billing activation. Production vault design and automatic backup remain incomplete.

### Authenticated service proof design

Andrew authorized continuing on 2026-10-10. Proceed inline with one owner and
standard eventual feature review; the bounded service spike does not advance this
feature out of drafting or select the production provider. Existing privacy,
offline-use, retention and budget decisions answer the directional questions.

Options: (1) deploy the direct Firebase Storage SDK/Rules candidate to see whether
the local race exists in the live service; this leaves the separate bearer URL
boundary and conditional-write contract unresolved; (2) retain native Firebase
identity and add a narrow authenticated service using GCS create preconditions and
non-destructive IAM permissions; (3) restart the native-account proof with Supabase.
Prepare option 2 for synthetic proof. It reuses the demonstrated account and gives
an explicit conditional write. Firebase's second-generation HTTP function deployer
fits the installed CLI and runs on Cloud Run; no additional authentication protocol,
database, email provider, domain or client-visible storage credentials are needed.
This is a candidate to validate, not evidence that deployed IAM or recovery works.

The trickiest unit is atomic admission plus lost-response retry: read an existing
slot first, accept only exact matching bytes, otherwise create with
`ifGenerationMatch: 0`, then independently read back the committed bytes before
returning a receipt. A losing concurrent create reads the winning object; a
different payload receives conflict. A failed readback is never success. No
handler replaces, deletes or prunes objects. Use the existing strict backup codec
for schema validation, with fatal UTF-8 decoding and the 25 MiB byte limit.

Proof units under `prototypes/firebase-vault/gateway/`:

- `handler.mjs`: `createVaultHandler({ ownerUid, verifyToken, store })` returns an
  HTTP handler. The verifier resolves `{uid:string}` or rejects; the store exposes
  `list(): Promise<Snapshot[]>`, `read(slot): Promise<{bytes:Buffer,snapshot:Snapshot}|null>`
  and `create(slot, bytes, sha256): Promise<void>`. `Snapshot` is
  `{slot:string, bytes:number, sha256:string, generation:string, createdAt:string}`.
  Only an authenticated admitted UID can use `GET /snapshots`,
  `GET /snapshots/00..31` or `PUT /snapshots/00..31`; mutations require an exact
  `X-Content-SHA256` digest. Unknown paths, query parameters, other verbs and
  malformed content fail explicitly. Responses carry no UID, tokens or URLs.
  `Cache-Control: no-store` applies to errors and library bytes alike.
- `gcs-store.mjs`: `createGcsStore(bucket, ownerUid)` implements this port with
  native Google Cloud Storage SDK calls. Hardcode the owner prefix, exact slot
  grammar, create precondition and metadata. Bound listings and downloads; pin a
  read to the returned object generation. Never construct signed/download URLs.
- `index.mjs`: Firebase HTTP function `privateVaultProof`, Node 22,
  us-central1, 512 MiB, one CPU, concurrency one, minimum zero and maximum one
  instance, 60-second timeout. Firebase Admin validates the ID token for the
  proof project with revocation checking; the admitted UID is private runtime
  configuration. Use a dedicated service account, never a default editor account.
  Bundle the existing codec into the deployment artifact with esbuild; do not
  fork its schema or ship web UI assets and emulator tools to the function.
- `prepare-service.mjs`: generate a private deployment directory and reviewed
  resource plan using successful native evidence only as local configuration
  input. Do not authenticate that evidence, link billing, deploy or upload data.
  Include dedicated bucket/account names, required roles, runtime limits and
  artifact hash. Owner UID and generated environment file remain outside Git.

Deployment proposal: same dedicated project `cruxcontrol-auth-20261010`, bucket
`cruxcontrol-auth-20261010-vault-proof`, account `crux-vault-proof`, one function.
Bucket has uniform access and enforced public-access prevention, no lifecycle
deletion, and default seven-day soft deletion. Runtime gets only bucket-scoped
Object Creator/Viewer and a project custom role containing `firebaseauth.users.get`
for revoked/disabled-user checks. The function endpoint admits unauthenticated
transport requests so it can verify Firebase end-user tokens, but every data route
requires the admitted account. No client has direct bucket IAM or a token URL.
The 32-slot, 800 MiB maximum remains proof-only. It is not dogfood retention.

Tests use actual HTTP requests against the handler plus synthetic verifier/storage
adapters, and an SDK wire fixture checks the GCS precondition. Cover competing
different and identical creates, existing-object conflict, lost upload response,
readback corruption, anonymous/other-owner/invalid token denial before storage,
strict schema/hash/size/path validation, no destructive methods, slot exhaustion,
and exact readback/discovery from a fresh client. Mock storage is not evidence of
live GCS atomicity or IAM. Retain the original failing direct-SDK assertion.

Before live admission, verify deployed least privilege, actual native token
authentication, concurrent conditional creates, interrupted retries, unauthorized
requests and fresh-install discovery/readback. Whole-library installation/restore
and automatic scheduling remain owned by automatic-backup. Confirm service costs
and explicit billing activation before any deploy command executes.

Primary implementation references checked 2026-10-10:
[GCS preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions),
[GCS IAM roles](https://docs.cloud.google.com/storage/docs/access-control/iam-roles),
[public access prevention](https://docs.cloud.google.com/storage/docs/public-access-prevention),
[Firebase token validation](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[revocation](https://firebase.google.com/docs/auth/admin/manage-sessions),
[HTTP functions](https://firebase.google.com/docs/functions/http-events),
[runtime limits](https://firebase.google.com/docs/functions/manage-functions).

Pre-mortem: the emulator cannot certify IAM; local passing tests must never close
live acceptance. A service identity with inherited delete/admin rights defeats the
intended secondary protection, so inspect effective permissions. Public transport
means invalid traffic still consumes compute; maximum instances and alerts are not
hard spending caps. Recovery depends on account and project availability; retain
the separately verified portable-file path. If live authorization or conditional
creation fails, stop at the proof and revisit the candidate before real authoring.

### Authenticated service preparation evidence

The candidate and native proof transport are implemented; no live service is
deployed. Ten local tests pass: nine handler tests exercise actual local HTTP
with injected identity/storage boundaries, and one real GCS SDK wire fixture
checks request preconditions, generation-pinned reads and non-destructive
requests. The original direct-SDK competing-create todo remains unresolved.
Neither fixture establishes live IAM, account isolation or cloud recovery.

Inspection of pinned `@google-cloud/storage` 8.4.0 found that its post-upload
checksum-mismatch path attempts `delete()`. The adapter therefore supplies CRC32C
in upload metadata for server validation and disables that SDK cleanup path;
independent generation-pinned readback still checks checksum, exact bytes, SHA-256
and backup schema before a receipt. The wire test deliberately returns a wrong
upload-response checksum and confirms no DELETE request occurs. This follows the
provider's [server-side checksum validation](https://docs.cloud.google.com/storage/docs/data-validation)
contract; live rejection and IAM remain to be tested.

`prepare-service.mjs` produced ignored `.private-firebase/service-proof-1/` with
artifact SHA-256
`104df9104d69af451fe59891b5c550cb0094ff9c642c0b1163b26e8a3129f3fd`.
The copied artifact and lock hashes match the resource plan, private files have
no group/other access, and test fixtures are absent from the deployment bundle.
A production-only dependency install and import of that exact bundle pass;
Firebase's exported endpoint metadata matches the proposed region, identity,
memory, CPU, concurrency, instance limits and timeout. These are local package
checks, not a deployed-configuration readback.

The proof-only Android bridge now offers native `vaultRequest` list/get/put
against the fixed project HTTPS endpoint. Firebase ID tokens stay in the native
Authorization header, redirects are disabled, and response sizes/timeouts are
bounded. The emulator-only operator runner validates uploads with the shared
codec and writes responses only to private evidence. No automatic scheduler or
product account UI is introduced. SignedProof18 compiles with the private catalog;
APK SHA-256 is
`6924cc5b187330b3ea1c87a3dd305e69ea78ccd5455b7a37f5a903fb06b62577`, and its
signature matches the retained signing certificate. It was built from tracked
dirty source based on `36af3fd`, not a clean release commit. No emulator or phone
has received this build, and no native service request has run. Existing release
variant isolation is unchanged; CI checks the added source compilation.

`cost-estimate.mjs` records reproducible illustrative pricing checked 2026-10-10:
approximately **$0.485/month before free allowances** for 32 × 25 MiB snapshots,
1,000 function requests, 2,000 instance seconds at one CPU/0.5 GiB, 1,000 class-A
and 5,000 class-B storage operations, 1 GiB North America outbound transfer,
1 GiB retained build artifacts and 30 e2-standard-2 build minutes with a 100 GiB
disk. This is assumed usage, not measured spending or a guarantee. Free allowances
may reduce it; taxes, unrelated usage, excess traffic and optional services are
excluded. Primary rate links are embedded in the script. Propose a $5 monthly
budget with alerts at $1, $2.50 and $5 before live verification; alerts and runtime
limits are not hard spending caps. Restrict seven-day artifact cleanup to function
build images, never library snapshots. Billing activation remains an explicit
prerequisite; no billed service has been provisioned.

Next: CI for this preparation, owner billing activation, then provision/read back
the exact planned resources and run synthetic live authorization, conditional
create, retry and separate-installation recovery checks. Only passing live evidence
can support selecting the production vault and completing the automatic-backup
design. Real authoring remains gated on automatic protection and proven restore.

### Live proof authorization and provisioning

Andrew chose the $5/month alert-budget setup and clicked Link account. The console
spinner persisted, but a direct Cloud Billing read confirms `billingEnabled=true`
and a linked account. No second linking attempt is necessary. The owner's action
supplies the prepared proof's billing prerequisite; continue the already-authorized
synthetic deployment and recovery work without another permission round.

`provision-service.mjs` executes the reviewed infrastructure plan explicitly:
verify prepared artifact hashes and the exact project, require billing to be
enabled, reconcile project-scoped $5 alerts at $1/$2.50/$5, enable required APIs,
create the dedicated identity and single-permission authentication role, and
create the private bucket with non-destructive object permissions. Preserve
existing IAM bindings using provider etags. Reject unexpected budget amounts,
bucket settings, public access or extra runtime roles. Save account/IAM details
only to private evidence. The script cannot link billing, upload snapshots,
delete data or deploy the function; deployment remains a separate explicit CLI
step using the prepared artifact. The initial inspect pass correctly stops when
the Budget API is not enabled; only explicit provisioning enables it.

### Live service and native recovery evidence

The Cloud Billing readback confirms the owner-completed upgrade succeeded despite
the console spinner. Provisioning readbacks confirm a private us-central1 STANDARD
bucket, uniform access, enforced public-access prevention, seven-day soft deletion
and no lifecycle deletion. The runtime identity has bucket Object Creator/Viewer
and only `firebaseauth.users.get` through its project custom role. A live effective
permission probe confirms create/get/list and absence of update/delete.

Project-scoped monthly current-spend alerts are configured at $1, $2.50 and $5.
These alerts are not a spending cap. The illustrative $0.485/month usage estimate
above is not a measured bill. Seven-day cleanup applies only to `gcf-artifacts`
build images. Cloud snapshots have no automatic cleanup.

`privateVaultProof` is ACTIVE with the planned Node 22, 512 MiB, one CPU,
concurrency one, min zero/max one instance and 60-second timeout. The deployed
artifact in private `service-proof-2/` has SHA-256
`d8b01054025e729c8746a1c80dc37ad7ed3e657ac8f17dc02f466a9a4e82fbd6`.
It adds bounded verifier diagnostic codes without logging credentials, claims or
exception text. An initial native list returned 401; requests passed after the
diagnostic redeployment, but no captured evidence establishes that first failure's
cause. Do not claim a confirmed propagation or token-verification fix. New API and
IAM setup also required propagation waits; inspection retries are bounded.

Live native signedProof18 checks using the admitted account:

- Slot 00: empty discovery, PUT 201, authenticated GET 200 with exact whole-library
  bytes, identical retry 200 with the same receipt/generation, and different-content
  retry 409 with the original preserved. Synthetic source is 7,993 bytes with SHA-256
  `5ce68bc0fa45c66379c11a246c2b95bf747769a0c0b5e045d356aaa2d5a7c1a8`.
- A separate installation began signed out with an empty native library and no
  copied app credentials. Signing into the same account discovered and downloaded
  slot 00 independently. The operator carried those returned cloud bytes into the
  existing actual Android document picker/review/import flow. All eight climbs
  and three playlists match after import and cold restart, including grades,
  angles, draft/finished/Trash state, effects and ordered local/provider entries.
  This is operator-assisted recovery, not an integrated product cloud-restore UI.
- A valid JSON fixture padded to exactly 25 MiB uploaded successfully to slot 03.
  Its first native GET received HTTP 200 from the provider but crashed the proof
  app with an `OutOfMemoryError` while constructing the bridge response. The
  retained cloud object was unchanged. The GET now streams into an app-private
  cache file with incremental SHA-256, size bounds and file sync; only file metadata
  crosses Capacitor. The emulator-only driver extracts the file, checks its size,
  digest and shared codec, writes private evidence and removes that temporary
  cache file. It also rejects on WebView disconnect instead of waiting ten minutes.
- SignedProof19 SHA-256
  `68d6d86aad984aca5cf9967d24c818d5bdf2984631b1fe9b9fa1fd30c0edbbbf`
  passes the same retained 26,214,400-byte GET exactly, SHA-256
  `f44652bb9367a0a71ef49104da9bb810a63b23ea801a9fb22952d71738c6384e`.
  Forced native session refresh succeeds afterward. A fresh validated whole-library
  backup and exact post-update comparison bracketed the same-key emulator update.
  This is an instrumented dirty-source proof build, not a clean release artifact;
  the padded fixture does not prove maximum-record-count production restore.

`verify-live-storage.mjs` independently exercises real provider permissions and
atomicity through a short-lived delegated credential for the dedicated runtime
identity. It temporarily grants only the existing operator token creation on that
service account, then removes and verifies removal of that membership in `finally`.
No service-account key is created. Native Google sign-in remains a separate proof.

- Two different simultaneous conditional creates in an unused slot have exactly
  one winner; the other returns 412. Unconditional overwrite and delete return
  403. The winner and original slot 00 remain exact.
- A genuine Firebase ID token for a synthetic different user is verified, then
  rejected by the live service with 403 for GET and PUT; the target slot remains
  absent. Anonymous and invalid tokens receive 401. Synthetic account cleanup and
  temporary operator IAM removal complete successfully.
- An early operator attempt stopped before storage access on IAM 403 and removed
  its temporary grant. A subsequent attempt passed IAM/storage but exposed a
  harness error: custom-token sign-in does not supply the asserted `localId` field.
  The corrected harness verifies the token's actual UID, cleans up the synthetic
  identity and reruns using a new unused slot rather than deleting prior evidence.
  Slots 01 and 04 retain the two race winners. The successful final evidence is
  private `live-storage-3/summary.json`.

Private evidence under ignored `.private-firebase/` includes provisioning/function
readbacks, `auth-proof/vault-live-*.json`, `auth-proof/live-recovery-1/summary.json`,
`auth-proof/vault-live-25mib-get19.json` and the live IAM summary. No owner phone,
real authored library or original PWA was modified. Tokens, account details, files
and emulator identifiers remain outside Git. Ten local service tests still pass;
the known direct-SDK emulator race remains an explicit TODO, not a live-service
claim. Lost-response behavior is covered locally plus live identical retry; a
deliberately interrupted live network upload is not claimed.

Next: settle the production vault contract using this evidence, then implement
native file transport, complete-snapshot revision acknowledgement, automatic
retry/admission, retention/capacity behavior and account/recovery surfaces in the
owning features. Test offline creation and subsequent automatic backup, failed or
interrupted writes, sign-out/account recovery and clean-install restoration through
the integrated app before admitting real authoring. Phone/Fullride acceptance is
still separate. The live proof service alone does not fulfill these requirements.

## Application vault design (2026-10-11)

The live evidence admits Firebase Authentication + the narrow authenticated GCS
service as the Android dogfood vault. Keep the existing project, bucket, runtime
identity, encryption, alerts and limits; the owning account is unchanged. This is
private backup, not sharing or multi-device synchronization. The automatic-backup
feature owns scheduling, durable revision/admission state and all product UI.

Directional question pass: account recovery, service encryption, offline use,
portable files and cheaper-first cost limits are settled. The prepared Manage,
connect, history and recovery mocks cover the forthcoming UI. Remaining pool,
chunk and retry sizes are reversible engineering choices, not new user decisions.
Direct reads covered gateway/native bridge/library/runtime/tests; one focused
read-only explorer mapped the cross-feature UI/restore seam. A standard independent
feature review will follow verification. One design advisory is warranted because
native file lifetime, identity changes and recovery receipts cross trust boundaries.

### Architectural choice

1. Native Firebase identity plus the already-proven gateway: choose this, with
   streamed native files and small bridge chunks. It preserves demonstrated account
   recovery and immutable storage without a new account/service.
2. Direct native Storage SDK: rejected here because it changes the proven access
   and conditional-write boundary; the earlier emulator race remains documented.
3. Another provider or JS token-bearing SDK: adds an unproven session boundary and
   does not resolve the native heap/large-transfer issue.

Keep the existing proof routes/data intact. Add `/library-v1/snapshots` and
`/library-v1/snapshots/<slot>` to the same function. Application slots are five
ASCII decimal digits `00000` through `00511`, exactly 512 immutable objects of at most
25 MiB (12.5 GiB maximum admitted application bytes); proof slots remain separate.
Application objects live at `owners/<uid>/library-v1/snapshots/<slot>`, disjoint
from proof data. Add four explicitly admitted `/acceptance-v1/r00N/snapshots` pools (`N` is 1–4)
with the identical 512-slot policy/algorithm under the matching owner prefix.
Separate runs allow clean-empty and retained-history acceptance without deleting
immutable test objects; arbitrary run names are denied.
Only a debuggable signed-proof build may select this pool through its ignored
variant-specific configuration; ordinary release configuration must select
`library-v1`. Status returns the scope so durable backup state cannot cross pools.
No app list/get route can discover the other pools. The acceptance pool is a
bounded synthetic test location, not an alternate product mode.
Keep every admitted snapshot; no pruning, deletion, mutable latest pointer, new
metadata database, or background-execution promise. Capacity exhaustion is visible
and stops uploads. This is the first dogfood retention policy, not indefinite free
retention. Existing $5 alerts remain alerts; measure actual usage before changing
policy. There is no fixed $25/month plan or new service instance.

### Public TypeScript contract

`web/src/private-vault/types.ts` owns the app-facing port; the native adapter is
its only production implementation. No token, signed URL or filesystem path enters
this contract.

```typescript
export interface VaultAccount { readonly uid: string; readonly email: string | null }
export interface VaultStatus {
  readonly configured: boolean;
  readonly installationId: string;
  readonly scope: 'library-v1' | `acceptance-v1/r00${1 | 2 | 3 | 4}`;
  readonly account: VaultAccount | null;
}
export interface VaultSnapshot {
  readonly slot: string; readonly bytes: number; readonly sha256: string;
  readonly generation: string; readonly createdAt: string;
  readonly exportedAt: string;
  readonly counts: Readonly<{ climbs: number; finished: number; drafts: number;
    trash: number; playlists: number }>;
}
export interface StagedBackup { readonly id: string; readonly bytes: number; readonly sha256: string }
export interface VaultListing {
  readonly snapshots: readonly VaultSnapshot[];
  readonly capacity: { readonly slots: number; readonly bytesPerSlot: number };
}
export interface VaultReceipt { readonly snapshot: VaultSnapshot; readonly verified: true }
export interface PrivateVault {
  status(): Promise<VaultStatus>;
  signIn(): Promise<VaultAccount>;
  signOut(): Promise<void>;
  list(uid: string): Promise<VaultListing>;
  stage(uid: string, text: string): Promise<StagedBackup>;
  upload(uid: string, slot: string, staged: StagedBackup): Promise<VaultReceipt>;
  download(uid: string, snapshot: VaultSnapshot): Promise<string>;
  discard(uid: string, stagedId: string): Promise<void>;
  retainStaged(uid: string, ids: readonly string[]): Promise<void>;
}
```

`VaultError` carries a bounded code: `not-configured`, `signed-out`,
`account-changed`, `not-admitted`, `cancelled`, `offline`, `unavailable`,
`conflict`, `missing`, `invalid-response`, `invalid-backup`, `staging-missing`.
Provider/SQL exception text, credentials and library contents never enter logs.
Strict response decoders fail closed on malformed metadata, capacity, duplicate
slots, noncanonical slots, invalid digest/generation/date/size and wrong receipts.
Download validates the listed generation, digest, size and strict backup codec;
a receipt validates the requested slot and staged digest/size. Older caller identity
cannot consume a completion after sign-out/account change, including sign-out and
back into the same UID: capture and recheck a native session epoch as well as UID.

### Implementation units and order

1. **Application service contract and isolation** —
   `web/src/private-vault/{types,contract}.ts` and gateway
   `{contract,handler,gcs-store,index}.mjs`, plus focused tests. Reuse the same handler
   and store algorithm with explicit proof/application pool definitions rather than
   fork the security logic. Validate path/slot/prefix from the selected pool, preserve
   current proof defaults/tests, and route the application prefix explicitly.
   A bounded listing of at most 513 objects detects excess/duplicate metadata.
   The application/acceptance metadata includes server-derived exportedAt and
   counts computed from the decoded backup at creation; finished/draft counts exclude
   Trash, and their sum with Trash equals all climbs. Reject inconsistent counts or
   byte/codec/count limits. Do not require a history viewer to download every full
   copy to learn counts. Keep legacy proof metadata unchanged.
   Continue generation-zero creates, server CRC metadata and independently verified
   readback. Deny unknown methods/queries, anonymous/different accounts, overwrite
   and delete. Application and proof routes cannot cross namespaces. Build bundles
   the shared codecs/contracts; no UI or private evidence enters the deployment.

2. **Native account and file transport** — main Android
   `NativeAccountPlugin.java` + `PrivateVaultPlugin.java`,
   `MainActivity.java`, `app/build.gradle`, and
   `prototypes/ios/src/{private-vault-plugin,native-private-vault}.ts`.
   Extract the proven account/session methods into a common native base where useful
   so the proof and application do not maintain separate authentication protocols.
   Native Firebase SDK and Credential Manager continue to own tokens/session storage;
   verification/access stays native with a fixed HTTPS endpoint, no redirects, bounded
   timeouts and at most one forced-token-refresh retry after HTTP 401. Recheck the
   expected Firebase UID before request and before returning. Refresh failures do not
   prevent local application startup or offline use.

   The hardest unit is durable upload staging without large bridge strings.
   Stage strictly decoded UTF-8 backup bytes in bounded chunks (at most 64 KiB
   decoded per call), base64-encoding UTF-8 byte ranges in both directions rather
   than splitting strings/surrogate pairs; require ordered offsets, exact declared
   size/digest, file sync
   and atomic sealing before returning an opaque UUID. Keep sealed uploads in an
   app-private `noBackupFilesDir` subdirectory, bound to the native account. Never
   accept arbitrary paths/URLs. A native installation UUID also lives in this
   non-restorable directory and survives ordinary updates, not app removal.
   Upload streams the sealed file; receipts never imply the JS coordinator has
   acknowledged a library revision. Interrupted/lost-response uploads leave sealed
   bytes available for the same retry. Discard is explicit after durable caller
   acknowledgement. `retainStaged` deletes only this account's unreferenced staging
   files, never a database, authored library, downloaded backup or cloud object;
   the coordinator supplies its durable pending ID before invoking cleanup. Sealed
   files are bound to owner and pool; native staging operations are serialized,
   reject stale session epochs, and cleanup never removes admitted in-flight files.

   GET streams to a temporary native file while hashing/limiting bytes and checking
   returned generation/digest against the selected snapshot. Read that file across
   the bridge in bounded chunks; incremental fatal UTF-8 decoding and the shared
   backup codec validate it before returning text. Clean only the temporary download
   after transfer. Download temporaries use a dedicated noBackupFilesDir directory,
   not the evictable cache. Plugin load removes partial staging/download remnants,
   never sealed files. Each append has its own ID/offset; no busy lock spans bridge
   calls. Serialize file/transfer operations separately from account operations so
   sign-out immediately invalidates the session epoch during a long transfer.
   Do not allow account changes to mix
   chunks or receipts. No 25 MiB Java String/Base64/JSONObject response is permitted.

3. **Packaging and integrated transport evidence** —
   `scripts/prepare-android-vault.mjs`, signed build checks and native proof driver.
   Generate ignored `vault-config.json` from the existing registered app's public
   Firebase configuration; never accept a service key/operator credential. Pin the
   exact project/package/client and service origin. Compile-only/CI builds may lack
   configuration and expose `not-configured`; a configured daily-use build includes
   native auth but remains non-debuggable and excludes proof activities/config.
   Preserve app ID, signing key, OS backup exclusions and increasing version codes.
   Update release-isolation assertions to distinguish intentionally admitted native
   auth from the still-excluded proof surface.

### Verification and acceptance

- Local HTTP/SDK tests for both pools, namespace isolation, all 512 application
  slots, invalid routes/metadata/receipts, conditional races/retries, strict schema
  and no destructive storage requests. Existing proof cases remain honest.
- Native-adapter tests for chunk boundaries (including multibyte UTF-8), exact
  digest/generation/size checks, wrong-account/late response, staging restart/retry,
  missing/corrupt file and cancellation/401 refresh behavior. Use injected native
  transport and actual shared backup codecs; don't merely mirror Java code in mocks.
- Compile configured signed proof and unconfigured CI variants. Before an emulator
  update, retain/validate its complete library; compare after update. Validate real
  native sign-in/renewal and 25 MiB app-namespace put/list/get with synthetic data,
  plus process restart with a sealed pending file. Production-namespace synthetic
  acceptance must use a separately reserved test owner/namespace or a temporary
  isolated service configuration; never seed the owner's future library with test
  snapshots. Keep proof endpoint/test pool for routine live transport verification.
- Service changes deploy only from the prepared, reviewed artifact through the
  existing explicit project path; verify IAM/runtime/bucket unchanged. Actual app
  automatic scheduling/restoration is the next feature's acceptance, not this one's.

### Risks and ownership

Persisting staged bytes before recording the durable pending ID can leave an orphan;
cleanup must use the authoritative SQL pending state and account, never directory
age or an optimistic assumption. An auth change invalidates in-flight results.
Chunked transport solves the observed Java heap failure; maximum record-count and
JS restore memory still need integrated acceptance. Capacity must report paused
protection rather than delete older versions. Unknown initial proof 401 remains a
recorded limitation; production handles one refresh retry and visible failure.

One owner implements this cohesive vault feature; its service/native/acceptance
checkpoints have different test surfaces and span multiple sessions, so child
stories provide resume points. No automatic-backup implementation is dispatched
until the vault is verified at review or done. Review weight is standard from
`.work/CONVENTIONS.md`, with one cross-model review and fix verification.

### Dispatch and checkpoints

One feature owner implements the service and native checkpoints sequentially; the
host owns isolated live acceptance and feature review. Child stories are
`private-vault-service`, `private-vault-native`, and `private-vault-acceptance`
(all prefixed by `epic-library-preservation-`). Each has distinct verification
and a separate completion commit. The dependency graph is acyclic and native
library is terminal. Automatic-backup remains design-only until this feature's
integrated verification is green.

Implementation capability: the skill's default GPT-5.6 Luna is unavailable; use
available GPT-6 Luna at xhigh for this cross-language security/data-preservation
work. Root owns design adjudication, integration verification and the standard
one-pass Claude review. The worker may not deploy, read private account evidence,
change real device state, or push. Shared working tree ownership excludes the
automatic-backup feature and unrelated untracked documentation.

## Other agent review — application design advisory

Claude Opus xhigh, read-only peer job `20261011T153611Z-e20f1bfa`, completed
2026-10-11 with seven material suggestions. This advisory is not feature approval.
Receiver adjudication:

- Accepted paged native SQLite reads and a structured maximum-library memory proof;
  the automatic-backup feature owns that capture/restore seam. A padded 25 MiB
  transport proof alone is insufficient. Add a constrained-heap gateway fixture.
- Accepted server-derived per-copy counts/exportedAt and five-digit slot names
  before any application object is created. Initial admission remains 512 copies;
  larger policy requires separately tested listing/cost changes. Legacy proof
  metadata/paths stay stable.
- Accepted separate bounded acceptance run prefixes, with four admitted runs rather
  than the suggested 1,000, to keep aggregate storage exposure bounded.
- Accepted durable target-slot identity, independent known history, missing-stage
  reconciliation and atomic recovery hold/digest. The dependent design already
  carries most; clarify that restored equal content becomes a protected baseline
  without a duplicate exportedAt-only upload.
- Accepted immediate auth-epoch invalidation, per-call staging offsets, UTF-8 byte
  chunks and non-evictable download temporaries. Retain native owner/pool file
  binding rather than the proposed unbound files because it catches cross-scope
  misuse independently of caller metadata.
- Keep the deliberately short foreground capture interval for the first dogfood
  protection target; do not depend on an inactive callback or claim execution after
  suspension. 512 copies may last only roughly 10–25 active setting sessions.
  Expose remaining capacity and retained-copy pause; future retention/capacity work
  is required before promising indefinite daily use. Five-digit naming keeps a
  later bounded increase possible. No silent pruning permission is inferred.
- Keep explicit mutation-transaction revision increments with full write-surface
  tests rather than adding trigger-based per-row revisions: the current serialized
  adapter is the only write owner and one revision describes one committed change.

A 60-second service timeout still limits very slow 25 MiB uplinks; failed transfers
remain pending and retry idempotently. Smaller normal backups do not prove that
upper-size/slow-network combination.

### Native checkpoint ownership refinement

The service checkpoint is verified and committed. The cross-language native
checkpoint is unusually broad, so root takes the coherent configuration/APK-
isolation/live-driver slice while the single feature worker retains the adapter,
native account/file plugins and Gradle dependencies. These are disjoint write sets
with the plugin contract already specified; root and worker serialize Gradle and
combine the verified changes into the native checkpoint's one completion commit.
Root also owns the reproducible structured-fixture acceptance helpers. No extra
implementation worker or one-story fan-out was added.

## Integrated implementation verification (2026-10-11)

The service (`de88541`), native transport (`b39b343`) and live acceptance
(`96cec2e`) checkpoints are complete. The common gateway owns legacy proof,
application and four bounded acceptance pools, preserving immutable creation and
verified readback. Native authentication never exposes tokens to JavaScript;
sealed account-and-pool-bound files and bounded UTF-8 chunks avoid the observed
large Java bridge response failure. The actual adapter was exercised through
native plugins on two signed emulator installations, including reauthentication,
process restart, exact retry/conflict and all-record-count structured readback.
Release packaging excludes the proof surface; unconfigured compile-only builds
remain valid. Foundation assertions were aligned in `4903a52`.

Verification: web lint/typecheck and 838 tests, prototype lint/typecheck and 100
tests plus 10 package/config checks, gateway 16 tests, signedProof20 and release21
build/isolation checks, unconfigured debug compile, and the acceptance child's
live evidence. No authored phone library was modified. The actual automatic
queue/status/recovery journey is deliberately the next feature's boundary.

Standard review: one independent Claude implementation pass, then receiving-agent
adjudication and verification of accepted fixes. This application implementation
review is distinct from the earlier design advisory and earlier provider proofs.

## Standard implementation review — adjudication in progress

Claude Opus xhigh completed one balanced independent pass at `fd261f8`, job
`20261011T162201Z-d5498093`; it independently reran gateway16/shared-contract11/
adapter5 tests. Root separately reproduced a late download-completion/sign-out
race with a new failing regression. The reviewer called other concerns mostly
hardening; receiving-agent assessment treats pre-create metadata validation,
bounded transfer waits, local-file error honesty and test/build namespace isolation
as material to this preservation release. Stale acceptance documentation is also
accepted. These bounded fixes belong to child `private-vault-review-fixes`.

No second independent pass is required under standard weight. Root will verify the
named fix set and document every proposal's final disposition. Automatic-backup
implementation may continue on its already verified port; release/admission remains
blocked until the fixes and integrated recovery acceptance pass.


## Standard review — verified fix disposition

The one Claude pass and root regression are adjudicated; child review-fixes is
complete in `8d07975`. Accepted material fixes cover the late account race, metadata
validation before immutable creation, bounded token/transfer waits, honest storage
errors, namespace isolation and stale documentation. Their focused tests, signed
Android builds and live service/native verification pass. The parent returns to
review only to await CI; standard weight does not require another independent pass.

The abort mock and retention test gap were corrected. Five native boundary tests
now run in CI. Exact forced-401 retry injection, wider socket failure testing,
partial-file reclamation and directory-sync exploration are important follow-up
work parked unbound in `idea-vault-fault-injection`; current impact and evidence
limits are recorded there. No finding is dismissed merely because the reviewer
called it low priority. Automatic scheduling/UI recovery and physical hardware
acceptance remain owned by their existing features.


## Standard review — closure

**Approve with comments.** Effective weight: standard. Independent implementation
passes: one (Claude Opus, `20261011T162201Z-d5498093`), followed by root adjudication
and verification of the named fix set; no second independent pass. All material
current-cycle findings are closed by `8d07975`, with live evidence and limitations
in its child record. Important follow-up work remains parked unbound.

[CI run 38157083796](https://github.com/andromedus1/cruxcontrol/actions/runs/38157083796)
passes at `44988b3`: web lint/type/unit/build/browser, prototype browser and unit
checks, Android compile plus the new Java tests, and authenticated gateway tests.
The separate legacy Storage SDK policy exploration retains its explicit known-race
TODO; it is not this feature's immutable-backup acceptance.

The private vault feature is complete. Automatic backup/recovery and physical
phone/Fullride acceptance remain active dependencies of real-authoring admission;
this closure is not a dogfood-release or merge claim.
