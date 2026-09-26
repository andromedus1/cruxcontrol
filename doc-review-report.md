# Doc Review Report

**Project:** CruxControl
**Audited snapshot:** implementation at `760a5da` plus the documentation working tree
**Baseline date:** 2026-09-12
**Follow-up date:** 2026-09-26
**Documents reviewed:** 6 (5 system planning documents plus README)
**Passes run:** 1 baseline system-level pass plus 1 scoped `--system-only` follow-up
**Issues found:** baseline 0; follow-up 0 unresolved, 2 stale assertions corrected

## Follow-up system-level pass — 2026-09-26

This required research-pipeline `doc-review --system-only` follow-up covered the two
sentence-level corrections in `README.md` and `docs/ARCHITECTURE.md`. The planning
corpus remains `docs/VISION.md`, `docs/PRINCIPLES.md`, `docs/SPEC.md`,
`docs/ARCHITECTURE.md`, and `docs/DEPLOY.md`; `CLAUDE.md` was checked for local
constraints. No module planning documents required a separate pass.

### Resolved: spatial role protection wording

**Files:** `docs/ARCHITECTURE.md`, `web/src/light-effects/frame.ts`

The architecture sentence described semantic roles as always being reasserted last.
The frame engine reasserts role colors only when at least one spatial group exists;
assignment-only effects intentionally animate explicitly assigned role holds. The
architecture wording now states both conditions.

### Resolved: device acceptance scope

**Files:** `README.md`, archived evidence at
`.work/archive/epic-route-creation-flashy-light-effect-demos.md` and
`.work/archive/epic-route-creation-board-light-capacity-envelope-physical-results.md`

README wording broadly treated device acceptance as future work, while the completed
records contain Android Chrome effects dogfooding and an accepted Android/API-2
controller profile. API-3 and other device, browser, and controller profiles remain
unmeasured. README now states that evidence boundary.

### Follow-up cross-document result

- All five system planning documents have frontmatter and existing local links.
- `docs/ARCHITECTURE.md` now carries `updated: 2026-09-26`.
- The architecture, specification, principles, and README agree that the current
  physical profile is Android/API-2, uses complete scenes, and remains foreground-bound.
- No additional contradiction or stale assertion was found in the scoped review.

### Proposals

None. The remaining API-3 and alternate-device/profile measurements are explicitly
unmeasured evidence boundaries, not documentation defects for this correction.

This follow-up did not expand into shared-library/catalog roadmap design or alter
generated knowledge indexes. Unit, browser, and hardware tests were not run by this
documentation pass.

## Baseline scope and method

This bounded research-pipeline `doc-review` pass followed the build-process reference
and checked the automatic connected-board lighting and playlist editing update.
The planning corpus came from `docs/knowledge-index.yaml`: `docs/VISION.md`,
`docs/PRINCIPLES.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/DEPLOY.md`.
README was included as the user-facing description of these capabilities.

An independent agent compared the changed prose with the current lighting hook,
climb detail, route editor, shared connection bar, playlist management/play-through,
and workspace navigation. It checked cross-document consistency, frontmatter,
local links, and indexed blocking-brief existence. No module planning documents
required separate passes. No Critical or High finding required a fix/re-audit loop.

Research substance, historical planning, completed work items, and the untracked
`.peeragent/`, `docs/kilter_docs/`, and `docs/set_boulders/` directories were outside
this review. The report establishes source/document consistency, not deployed
behavior or physical-board acceptance. Unit, browser, and hardware tests were not
run by this documentation pass.

## Baseline pass: system-level findings

No findings at any severity.

## Baseline verified contracts

- `useEditorLighting` uses scene-content keys and a 180 ms debounce to update an
  already-connected board when the selected scene changes or a connection completes.
  Metadata edits and repository refreshes do not restart unchanged scenes. Animation
  starts only after the initial queued frame is applied.
- `ClimbDetail` and `RouteEditorWorkspace` share that hook. `BoardControlBar` retains
  explicit Connect/Reconnect actions; automatic scene updates do not open a chooser.
  Retry/restart/stop remain available, and Clear remains in editor capacity diagnostics.
- `CruxControlWorkspace` keeps the source playlist ID and optional entry key in memory.
  `PlaylistLibrary` and `PlaylistPlayThrough` use them to restore list/play-through
  context after editing an available local climb. Unavailable climbs cannot be edited.
- The update introduces no conflict with VISION, PRINCIPLES, or DEPLOY. Deployment
  remains gated by the approved CI workflow.

## Baseline frontmatter, links, and index

All 5 system planning documents have compliant frontmatter under the project's
established `type: planning` convention. SPEC and ARCHITECTURE carried the update date
2026-09-12 at baseline. All 15 local Markdown links resolve.

The installed knowledge-index regenerator ran with an explicit discovery filter
excluding the two untracked private input directories. It found 23 documents
(5 planning, 17 research, 1 historical) and 108 substrate items, with 0 errors and
0 warnings. All three derived index files were regenerated. The active feature
count reflects the in-progress delivery snapshot; terminal stage changes are owned
by the delivery workflow.

## Baseline blocking briefs and phase checks

All 7 indexed blocking-brief paths exist:

- `.research/briefs/cloudflare-deploy/parent.md`
- `.research/briefs/kilter-grade-prediction/parent.md`
- `docs/briefs/board-control-web-bluetooth.md`
- `docs/briefs/board-rendering-and-filtering.md`
- `docs/briefs/catalog-sync-api.md`
- `docs/briefs/foundation-pwa-sqlite.md`
- `docs/briefs/recommendations-and-training.md`

No phase completion claim changed in the baseline update. Delivery decomposition and
stage verification remain in `.work/`; this pass did not re-audit completed work items.

## Baseline provenance summary

| Research method | Briefs/reports | Latest updated |
| --- | ---: | --- |
| `/deep-research` | 8 | 2026-06-14 |
| `/brief` | 5 | 2026-06-14 |
| `/research` | 1 | 2026-06-14 |
| `migrated` | 2 | 2026-08-02 |

The skill's mechanical age/tool-tier rule identifies four older `/brief` entries
as refresh candidates: board-control-web-bluetooth, board-rendering-and-filtering,
catalog-sync-api, and recommendations-and-training. This is informational metadata;
it does not establish that their research conclusions are stale or require refresh
for this bounded behavior update.
