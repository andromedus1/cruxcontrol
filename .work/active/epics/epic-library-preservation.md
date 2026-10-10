---
id: epic-library-preservation
kind: epic
stage: implementing
tags: [data, security]
research_refs: [android-chrome-recovery-access, independent-library-preservation]
parent: null
depends_on: [story-phone-library-recovery]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-10
---

# Preserve private libraries across browser and device loss

## Brief

Make authored climbs and playlists independently recoverable while preserving offline
creation and board use. Andrew has authorized moving on from the phone recovery
attempt and explicitly requested both automatic private online backups and portable
backup files he controls. This is the immediate priority ahead of catalog expansion
and invited sharing. It is not a requirement to publish private work to friends.

The shipped app has manual whole-library file export/restore, but no automatic
independent backup. This epic owns closing that gap, showing the actual protection
state, retaining recoverable versions and proving restoration after complete local
storage loss. The design must state the remaining window of vulnerability for offline
edits and must not promise that every possible loss can be prevented.

## Strategic decisions

- **Both backup forms:** automatic private online backup and portable complete files
  for owner-controlled storage. Andrew's answer was “can we do both?”; both are in scope.
- **Local use:** authoring, saved-climb browsing and board control remain available
  offline. No sign-in or backup outage may prevent access to already-local work.
- **Private recovery:** a backup is not a contribution to the invited shared library.
  Existing future sharing membership must not grant access to private backups.
- **Account protection (Andrew, 2026-10-09):** service-managed encryption and
  recovery through a normal account are acceptable. Operator-blind end-to-end
  encryption and a separate user-managed recovery key are not required.
- **Recovery disposition:** assume the missing post-migration creations are lost for
  planning. Retain incident evidence; no lab escalation, reset or reconstruction is
  required to begin this work. The sixteen imported climbs are not the lost creations.
- **No stack selected:** online backup is authorized as a capability. No provider,
  paid plan, account, upload, public deployment or destructive restore is selected by
  this scope. Choose technology after the focused research and concrete review.
- **No interim PWA authoring (Andrew, 2026-10-09):** Andrew does not plan to keep
  creating climbs in the current app during the build. Do not assume an active
  library needs new PWA protection features in the meantime.
- **Platform sequencing:** proceed with the native-client storage and recovery path.
  Prove actual native persistence, automatic private online backup, portable files
  and complete restoration before treating the new client as ready for everyday
  authoring. Current-PWA hardening is not a prerequisite. Android remains the first
  phone acceptance target; unavailable iPhone hardware does not block preparation.
  Browser persistence remains a technical comparison, not a required PWA release.
- **Existing material:** retain the recovery evidence and available files. If any
  surviving library is transferred, validate its export and target restoration;
  that conditional handoff does not require building automatic backups for the PWA.

## Required outcomes

1. Capture all saved authored contents: Draft/Finished/Trash, names, angles, grades,
   holds/roles, identity/revisions, effect recipes, playlists, ordered memberships,
   missing/provider references and records across installations. Reuse strict codecs.
2. After initial user setup, back up committed changes automatically while execution
   and network access are available. Retry failures safely; distinguish local saving,
   pending protection, verified independent backup, and backup failure. Define the
   acknowledgement and verification required before claiming protection.
3. Keep immutable prior snapshots under an explicit retention policy. Missing,
   unreadable, empty, stale or partially read local stores must never silently replace
   a good recovery point or propagate inferred deletions. A new browser/device must
   be able to discover its backup without depending on a key stored only in the lost
   origin. Legitimate deletion requires explicit semantics separate from absence.
4. Keep complete, validated portable files available independently of the service.
   Research whether repeated file copies can be automatic on each supported platform;
   never describe browser downloads or a same-origin copy as an independent automatic
   backup without proof of delivery. User-controlled files on another device or drive
   provide an additional failure boundary.
5. Restore into an empty client from the independently retained copy, preview contents,
   preserve IDs and exact playlist order, block conflicts and report partial outcomes.
   Account/session/key recovery must remain possible after total browser/device loss.
6. Reduce local eviction exposure where feasible and communicate its limits. A
   persistence grant, same-device second database, service worker, sync cache or native
   wrapper alone does not satisfy independent recovery.
7. Make device/laptop migration verifiable: inventory wanted libraries and backups,
   validate a fresh independent copy and perform a restore comparison before declaring
   migration preservation complete. Git/source transfer is not personal-data transfer.

## Acceptance scenarios

Use synthetic libraries and isolated origins/devices for destructive tests. Never
erase Andrew's profile to demonstrate recovery.

- An acknowledged protected library survives deletion of all test-origin storage and
  restores on a clean client with exact semantic equality, including grades, effects,
  Trash, IDs and playlist ordering.
- An offline edit saves and remains usable; protection stays pending until that exact
  revision is independently acknowledged. Offline loss before backup is reported as
  a limitation, never hidden behind a generic Saved message.
- A lost browser identity, expired session or recreated empty installation cannot
  overwrite a prior nonempty snapshot. Recovery uses credentials held independently
  of the lost origin; test the chosen account/key recovery path.
- Interrupted capture/upload, quota failure, concurrent tabs and out-of-order retries
  preserve prior versions and cannot label a mixed or incomplete snapshot protected.
- A retained portable file restores in isolation without access to the online service.
- Corrupt files, incompatible versions and restore conflicts produce actionable
  failure without destructive fallback. Partial per-store commits remain retryable.
- Update and migration checks verify actual contents against an independent copy.

## Grounding

Reuse the [incident record](../../archive/story-phone-library-recovery.md) and the
[recovery-access brief](../../../.research/analysis/briefs/android-chrome-recovery-access.md)
for the loss pattern and access limits. Existing implementation entry points are
`web/src/library-backup/{service,codec,indexeddb-store,delivery}.ts`, the climb and
playlist repositories, runtime composition and update admission. Existing manual
backup limits and per-store transactions are contracts to review, not evidence of
automatic backup or a cross-store consistent snapshot.

The invited-library/access and iOS briefs are reusable constraints, not a selected
private-backup architecture. The completed [preservation comparison](../../../.research/analysis/briefs/independent-library-preservation.md) grounds:

- Browser/Android and native execution, persistence and file-delivery limits;
  foreground retry behavior and what survives origin loss.
- A minimal private online backup destination, authorization/account recovery,
  encryption/key recovery tradeoffs, retention, cost and cross-origin/native access.
- Coherent snapshot capture across current independent stores, revision identity,
  safe acknowledgement and recovery detection without relying on erased local flags.

Research verification is complete; the epic remains at drafting for directional
design and mockup alignment. Apply the corrected comparison and settled decisions;
do not re-ask whether online and portable-file protection are wanted. Provider
authentication and native persistence still require implementation proofs.

## Scope boundaries and simplification

Extend the existing whole-library representation and restore behavior where sound;
avoid duplicate backup serializers or a generalized synchronization framework. This
epic supplies recovery, not live multi-device editing, group publication, provider
catalog backup or a rewrite of board control. Catalogs remain independently
reacquirable; irreplaceable authored content is the preservation priority.

No new UI structure is selected at scope time. Setup, protection status, version
selection and recovery need mockup-first alignment after the feasibility decisions;
no production UI is authorized by an unreviewed sketch. Code, infrastructure and
phone rollout remain subject to the normal PR, acceptance and preservation gates.

## Scope verification

Top-level epic: the work introduces an independent recovery boundary and several
user capabilities, beyond a one-file bug fix. It depends only on the recovery
disposition, not the catalog or invited-service implementation. Source and work
inventory found no existing active automatic-private-backup owner to duplicate.
Foundation intent now distinguishes local availability from recoverability and
permits a narrow private-backup service without selecting a vendor.

## Research execution

Andrew explicitly authorized starting this work after the dual-backup scope was
recorded. The focused decision is whether a private hosted snapshot vault plus
owner-controlled files can meet the recovery contract without rewriting local
authoring. Apply standard verification with one independent adversarial read.
This is existing authorized work; no additional scope-confirmation round is needed.

```yaml
intent: terminate-in-position
output_kind: synthesis-brief
consumer: calibrated-work
verification_rigor: standard
temporal_contract: re-engage-on-trigger
primitives_extends: []
primitives_opts_out: []
decision_relevance: Select the backup boundary and first proof from execution, recovery, identity, retention and snapshot-consistency constraints; reject options that require unreliable background work or phone-only recovery secrets.
scope_authority: pre-registered
analytical_artifact_type: per-campaign-brief
```

Substrate check: existing invited-library/cost and iOS analyses inform comparison
questions but do not establish private-backup behavior; treat them as lenses and
re-fetch primary documentation. The Android recovery brief describes the incident's
access limits rather than a prevention architecture.

Candidate engagement shapes: (1) one focused end-to-end backup/recovery comparison,
(2) separate provider-specific campaigns, (3) a broad native-storage migration
campaign. Select (1): the decision is one recovery contract, while (2) duplicates
client constraints and (3) expands beyond the immediate preservation decision.
Direct code reading plus primary sources is sufficient for acquisition; independent
review checks the composed recommendation. No specialist authoring fan-out needed.

Andrew additionally asked whether CruxControl should become an installed native app.
Extend this same assessment to compare actual native persistence with a WebView
wrapper. The proposed native experiment compares a shared-UI SQLite adapter against browser
persistence, with the new client's preservation capabilities as the delivery target.
Existing iOS simulator tooling can exercise the stronger documented iOS storage case; Android native
validation remains necessary before a phone-client migration. This is a proof recommendation, not
authorization to discard the PWA or a claim that the existing iOS shell uses native
library storage. The existing prototype explicitly reuses IndexedDB.

## Implementation grounding

Direct code reading for the native-app question found reusable domain ports in
`web/src/drafts/repository.ts` and `web/src/playlists/repository.ts`. However,
`web/src/app/create-runtime.ts` currently opens both IndexedDB databases and
constructs their repositories and backup store directly. A native persistence proof
must exercise a real alternative composition, not relabel the existing databases.
The existing backup service compares repeated reads of two independent stores;
that is not a cross-store transaction. Preserve its strict codecs and complete
logical format while proving a coherent capture boundary.

`prototypes/ios/src/runtime.ts` recognizes iOS explicitly, injects native BLE and
file delivery, then uses that same IndexedDB-based runtime. Android packaging and
native persistence are additional work; the compiled iOS shell is not evidence of
an Android build or SQLite-backed authoring. The community catalog is separately
reacquirable and does not need to become part of an authored-library backup.

Use the existing synthetic fixture for native capture/relaunch/update/restore
checks. A new native app is a separate storage identity: moving any remaining
browser library requires an explicit validated export/import comparison, never an
assumption that installation transfers browser storage. The source profile must
remain intact during that handoff. New setup/status/recovery UI still needs the
mockup alignment already required above.

Keep the native experiment bounded to persistence and complete recovery through the
existing interface. A failed native proof should trigger a revised storage/framework
choice, not automatically create a current-PWA hardening project. Andrew is not
planning interim PWA authoring. Choosing the production client, distribution path
and hosting account remains separate from validating these reversible technical candidates.

## Research outcome and review adjudication

The verified comparison covers browser/native persistence, coherent capture,
portable-file execution limits, private vault primitives and recoverable sessions.
One independent Claude Opus pass identified three material corrections, all accepted:
Android persistent IndexedDB must be a comparison baseline; surviving data needs a
verified transfer before real migration; and service authentication must be compared
evenly rather than ranking Cloudflare storage primitives as proof of native session suitability.
The lead verified the corrections against primary sources. The review's stronger
claim that every migration requires completed automatic backup was narrowed: an
independently retained, validated portable export can bridge migration, and synthetic
native experiments do not migrate personal data. The CORS cookie warning was also
kept in its documented Incognito context rather than generalized to every browser.

No service, account, production framework or phone rollout was selected. The next
design pass should turn native local persistence, complete portable recovery and
private versioned backup into capability-owned work for the new client. The current
implementation's missing `navigator.storage.persist()` call remains a diagnostic
finding; it is not a required implementation task under the no-interim-use decision
and does not establish that a persistence grant would have prevented this incident.

Research was acquired inline and checked with one independent reader; no authoring
fan-out or repeated review loop. Output: the linked brief and its source attestations.
Verification includes citation resolution, primary-source spot checks, local links,
knowledge-index lint and whitespace checks. The exact data-loss trigger remains
unproven; the native recommendation must not silently recast it as confirmed eviction.

## Owner clarification: delivery target

Andrew rejected the assumption of continued PWA use during the build. The earlier
current-client-first recommendation depended on that assumption, not on a technical
requirement to retrofit the PWA before building a native app. The sequencing above
applies his clarification: focus new preservation work on the app he will resume
using. Reuse existing domain logic, UI and portable-backup contracts where sound.
Keep both requested backup forms and verified recovery as readiness requirements;
there is no separate interim-PWA protection milestone.

## Design decisions

Directional alignment was prepared on 2026-10-09. Andrew authorized proceeding on
2026-10-10 with an explicit near-term Android dogfood target, full existing feature
parity, off-phone backup and the Kilter catalog. Full decomposition follows below.

- **Privacy and recovery:** Andrew selected account-protected backups, encrypted
  by the service, with account recovery. Prove owner-only authorization and recovery
  without the old device; do not introduce a phone-only secret or imply that the
  service operator cannot decrypt the content. This selects the trust boundary,
  not a hosting vendor or paid account.
- **Native persistence first:** begin with an installed Android client using real
  native storage behind the existing library ports and shared UI. Extend the
  existing shell rather than building a second domain implementation. A single
  native library database is the candidate for coherent capture; its exact adapter
  and transactional behavior need the native proof. The current browser Worker/OPFS
  catalog SQLite implementation does not supply native authored-library persistence.
- **Ownership across epics:** this epic owns native authored-data storage, Android
  packaging, private backup/recovery and everyday Android acceptance. The iOS epic
  retains its physical-iPhone BLE, permissions, authentication, file-delivery and
  distribution gates. Share implementation where practical; an Android pass cannot
  close untested iPhone acceptance.
- **Protection semantics:** separately show committed local saves and a verified
  independent copy. An offline edit, expired session, full backup store or failed
  local save cannot inherit a misleading success state from an older snapshot.
  On a new or restored installation, discover retained backups and verify status
  before admitting uploads from possibly empty or stale local state.
- **Portable copies:** offer a complete validated file through the platform's save
  or share mechanism. A completed handoff alone does not prove off-device delivery.
  Automated repeated file copies remain conditional on platform proof; they do not
  replace either automatic online backup or owner-controlled export.
- **Retention proposal:** retain immutable earlier copies for the first release;
  stop new uploads and surface capacity exhaustion instead of silently pruning.
  Size limits, cost and any later explicit pruning policy belong in the concrete
  service proposal, before provisioning. The mock demonstrates this conservative
  default without promising unlimited storage.

The light code-mapping pass verified that Android packaging, native repository
composition and a coherent backup boundary are all missing today. Scope the next
full design around useful capabilities rather than storage/API/UI layers. Preserve
real-board control, update/signing usability and full recovery as named acceptance
within those capabilities; do not lose them inside a database-only milestone.

## Mockups

- Flow: [library preservation preview](../../../.mockups/flows/library-preservation/index.html).
- Direction carried forward under Andrew’s 2026-10-10 instruction to proceed.
  Reuse this prepared flow; this records authorization, not a claim that Andrew
  individually reviewed every simulated state.
- Everyday path: compact library status → Back up & restore hub → portable file.
- Recovery path: connect an account → retained versions → review → checked recovery.
  Portable files enter at review without sign-in. These are branches around a hub,
  not a seven-step setup wizard.
- Inherits the existing design tokens, components and compact-status/Manage pattern;
  all sample names, account details and counts are synthetic.
- State previews cover offline pending writes, renewed installation verification,
  expired sign-in, full backup storage, failed local saves, nonempty/conflicting
  restore targets and cancelled file delivery. Existing
  [file-recovery states](../../../.mockups/flows/library-backup/index.html) remain
  references for detailed conflict/partial-result presentation.
- Provider sign-in and OS file delivery are simulated handoffs. The mock does not
  establish authentication, storage, upload or restoration correctness.
- Validation: eight HTML files (seven surfaces plus navigator), working internal
  links, mobile light/dark layouts, desktop overview and browser-driven navigation
  through online recovery, conflicts and portable-file cancellation/recovery.

## Android dogfood milestone

Andrew’s target is a private usable Android build within the next few days. Full
functionality means parity with the shipped wall-session app, including native
Bluetooth, editor/grades/effects, Drafts/Finished/Trash, ordered playlists/play-through,
screenshot import, keep-awake, files and useful sharing. Include the approved older
Kilter catalog in this build; current official catalog coverage remains separate.
Use direct private APK installation and updates for initial dogfood. Public store
publication, partner sharing and iPhone hardware acceptance do not gate this target.

Do not silently reduce the agreed independent-protection requirement to a local file
or rely on Android automatic OS backup. Both automatic account-protected snapshots
and complete portable files remain in scope. Andrew explicitly confirmed on
2026-10-10 that automatic online backups must pass before real authoring; a temporary
manual cloud-file bridge is not accepted. Keep pre-admission testing synthetic and
verify online recovery into an empty installation as well as portable-file recovery.

## Decomposition

Six capability owners cover native local use, portable recovery, recoverable account
access, automatic protection, native catalog availability and complete Android
wall-session parity. Keep the existing shared React/Capacitor direction because its
UI and controller already exist; a native-view rewrite expands the critical path,
while a browser-only wrapper leaves the intended storage boundary unimplemented.
Do not split by database/API/UI layers or create test-only features. Online restore
belongs with automatic protection; Android parity can proceed independently of
hosted-account setup. Daily-use admission remains the aggregate epic gate.

- `epic-library-preservation-native-library` — Author offline in the native Android app; depends on none.
- `epic-library-preservation-portable-files` — Keep and restore a complete portable library file; depends on `epic-library-preservation-native-library`.
- `epic-library-preservation-private-vault` — Access private backups through a recoverable account; depends on `epic-library-preservation-native-library`.
- `epic-library-preservation-automatic-backup` — Automatically protect saved native library changes; depends on `epic-library-preservation-native-library`, `epic-library-preservation-private-vault`.
- `epic-library-preservation-android-catalog` — Use the older Kilter catalog in the Android app; depends on `epic-library-preservation-native-library`.
- `epic-library-preservation-android-parity` — Use the complete Android wall-session app; depends on `epic-library-preservation-native-library`, `epic-library-preservation-portable-files`, `epic-library-preservation-android-catalog`.

### Decomposition risks

- Prove the packaged catalog early: OPFS/Worker/WASM or compressed-byte serving may
  require a native catalog adapter. The Git-ignored database must not disappear in CI.
- Native storage must replace the IndexedDB composition and provide coherent capture;
  a compiling shell alone is not completion. Transaction/disk errors must fail saves.
- Account/session recovery is the off-phone protection critical path. Do not choose
  the service merely because a storage API is convenient or assume a paid account exists.
- Native file/clipboard/share/awake/Back behavior and usable outbound URLs need named
  ownership; shared screens do not establish device parity.
- Private signing identity must survive laptop replacement. Preserve the signing key
  outside Git and verify an actual same-identity upgrade before daily-use admission.
- Close the loop on a physical Android phone and board. Emulator results cannot
  establish BLE or the owner’s installed-WebView behavior.

## Next design entry

Design and implement `epic-library-preservation-native-library` first. Run the Android
packaged catalog smoke early alongside that proof, then complete portable copies,
account access, automatic protection and clean-client recovery. Service selection,
platform failures and phone/board availability determine timing; do not promise a
fixed delivery date before those proofs. No further current-PWA preservation release
is a prerequisite.
