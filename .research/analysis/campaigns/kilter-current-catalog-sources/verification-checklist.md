---
provenance: agent-synthesis
stage: adversarial-read
target: .research/analysis/campaigns/kilter-current-catalog-sources/parent.md
target_sha256_prefix: 35216fc38fc78f6d
reviewed: 2026-10-19
verdict: NEEDS-REVISION
---

# Verification checklist: kilter-current-catalog-sources (adversarial read)

Inputs: the parent synthesis, three specialist briefs, all `kcs-*` attestations (cited and
uncited), and the lint output. I re-ran read-only checks against the local artifacts
(`ours.db`, `bs-kilter-8.db`, `bs-catalog.db`). I also made read-only re-fetches of three
sources to test specific claims: Boardsesh `docs/board-snapshots-dataset.md`,
`docs/kilter-sync.md`, `LEGAL.md` and `docs/board-snapshots.md` at commit `3340422a`, plus
`https://kilterboard.io/terms` as raw HTML. Copies of the re-fetched files are in the session
scratchpad under `adv/`. Re-fetched passages cited below are **not yet attested**. Each finding
names the attestation the revision pass must extend before re-pointing a citation, following
the quote-before-cite rule and the direction rule in bundle §8.

## Verdict: NEEDS-REVISION

Three findings change substance, all on seed dimensions: terms (R1, R2) and deletions (R3).
Two findings smooth a measured result (R4, R5). The rest are citation precision and coverage
fixes. All hardware-identity, coverage and transport figures in §4 reproduce exactly (see
"Verified" at the end).

---

## (a) Semantic citation-chain walk

1. **Key finding L30**: "Kilter says the old app … was taken down" is cited only to
   `[kcs-kilter-support]{10}`. That attestation says "no longer supported" and does not say "taken down".
   The phrase "taken down" is Kilter's statement in `[kcs-news-yahoo]{11}`. Add {11}.
2. **L62**: "The new app is published by Kilter LLC [kcs-kilter-landing]{17} [kcs-kilter-support]{10}".
   Neither attestation records the publisher. `kcs-appstore-ios` records "Seller Kilter LLC" and is
   uncited. Cite it.
3. **L56–58 chronology**: "a Kilter press release for its own app on 2026-03-31 [kcs-news-yahoo]{11}
   [kcs-cbj-press]{12}". The Yahoo attestation has no 03-31 press release. Its timeline has
   "Mar 26 … Kilter launches replacement". CBJ is dated 03-31 but is a trade-press article.
   `kcs-vertige` explicitly attests "Mar 31 Kilter press release" and is uncited. Re-cite, and keep
   Yahoo's 03-26 launch report side by side rather than implying the app arrived on 03-31.
   `kcs-vertige` also reports a new-app Android update on 2026-03-16, which bears on the 03-26 era
   cutoff used in §4.
4. **L175–176**: "Boardsesh's deleted-UUID list mixes case [kcs-boardsesh-kilter-sync]{3}" misattributes
   the list. Per {3}, the mixed-case `string[]` is Kilter's first-party `GET /api/climbs/delteduuids`
   response. L186 states this correctly, so L175–176 contradicts the brief's own text.
5. **L87–88**: "Landing, support, claim, store and terms pages carry no API or developer links
   [17][7]". The cited attestations cover landing and terms only. The support absence is in {10},
   the store listing is `kcs-appstore-ios`, and the FAQ is `kcs-settercloset-pages`, all uncited
   here. `kcs-kilter-claim` does not record link absence. Re-cite, or drop "claim".
6. **L126–127**: the API-terms quotes ("for integrations"; "which we do not currently grant") cite only
   `kcs-boardsesh-api-docs`, a summarizing fetch. `kcs-boardsesh-legal` has the same wording verbatim
   and is source-direct. Co-cite {4}. (Also see R1: the LEGAL wording is broader than "hosted API".)
7. **Contradictions row "Quality scale"**: "0-5 star scale" is shown as a quote, but the attestation
   records only "quality_average (0-5)". The source does say "`quality_average` (0–5 star scale)"
   (re-fetch, dataset doc). This is a read-but-not-attested gap: extend
   `kcs-boardsesh-snapshots-dataset` with the verbatim phrase.
8. **Inventory table, Boardsesh hosted API row**: "Carries post-split climbs? Yes" is unsupported.
   `kcs-boardsesh-api-docs` says "No Kilter-specific data-source documentation on this page".
   Mark it `{inferred: …}` (same database as the snapshots) or say "not documented".
   "Access: Session/JWT" also drops the attested "Public read endpoints have generous limits", and
   LEGAL describes the API as being for "tools that read climb data". Unauthenticated reads are not
   ruled out, so revise the cell.
9. **Inventory table, Kilter first-party row**: "Update shape: Unknown (private)" contradicts attested
   material. `{3}` and `{20}` describe (as a third-party reverse-engineered account) full per-layout
   arrays via `GET /api/climbs/all/{productLayoutUuid}` with no pagination, `GET /api/climb-stat/all/…`,
   a deleted-UUID list, Keycloak PKCE with Bearer JWT, and client `Retry-After` handling. The seed asks
   for request/response shapes, auth and rate limits "where public". State these as Boardsesh's
   reverse-engineered description, labelled as such and not as a contract, rather than "Unknown".

## (b) Claim shapes the mechanical lint missed

1. **Key finding L32**: "Boardsesh's anonymous v1-gzip snapshots are the only public bulk source found
   that carries post-split Kilter climbs" is a comparative superlative (bundle §6). It is hedged with
   "found", but it is composed across the whole inventory and carries no marker. `kcs-hf-kilter-datasets-2026`
   records that `kvxb/kilter` (2026-10-04, ships `kilter.db`, no README) and `knightnemo/kilter-climb-real2sim`
   (2026-10-12) were **not inspected**. The third-party specialist named this gap and the parent dropped it.
   Reword (for example "no other public bulk source examined…"), add `{inferred: aggregate}`, and list the
   uninspected datasets under Gaps and Disconfirming analysis.
2. **L104–105**: "Hugging Face datasets are filtered ML splits … from BoardLib-era data with no stated
   snapshot date" generalizes from the three cards read to every dataset. "BoardLib-era" is composed: the
   card says "BoardLib repo + Kilter app". Scope the claim to the cards read.
3. **L132–133**: "A consumer of the public snapshots does not itself access Kilter's services" is a composed
   legal-adjacent reading with no marker. Mark it `{inferred: …}`. Also qualify it with the LEGAL
   "data or servers" clause (R1).
4. **Disconfirming L229–231**: "three independent sources report it gone [10][16][15]". {10} says the
   old *app* is unsupported and does not address the sync API. The more direct evidence is uncited:
   Yahoo's "Michaux disables Kilter app server" (03-26) and `kcs-boardlib-pr1` (TLS handshake failure
   reproduced with three tools from multiple networks). Re-weight the citations; "independent" is
   composed.

## (c) Coherence read for smoothed contradictions

1. **R1, high. Boardsesh LEGAL contains an internal tension that the synthesis narrows away.**
   `kcs-boardsesh-legal` attests verbatim: "The hosted service is not a backend for other apps. A publicly
   distributed app or fork that uses Boardsesh **accounts, data or servers** as its service needs our
   written permission, and we do not currently grant it." The next paragraph (re-fetch, LEGAL.md
   L69–71) says "You do not have to start from an empty database either. The nightly board snapshots …
   you are welcome to use them", in the context of forks running their own backend.
   §3 (L125–127), key finding L36 and implementation note 10 all narrow the restriction to "its hosted
   API". A distributed app that fetches snapshots from `snapshots.boardsesh.com` on a schedule as its
   catalog update source arguably falls within "data or servers as its service". These two statements
   should appear as a Contradictions row (`tension`, intra-source, both `[kcs-boardsesh-legal]{4}`) and in
   §3, with no resolution. The same paragraph's "We are also happy to talk about syncing non-user data
   such as climbs and grades to an alternative service" is an attested permission route and is also
   absent. Because the Project-implications bullet says the operator decision followed review of "the
   terms tension in section 3", the revised §3 should be shown to the operator again. This verification
   does not judge the decision itself.
2. **R3, high. "Deletions are unlistings"** (summary L28 and §4 "Deletions and edits") smooths three
   attested or source-stated qualifiers:
   - {3} attests that the deletion pass is "gated, report-only by default". The source (re-fetch,
     kilter-sync.md L176) adds that "an absent list is not evidence that nothing was deleted". L186
     presents unlisting as what happens, without this qualifier.
   - The `sync_deletions` row (L191–192, count 0) is presented without interpretation. Per
     `docs/board-snapshots.md` (re-fetch, L115–133 and L409–410), it is a **metadata-only tombstone
     replay boundary** for Boardsesh's own clients, which then pull tombstones from Boardsesh's sync
     service. An anonymous snapshot consumer receives no deletion feed and must diff successive
     snapshots. A row count of 0 is by design and is not evidence that nothing was deleted. This needs an
     attestation for `board-snapshots.md`; the current `kcs-boardsesh-docs-legacy` covers it in one line
     and gets it wrong (see (h)).
   - Rows can disappear from snapshots without unlisting. The dataset doc, attested in part, distributes
     "only published imported climbs without a linked Boardsesh author" and adds (re-fetch) that "account
     privacy changes can revoke access". Folding moves a UUID to `board_climb_aliases`. The uncited
     `kcs-boardsesh-snapshot-manifest` records layout 8 at 35,022 climbs on 2026-10-03 against 34,070 on
     2026-10-19. Those come from different prefixes (`v1` on Tigris, `v1-gzip`) and a summarizing fetch,
     so record this as a `{confidence: …}` tension, not a measured deletion count.
   Implementation note 6 should then read: unlisting and disappearance are both removal signals. Note 5
   already covers aliases.
3. **R4, medium-high. Ascensionist counts.** Key finding L35 says counts "have grown on 18,459 of 43,724
   shared rows". Re-running the comparison: equal 9,366, higher 18,459, **lower 15,899** (median
   decrease 1, maximum 17). Reporting only growth hides that more than a third of shared rows went down,
   which matters for any sends filter. The source gives a mechanism: the live sync writes
   `GREATEST(existing, incoming)` but `repair-stats` "may correct a count downward" (re-fetch,
   kilter-sync.md L428). Extend `kcs-boardsesh-kilter8-artifact` with the "lower" count and
   `kcs-boardsesh-kilter-sync` with the repair-stats passage, then revise L35 and §4 "Stats and grades".
4. **R5, medium. Role-code era framing.** §4 "Role codes changed after the split", summary L27 and key
   finding L34 present roles 12–15 as a property of post-split creation. Re-running the comparison: **all
   491** shared Aurora-era climbs whose `frames` are not byte-identical differ **only** in role code
   (42–45 in the baseline, 12–15 in the snapshot). Their placements are the same, and they become
   byte-identical after mapping roles by name. So legacy climbs re-ingested through the new backend were
   also recoded. Two consequences follow:
   - The multi-frame sentence (L160–162) sits next to the 22,656 byte-identical figure and invites the
     reader to attribute the 491 differences to delta frames. In this data none of them are.
   - This is the strongest available evidence against the disconfirming hypothesis that role 12–15 rows
     are non-Homewall climbs mis-tagged to layout 8 (L238–241), because known Homewall climbs carry
     12–15 after re-ingestion. `{3}` also attests a mis-tagged-layout reroute fallback (8 climbs on
     2026-09-15), which is relevant to the same hypothesis and uncited.
   Extend `kcs-boardsesh-kilter8-artifact` with the 491 result and reframe: "rows sourced from the new
   backend carry product-1 role codes, including re-ingested legacy climbs".
5. **Cadence (low).** The source contradicts itself. Prose at kilter-sync.md L252 says the catalog job runs
   "every 6 hours at :23" after the worker cutover. The job table at L509 says "Hourly at :23". L102–103
   states 6-hourly as fact. Add a tension row or hedge it, and note that the prose is conditional on
   "after the worker cutover".

## (d) Noise domination and relevance weighting

Uncited attestations that are more relevant than what the brief cites:

- `kcs-appstore-ios`: the publisher (see (a)2).
- `kcs-vertige`: the 03-31 press release and the 03-16 new-app update (see (a)3).
- `kcs-boardlib-pr1`: a third-party report that "Climb UUIDs and difficulty-grade IDs remained
  unchanged across the split", plus TLS failure reproduced from multiple networks. It corroborates §4
  identity and L84–86 and is stronger than the single observation in {19}. Mark it `{confidence: secondary}`.
- `kcs-kilter-support-claim`: Kilter's own statement "Almost all climbs created on the old app have been
  preserved". This is the only first-party coverage statement on legacy climbs in the current app, and
  the seed asks for current-app versus legacy coverage. Note that it came through a summarizing fetch.
- `kcs-boardsesh-kilter-sync` contains more evidence the brief does not use:
  - The mis-tagged reroute fallback (see (c)4).
  - The Kilter app's (climb, angle) count convention.
  - Re-fetch L198–206 (attest before citing): Boardsesh's Homewall 8x12 and 10x12 distinct-climb and
    stat counts match the Kilter app's displayed counts to within about 1.5%. This is publisher-reported
    coverage parity for sibling Homewall sizes; 7x10 was not measured.
  - Some stat rows come only from Boardsesh ticks (`upstream_synced_at IS NULL`), which bears on the
    `ascensionist_count` ambiguity at L201–203.
- **Quality mechanism (attestation thin).** `kcs-boardsesh-kilter-sync` records only "normalized to 1-5".
  The source (re-fetch, L441–447) says Kilter's new app natively reports 1–5 and stores it as-is, while
  Aurora's 1–3 rows were rescaled ×5/3. The snapshot quality for re-ingested rows is therefore the new
  app's own rating average, not a rescaled Aurora value, which explains "no fixed rescale" (L199–200) and
  implementation note 7. Extend the attestation and cite it.
- **Seed coverage, rate limits.** The brief does not state rate-limit facts for the first-party backend
  (client honours `Retry-After` up to 5 min, `rate_limited` failure; attested in {3}) or for the Boardsesh
  API ("generous", no numbers; {5}). Add one line for each source.

## (e) Quote-context walk (GR.4)

1. LEGAL "you are welcome to use them" (L119) is presented as a standalone invitation. The source puts it
   directly after the "accounts, data or servers" restriction and in the context of seeding one's own
   backend (R1).
2. Dataset doc (L119–122): the brief keeps "attribute setters" and "don't present … as officially sourced"
   but drops the lead clause of the same sentence, "If you redistribute or build on this data, **you are
   responsible for how you use it**". This clause is attested and bears on redistribution.
3. Inventory table "login optional in code" (legacy row) strips the attested qualifier that BoardLib's
   `database` command **always** logs in before syncing; only `sync()` accepts `token=None`. See (f).
4. Kilter quotes ("taken down today…"), the http-spec disclaimer and the issue #78 "no longer works" quote
   keep their framing. Nothing to fix.

## (f) Analytical-tier inheritance walk

- The brief cites no analytical-tier artifact; the lint shows no intra-program resolutions. The prior brief
  (`docs/briefs/catalog-sync-api.md`) is described as superseded and is not cited. Correct.
- **Inheritance suspected:** the lens brief says "Auth is optional and lazy. Public catalog sync works
  anonymously." The inventory cell "login optional in code" reproduces that framing more strongly than the
  attestation supports (see (e)3). Rewrite from `kcs-boardlib-head-2026-10` alone.
- Reversal bookkeeping (bundle §8): `supersedes:` points at the prior brief, which is retained. The prior
  brief has no forward pointer, which is downstream work. This is not a defect of this artifact.

## (g) Line-reference walk

- The brief has no line-range or section-range citations. The `product_sizes_layouts_sets` rows 55/56
  (sets 26/27) were checked against both databases and match. Nothing further.

## (h) Thin-attestation check (semantic)

1. **`kcs-kilter-terms` (R2, high).** The frontmatter says `source-direct`, but the body says it was
   fetched through a summarizing tool. Its "Absences" section ("No dedicated section on user-generated
   climbs/content ownership or a content license") is **partly contradicted by the raw page**. The raw
   page was re-fetched 2026-10-19 from `https://kilterboard.io/terms` (HTML, "Last updated: March 9,
   2026") and contains:
   - "Using our Services does not give you ownership of any intellectual property rights in our Services
     or the content you access through them ("Content"). You may not use Content, except as permitted in
     these Terms, by its owner, or as otherwise permitted by law."
   - "some Content belongs to … other users … or is Your Content (as defined in Section 5 below)".
     Section 5 is "About Software", so the definition does not resolve.
   - In Section 5: "You may not copy, modify, distribute, sell, or lease any part of our Services or
     Software".

   §3 L113–114 says "The terms say nothing about ownership or licensing of user-created climbs". That
   overstates the absence. The Terms do not grant Kilter a licence over user content, but they do say
   other users own Content and restrict its use to what the Terms, the owner or the law permit. That is
   directly relevant to redistributing a derived catalog. The three quoted strings in §3 do appear
   verbatim in the raw page, so the quotes stand.

   Fix: re-attest from the raw HTML (correct the confidence label and the Absences section), then revise
   §3 and its "Reading".
2. **Summarizing-fetch attestations used for load-bearing claims.** These lack `{confidence: …}` markers:
   - `kcs-boardsesh-api-docs` (explicitly summarizing).
   - `kcs-kilter-product-terms` (summarizing; it is the source for the "Third-Party App Integration
     Agreement" reference).
   - `kcs-kilter-claim` and `kcs-kilter-support` (text "as returned").
   - `kcs-boardsesh-snapshot-manifest` (summarizing, if cited per (c)2).

   Add markers wherever the claim is load-bearing, or re-attest from raw.
3. **`kcs-hf-kilter-datasets-2026`** (lint GR.5). It is substantively thin for the generalization at
   L104–105, and its Vilin97 details cite through another attestation (`hf-vilin97-kilterboard`) rather than
   the card. Acceptable only if the claim is scoped (see (b)2).
4. **`kcs-hangtime-kilter-client`** (lint GR.5). Substantively adequate for the narrow L91–93 claim
   (Keycloak-authenticated client). You may add that it syncs gyms and walls only, so it is not a catalog
   source.
5. **`kcs-boardsesh-docs-legacy`** has one `source_url` (kilter-sync.md, the same as {3}) but summarizes
   three files. Its line "every layout manifest entry carries deletionsReplayFrom" is **wrong**:
   `deletionsReplayFrom` is in the build/upload logs (board-snapshots.md L132–133), and the saved
   v1-gzip manifest entry for kilter/8 has no such field. The parent does not cite this line, but fix it
   at the attestation tier and split the file into per-source attestations.
6. **`kcs-boardsesh-kilter8-artifact`**. These minor figures are not cited by the parent but are worth
   correcting:
   - Lightable multi-frame rows: my re-run counts 37 lightable-after-mapping rows containing `,"`
     against the 27 attested. The attested 27 may use a different base, so state the base.
   - Baseline quality-3.0 group with equal counts: n = 6,432 here against 6,444 attested. This may
     depend on how null quality is handled.

## Lint flags adjudicated

- L86 `unreachable-source` for `kcs-legacy-host-observation`: expected, since the observation is that the
  host fails TLS. Accept.
- L93 thin: substantively adequate ((h)4). L105 thin: substantively thin ((h)3).
- L123, L198 and L302 pattern flags (Apache-2.0, numeric ranges, "publishes an API"): false positives.

## Verified (re-run against local artifacts; no change needed)

- **Hardware.**
  - Layout 8 "Kilter Board Homewall", product 7.
  - Size 17 "7x10" with edges -44/44/24/144, identical to the baseline, including the "Full Ride LED Kit"
    description.
  - PSLS rows 55/56 map to sets 26/27 with identical image filenames.
  - Placements: 472/472 baseline rows match on (id, layout, hole, set). The 27 extra placements are in
    set 28 (13) and set 29 (14).
  - LEDs 305/305, holes 3,294/3,294, grades 39/39. Roles 12–15 belong to product 1 and 42–45 to product 7,
    with the same names.
- **Climbs.**
  - 34,070 rows, 29,053 listed, 0 drafts; newest `created_at` 2026-10-19T14:23:52Z.
  - 23,147/23,156 baseline UUIDs present; 22,656 byte-identical; 94 unlisted; 3 of 9 absent UUIDs
    are aliases.
  - Role eras 24,069 / 1,962 / 3,019 / 3, which sum exactly to the listed total, so no mixed-role rows.
  - Lightable 11,465 as stored and 13,347 after mapping. The 13,347 is the **same set** as
    `compatible_size_ids ∋ 17`, not just the same count.
  - Of those, 1,149 are post-cutoff, 1,148 use lowercase dashed UUIDs, and 2,278 are absent from the
    baseline.
- **Stats.** 51,874 rows; quality range 0.25–5.0 against 1.0–3.0 in the baseline; 740 null
  `display_difficulty`; 43,724 shared; 9,366 equal; 18,459 higher (plus 15,899 lower, see R4).
- **Transport.**
  - Stored headers show HTTP/2 200, `application/x-sqlite3`, `immutable` with one-year max-age, ACAO `*`
    and no `content-encoding`. The body starts with `SQLite format 3`.
  - The identity and gzip downloads both hash to `102382b6…`, which matches the attestation.
  - `snapshot_meta.sync_deletions` row_count is 0.
- **Kilter terms quotes** in §3: verbatim in the raw page.
- **Project implications** section: clearly labelled as an operator decision and design context, and kept
  separate from source findings. Correct, apart from the re-review note in R1.

## Prioritized required revisions

1. **R1 (high):** Surface the LEGAL "accounts, data or servers as its service" restriction next to
   "welcome to use them" as an intra-source `tension`. Revise §3, key finding L36 and implementation
   note 10. Restore "you are responsible for how you use it" and the "happy to talk about syncing" route.
   Flag the revised §3 for the operator.
2. **R2 (high):** Re-attest the Kilter Terms from raw HTML, adding the Content-ownership/use clause, the
   "Your Content" reference and "may not copy, modify, distribute". Correct §3 L113–114 and the Reading.
3. **R3 (high):** Rewrite deletion handling:
   - The first-party deletion pass is gated and report-only by default.
   - `sync_deletions` is a replay boundary, not a deletion count.
   - Anonymous consumers must diff snapshots, and rows can vanish (privacy filter, aliasing).
   - Attest `board-snapshots.md` and fix the docs-legacy `deletionsReplayFrom` line. Update summary L28
     and implementation note 6.
4. **R4 (medium-high):** Add the 15,899 lower-count rows and the repair-stats and Boardsesh-tick
   mechanisms. Attest the quality mechanism (Kilter natively 1–5, Aurora ×5/3). Revise L35 and §4 Stats.
5. **R5 (medium):** Add the 491 role-only recoding result. Reframe the role-code era claims (L27, L34,
   §4) and the multi-frame juxtaposition. Strengthen the mis-tag disconfirming item with this result and
   the reroute fallback.
6. **R6 (medium):** Fix citations: (a)1 L30 +{11}; (a)2 L62 → `kcs-appstore-ios`; (a)3 chronology →
   `kcs-vertige`; (a)4 L175 misattribution; (a)5 L87–88; (a)6 co-cite LEGAL; (a)7 attest "0–5 star scale".
7. **R7 (medium):** Inventory table fixes:
   - Legacy auth cell (BoardLib's database command always logs in).
   - First-party update shape, auth and rate limits as a labelled reverse-engineered description.
   - Boardsesh API carriage and access cells.
   - Rescope the HF row and the "only … found" key finding, and add the uninspected `kvxb/kilter` and
     `knightnemo` datasets to Gaps.
8. **R8 (low-medium):** Add `{confidence: …}` markers for summarizing-fetch attestations used for
   load-bearing claims (API docs, product terms, claim/support), and mark the composed claims in (b)3–4.
9. **R9 (low):** Bring in the uncited corroboration: `kcs-boardlib-pr1` for UUID/grade-ID continuity and
   multi-network TLS failure, `kcs-kilter-support-claim` ("Almost all climbs … preserved"), and the
   publisher's Homewall 8x12/10x12 count parity (attest first). Note the 6-hourly versus hourly cadence
   tension.

---

## Revision record (orchestrator, 2026-10-19)

Assessed snapshot: parent.md sha256 prefix 35216fc38fc78f6d → revised. Correction mode
(positions preserved except where findings showed an overstatement).

| Finding | Action | Substrate changes |
|---|---|---|
| R1 Boardsesh LEGAL narrowed | §3 rewritten with full LEGAL paragraph and the two omitted qualifiers; intra-source tension row added; key finding and impl. note 10 revised; Project implications flags operator re-confirmation | kcs-boardsesh-legal extended with verbatim paragraphs |
| R2 Kilter terms absence overstated | §3 now quotes content-ownership, Third Party Content, and copy/distribute clauses; "Your Content" dangling definition recorded | kcs-kilter-terms re-attested from raw HTML; confidence note + revisions log |
| R3 deletions smoothed | Deletions section rewritten: report-only gate, absent-list qualifier, exclusion/alias removal paths, `sync_deletions` described per ops doc; impl. note 6 extended | new kcs-boardsesh-snapshot-ops; kcs-boardsesh-docs-legacy corrected (deletionsReplayFrom is a log field) |
| R4 ascensionist counts | Higher/equal/lower all reported; repair-job and native-1–5 quality explanation added | kcs-boardsesh-kilter-sync extended; artifact attestation adds 15,899 lower (re-run confirmed) |
| R5 role codes | Reframed as ingest-path property; 491 role-only recodes added; reroute fallback cited; disconfirming bullet updated | artifact attestation adds 491 finding (re-run confirmed: 491/491 role-only) |
| R6 citations | taken-down (yahoo), Kilter LLC (appstore-ios), 03-31 (vertige), deleted-list owner, API-link absence (landing/support/settercloset), "0–5 star" quote added to dataset attestation | dataset attestation extended |
| R7 inventory table | Legacy login, first-party update shape (third-party description), Boardsesh API row, HF row and superlative fixed | — |
| R8 markers | {confidence: summarizing-fetch} on product terms, claim, API docs; composed claims marked inferred | — |
| R9 corroboration | boardlib-pr1 (UUID/grade continuity, multi-network TLS), support-claim "Almost all climbs", cadence self-contradiction row | — |

Not adopted: Homewall in-app count corroboration (R9) — would require a new attestation
pass on a summarizing source; low value for the decision.
Attestation discrepancy notes: multi-frame count restated (37 role-normalized / 27 as
stored); quality-group n depends on one-decimal rounding of the baseline, now stated.
Lint after revision: 141 resolved, 1 expected unreachable-source, 5 thin (narrow claims),
5 advisory pattern flags (false positives: version-like decimals, "exactly one").

## Gate record (final)

| Gate | Assessed | Result | Evidence |
|---|---|---|---|
| lint (floor) | each specialist brief; parent revisions | specialists: 0 broken after format corrections; parent: 168 resolved, 1 expected unreachable-source (legacy host observation), thin/advisory flags reviewed | lint runs in session; scratchpad lint-parent.txt (first pass) |
| adversarial-read | parent 35216fc38fc78f6d | NEEDS-REVISION (R1–R9) → revised | this file |
| evaluate (isolated) | a0b0683f → 0691f2df → c97c0b9c | NEEDS-REVISION → NEEDS-REVISION (frontmatter; unsaved edit) → APPROVED | campaign-evaluation.md |
| spot-check (floor) | lead, after revisions | figures re-run twice against local artifacts; sampled quotes present in attestations (support-claim, Hangtime, HF licence, product terms, claim 6 MB, Retry-After, reroute) | session record |

Final assessed text: 7ced87db199a54cd (wording-only changes after pass 3).
