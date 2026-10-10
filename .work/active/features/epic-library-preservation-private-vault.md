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
- [Existing native shell](../../../prototypes/ios/README.md); native packaging does not currently imply native library persistence.

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
the architecture. No account, paid plan or service has been provisioned.

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

Provider selection and a real native account proof remain open. Do not advance
this feature to implementation on the strength of storage documentation alone.

### Usage-priced candidate

The focused [native service cost assessment](../../../.research/analysis/briefs/native-backup-service-costs.md)
adds Firebase native Authentication plus Cloud Storage as another proof candidate.
Its documented Capacitor 8 path and renewable native sessions warrant testing, but
native sign-in does not automatically authenticate a WebView SDK. Keep identity and
object access on the demonstrated native path; inspect token persistence and OS
backup exclusions before claiming secure recovery.

Firebase Storage requires a Blaze billing account even within eligible no-cost
allowances. A US-region bucket can use those allowances; overages are chargeable,
and Storage budget alerts are not a hard cap. No billing account or project has
been created. The answered budget question establishes a cheaper-first operating
constraint, not provider selection or permission to activate billing. The source review passed
after bounded wording/citation corrections; execution evidence remains pending.

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
- The native SDK proof still needs project/app registration and Google provider
  configuration. Browser login for the operator CLI succeeded with Andrew's chosen
  account; that is service setup access, not evidence that sign-in in the Android app works. Do not advance
  this feature from drafting until the required design and native proof are ready.

Setup references checked 2026-10-10:
[Spark and social sign-in](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans),
[CLI authentication](https://firebase.google.com/docs/cli#log_in_and_test_the_firebase_cli),
[Android Google sign-in setup](https://firebase.google.com/docs/auth/android/google-signin).

### Account setup checkpoint

The dedicated Google Cloud project is created. A direct billing-info read confirms
no linked billing account and `billingEnabled=false`. Firebase activation currently
returns HTTP 403; direct project permission checks confirm the operator has
`firebase.projects.update`, project read and service-enable/read permissions.
Firebase documents unaccepted first-use terms as another possible cause. Andrew
has been asked to complete console onboarding in the chosen account. No Firebase
app, Google provider or Storage bucket is configured yet. The initial longer project
ID was rejected before creation; only the shorter ID above was created.

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
