---
id: idea-catalog-playlist-callback
created: 2026-10-10
updated: 2026-10-10
tags: [data, ui]
---

Catalog details cannot add a provider climb to a playlist: CatalogBrowser does not
pass LocalClimbViewer's existing onManageLists callback, and the workspace only
opens PlaylistMembershipDialog for local drafts. Observed while preparing the
Android catalog feature's required catalog-to-playlist emulator proof. Reuse the
existing membership dialog and preserve the provider ID/layout reference.
