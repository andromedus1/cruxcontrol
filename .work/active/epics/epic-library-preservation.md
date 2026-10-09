---
id: epic-library-preservation
kind: epic
stage: drafting
tags: [data, security, needs-research]
research_refs: [android-chrome-recovery-access]
parent: null
depends_on: [story-phone-library-recovery]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
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
- **Recovery disposition:** assume the missing post-migration creations are lost for
  planning. Retain incident evidence; no lab escalation, reset or reconstruction is
  required to begin this work. The sixteen imported climbs are not the lost creations.
- **No stack selected:** online backup is authorized as a capability. No provider,
  paid plan, account, upload, public deployment or destructive restore is selected by
  this scope. Choose technology after the focused research and concrete review.
- **Platform sequencing:** prove the current Android/browser path first; maintain
  compatibility with the shared-client/native direction. Physical iPhone availability
  does not block Android data protection. Native guarantees need their own validation.

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

## Grounding and research needed

Reuse the [incident record](../stories/story-phone-library-recovery.md) and the
[recovery-access brief](../../../.research/analysis/briefs/android-chrome-recovery-access.md)
for the loss pattern and access limits. Existing implementation entry points are
`web/src/library-backup/{service,codec,indexeddb-store,delivery}.ts`, the climb and
playlist repositories, runtime composition and update admission. Existing manual
backup limits and per-store transactions are contracts to review, not evidence of
automatic backup or a cross-store consistent snapshot.

The invited-library/access and iOS briefs are reusable constraints, not a selected
private-backup architecture. Focused research must settle:

- Browser/Android and native execution, persistence and file-delivery limits;
  foreground retry behavior and what survives origin loss.
- A minimal private online backup destination, authorization/account recovery,
  encryption/key recovery tradeoffs, retention, cost and cross-origin/native access.
- Coherent snapshot capture across current independent stores, revision identity,
  safe acknowledgement and recovery detection without relying on erased local flags.

Run research before architectural decomposition. The `needs-research` tag records
that requirement, not a need for Andrew to rediscover facts or approve routine work.
Then run the directional epic-design alignment pass using these settled decisions;
do not re-ask whether online and portable-file protection are wanted.

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
