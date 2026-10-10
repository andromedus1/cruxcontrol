---
id: idea-pending-import-close
created: 2026-10-10
updated: 2026-10-10
tags: []
---

Parity regression tests reproduce screenshot and playlist import dialogs invoking
onClose from their header/cancel event while the import mutation or refresh is
still pending. Footer controls disable, but logical close callbacks lack the same
guard. Native Back must reuse these actions, so pending writes need guarded close
semantics before the dispatcher can safely route them. Membership writes have the
same unguarded logical-close seam by inspection. Preserve cancellation during
write-free review/analysis and keep committed/importing work visible until settled.
