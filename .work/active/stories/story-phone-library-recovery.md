---
id: story-phone-library-recovery
kind: story
stage: review
tags: [data, prose]
research_refs: [android-chrome-recovery-access]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
---

# Investigate the unavailable phone library before any update

## Current disposition

Andrew has chosen to end recovery escalation and proceed on the working assumption
that the post-migration climbs are lost. No verified, preserving DIY deleted-file
acquisition path has been established for this phone. No laboratory was contacted,
paid, or asked to acquire it. This closes the recovery attempt by owner decision;
it does not establish permanent physical erasure or specialist impossibility.

The evidence remains preserved outside Git. No phone reset, storage cleanup, import,
reinstallation, or new application deployment is part of this disposition.
The next priority is [independent library preservation](../epics/epic-library-preservation.md),
covering both automatic private online backups and portable owner-controlled files,
as requested by Andrew. Catalog and sharing work remain behind that priority.

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

## Initial evidence checkpoint

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
  is denied to the ordinary Android shell. Later authorized debugging file reads and
  directory inventories succeeded (see native-file checkpoint); no forensic disk
  image has been acquired.
- Chrome reports an October 8 update. Temporal proximity alone is not causality.
- Historical Git and migration records name real phone backups from September 5–12.
  Actual backup payloads have not been located in transferred archives/ordinary
  searched paths. Andrew confirms the old laptop was erased and is unavailable.
- Sixteen original PNGs remain locally. Andrew confirms these are pre-CruxControl
  climbs imported during migration, not the new climbs this incident seeks to recover.
  A private second copy was made and every
  SHA-256 matches. The existing full PNG decoding/ring-manifest verification test
  passes for all sixteen. Both copies are on this laptop, not independent hardware.
- Synthetic iOS simulator exports are excluded as recovery sources for Andrew's data.

No application update, restoration or authored-library write has been performed.
Later checkpoints below supersede the initial assessment's access limitations.


## Host re-audit and additional evidence

- Andrew requested a higher-effort review of prior work. An out-of-band, fresh-context
  Claude Opus review completed through peeragent; no phone access or edits delegated.
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
  historical searches also found no direct whole-origin deletion path (see review
  below). These bounded source searches do not prove the absence of every defect.

## Limits of the completed recovery attempt

- No forensic disk image has been acquired. Native debugging access has now preserved
  quota metadata and directory inventories. These live reads cannot establish physical
  erasure of deleted/untracked remnants.
- Diagnostic ZIP acquisition did not succeed; a zero-byte canceled transfer is not
  a disk-level absence proof. Do not root, unlock, reset or reinstall to bypass this.
- Andrew reports a recent low-storage warning and knows of no independent export
  backup. Old laptop is confirmed erased and unavailable.
- Cause remains unestablished. Browser-level origin loss/cleanup, eviction, corruption,
  browser regression, historical application/maintenance fault, and context mismatch
  must be evaluated against evidence rather than selected by intuition.


## Independent review and adjudication

Out-of-band review job `20261009T210858Z-64dedf90` completed successfully with Claude
Opus, xhigh, read-only scope and no project changes. One independent pass was used.
The host retains responsibility for evidence and conclusions. Subsequent owner
disposition closes the recovery attempt, not the uncertainty about physical remnants.

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
- The committed sixteen-climb source manifest preserves the pre-CruxControl imported
  climbs. Andrew explicitly distinguishes these from the target: climbs authored
  since migrating to CruxControl. Neither the manifest nor the PNGs recovers that work.
- The recovery-only server was stopped; our USB reverse and CDP forward were removed.
  The temporary UI dump was removed. Browser download behavior was restored to default.

## Recovery disposition and next decision

No post-migration authored-library records have been recovered. The accessible browser,
shared files, transferred backup payloads and available project history have not
provided a whole-library recovery source. Although ordinary shell/download access
failed, separate authorized debugging interfaces now permit native file reads and
directory enumeration. Live directory inventories show no project backing directory
in the examined legacy, bucket and additional partition locations. This strengthens
the evidence beyond an empty browser API listing; it is not a raw deleted-data image.
**Permanent physical loss is not proven.** The authorized technical specialist-access
assessment is complete. Andrew subsequently declined external escalation and chose
to proceed assuming loss; no external service has been contacted or promised a result.

The diagnosis supported now is: apparent loss/unavailability of the app origin's
storage, with low-storage eviction a plausible leading hypothesis and no conclusive
per-origin deletion log. Independent-backup and persistence protections were absent;
backup migration verification failed to leave an accessible recovery copy. Exact
trigger and time remain unknown.

The recovery disposition is settled. Protection design must address
browser-origin loss, device loss, offline writes awaiting protection, immutable prior
versions, empty-installation recovery without overwriting a good backup, and verified
restore drills. Persisting browser storage alone is insufficient; distinguish a
local save from an independently recoverable copy. No cloud vendor, authentication
scheme or new production architecture is selected by this incident record.

## Specialist access assessment registration

The user's authorization supplies the focused scope and the decision: whether a
preserving acquisition path exists before considering the recovery avenue exhausted.
Continue the already authorized investigation without another scope-approval loop.
One inline assessment with standard verification and an independent adversarial read
is proportionate; this is not a broad forensic-tool procurement exercise.

```yaml
intent: validate-claim
output_kind: synthesis-brief
consumer: calibrated-work
verification_rigor: standard
temporal_contract: re-engage-on-trigger
primitives_extends: []
primitives_opts_out: []
decision_relevance: Determine whether diagnostic export or specialist acquisition can obtain protected Chrome files while preserving recovery options.
scope_authority: pre-registered
analytical_artifact_type: per-campaign-brief
```

Existing incident evidence is framing, not an external research citation. No existing
research brief answers the protected-file acquisition question. Candidate approaches:
one focused acquisition assessment (selected), separate source/forensic campaigns
(unnecessary coordination for this bounded question), or a broad vendor survey
(does not resolve device compatibility). Device facts and a reviewable lab inquiry
stay in the private recovery folder; generic technical findings live in research.

## Native-file checkpoint and specialist handoff

The source review found two different access paths. The diagnostic ZIP download uses
a source-file allowlist that excludes Android Chrome's internal cache; moving the
destination cannot change that check. This predicts a denial under normal policy,
but no per-download runtime failure site was captured. Separately, trusted debugging
file inputs and file-drop events can grant native reads through Chrome itself.

Bounded live checks used agent-controlled blank receiving tabs. A system-file control
and one-byte private-profile read succeeded. Native quota database/journal copies were
saved and hashed outside Git. They pass the applicable host-only integrity check,
but are live, separately read files; the journal was not replayed and no atomic
acquisition is claimed. No climb payload was recovered from this bookkeeping.

The first file-chooser directory attempt canceled. A separate debugging file-drop
path succeeded after using a valid inherited origin; its first opaque-origin attempt
returned EncodingError. This is a correction of the earlier access limit, not recovery
of authored content. Directory inventory found:
- No project-origin LevelDB, blob or SQLite path among the legacy IndexedDB entries.
- Every numbered WebStorage directory maps to another origin in the copied quota
  database; none is unmapped or associated with the project.
- No project match or nested IndexedDB directory in the additional Storage subtree;
  the traversal reported no error.
- Full-file reads report NotFoundError for the expected origin CURRENT file and the
  previous diagnostic ZIP. A zero-length sliced read was inconclusive and superseded
  by the full-file check; do not cite it as existence evidence.

No additional ZIP was generated, no source database engine was opened, no authored
data was written and no file was uploaded over the internet in these native-read
checks. Browser state necessarily changed through temporary tabs and debugging
bookkeeping. Receiving tabs were closed and the debug forward removed afterward.
The preservation server and reverse port remain stopped.

The private specialist inquiry and case sheet now request an assessment of acquired
metadata and deleted/untracked remnants. They explicitly distinguish the lost
post-migration creations from the sixteen preserved imports. Public service leads
and a Pixel-family forensic-tool claim are documented, but exact software/patch
support and recoverability are unconfirmed. No lab has been contacted or paid.

Independent access-assessment review job `20261009T213758Z-89a7e497` completed with
four accepted material corrections: default temp-directory grounding, attribution
qualifiers, export/deleted-data distinction, and complete preservation guidance.
They were applied. Bounded delta review `20261009T215640Z-3dd9f053` completed and
requested one material clarification: disclose the receiving page's target origin
and distinguish inspection-time quota timestamps from the original loss timeline.
That correction was applied and verified by the host. No third review was run.
Citation lint and evidence hashes were checked; the research index was regenerated.
The completed access assessment supplies the protection-design handoff. No
permanent-loss finding is asserted.

## Final diagnosis and lessons

| Finding | Confidence and limit | Required response |
| --- | --- | --- |
| Authored data was stored in the phone's Chrome origin, not served from the laptop. | Confirmed by the repositories and prior backup evidence. Losing the laptop does not itself delete that browser database. | Preserve local/offline authoring while adding an independent recovery copy. |
| The target origin's authored database files and expected offline resources were unavailable during inspection. | Browser checks and native inventories agree; live inspection is not a deleted-block image. | Exercise complete-origin-loss recovery, not only reload and update survival. |
| Storage-pressure eviction is a plausible leading explanation. | Andrew recalls a low-storage warning; exact trigger/time and per-origin deletion evidence are absent. Chrome update proximity is not proof. | Reduce eviction exposure where supported, but do not rely on persistence grants as a backup. |
| Independent protection was inadequate. | Manual export existed; automatic independent backups and trustworthy backup-age state did not. Recorded old-laptop backups were not transferred to the new laptop. | Automatic private versioned backup plus portable files, with restore verification and migration checks. |
| Debugging did not recover post-migration creations. | No explicit deletion/reset or production update was issued; browser inspections caused state changes and may invoke engine housekeeping. | Retain evidence and report uncertainty without declaring a forensic guarantee. |

The design failure was treating browser-local saving and a manual export facility as
adequate protection for irreplaceable authored work. A successful local transaction
does not establish that a library can survive origin loss, device loss, or an erased
backup machine. Update tests alone do not cover these failure modes. The exact
deletion cause remains unknown; preventive work need not wait for causal certainty.

## Closure verification

- Existing evidence includes validated original screenshots, hashed quota files and
  directory inventories, audited phone operations, backup/migration searches, and
  independent technical reviews with accepted corrections applied.
- The sixteen preserved imports are explicitly excluded from claims of recovering
  post-migration climbs. No such climb has been recovered.
- Current-source and Git-history searches for whole-origin deletion and persistence
  requests were rechecked without contacting or changing the phone. No direct
  whole-origin deletion path or persistence request was found; this is scoped evidence.
- The source `web/src/library-backup/service.ts` confirms explicit file export,
  bounded cross-store stability checks, and missing-only per-store restoration.
- Owner disposition, confidence-qualified diagnosis, retained evidence and the
  prevention handoff satisfy this operational story. Product safeguards remain
  unimplemented and are owned by `epic-library-preservation`.

## Implementation notes

- Execution capability: host-owned inline prose and evidence reconciliation; no
  new phone diagnostics or delegated device operations.
- Review weight: standard, from project conventions; standalone-story closure uses
  the bounded inline lane. Earlier independent investigations remain evidence.
- Files changed: this record and the linked preservation scope/priority documents.
- Tests added/removed: none; no executable behavior changed. Validate document links,
  substrate dependencies, diff integrity and generated knowledge index.
- Simplification: one explicit recovery disposition replaces an indefinite lab wait;
  prevention has a single delivery owner rather than repeated incident proposals.
- Discrepancy: external acquisition is not completed; Andrew explicitly chose to
  close that avenue. Physical unrecoverability and a precise deletion cause remain
  unproved.
