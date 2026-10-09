---
id: story-phone-library-recovery
kind: story
stage: implementing
tags: [data, prose]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Investigate the unavailable phone library before any update

## Brief

Andrew reports the same Android phone successfully used the authored library about
two weeks before 2026-10-09. Today its installed app initially displayed connection
refused at the established USB origin. Read-only checks did not expose the saved
library. Recovery takes priority over catalog, sharing and other roadmap work.

Order authorized by Andrew: exhaust safe recovery checks, diagnose what the evidence
can establish, then design prevention. Do not equate a negative browser listing with
proof of physical erasure. Do not claim a root cause from timing alone.

## Scope and boundaries

This operational story owns the evidence record and recovery disposition. It does
not authorize clearing data, resetting/uninstalling the browser, rooting/unlocking
the phone, forcing worker activation, or importing/reconstructing records over the
phone. Private artifacts and identifiers remain outside Git. Protection design will
be separately grounded in these findings; no product implementation is selected.

## Simplification opportunity

Replace contradictory conversational conclusions with one evidence-based incident
record, including unresolved questions and the limits of ordinary debugging access.

## Execution

One host owns the phone and all mutations. The inline implementation workflow is
used for the operational record. The separately requested out-of-band deep review
of prior maintenance and storage architecture is advisory input, not a standalone
story review or a substitute for host verification.

## Acceptance checkpoints

- Preserve and validate available private screenshots and any recovered files.
- Confirm origin, browser/profile and storage-key evidence without data resets.
- Inventory accessible browser storage and transferred backup sources; distinguish
  synthetic test fixtures from authored data and metadata from actual payloads.
- Audit this session's actual phone operations and relevant existing deletion,
  update, backup and durability code; separate observed facts from hypotheses.
- State exactly which recovery paths are exhausted, which remain, and why; do not
  declare forensic impossibility from ordinary API access.
- Record a diagnosis with confidence and an explicit protection-design handoff.

## Evidence checkpoint (incomplete)

- Original target was the installed Chrome WebAPK at `http://localhost:4173/`;
  it showed `ERR_CONNECTION_REFUSED` before a new production server was started.
- Only a script-free preservation page has been served during this incident.
- Page APIs report no IndexedDB databases, localStorage keys, caches or OPFS entries
  at that origin. Quota reports zero usage; persistent-storage grant is false now.
  This does not establish the historical grant or a deletion cause.
- Chrome's internal inventory lists a zero-size default bucket with an epoch-like
  modification time and constructed paths, not recovered database contents. The host
  prematurely described that entry as a surviving database and corrected the claim.
  Inspection itself may have created empty bookkeeping; verify this before inference.
- Other browser buckets are nonempty. Direct filesystem access to Chrome app storage
  is denied to the ordinary Android shell. No forensic image has been acquired.
- Chrome reports an October 8 update. Temporal proximity alone is not causality.
- Historical Git and migration records name real phone backups from September 5–12.
  Actual backup payloads have not been located in transferred archives/ordinary
  searched paths. Andrew confirms the old laptop was erased and is unavailable.
- Sixteen original PNGs remain locally. A private second copy was made and every
  SHA-256 matches. The existing full PNG decoding/ring-manifest verification test
  passes for all sixteen. Both copies are on this laptop, not independent hardware.
- Synthetic iOS simulator exports are excluded as recovery sources for Andrew's data.

No application update, restoration or authored-library write has been performed.
Recovery assessment and diagnosis remain open.


## Host re-audit and additional evidence

- Andrew requested a higher-effort review of prior work. An out-of-band, fresh-context
  Claude Opus review is running through peeragent; no phone access or edits delegated.
- Source-level PNG verification passed: `npm -w web run test --
  src/screenshot-import/private-source-verification.test.ts`. It decodes and verifies
  all sixteen private images against the checksum-linked hold manifest. A ZIP of the
  original PNGs plus their checksum manifest was separately tested and byte-compared.
- A filename search across the current Mac home found only synthetic iOS exports,
  not the historical real phone backups. Migration archive indices contain no named
  phone backup payloads; transferred project JSON includes a synthetic fixture only.
  This is scoped evidence, not proof that every external/cloud backup is absent.
- Confirmed Chrome profile path is the ordinary Android `Default` profile. A normal
  Chrome tab at the same origin, in addition to the home-screen WebAPK, reports no
  databases, no cache entries and zero usage. The installed WebAPK manifest confirms
  the exact localhost scheme/host/port. No second installed browser or Android user
  was found in the initial inventory.
- The original Playwright CDP attachment used its defaults. Installed Playwright
  source shows that connection initialization sets browser download behavior unless
  `noDefaults` is used. This could interfere with diagnostic downloads. The host
  restored default download behavior and subsequently instrumented one export with
  a known device download path, returning to defaults afterward.
- Chrome's exact reported source revision was fetched for diagnostic export review.
  `DownloadBucketData` closes connections with `delete_bucket_data=false`, then
  attempts to ZIP the bucket paths. It does not check the ZIP helper's success before
  reporting initiation success. The exact app bucket reported zero connections.
  The instrumented export emitted download-start then canceled with zero bytes;
  no archive was obtained. Initiation success is NOT a successful backup.
- The same Chromium source confirms binding an IndexedDB factory can create default
  bucket bookkeeping, and `GetDatabaseInfo` initializes a backing store with
  `create_if_missing=false`. Initialization can perform engine cleanup/corruption
  handling. Thus browser-level inspection is not a forensic read-only disk image.
  The zero-byte inventory entry and generated paths do not prove surviving records.
  The host's earlier unqualified “storage untouched” statements were too strong.
  No explicit storage deletion/reset command or application-record mutation was issued.
- Current phone data partition is approximately 97% used with about 4 GiB available.
  This is a current observation only, not evidence of earlier eviction. Chromium's
  documented default reserves are capped below that free amount; field-trial settings
  and historical free space have not been established. Do not diagnose eviction
  from this percentage alone.
- Initial code search found no production `deleteDatabase`, bulk `clear`, or
  `navigator.storage.persist` call. Authored deletion paths are per-record operations;
  a complete historical audit is still pending. This does not prove no code defect.

## Recovery limits still open

- No raw image/copy of Chrome's protected internal data has been acquired. Android
  denies ordinary shell access; browser API results cannot establish physical erasure.
- Diagnostic ZIP acquisition did not succeed; a zero-byte canceled transfer is not
  a disk-level absence proof. Do not root, unlock, reset or reinstall to bypass this.
- Independent backup locations and the user's timeline of low-storage/cleanup events
  are awaiting clarification. Old laptop is confirmed erased and unavailable.
- Cause remains unestablished. Browser-level origin loss/cleanup, eviction, corruption,
  browser regression, historical application/maintenance fault, and context mismatch
  must be evaluated against evidence rather than selected by intuition.


## Independent review and adjudication

Out-of-band review job `20261009T210858Z-64dedf90` completed successfully with Claude
Opus, xhigh, read-only scope and no project changes. One independent pass was used.
The host retains responsibility for evidence and conclusions; this story is not done.

Accepted findings:
- The original connection-refused page is also evidence that the expected offline
  shell was unavailable. An intact, controlling offline worker/cache should have
  opened the app without the laptop. Missing laptop hosting alone is not a sufficient
  explanation, although a broken/noncontrolling worker remains an alternative.
- The first IndexedDB enumeration can explain the zero-size internals bucket entry.
  Generated path strings and a null modification time are not a surviving database.
- The raw session contains no explicit origin clear, database deletion, browser reset,
  or new production-app update. The diagnostic work did cause navigation, downloads,
  browser bookkeeping and temporary files; it was not a forensic disk acquisition.
- Unrelated origin names were unnecessarily printed during an internal-inventory
  filter. Later analysis uses private artifacts and emits only project matches/counts.
- The preservation server should be stopped rather than left serving HTML for all
  paths, including worker/manifest paths. Stop further UI automation and preserve the
  phone pending the recovery disposition.
- Existing ordinary exports are manual. No automatic independent backup, backup-age
  state, persistence request, or reliable post-loss detection exists. The migration
  recorded real phone backup files but their payloads were not transferred. These are
  confirmed systemic protection gaps independent of the deletion trigger.

Rejected or qualified reviewer claims:
- “No code in CruxControl can cause this” is too absolute. Current and historical
  source searches found no direct whole-origin deletion path, and the all-storage
  absence pattern is inconsistent with an ordinary per-record delete. This narrows
  the hypothesis set; it does not prove the absence of every application, browser or
  maintenance fault. Generated Workbox code does clean obsolete app caches.
- “No step today deleted data” cannot be established at filesystem level without a
  pre-inspection acquisition. No explicit deletion command was issued; Chromium
  internals can perform housekeeping while answering nominal read requests.
- The user already clarified that sharing meant climbing together, not sending
  links/files; do not repeatedly ask for shared exports as though that were unknown.
- Do not generalize that every possible rooting method wipes a phone or promise
  specialist recoverability. No rooting/unlocking/reset is authorized or attempted.

## Final non-invasive checkpoint (2026-10-09)

- Andrew confirms a low-storage warning yesterday or the day before and knows of no
  independent export backup. This strengthens storage-pressure eviction as a working
  hypothesis, not a proven incident attribution.
- Quota internals reports 0 evicted buckets, 4 skipped rounds, in the current browser
  process (about six hours old). This does not cover the earlier low-storage warning.
- Chrome histogram telemetry records three download interruptions with reason 2
  (`FILE_ACCESS_DENIED` in this exact Chromium revision). It is process-wide evidence,
  consistent with the failed diagnostic exports, not a per-download filesystem proof.
  Export cancellation is therefore not evidence of empty physical storage.
- A private inventory filter found 26 origins and exactly one local/IP/dev-port/project
  candidate: the expected localhost origin. No alternate candidate surfaced there.
- A read-only content-signature scan of accessible shared-storage JSON files, excluding
  Android app directories and files above the backup size limit, checked one JSON file
  with no library/playlist envelope match and no traversal error. No private app
  database was accessed or reset.
- No archived project task was available from the connected task server. No September
  Codex sessions were migrated locally. Project Git JSON history and migrated artifacts
  provide no whole-library payload; synthetic exports remain excluded.
- The committed sixteen-climb source manifest is an independent reconstruction asset
  with reviewed names/hold layouts. It is not the latest library and cannot recover
  later custom climbs, authored changes, playlist ordering, identities or recipes.

## Recovery disposition and next decision

No original authored-library records have been recovered. The accessible browser,
shared files, transferred backup payloads and available project history have not
provided a whole-library recovery source. Android's protected Chrome files remain
unimaged and inaccessible through the available ordinary shell/export path.
**Permanent physical loss is not proven.** A specialist assessment, if Andrew wants
that additional avenue, must precede any phone reconstruction/reset/restore; no such
service has been contacted or promised a result.

The diagnosis supported now is: apparent loss/unavailability of the app origin's
storage, with low-storage eviction a plausible leading hypothesis and no conclusive
per-origin deletion log. Independent-backup and persistence protections were absent;
backup migration verification failed to leave an accessible recovery copy. Exact
trigger and time remain unknown.

After Andrew settles the remaining recovery avenue, protection design must address
browser-origin loss, device loss, offline writes awaiting protection, immutable prior
versions, empty-installation recovery without overwriting a good backup, and verified
restore drills. Persisting browser storage alone is insufficient; distinguish a
local save from an independently recoverable copy. No cloud vendor, authentication
scheme or new production architecture is selected by this incident record.
