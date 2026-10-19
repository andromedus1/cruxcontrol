---
description: Read before designing epic-catalog-sync. Establishes which sources currently carry Kilter community climbs after the 2026 Kilter/Aurora split, and what an offline Homewall 7x10 catalog updater must handle when consuming Boardsesh's public snapshots.
type: brief
kind: research
slug: kilter-current-catalog-sources
research_method: /brief
provenance: agent-synthesis
verification_status: attested
status: draft
updated: 2026-10-19
nav_priority: high
blocks_phase: epic-catalog-sync
supersedes: docs/briefs/catalog-sync-api.md
refresh_verification:
  delta_reverified: all claims (input_state legacy; prior brief used as lens only, no attestations reused without re-fetch)
  grandfathered: []
summary: |
  The legacy Aurora-hosted Kilter sync (kilterboardapp.com /sync, the path BoardLib
  implements) stopped serving Kilter in late March 2026 and BoardLib has not followed
  Kilter's move. Kilter's own app publishes no API, developer terms, or bulk export, and
  its Terms of Use prohibit scraping, automated copying, reverse engineering and
  unpermitted use of Content. Boardsesh pulls Kilter's current catalog from the
  first-party backend with an authenticated, reverse-engineered client and republishes
  it as anonymous, CORS-open SQLite snapshots per layout, plus a hardware catalog; its
  policy invites snapshot use while requiring written permission for a publicly
  distributed app that uses Boardsesh data or servers as its service. Direct inspection
  shows the Homewall (layout 8) snapshot keeps Aurora-era 7x10 hardware IDs exactly and
  keeps legacy climb UUIDs, and carries climbs created through the day of fetch. Climbs
  that appear to come from Kilter's new backend use product-1 role codes 12–15 and
  lowercase dashed UUIDs (inferred); quality is not on the Aurora three-star scale
  (documented as 0–5 and as 1–5, observed 0.25–5.0); and anonymous consumers get no
  deletion feed.
key_findings:
  - "The legacy Aurora Kilter sync is not a viable source of new climbs: Kilter says the old app is no longer supported and press reports it was taken down; Boardsesh switched its Aurora sync off for Kilter on 2026-03-30; BoardLib's last commit is 2026-03-17 and its Kilter issue #78 remains open. [kcs-kilter-support]{10} [kcs-news-yahoo]{11} [kcs-boardsesh-docs-legacy]{16} [kcs-boardlib-head-2026-10]{14} [kcs-boardlib-issues-2025-2026]{15}"
  - "Kilter publishes no public API or bulk catalog export; its claim portal attaches per-user data only, and its Terms of Use forbid access other than through its interface, extensive or automatic copying, reverse engineering, and use of Content except as permitted. [kcs-kilter-landing]{17} [kcs-kilter-claim]{9} [kcs-kilter-terms]{7}"
  - "Among the sources inspected, Boardsesh's anonymous v1-gzip snapshots carry Kilter climbs dated after the 2026-03-26 split; its Homewall artifact held 34,070 climbs with rows created through 2026-10-19. Two other Hugging Face uploads (one dated 2026-10-04) were not inspected. [kcs-boardsesh-snapshots-dataset]{2} [kcs-boardsesh-kilter8-artifact]{1} [kcs-hf-kilter-datasets-2026]{18}"
  - "For Homewall 7x10 (layout 8, size 17, sets 26/27) the snapshot hardware catalog matches the Aurora-era tables exactly: 472/472 placements, 305/305 LEDs, 3,294/3,294 holes, 39/39 grades. [kcs-boardsesh-kilter8-artifact]{1}"
  - "Layout-8 climbs appear with product-1 role codes 12–15 instead of Homewall's 42–45 in 3,019 of 3,022 listed climbs with created_at on or after 2026-03-26, in 1,962 listed climbs dated earlier, and in 491 baseline-shared legacy climbs whose placements otherwise match; {inferred: convergence} this follows ingestion from Kilter's new backend. Mapping roles by name raises 7x10-lightable listed climbs from 11,465 to 13,347, the same set as the snapshot's size-17 tag. [kcs-boardsesh-kilter8-artifact]{1}"
  - "Snapshot quality_average is not on the Aurora three-star scale and does not convert back to it by a fixed factor: Boardsesh documents it as 0–5 and as 1–5, and observed values span 0.25–5.0. On shared climb-angle rows, ascensionist counts are higher in 18,459, equal in 9,366 and lower in 15,899. [kcs-boardsesh-snapshots-dataset]{2} [kcs-boardsesh-kilter-sync]{3} [kcs-boardsesh-kilter8-artifact]{1}"
  - "Boardsesh terms: snapshots are 'welcome to use' with once-per-day fetching, setter attribution and no official-sourcing claim, but a publicly distributed app that uses Boardsesh 'accounts, data or servers as its service' needs written permission Boardsesh does not currently grant; whether recurring snapshot consumption falls inside that restriction is not stated. [kcs-boardsesh-legal]{4} [kcs-boardsesh-snapshots-dataset]{2}"
decisions_informed:
  - epic-catalog-sync current acquisition adapter
  - catalog update/replace mechanics and identity normalization
  - catalog rating/sends filter semantics after source change
---

# Current Kilter catalog sources (October 2026)

## Purpose and boundary

This brief unblocks `epic-catalog-sync`. It answers which sources currently carry
Kilter community climbs, how each is accessed, what identities and schemas they
preserve, and what terms attach to them. It supersedes the June 2026 sync brief, which
assumed the legacy Aurora `POST /sync` path. Personal data (logbooks, likes, an
account's own drafts) and publishing back to Kilter are out of scope. Facts were
checked on 2026-10-19.

## 1. What changed in 2026

Aurora Climbing operated the previous Kilter app. Reported chronology: a Kilter
cease-and-desist to Aurora on 2026-03-19, removal of the old app on 2026-03-26, and a
Kilter press release for its own app on 2026-03-31 [kcs-news-yahoo]{11}
[kcs-vertige]{23} [kcs-cbj-press]{12}. One report says Kilter launched its replacement
on 2026-03-26 [kcs-news-yahoo]{11}. Kilter's statement says the previous app "was taken
down today by the third-party company that operated it" [kcs-news-yahoo]{11}. Kilter's
support page says the old app is no longer supported and account data could not be
transferred, while "Almost all climbs created on the old app have been preserved"
[kcs-kilter-support]{10} [kcs-kilter-support-claim]{24}. The new app's seller is Kilter
LLC [kcs-appstore-ios]{25}, and it requires a new account [kcs-kilter-support]{10}.

## 2. Source inventory

| Source | Carries post-split climbs? | Access | Update shape | Status for this decision |
|---|---|---|---|---|
| Legacy Aurora `kilterboardapp.com/sync` (BoardLib) | No evidence of any | Form POST with per-table cursors; BoardLib's database command always logs in first | Incremental | Shut down for Kilter |
| Kilter first-party app/backend | Yes | Account (Keycloak); no public API or developer docs found | Full per-layout REST arrays plus a deleted-UUID list, per third-party description only | Not a documented integration surface |
| Boardsesh v1-gzip snapshots | Yes | Anonymous HTTPS, CORS `*` | Full snapshot per layout; documented nightly at 07:15 UTC, observed built at 18:38 UTC (see Contradictions) | Viable as data; policy scope for recurring use not stated (§3) |
| Boardsesh hosted API (`/api/v1`) | Not established | Public read endpoints plus session/JWT for account actions | Per-request | "For integrations"; not a backend for other apps |
| Hangtime Kilter client | Not established | Account (Keycloak) | Syncs gyms and walls only | First-party-backend client; not a catalog source |
| Hugging Face Kilter datasets | Not established | Download | Static | Inspected cards are ML subsets; two 2026 uploads not inspected |

Evidence per row:

- **Legacy Aurora sync.** BoardLib's Kilter code still targets `https://kilterboardapp.com`
  and implements a form-encoded `POST /sync` whose body maps table names to
  `last_synchronized_at` cursors, looping on `shared_syncs` until `_complete` or 100
  pages; its `database` command always logs in before syncing, although the `sync()`
  function accepts no token [kcs-boardlib-head-2026-10]{14}. BoardLib's last commit is
  2026-03-17; issue #78 (opened 2026-03-27) reports the Aurora Kilter endpoint "no
  longer works", and the maintainer asks for PRs and suggests Boardsesh snapshots could
  replace BoardLib's database command [kcs-boardlib-issues-2025-2026]{15}. Boardsesh
  documents switching its Aurora sync off for Kilter on 2026-03-30
  [kcs-boardsesh-docs-legacy]{16}. A single HTTPS check of the legacy host on 2026-10-19
  failed the TLS handshake [kcs-legacy-host-observation]{19}; a third-party PR reports
  the same failure from multiple networks [kcs-boardlib-pr1]{26}.
- **Kilter first party.** Landing, support, FAQ, claim and store pages carry no API or
  developer links [kcs-kilter-landing]{17} [kcs-kilter-support]{10}
  [kcs-settercloset-pages]{27}, and the terms contain no API provisions
  [kcs-kilter-terms]{7}. The claim portal accepts an Aurora JSON export (up to 6 MB) or a
  manual claim of published climbs, and attaches them to the claimant's account; it
  offers no catalog export [kcs-kilter-claim]{9} {confidence: summarizing-fetch}.
  Boardsesh and Hangtime reach the first-party backend through Keycloak-authenticated
  clients [kcs-boardsesh-kilter-sync]{3} [kcs-hangtime-kilter-client]{21}. Boardsesh
  describes full per-layout `GET` arrays for climbs and stats, a deleted-UUID list, and
  `Retry-After` handling, and labels that description reverse-engineered and "not an
  authoritative server contract" [kcs-boardsesh-kilter-sync]{3}
  [kcs-boardsesh-kilter-http-spec]{20}. A third-party PR reports that climb UUIDs and
  difficulty-grade IDs were unchanged across the split [kcs-boardlib-pr1]{26}.
- **Boardsesh snapshots.** A stable manifest at
  `https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json` lists one
  timestamped SQLite artifact per (board, layout); artifact URLs rotate and superseded
  artifacts are pruned after a 14-day grace, so consumers must resolve through the
  manifest each time [kcs-boardsesh-snapshots-dataset]{2}. Hardware and reference tables
  ship separately under `v1-catalog/manifest.json` [kcs-boardsesh-snapshots-dataset]{2}.
  Boardsesh feeds these from the first-party backend with full per-layout pulls; its own
  documentation describes the catalog sync both as 6-hourly and as hourly
  [kcs-boardsesh-kilter-sync]{3}.
- **Hangtime.** Its Kilter client uses the new Keycloak and PowerSync endpoints, requires
  an account, and syncs gyms and walls only [kcs-hangtime-kilter-client]{21}.
- **Boardsesh hosted API.** The documentation lists a `/api/v1/` REST base, public read
  endpoints with "generous limits", and authenticated account endpoints
  [kcs-boardsesh-api-docs]{5} {confidence: summarizing-fetch}.
- **Hugging Face datasets.** The inspected cards describe filtered ML splits (for example
  layout 1, size 10, sets 1/20) from BoardLib-era data with no stated snapshot date;
  `kvxb/kilter` (2026-10-04, ships a `kilter.db`) and `knightnemo` uploads were listed but
  not inspected [kcs-hf-kilter-datasets-2026]{18}.

## 3. Terms and permissions

**Kilter Terms of Use (last updated 2026-03-09).** Users must not "try to access them
using a method other than the interface and the instructions that we provide, or
extensively or automatically copy any content from the Services (in other words, no
scraping)", and may use the Services "only for your personal non-commercial use"
[kcs-kilter-terms]{7}. The Software licence is personal and non-commercial, and users
"may not copy, modify, distribute, sell, or lease any part of our Services or Software,
nor may you reverse engineer" them without written permission [kcs-kilter-terms]{7}.
On content: using the Services "does not give you ownership of any intellectual
property rights in our Services or the content you access through them (“Content”)",
and users "may not use Content, except as permitted in these Terms, by its owner, or as
otherwise permitted by law" [kcs-kilter-terms]{7}. The terms treat other users' content
as theirs ("Third Party Content"); the "Your Content" definition they point to is absent
from the referenced section, so the terms never state who owns or licenses user-created
climbs [kcs-kilter-terms]{7}. No API terms or third-party-client provisions appear
[kcs-kilter-terms]{7}. The Product Terms also prohibit reverse engineering and refer to
a "Third-Party App Integration Agreement" whose text was not found
[kcs-kilter-product-terms]{8} {confidence: summarizing-fetch}.

**Boardsesh.** Its LEGAL policy says: "The hosted service is not a backend for other
apps. A publicly distributed app or fork that uses Boardsesh accounts, data or servers
as its service needs our written permission, and we do not currently grant it. If you
fork Boardsesh, run your own backend too" [kcs-boardsesh-legal]{4}. The next paragraph
says the nightly snapshots "are public SQLite files of the climb catalogs, cheap for us
to serve, and you are welcome to use them", offered so a backend need not start from an
empty database, and adds: "We are also happy to talk about syncing non-user data such
as climbs and grades to an alternative service" [kcs-boardsesh-legal]{4}. The snapshot
documentation asks for at most one fetch per artifact per day, says "If you
redistribute or build on this data, you are responsible for how you use it", and asks
that setters be attributed and the data not be presented as officially sourced from a
manufacturer [kcs-boardsesh-snapshots-dataset]{2}. No explicit data licence is stated;
Boardsesh's code is Apache-2.0 and its hosted service and data sit outside that licence
[kcs-boardsesh-legal]{4}. Boardsesh's position that climbs are factual,
community-created content is its own stance [kcs-boardsesh-legal]{4}. The public API is
"for integrations" [kcs-boardsesh-legal]{4} [kcs-boardsesh-api-docs]{5}.

**Reading.** {inferred: tension} Two separate questions arise.
(1) *Upstream.* Boardsesh's acquisition is authenticated, automated and
reverse-engineered [kcs-boardsesh-kilter-sync]{3} [kcs-boardsesh-kilter-http-spec]{20},
which sits against the Kilter terms' scraping, copying and reverse-engineering clauses
and its content-use clause [kcs-kilter-terms]{7}. A snapshot consumer does not itself
access Kilter's services.
(2) *Boardsesh's own policy.* The policy invites snapshot use but also restricts a
publicly distributed app from using Boardsesh "data or servers as its service"
[kcs-boardsesh-legal]{4}. The text does not say whether an app that fetches snapshots
from Boardsesh's host on a recurring schedule falls inside that restriction, or whether
re-hosting the snapshot in the app's own backend satisfies "run your own backend"
{ambiguous: Boardsesh policy scope for recurring snapshot consumers}. Boardsesh names a
contact for policy questions [kcs-boardsesh-legal]{4}. Whether either point is
acceptable for a given deployment is a judgment outside the sources; the unseen Kilter
integration agreement could also change the picture.

### By use mode

{inferred: aggregate} The clauses that bear on each way of consuming the snapshots:

| Use mode | Kilter clauses in play | Boardsesh clauses in play | Settled by the sources? |
|---|---|---|---|
| (a) An end-user device fetches snapshots for its owner's use | Personal non-commercial use; Content may be used only as permitted by its owner or by law [kcs-kilter-terms]{7} | Snapshots "welcome to use"; once per day per artifact [kcs-boardsesh-legal]{4} [kcs-boardsesh-snapshots-dataset]{2} | Boardsesh: invited. Kilter: terms do not address derived third-party data. |
| (b) A distributed app fetches from Boardsesh's host on its users' behalf | As (a), per user | Restriction on a publicly distributed app using Boardsesh "data or servers as its service" [kcs-boardsesh-legal]{4} | No: scope not stated |
| (c) A developer bundles or re-hosts a Boardsesh-derived catalog | Copy/distribute and Content-use clauses [kcs-kilter-terms]{7} | "If you redistribute or build on this data, you are responsible for how you use it"; attribute setters; no official-sourcing claim [kcs-boardsesh-snapshots-dataset]{2}; "run your own backend" [kcs-boardsesh-legal]{4} | No: no data licence; Kilter's position on derived catalogs unknown |

### Against a "public or user-authorized, no reverse engineering" constraint

{inferred: aggregate}
- *Legacy Aurora sync*: documented only through open-source clients, and BoardLib's
  database command logged in before syncing [kcs-boardlib-head-2026-10]{14}; it is now
  unavailable for Kilter [kcs-boardsesh-docs-legacy]{16}, so the constraint is moot.
- *Kilter first-party backend*: reachable only through clients whose description is
  reverse-engineered [kcs-boardsesh-kilter-http-spec]{20}; direct use would not meet the
  constraint.
- *Boardsesh snapshots*: public and anonymous [kcs-boardsesh-snapshots-dataset]{2}, but
  produced from a reverse-engineered upstream [kcs-boardsesh-kilter-sync]{3}. Whether
  consuming such an output meets the constraint is a policy question the sources do not
  answer {ambiguous: constraint applies to the consumer's access or to the data's origin}.
- *Hugging Face datasets*: public, MIT-licensed cards, but not a current catalog
  [kcs-hf-kilter-datasets-2026]{18}.

If the constraint is read as applying to data origin, no inspected source carries
post-split Kilter climbs within it, and keeping the Aurora-era snapshot remains the
outcome. If it is read as applying to the consumer's own access, Boardsesh snapshots
qualify, subject to §3's Boardsesh-policy question.

## 4. Snapshot contents measured against the Aurora-era Homewall data

Measured figures in this section come from one anonymous download of the layout-8
artifact (built 2026-10-19T18:38Z) and the v1-catalog artifact. The comparison baseline is
an Aurora-era Kilter SQLite extract holding 23,156 Homewall (layout 8) climbs created
2020-10-05 to 2026-01-31; it is not filtered to 7x10, and its file hash is recorded in the
attestation [kcs-boardsesh-kilter8-artifact]{1}.

### Artifact shape

The v1-gzip manifest has top-level `formatVersion`, `generatedAt` and `entries`; each entry
carries `boardType`, `layoutId`, `url`, `bytes`, `uncompressedBytes`, `contentEncoding`,
`builtAt`, `schemaVersion` and per-table `rowCount` and watermarks. A layout artifact holds
`board_climbs`, `board_climb_stats` and `snapshot_meta`; `board_climbs` includes `uuid`,
`layout_id`, `frames`, `angle`, `is_listed`, `is_hidden`, `created_at`, `updated_at`,
`required_set_ids`, `compatible_size_ids`, `hold_fingerprint`, setter fields and revision
numbers. The v1-catalog artifact holds products, layouts, sizes, sets, roles, holes,
placements, LEDs, grades and climb aliases [kcs-boardsesh-kilter8-artifact]{1}.

### Hardware identity

Kilter layout 8 is "Kilter Board Homewall" and product size 17 is "7x10" with edges
-44/44/24/144, exactly as in the Aurora-era tables; size 17 still maps to sets 26 and 27
through rows 55 and 56 [kcs-boardsesh-kilter8-artifact]{1}. All 472 Aurora-era layout-8
placements, all 305 size-17 LEDs and all 3,294 holes are identical by ID and
coordinates. The snapshot adds 27 placements in sets 28 and 29 (Mainline and Auxiliary
Kickboard), which are not part of size 17's sets [kcs-boardsesh-kilter8-artifact]{1}.
The 39 difficulty grades match [kcs-boardsesh-kilter8-artifact]{1}.

### Climb identity and coverage

- The artifact holds 34,070 climbs: 29,053 listed and 5,017 unlisted
  [kcs-boardsesh-kilter8-artifact]{1}.
- 23,147 of 23,156 Aurora-era UUIDs are present (case-insensitive); 22,656 of those have
  byte-identical `frames`; 94 are now `is_listed=0`; 3 of the 9 absent UUIDs appear as
  aliases in `board_climb_aliases` [kcs-boardsesh-kilter8-artifact]{1}.
- Frames are the Aurora `p{placement}r{role}` grammar, rewritten by Boardsesh from the
  first-party hole-based format [kcs-boardsesh-kilter-sync]{3}. Multi-frame climbs are
  emitted as pure-delta frames, so byte comparison against Aurora-era multi-frame strings
  can differ even when semantically equal [kcs-boardsesh-kilter-sync]{3}. In this data,
  that is not what separates the two catalogs: all 491 shared climbs whose `frames`
  differ keep the same placement sequence and differ only by role code
  [kcs-boardsesh-kilter8-artifact]{1}.
- **Role codes follow the ingest path, not only the creation date.** Roles 12–15 belong to
  product 1 and 42–45 to product 7, with the same four names (start, middle, finish,
  foot) [kcs-boardsesh-kilter8-artifact]{1}. Every listed climb uses one role family only.
  Among listed Homewall climbs created on or after 2026-03-26, 3,019 use only roles 12–15
  and 3 use only 42–45; before that date 24,069 use 42–45 and 1,962 use 12–15, and the 491 shared legacy climbs above changed
  from 42–45 to 12–15 [kcs-boardsesh-kilter8-artifact]{1}. {inferred: convergence} Climbs
  re-ingested from Kilter's new backend therefore arrive with product-1 role codes on
  layout 8, whatever their creation date.
- **Coverage on 7x10.** Counting listed climbs whose every placement has a size-17 LED:
  11,465 with roles as stored, 13,347 when roles are mapped by name; the size-17 tag in
  `compatible_size_ids` also yields 13,347 [kcs-boardsesh-kilter8-artifact]{1}. Of the
  13,347, 2,278 are absent from the baseline: 1,149 have `created_at` on or after
  2026-03-26, 412 fall between the baseline's newest climb and the split, and 717 have
  older dates [kcs-boardsesh-kilter8-artifact]{1}. Of those 717, 523 carry dashed UUIDs
  and roles 12–15 with dates spread across 2020–2026, and 194 are 32-hex climbs simply
  absent from the baseline extract [kcs-boardsesh-kilter8-artifact]{1}. {inferred:
  divergence} `created_at` is therefore not a reliable marker of post-split creation;
  UUID format and role family are stronger signals of new-backend origin.
- **UUID format.** 1,148 of the 1,149 lightable climbs with `created_at` on or after
  2026-03-26
  use lowercase dashed UUIDs; Aurora-era UUIDs are 32-character uppercase hex
  [kcs-boardsesh-kilter8-artifact]{1}. Kilter's first-party deleted-UUID list mixes case
  [kcs-boardsesh-kilter-sync]{3}.
- **Dedup folding.** A new-UUID climb whose (layout, hold fingerprint) matches an
  existing climb becomes an alias of it rather than its own row, and its stats are summed
  onto the canonical [kcs-boardsesh-kilter-sync]{3}. Aliases ship in the v1-catalog
  artifact [kcs-boardsesh-snapshot-manifests]{6}.
- **Unmappable climbs** go to a skip backlog and are absent; the documented gap is three
  climbs on a post-2024 hold set. Climbs tagged to the wrong layout upstream are rerouted
  when exactly one other layout decodes them; eight were rerouted on 2026-09-15
  [kcs-boardsesh-kilter-sync]{3}.

### Deletions and edits

Boardsesh's reconciliation against Kilter's deleted-UUID list is "gated, report-only by
default", and "an absent list is not evidence that nothing was deleted"
[kcs-boardsesh-kilter-sync]{3}. When applied, it unlists (`is_listed=false`) rather than
removing rows; Boardsesh observed the first-party catalog still returning 124 climbs
that the deletion pass unlisted [kcs-boardsesh-kilter-sync]{3}.

Rows can also leave a snapshot without being unlisted: snapshots distribute only
published imported climbs without a linked Boardsesh author, exclude drafts
[kcs-boardsesh-snapshots-dataset]{2}, and fold duplicate-hold climbs into aliases
[kcs-boardsesh-kilter-sync]{3}. The artifact's `snapshot_meta` has a `sync_deletions`
row with count 0 [kcs-boardsesh-kilter8-artifact]{1}; Boardsesh's operations document
describes it as a metadata-only tombstone boundary [kcs-boardsesh-snapshot-ops]{22}, not
a list of deleted climbs. The artifact contains no per-climb deletion table
[kcs-boardsesh-kilter8-artifact]{1}, so {inferred: aggregate} an anonymous consumer
detects removals only by comparing successive snapshots. The alias table identifies
alias folds; a deletion and an exclusion (for example a setter linking a Boardsesh
account) remain indistinguishable.

Rows carry `updated_at`, `revision_number` and `holds_revision_number`
[kcs-boardsesh-snapshots-dataset]{2} [kcs-boardsesh-kilter8-artifact]{1}.

### Stats and grades

`board_climb_stats` is keyed by (board, climb, angle) with `display_difficulty` in the
native Kilter difficulty scale [kcs-boardsesh-snapshots-dataset]{2}.

**Quality.** Boardsesh's sync documentation says Kilter's new backend reports
`quality_average` on 1–5, Aurora reported 1–3, Aurora-sourced values are rescaled ×5/3,
and every writer stores 1–5 [kcs-boardsesh-kilter-sync]{3}; its dataset documentation
calls the column a "0–5 star" scale [kcs-boardsesh-snapshots-dataset]{2}. Observed values
span 0.25–5.0, with 13 rows below 1.0 [kcs-boardsesh-kilter8-artifact]{1}. On shared rows
with unchanged ascensionist counts, one Aurora-era value maps to a wide snapshot range (for
example 3.0 → 1.0–5.0, mean 3.83) [kcs-boardsesh-kilter8-artifact]{1}. {inferred:
divergence} Whatever the documented rescaling, the snapshot values do not convert back to
the Aurora three-star values by a fixed factor. Stat angles run 0–70 in steps of 5 in
both the snapshot and the baseline [kcs-boardsesh-kilter8-artifact]{1}.

**Ascensionist counts.** On 43,724 shared (climb, angle) rows the snapshot count is higher
in 18,459, equal in 9,366 and lower in 15,899 [kcs-boardsesh-kilter8-artifact]{1}.
Boardsesh's live sync historically kept the larger of its two upstream counts, while a
separate repair job re-fetches Kilter's stats, de-duplicates them and overwrites the
upstream count, which can lower it [kcs-boardsesh-kilter-sync]{3}. Boardsesh's
materialized count also adds a Boardsesh-native count [kcs-boardsesh-kilter-sync]{3};
whether the snapshot value includes that term is not stated {ambiguous: snapshot
ascensionist_count composition}. 740 stat rows have null `display_difficulty`
[kcs-boardsesh-kilter8-artifact]{1}.

### Transport

The manifest declares `contentEncoding: gzip` with a compressed `bytes` value and an
`uncompressedBytes` value, and no content hash [kcs-boardsesh-kilter8-artifact]{1}. The
dataset documentation says artifacts are served with `Content-Encoding: gzip`
[kcs-boardsesh-snapshots-dataset]{2}; observed responses carried no
`content-encoding` header and returned plain SQLite of exactly `uncompressedBytes`,
under both `Accept-Encoding: identity` and `gzip` [kcs-boardsesh-kilter8-artifact]{1}.
Artifact responses are `immutable` with a one-year max-age; the manifest caches for 300
seconds; both allow any origin [kcs-boardsesh-kilter8-artifact]{1}.

## Contradictions

| Claim | Position A | Position B | Relationship |
|---|---|---|---|
| Artifact transfer encoding | Served with `Content-Encoding: gzip`; check for `1f 8b` [kcs-boardsesh-snapshots-dataset]{2} | No `content-encoding`; plain SQLite bytes equal to `uncompressedBytes` [kcs-boardsesh-kilter8-artifact]{1} | contradicts |
| Snapshot cadence | Nightly at 07:15 UTC, with occasional manual runs [kcs-boardsesh-snapshots-dataset]{2} | Kilter layout 1 and 8 artifacts built 18:38 UTC while other boards built 07:19 UTC [kcs-boardsesh-snapshot-manifests]{6} | tension |
| Quality scale (documented) | "0–5 star" scale [kcs-boardsesh-snapshots-dataset]{2} | Every writer stores 1–5 [kcs-boardsesh-kilter-sync]{3} | contradicts |
| Quality scale (observed) | Every writer stores 1–5 [kcs-boardsesh-kilter-sync]{3} | 13 rows below 1.0; range 0.25–5.0 [kcs-boardsesh-kilter8-artifact]{1} | contradicts |
| Quality rescaling | Aurora-sourced values rescaled ×5/3 [kcs-boardsesh-kilter-sync]{3} | Shared rows with equal counts show no fixed mapping from Aurora values [kcs-boardsesh-kilter8-artifact]{1} | tension |
| Replacement-app launch date | Kilter launched its replacement 2026-03-26 [kcs-news-yahoo]{11} | Kilter press release 2026-03-31 [kcs-vertige]{23} [kcs-cbj-press]{12} | qualifies (launch vs announcement) |
| Catalog sync cadence | Catalog sync every 6 hours [kcs-boardsesh-kilter-sync]{3} | Schedule table: "Hourly at :23" [kcs-boardsesh-kilter-sync]{3} | contradicts (within one document) |
| Boardsesh data use by other apps | Snapshots: "you are welcome to use them" [kcs-boardsesh-legal]{4} | A publicly distributed app using Boardsesh "data or servers as its service" needs written permission, not currently granted [kcs-boardsesh-legal]{4} | tension (within one policy; scope for recurring snapshot consumers not stated) |
| Legacy shutdown date | Aurora backend gone 2026-03-25 [kcs-boardsesh-migration]{13} | App taken down 2026-03-26 [kcs-news-yahoo]{11} | tension |
| BoardLib Kilter support | README lists Kilter as supported [kcs-boardlib-head-2026-10]{14} | Issue #78: endpoint no longer works [kcs-boardlib-issues-2025-2026]{15} | qualifies (README last changed 2026-03-17, before the issue) |

## Disconfirming analysis

- *Legacy sync might still work.* No fetched source reports a successful legacy sync after
  March 2026; three independent sources report it gone [kcs-kilter-support]{10}
  [kcs-boardsesh-docs-legacy]{16} [kcs-boardlib-issues-2025-2026]{15}. The API itself was
  not called.
- *Snapshots might not contain current-app climbs.* Rows with `created_at` through the
  fetch date exist, and they carry a distinct UUID format [kcs-boardsesh-kilter8-artifact]{1}.
- *Hardware IDs might have drifted.* Every 7x10 placement, LED and hole matched by ID and
  coordinates [kcs-boardsesh-kilter8-artifact]{1}. Only Homewall layout 8 / size 17 was
  checked.
- *Role 12–15 rows might be non-Homewall climbs mis-tagged to layout 8.* Evidence runs
  against it: 491 known Homewall climbs from the Aurora-era data reappear with the same
  placements and only their roles recoded, and the name-mapped 7x10 set is the same set
  Boardsesh tags with size 17 [kcs-boardsesh-kilter8-artifact]{1}. Boardsesh separately
  reroutes upstream layout mis-tags [kcs-boardsesh-kilter-sync]{3}. No rendering in
  Kilter's own app was compared.
- *Snapshot terms might cover any reuse.* The same policy that invites snapshot use
  restricts publicly distributed apps from using Boardsesh data or servers as their
  service [kcs-boardsesh-legal]{4}; see §3.
- *A Kilter API might exist.* None was found on any fetched first-party page; the
  integration agreement remains unseen [kcs-kilter-product-terms]{8}.

## Implementation-relevant notes

These are facts an updater must accommodate; the design choices belong to the epic.

1. Resolve artifact URLs from the v1-gzip and v1-catalog manifests on every check; do
   not persist artifact URLs; fetch each artifact at most once per day
   [kcs-boardsesh-snapshots-dataset]{2}.
2. Accept both gzip and plain SQLite bodies (sniff `1f 8b` versus the SQLite header);
   validate length against the manifest `bytes` or `uncompressedBytes` accordingly; no
   publisher hash exists to pin [kcs-boardsesh-kilter8-artifact]{1}
   [kcs-boardsesh-snapshots-dataset]{2}.
3. Select Homewall rows with `layout_id = 8`, `is_listed = 1`, and 7x10 compatibility;
   either rely on `compatible_size_ids` containing 17 or recompute from placements and
   size-17 LEDs after role normalization — both give 13,347 today
   [kcs-boardsesh-kilter8-artifact]{1}.
4. Normalize role codes by role name within the board (12↔42 start, 13↔43 middle, 14↔44
   finish, 15↔45 foot) before validating or lighting [kcs-boardsesh-kilter8-artifact]{1}.
5. Compare UUIDs case-insensitively and accept both 32-hex and dashed forms; consult
   `board_climb_aliases` before treating a known UUID as removed
   [kcs-boardsesh-kilter8-artifact]{1} [kcs-boardsesh-kilter-sync]{3}.
6. Treat `is_listed = 0` as removal from browsing, not deletion of history
   [kcs-boardsesh-kilter-sync]{3}. Detect other removals by comparing successive
   snapshots; the artifact carries no deletion feed. Check `board_climb_aliases` for a
   vanished UUID; one not found there may be an exclusion rather than a deletion [kcs-boardsesh-kilter8-artifact]{1}
   [kcs-boardsesh-snapshots-dataset]{2} [kcs-boardsesh-snapshot-ops]{22}.
7. Do not reuse three-star quality thresholds on snapshot `quality_average`; treat its
   range as 0–5 (observed 0.25–5.0) [kcs-boardsesh-snapshots-dataset]{2}
   [kcs-boardsesh-kilter8-artifact]{1}. Expect sends
   counts to move in both directions between snapshots [kcs-boardsesh-kilter8-artifact]{1}.
8. Join hardware from the v1-catalog artifact, or keep existing Aurora-era hardware
   tables for 7x10, which match exactly [kcs-boardsesh-kilter8-artifact]{1}.
9. Surface setter attribution and avoid labelling the data as official Kilter data
   [kcs-boardsesh-snapshots-dataset]{2}.
10. Boardsesh's policy says a publicly distributed app must not use Boardsesh accounts,
    data or servers as its service without written permission, invites snapshot use, and
    names a contact for policy questions [kcs-boardsesh-legal]{4}. Which side of that line
    a recurring snapshot fetch falls on is not stated (§3).

## Project implications (design context, not source findings)

- The operator accepted Boardsesh snapshots as CruxControl's recurring upstream Kilter
  catalog source on 2026-10-19, with the Kilter-terms tension in view. That decision
  should be re-confirmed against the Boardsesh policy restriction quoted in §3 and the
  use modes above. Both are project decisions recorded here for the epic, not
  conclusions of the sources.
- The catalog is a separate, reacquirable store; authored climbs, playlists and backups
  are outside it. Any update path must leave the personal library untouched, including
  playlist references to catalog climbs whose UUIDs are later unlisted or aliased.
- The current bundled catalog is labelled `legacy-aurora-kilter` with newest climb
  2026-01-31. A Boardsesh-sourced catalog needs its own provenance label, build time and
  watermark.
- The rating filter currently uses the source's three-star scale; a source change alters
  rating semantics (implementation note 7).

## Gaps

- Snapshot `ascensionist_count` composition (upstream only versus including
  Boardsesh-native ticks).
- Snapshot completeness relative to Kilter's live Homewall catalog; the author-link
  exclusion, skip backlog and alias folds were not counted.
- Why 523 dashed-UUID climbs carry pre-split `created_at` dates.
- The baseline extract is itself incomplete: 194 lightable 32-hex climbs dated before its
  newest climb are absent from it. Most of the snapshot's 5,017 unlisted rows are not
  traced to a cause.
- Whether Boardsesh regards recurring snapshot fetching by a distributed app, or
  re-hosting of snapshots, as within its written-permission restriction.
- Whether role 12–15 Homewall rows render identically in Kilter's own app.
- The "Third-Party App Integration Agreement" text and any Kilter statement on
  third-party clients or climb ownership.
- Layouts other than Homewall 8 / size 17 were not measured.
- Exact last date the legacy Aurora API served Kilter data.

## Revisit if

- Kilter publishes an API, developer terms, a bulk export, or a third-party policy, or
  revises its Terms of Use.
- Boardsesh changes the manifest `formatVersion`, the `v1-gzip`/`v1-catalog` prefixes,
  snapshot terms, or adds a data licence or content hash.
- Boardsesh changes role-code or UUID handling for Homewall, or Homewall size-17
  hardware rows change.
- Boardsesh stops publishing Kilter snapshots.

## Bibliography

1. kcs-boardsesh-kilter8-artifact
2. kcs-boardsesh-snapshots-dataset
3. kcs-boardsesh-kilter-sync
4. kcs-boardsesh-legal
5. kcs-boardsesh-api-docs
6. kcs-boardsesh-snapshot-manifests
7. kcs-kilter-terms
8. kcs-kilter-product-terms
9. kcs-kilter-claim
10. kcs-kilter-support
11. kcs-news-yahoo
12. kcs-cbj-press
13. kcs-boardsesh-migration
14. kcs-boardlib-head-2026-10
15. kcs-boardlib-issues-2025-2026
16. kcs-boardsesh-docs-legacy
17. kcs-kilter-landing
18. kcs-hf-kilter-datasets-2026
19. kcs-legacy-host-observation
20. kcs-boardsesh-kilter-http-spec
21. kcs-hangtime-kilter-client
22. kcs-boardsesh-snapshot-ops
23. kcs-vertige
24. kcs-kilter-support-claim
25. kcs-appstore-ios
26. kcs-boardlib-pr1
27. kcs-settercloset-pages
