---
id: idea-native-share-cancel-status
created: 2026-08-02
updated: 2026-08-02
tags: [ui]
---

Treat an `AbortError` from the native Web Share sheet as neutral user cancellation rather
than rendering it as a red failure alert. Preserve real adapter failures as explicit,
recoverable errors. This low-severity UX follow-up was accepted during the standard
portable-sharing review; sharing, file fallback, and local data remain correct today.
