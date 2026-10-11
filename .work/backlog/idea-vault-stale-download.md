---
id: idea-vault-stale-download
created: 2026-10-11
updated: 2026-10-11
tags: [security, data]
---

The actual private-vault TypeScript adapter can resolve downloaded backup text
after sign-out starts during its final native cleanup await. A focused regression
in `prototypes/ios/src/native-private-vault.test.ts` returns
`returned-stale-content` instead of the required `account-changed`. Download
checks the captured session during chunks, but never rechecks after async hashing
and cleanup. This violates the private-vault feature's late-completion contract;
recorded during integrated review before any real authoring admission.
