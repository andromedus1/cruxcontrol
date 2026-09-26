---
id: epic-shared-climb-library-updates
kind: feature
stage: drafting
tags: [ui, data, security]
research_refs:
  - .research/analysis/briefs/invited-offline-library.md
parent: epic-shared-climb-library
depends_on: [epic-shared-climb-library-browse-save]
release_binding: null
gate_origin: null
created: 2026-09-26
updated: 2026-09-26
---

# Explicit source updates and withdrawal

## Brief

Let an author explicitly publish a new revision of their own contribution or
withdraw it from future group distribution. Reuse the approved snapshot preview
and show the scope of withdrawal before confirmation. Enforce current membership,
ownership, retry identity, and expected revision so two devices cannot silently
overwrite each other's changes. Provide an operator removal procedure without
adding an administration application. Resolve owned contributions through the
authenticated service identity so a recovered browser or second device can manage
them without the original local draft or publication receipt.

When a saved climb's source changes, offer a review and an explicit choice to keep
the current copy or accept the new revision. An accepted update preserves the local
climb identity and existing playlist memberships/order; intervening local edits must
be detected and protected, with a separate-copy path where replacing would discard
personal work. Do not auto-merge or silently replace recipes, metadata, or holds.
Withdrawal and access revocation leave retained personal copies usable, including
offline. A withdrawal marker can explain that the source is no longer available;
a missing result in a partial refresh cannot stand in for that marker.

This completes the source lifecycle promised by the epic. It does not introduce
collaborative editing, notifications, push sync, public moderation, remote erasure,
or automatic private-library uploads. Recovery from a hosted restore must not
downgrade newer local copies or reuse a source revision with different content.

## Epic context

- Parent: [shared-library epic](../epics/epic-shared-climb-library.md).
- Consumes shared identity/revisions and the saved-copy provenance established by
  publication and browse/save. Earlier features must not postpone those contracts.

## Inherited design decisions

- Saved copies stay unchanged until explicit acceptance; removal never deletes them.
- Only owners revise their contributions; an operator may remove distribution.
- Edits to a personal climb never automatically publish a revision.
- Online mutation and refresh; local use survives network/auth failure.
- Preserve all existing user records, playlist order, Trash, and backup guarantees.

## Research briefs

- [Invited/offline library comparison](../../../.research/analysis/briefs/invited-offline-library.md)
  — conflicts, withdrawals, retained copies, revocation and hosted recovery.

## Foundation references

- `docs/SPEC.md` — shared-library ownership and local optimistic edits.
- `docs/ARCHITECTURE.md` — repository revisions and independent recovery boundaries.

## Mockups

- Inherits `.mockups/design-system/` and the approved 2026-09-26 direction.
- Revision publishing composes [snapshot review](../../../.mockups/flows/share-climb/02-review.html)
  with a revision-specific action and confirmation message.
- Recipient review composes [climb detail](../../../.mockups/flows/shared-library/04-climb.html)
  with an update notice, compact changes summary, and explicit keep/update choices;
  the separate-copy action reuses [save](../../../.mockups/flows/shared-library/05-save.html).
- Withdrawal uses the existing destructive-confirmation pattern and retained-copy
  explanation. No new screen is planned. These variants are not separately rendered;
  AGENTS.md permits existing-component composition without another flow. If detailed
  design needs a novel comparison/recovery surface, mock it before implementation.
