---
id: epic-shared-climb-library-publish
kind: feature
stage: drafting
tags: [ui, data, security]
research_refs:
  - .research/analysis/briefs/invited-offline-library.md
parent: epic-shared-climb-library
depends_on: [epic-shared-climb-library-invited-access]
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Explicitly publish an attributed climb

## Brief

Let a member choose an authored climb, inspect exactly what will be shared, and
publish that snapshot immediately to the invited circle. Establish the shared
contribution identity, immutable source revision, authenticated ownership, and
bounded snapshot contract consumed by browsing and saving. A successful commit
must be visible to a subsequent authorized read independently of app releases.

Reuse the portable snapshot and board-validation boundaries where their contracts
fit. Explicitly select public metadata rather than uploading an entire local
record: private setter notes, local identifiers, other climbs, playlist membership,
and browser backups are not implicit publication fields. Human-readable attribution
must not expose login email addresses by default. Publication retries, including
a committed request whose response was lost, must resolve to the same contribution
instead of creating duplicates. A local edit during preview cannot silently change
the snapshot the member confirmed.

The feature delivers first publication and its receipt/return path. Later revision
and withdrawal actions belong to the lifecycle feature, but their stable identity
must be possible from the first publish. Authenticated authors must be able to
rediscover their owned contributions after browser recovery or on another device;
management cannot depend solely on an initial browser-local receipt.
There is no approval queue, provider-catalog
submission, hidden offline upload queue, or new authoring/lighting stack.

## Epic context

- Parent: [shared-library epic](../epics/epic-shared-climb-library.md).
- Consumes invited access; produces the publication and provenance contract used
  by browse/save and later lifecycle operations.

## Inherited design decisions

- Explicit submissions publish immediately within the invited group.
- Personal autosave never publishes; connection is required for publication.
- Recipients keep saved copies after revision or withdrawal. Explain this before
  the first publication, as in the approved preview.
- Authenticated member identity owns the contribution; client-supplied attribution
  cannot confer ownership. Other members cannot change it.
- The sample finished climb does not introduce new validity rules for local drafts.
  Define shared-snapshot eligibility without restricting local saving or editing.

## Research briefs

- [Invited/offline library comparison](../../../.research/analysis/briefs/invited-offline-library.md)
  — immutable revisions, atomic retry identity, primary reads, owner authorization.

## Foundation references

- `docs/SPEC.md` — local authoring and explicit shared contributions.
- `docs/ARCHITECTURE.md` — portable snapshots and intended shared boundary.

## Mockups

- Inherits `.mockups/design-system/`.
- Approved 2026-09-26: [publish journey](../../../.mockups/flows/share-climb/index.html)
  — own climb → shared snapshot review → publication confirmation.
- Reuse the existing inline retry/conflict treatment for failed publication;
  never show success before the service confirms the committed operation.
