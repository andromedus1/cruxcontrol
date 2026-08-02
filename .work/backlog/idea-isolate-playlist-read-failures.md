---
id: idea-isolate-playlist-read-failures
created: 2026-08-02
updated: 2026-08-02
tags: [ui, data]
---

A corrupt playlist row or playlist-store read failure currently rejects the combined
workspace refresh, which can temporarily hide My Climbs, Drafts, and Trash behind a
playlist-related retry error. Consider settling playlist reads separately so playlist
storage failure degrades only the Lists surface while the independent climb database
remains usable. This was accepted as a lower-risk resilience follow-up during the
standard review of `epic-playlists-local-library`; write-path isolation and explicit
retry behavior remain intact.
