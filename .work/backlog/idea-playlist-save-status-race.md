---
id: idea-playlist-save-status-race
created: 2026-09-05
updated: 2026-09-05
tags: [ui, tests]
---

Full integrated unit run at de09b41: PlaylistLibrary metadata save completed but the
Saved status was blank. The selected-record hydration effect resets status whenever
name/notes change, racing the successful mutation status after refreshed props arrive.
Captured in /tmp/cruxcontrol-final-unit.log; the native PWA browser scenario also relies
on this real save-completion signal. Preserve the confirmation across metadata refresh
and clear it when intentionally selecting another list.
