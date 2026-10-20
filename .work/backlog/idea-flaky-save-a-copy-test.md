---
id: idea-flaky-save-a-copy-test
created: 2026-10-19
updated: 2026-10-19
tags: [ui]
---

Flaky test under full-suite load: `web/src/app/CruxControlWorkspace.test.tsx`
"adopts Save-a-copy identity so later saves target the copy" failed once in 5 full
vitest runs of the combined catalog-sync branches (#38 + #39) on 2026-10-19. It passed
3/3 in isolation and 3/3 full-suite runs on main. Likely a timing/`waitFor`
sensitivity under load. Root-cause it (do not delete or loosen the assertion) when it
recurs or during a test-quality pass.
