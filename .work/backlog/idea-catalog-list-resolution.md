---
id: idea-catalog-list-resolution
created: 2026-10-10
updated: 2026-10-10
tags: [data, ui]
---

PlaylistLibrary never supplies provider rows to resolvePlaylistEntries, so stored
provider references always appear Missing and cannot play through even when the
catalog is installed. Observed during Android catalog acceptance preparation.
The parent authorized the existing CatalogQueryPort.get path, lazy provider reads
from Lists, and provider rows in PlaylistLibrary. Distinguish loading, unavailable
catalog and failed lookup from a confirmed missing route; retain order and all
authored data, cancel stale work, deduplicate and bound lookups.
