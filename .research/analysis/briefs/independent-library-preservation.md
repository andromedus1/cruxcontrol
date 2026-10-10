---
title: Recoverable local libraries across browser and native clients
description: Choose a persistence and independent-backup boundary that survives local origin or device loss.
type: brief
kind: research
updated: 2026-10-09
status: locked
provenance: agent-synthesis
verification_status: reviewed-corrections-verified
summary: >
  Continued authoring warrants protecting the current client during a transition;
  paused authoring permits focusing preservation on its replacement. Android persistence
  grants narrow the storage difference; the documented WebView warning is stronger
  on iOS. Recoverable identity, coherent capture and verified restoration define
  protection, and authentication viability remains a service-selection gate.
key_findings:
  - A native WebView wrapper does not automatically replace browser-backed storage.
  - Native persistent storage and off-device recovery address different failure modes.
  - Automatic backup cannot rely on uninterrupted browser background execution.
  - Account-recoverable immutable snapshots and portable files remain necessary for either client.
  - Android persistent IndexedDB is the baseline a native storage proof must compare against.
  - Storage and authentication must be assessed separately; Access re-login and native sessions remain deciding constraints.
---

# Recoverable local libraries across browser and native clients

## Decision and position

For a small offline authoring application, choose local persistence separately from
independent recovery. `extends`: If authoring continues in the current client during
transition, protect that client while proving a replacement. If authoring is paused
and no active library needs interim protection, focus new preservation work on the
replacement; retrofitting the old client is not a prerequisite. In either case,
require coherent capture, versioned independent backups, portable files and verified
restoration in the client intended for continued use.

Capacitor warns about WebView LocalStorage and IndexedDB on at least iOS, while
explicitly noting Android's persisted-storage API for IndexedDB.
[preservation-capacitor-storage]{22}
Chromium considers engagement and installation when granting persistence.
[preservation-persistence]{1}
{inferred: qualifies} On Android, persistent IndexedDB is a relevant baseline, so
these documents alone do not establish a decisive native durability advantage.
The documented storage case for a native adapter is stronger on iOS. A container
that keeps WebView storage has not itself implemented a native database.
[preservation-capacitor-storage]{22}

`extends`: Pair either client with an authenticated, versioned snapshot vault and
portable owner-controlled files. An online receipt should identify validated,
retrievable bytes from a coherent saved library. Native integration may justify an
installed client, but that product judgment is separate from proving recoverability.

## What an installed app changes

Android distinguishes persistent app files from reclaimable cache files, but
uninstall removes app-specific storage. [preservation-android-files]{20}
{inferred: distinguishes} Native persistence can remove the browser-origin eviction
boundary without surviving device loss or uninstall. Independent copies remain
necessary. [preservation-android-files]{20}

A concrete SQLite bridge candidate is the pinned Capacitor community plugin
8.1.1; its package targets Capacitor 8 and its API exposes explicit transactions.
These are documented capabilities, not a successful application build or a
measured durability result. [preservation-sqlite-package]{23}
[preservation-sqlite-api]{24}

`extends`: A native proof should verify transaction failure, app termination,
relaunch, upgrade, full export and restoration into an isolated empty client.
Keep the same domain IDs, codecs, grades, effects and ordered memberships.
SQLite documents coordinated backup mechanisms for live databases.
[preservation-sqlite-backup]{27}
`extends`: Use a coherent logical export to retain the portable application format;
do not substitute an uncoordinated copy of a live database file.

Android Auto Backup is useful supplementary protection, but its documented
conditions include enabled backup, an idle device, an eligible network and at
least twenty-four hours since the previous backup, with a 25 MB allowance.
It also restores data before first launch after installation.
[preservation-android-backup]{21}
`extends`: Treat this as supplementary, not per-edit acknowledgement. A restored
installation may be stale but nonempty. Exclude device-specific backup receipts
and session/lineage state from OS restore, and compare authenticated remote history
before treating restored records as current protection.

## Browser and file limits

Persistence requests can reduce browser eviction exposure, but grants may be
denied and users can remove site data. [preservation-persistence]{1}
Frozen pages suspend tasks and discarded pages execute no JavaScript; termination
events are unreliable on mobile. [preservation-lifecycle]{2}
{inferred: bounds} A browser backup design therefore needs retry on usable execution
and explicit pending state, without promising completion after the app is closed.
[preservation-lifecycle]{2}

Current Chromium documentation includes Android File System Access support.
Selected handles require consent. The guide describes access loss when tabs close
and checking permissions when reopening stored handles. Writing completes on stream
close. OPFS is a different, origin-private facility. [preservation-files]{3}
`extends`: Capability-test each target. A selected folder can add a copy outside
browser storage; a folder on the same phone remains exposed to device loss.
Do not promise automatic folder copies across sessions without verified retained
permission; renewal may need interaction. Keep portable export when folder access
is unavailable. Native background execution also needs its own proof; a WebView
wrapper alone supplies no accepted scheduling guarantee. Evaluate supported
background retry as supplementary to foreground retry for either client.

## Hosted-vault candidates

| Candidate | Storage / operation evidence | Session renewal and client proof |
| --- | --- | --- |
| Worker with private R2 payloads; optional D1 metadata | Conditional/checksummed puts, strong direct reads and retention locks are useful vault primitives. [preservation-r2-api]{5} [preservation-r2-consistency]{6} [preservation-r2-locks]{7} | Access email codes require interactive re-login on global-session expiry; the CORS guide flags Incognito cookie blocking. [preservation-access-otp]{10} [shared-library-cf-sessions]{28} [preservation-access-cors]{11} `extends`: Storage candidate only; no authentication preference until actual client proof. |
| Supabase-managed service | Production email needs suitable delivery; Free inactivity pausing affects availability. [preservation-supabase-smtp]{16} [preservation-supabase-production]{17} | Rotating refresh tokens support renewal without a new sign-in; native redirect patterns are documented, but not a Capacitor-specific implementation. [preservation-supabase-sessions]{25} [preservation-supabase-deeplinks]{26} `extends`: A serious authentication candidate; prove secure token handling, authorization and the actual client return path. |
| Direct browser-to-Google-Drive app data | Hidden app folder with user/app-removal deletion behavior. [preservation-drive-appdata]{18} | This browser token model requires a user gesture for renewal. [preservation-google-token]{19} `extends`: As with Access, judge renewal frequency and visible pending protection. Server-code and native OAuth are unassessed alternatives, not rejected. |

`extends`: Apply the same criteria to each: frequency of interactive renewal,
survival of foreground/background transitions, secure session storage, return to
the intended client, lost-device account recovery and explicit expired-session state.
Storage fit does not establish authentication fit; no complete service is selected.

R2 Standard currently includes 10 GB-month, one million Class A and ten million
Class B requests in its free allowance. Workers Paid starts at USD 5/month with
usage charges beyond allowances. These are not a complete-system quote or cap.
[preservation-r2-pricing]{9} [preservation-workers-pricing]{15}
`extends`: Measure maximum allowed snapshots and realistic save frequency before
selecting a plan; small user count does not establish CPU or storage fit.

## Recovery identity and privacy

Access authenticates allowed email addresses by one-time code. Its global session
lasts fifteen minutes to one month (default twenty-four hours), after which the
user must authenticate again; application sessions may be shorter. This ordinary
browser-session model is distinct from a configured Cloudflare One Client session.
[preservation-access-otp]{10} [shared-library-cf-sessions]{28}
CORS access needs the application cookie; the guide specifically warns about
Incognito third-party-cookie blocking. JWT validation checks signing keys, issuer and audience.
[preservation-access-cors]{11} [preservation-access-jwt]{12}
Access's human subject changes when a user is removed and re-added.
[shared-library-cf-application-token]{29}

`extends`: Prove the established local browser origin and actual native origins,
not only a same-origin hosted demo. Access would require periodic interactive
re-login, with backup pending while expired. Do not key durable backup ownership
solely by the provider subject; define authorized identity recovery and relinking.
Keep offline app access usable while only backup endpoints require authentication.
Never embed operator credentials or leave alternate endpoints unprotected.

R2 encryption is provider-managed; Cloudflare holds the keys.
[preservation-r2-security]{8}
`extends`: Describe that trust boundary accurately. End-to-end encryption is a
different contract requiring independently recoverable keys; a sole key in the
lost origin defeats recovery. Do not introduce such a secret incidentally.
Owner-private backup must remain separate from group publication.

## Snapshot and acknowledgement contract

`extends`: The application should implement and test these invariants:

1. Capture every required saved record from a coherent view. Fail on unreadable or
   invalid records rather than silently omitting them.
2. Preserve immutable prior snapshots. Treat empty, partial and unexplained
   regressions as recovery conditions; absence is not deletion authorization.
3. Give retries stable identity and bind the receipt to content identity, schema
   and library identity. A timed-out write must be safely discoverable/retryable.
4. Verify the retained payload by authenticated readback and strict decoding.
   Only acknowledge the captured revision. Newer edits stay pending.
5. On fresh installation, reauthenticate and discover existing backups before
   starting a new lineage. Never require erased local flags to detect this case.
6. Restore with validation, explicit conflict handling and exact identity/order
   comparison. Keep portable recovery usable without the hosted service.

Web Locks provide cooperative shared/exclusive coordination.
[preservation-web-locks]{4}
`extends`: For multiple browser databases, every writer must participate in a
capture protocol; a lock does not manufacture a cross-database transaction or bind
old clients. A single native database can be investigated as a coherent transaction
boundary, with adapter and crash behavior proven rather than assumed.

R2 checksums validate transferred bytes; they do not prove complete application
capture. D1's 2,000,000-byte row limit precludes a larger whole backup in one row.
D1 batches are transactions within D1, not transactions with R2.
[preservation-r2-api]{5} [preservation-d1-limits]{13}
[preservation-d1-batch]{14}
`extends`: First evaluate immutable, self-describing R2 objects and strong listing
without a separate D1 manifest. If a second store earns its complexity, publish only
after verified payload storage and handle orphan/pending objects and idempotent retry.
Any mutable latest pointer needs conditional update. On a timed-out immutable put,
read back and compare before treating a retry rejection as failure. Account recovery
must discover complete snapshots even if local receipts disappear.

Locks can prevent R2 object deletion and overwriting, including against lifecycle
rules, but an authorized administrator can remove them.
[preservation-r2-locks]{7}
`extends`: Start with no client deletion authority. Choose retention and capacity
policy deliberately; exhausting capacity must report pending/failed protection
while retaining good copies. Avoid claiming indefinite free retention or immunity
to account compromise.

## Contradictions

| Sources / relationship | Qualified conclusion |
| --- | --- |
| [preservation-capacitor-storage]{22} / [preservation-android-files]{20} — qualifies | A native container can expose both WebView storage and native persistent storage. “Installed app” alone does not identify the persistence guarantee. |
| [preservation-files]{3} / [preservation-lifecycle]{2} — qualifies | File access capability can exist while background execution is suspended. Permission is not a scheduling guarantee. |
| [preservation-r2-consistency]{6} / [preservation-r2-locks]{7} — qualifies | Strong consistency reflects completed writes; retention prevents ordinary overwrites/deletes. These are separate properties. |
| [preservation-capacitor-storage]{22} / [preservation-persistence]{1} — qualifies | The iOS WebView warning cannot be generalized to Android without comparing a persistence grant. Native superiority on Android remains a proof question. |
| [shared-library-cf-sessions]{28} / [preservation-google-token]{19} — shared constraint | Both ordinary Access sessions and Google browser tokens eventually require interaction. Compare renewal frequency and pending-state handling consistently. |
| [preservation-access-cors]{11} / [preservation-supabase-sessions]{25} — design tension | Cookie-based Access and refresh-token sessions impose different cross-site and renewal constraints. Neither source proves this application's native implementation. |

## Disconfirming analysis

A native container retaining WebView storage and app uninstall both defeat a claim
that packaging alone prevents loss. Android persistent IndexedDB supplies another
counterexample to treating native storage as the only viable local solution.
[preservation-capacitor-storage]{22} [preservation-android-files]{20}
[preservation-persistence]{1}
`extends`: Compare native against that baseline. Neither comparison establishes
the cause of an individual loss; corruption, explicit cleanup and application
faults remain distinct from eviction. Independent recovery must cover all of them.

R2 storage primitives do not settle the authentication choice. Access expiry and
unproven cross-site sessions weaken an unobtrusive-backup claim, while Supabase's renewable
sessions supply relevant contrary evidence. Neither is a completed client proof.
[shared-library-cf-sessions]{28} [preservation-access-cors]{11}
[preservation-supabase-sessions]{25}
Google's browser token restriction does not reject its other OAuth models.
[preservation-google-token]{19}

## Evidence limits and proof order

`extends`: Choose the implementation target from actual continued use. Protect an
actively used browser client during transition; when authoring is paused, the native
storage and recovery proof can lead without an interim browser release. In the target
client, prove coherent complete capture, owner-controlled files, authenticated
versioned backup and exact recovery into an isolated empty client. Before moving
any surviving data to a native app or another web origin, independently retain and
validate a complete source export and prove target restoration without deleting
the source. A verified portable-file bridge can satisfy that migration check;
completed automatic online backup is not a prerequisite for a synthetic experiment.

Exercise corruption, concurrent writes, interrupted commits/uploads, lost identity,
expired sessions, empty or stale restored installations and complete recovery.
No provider account, live service or physical storage-pressure behavior was tested.
Re-engage the comparison if target permissions, session behavior, native dependency
compatibility or provider pricing/retention contradict the documented assumptions.

## Sources

1. **preservation-persistence** — Persistent storage. https://web.dev/articles/persistent-storage (fetched 2026-10-09).
2. **preservation-lifecycle** — Page Lifecycle API. https://developer.chrome.com/docs/web-platform/page-lifecycle-api (fetched 2026-10-09).
3. **preservation-files** — File System Access API. https://developer.chrome.com/docs/capabilities/web-apis/file-system-access (fetched 2026-10-09).
4. **preservation-web-locks** — Web Locks API. https://www.w3.org/TR/web-locks/ (fetched 2026-10-09).
5. **preservation-r2-api** — R2 Workers API. https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ (fetched 2026-10-09).
6. **preservation-r2-consistency** — R2 consistency. https://developers.cloudflare.com/r2/reference/consistency/ (fetched 2026-10-09).
7. **preservation-r2-locks** — R2 bucket locks. https://developers.cloudflare.com/r2/buckets/bucket-locks/ (fetched 2026-10-09).
8. **preservation-r2-security** — R2 data security. https://developers.cloudflare.com/r2/reference/data-security/ (fetched 2026-10-09).
9. **preservation-r2-pricing** — R2 pricing. https://developers.cloudflare.com/r2/pricing/ (fetched 2026-10-09).
10. **preservation-access-otp** — Cloudflare Access one-time PIN. https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/ (fetched 2026-10-09).
11. **preservation-access-cors** — Cloudflare Access CORS. https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/ (fetched 2026-10-09).
12. **preservation-access-jwt** — Validate Access JWTs. https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ (fetched 2026-10-09).
13. **preservation-d1-limits** — Cloudflare D1 limits. https://developers.cloudflare.com/d1/platform/limits/ (fetched 2026-10-09).
14. **preservation-d1-batch** — D1 database API. https://developers.cloudflare.com/d1/worker-api/d1-database/ (fetched 2026-10-09).
15. **preservation-workers-pricing** — Cloudflare Workers pricing. https://developers.cloudflare.com/workers/platform/pricing/ (fetched 2026-10-09).
16. **preservation-supabase-smtp** — Supabase email delivery. https://supabase.com/docs/guides/auth/auth-smtp (fetched 2026-10-09).
17. **preservation-supabase-production** — Supabase production checklist. https://supabase.com/docs/guides/deployment/going-into-prod (fetched 2026-10-09).
18. **preservation-drive-appdata** — Google Drive application data. https://developers.google.com/workspace/drive/api/guides/appdata (fetched 2026-10-09).
19. **preservation-google-token** — Google browser token model. https://developers.google.com/identity/oauth2/web/guides/use-token-model (fetched 2026-10-09).
20. **preservation-android-files** — Android app-specific storage. https://developer.android.com/training/data-storage/app-specific (fetched 2026-10-09).
21. **preservation-android-backup** — Android Auto Backup. https://developer.android.com/identity/data/autobackup (fetched 2026-10-09).
22. **preservation-capacitor-storage** — Capacitor v8 storage guidance. https://capacitorjs.com/docs/guides/storage (fetched 2026-10-09).
23. **preservation-sqlite-package** — Capacitor community SQLite v8.1.1 package. https://raw.githubusercontent.com/capacitor-community/sqlite/v8.1.1/package.json (fetched 2026-10-09).
24. **preservation-sqlite-api** — Capacitor community SQLite v8.1.1 API. https://github.com/capacitor-community/sqlite/blob/v8.1.1/docs/API.md (fetched 2026-10-09).

25. **preservation-supabase-sessions** — Supabase sessions. https://supabase.com/docs/guides/auth/sessions (fetched 2026-10-09).
26. **preservation-supabase-deeplinks** — Supabase native deep linking. https://supabase.com/docs/guides/auth/native-mobile-deep-linking (fetched 2026-10-09).
27. **preservation-sqlite-backup** — SQLite backup API. https://www.sqlite.org/backup.html (fetched 2026-10-09).
28. **shared-library-cf-sessions** — Cloudflare Access sessions. https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/ (refreshed 2026-10-09).
29. **shared-library-cf-application-token** — Access application token. https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/ (refreshed 2026-10-09).

## Verification

One independent Claude Opus adversarial pass returned NEEDS-REVISION. The lead
corrected the three material findings: retained the Android persistence exception,
required verified preservation of surviving data before real migration, and removed
the uneven Cloudflare authentication preference. Source attestations were corrected first;
new session/deep-link and SQLite evidence was fetched directly. Analysis and project
guidance were removed from the new attestation records. Native OS restore staleness,
file permission renewal and simpler object-only retention were incorporated.

The lead spot-checked the corrected source qualifiers, session duration/renewal,
identity changes and migration dependency. The review's claim that automatic PWA
backup is required before any migration was narrowed: a validated portable export
can bridge migration, and a synthetic native experiment needs no personal migration.
Background execution remains an explicit proof requirement; no untested background
scheduler was adopted. No second review loop was run under standard review weight.

Citation lint resolves 57 citations with zero broken chains or thin attestations.
Version-pattern flags refer to the directly fetched, pinned SQLite package/API.
The knowledge index reports zero errors; its two foundation decision-count warnings
pre-date this brief. Local document links and whitespace checks pass. Android's
restore-order source was rechecked by direct HTTP fetch after browser fetch timeouts.

Applicability clarification: current-client-first implementation assumes continued
authoring in that client. The decision and proof order now make that assumption
explicit and cover paused authoring. Source findings and recovery requirements are
unchanged; this clarification does not establish any additional runtime capability.
