---
id: epic-library-preservation-private-vault
kind: feature
stage: drafting
tags: [data, security, infra]
research_refs: [independent-library-preservation, native-backup-service-costs]
parent: epic-library-preservation
depends_on: [epic-library-preservation-native-library]
release_binding: null
gate_origin: null
created: 2026-10-10
updated: 2026-10-10
---

# Access private backups through a recoverable account

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
