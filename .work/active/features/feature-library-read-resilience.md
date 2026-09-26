---
id: feature-library-read-resilience
kind: feature
stage: review
tags: [ui, data]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Keep healthy library records accessible

## Brief
Deliver the authorized corrupt-climb recovery and playlist read-failure isolation backlog ideas. Healthy Drafts, Finished climbs, and Trash remain usable when a stored climb cannot decode or playlist reads fail. Preserve every unreadable record unchanged and show a targeted warning; do not migrate, delete, or overwrite authored data.

## Strategic decisions
The user approved these two reliability fixes before shared-library/catalog work. This is a local read-path repair using existing warning/retry UI, with no new recovery editor or raw-record export. Preserve strict reads for imports/backup and writes. No unresolved strategic questions, new research, or mockup needed; existing recovery notice and error/retry patterns apply.

## Simplification opportunity
Separate climb and playlist refresh outcomes instead of one all-or-nothing workspace refresh. Retain independent repositories and existing validation.

## Architectural choice
Use an additive `DraftListOptions.onUnreadableRecord?: (issue: DraftReadIssue) => void` callback, with `DraftReadIssue` carrying string `key` and `message`. Default list/get/import/backup semantics remain strict. Only workspace list calls opt into tolerant reads and collect warnings for both active and Trash lists. A full-store cursor catches records missing the ordering index in both modes; strict reads reject them rather than silently omit them, while tolerant reads report them; sort decoded records newest-first with descending ID ties. Skip only explicit corrupt/schema errors and retain the original row in place. Storage/cursor failures still reject. Alternatives: globally skipping invalid rows would conceal incomplete input from imports; changing every list return to a result envelope would unnecessarily change unrelated callers.

The trickiest unit is distinguishing unreadable rows from storage failures without omitting rows missing index keys. Tests inject both corrupt and future-schema rows, with and without index fields, alongside healthy active/Trash records; verify raw rows remain identical and strict reads still reject.

## Implementation units
1. `web/src/drafts/repository.ts`, `indexeddb-repository.ts`: additive read diagnostic and opt-in tolerant enumeration; regression tests in `indexeddb-repository.test.ts`. Checkpoint: `idea-corrupt-climb-list-recovery`.
2. `web/src/app/CruxControlWorkspace.tsx`: collect/deduplicate diagnostics by stored key; render existing warning pattern with record key/message and preservation explanation. Refresh climb and playlist stores independently; playlist error/retry stays on Lists, cached lists remain intact, unavailable memberships are not offered. Explicitly awaited refresh errors continue to reject for existing dialog callers. Checkpoint: `idea-isolate-playlist-read-failures`.

## Acceptance criteria
- Healthy active and Trash rows remain accessible beside corrupt/future rows, even missing ordering metadata; original rows are unchanged.
- Strict reads, validation, writes, import deduplication and backup cannot silently omit corrupt records.
- Visible recovery notice identifies unreadable stored records without presenting unsafe edit/delete actions.
- A playlist failure cannot suppress climbs, editing, Trash, or create actions; Lists has a retry and recovers when reads work again.
- Existing pending-write/update admission and unsaved playlist state remain intact.

## Testing and risks
Use fake IndexedDB regression coverage plus workspace interaction tests for independent outcomes, warnings, retry, and retained cached data. Current repository implementations and error taxonomy provide sufficient grounding; no new external API or research. Corrupt records may lack installation/lifecycle metadata, so warn globally rather than guess their collection. Raw salvage export remains out of scope and backup must report its existing validation error. Concurrent refreshes follow existing workspace semantics; do not introduce a storage migration or new recovery authority.

## Execution
One cohesive inline implementation owner; standard independent feature review per project convention. Existing highest-capability host is appropriate for preservation and read isolation. No implementation fanout is needed. Mockup exemption: bug fixes reuse existing warning and retry structure.

## Implementation and review admission (2026-09-26)
Both child checkpoints are verified complete. Focused repository/workspace suite passes all 33 tests, including regressions demonstrated red before changes. Existing ordering/revision/lifecycle tests remain green. Independent standard feature review is required before completion; full suite and CI are part of final integration. No schema change, raw salvage export, or device maintenance.
