---
id: epic-ios-controller-bridge-backup-export
kind: feature
stage: drafting
parent: epic-ios-controller-bridge
depends_on: [ios-simulator-build-smoke]
release_binding: null
gate_origin: null
created: 2026-10-09
updated: 2026-10-09
tags: [data, ui]
---

# Native prototype needs a working backup file export

Actual iPhone17/iOS27 WKWebView check: after saving one synthetic draft, press
Back up & restore → Download library backup. The app reports "Backup download
started", but no file/save sheet opens and no backup appears in its container.
Native App log confirms LaunchServices rejects opening a `blob:capacitor://localhost/`
URL with LSApplicationWorkspaceErrorDomain Code115. The pinned Capacitor navigation
delegate hands that URL to UIApplication.open; it has no download handler.

The browser-only anchor-download mechanism in LibraryBackupDialog does not establish
a native backup. Preserve the existing backup codec, complete-library coverage and
update safeguards when introducing an explicit native file-export boundary. The
iOS controller epic already requires an inspected export/restore round trip before
native storage acceptance; this concrete failure now explains that open gate.

Evidence outsideGit: `/tmp/cruxcontrol-native-app.log` (12:13:02 local), and
`/tmp/cruxcontrol-native-maestro-backup/`. Only synthetic records were involved.
Do not count the dialog's status message as successful export.

## Authorized scope and decisions

Andrew authorized resuming the iPhone proof after migration, including local tooling.
Repair this verified prototype gap while community catalog implementation proceeds.
Retain the complete backup service/codec and normal user-initiated backup UI. Browser
exports keep working. Native export must hand a real complete file to a supported
iOS save/share mechanism, report cancellation and failures honestly, and prove an
inspected synthetic export/restore round trip. No production framework or storage
migration decision, account, remote service, personal-data transfer or phone update.

## Simplification opportunity

Reuse the existing exportFile service and runtime injection conventions; establish
one explicit file-delivery seam rather than embedding platform checks in the backup
codec. Review installed Capacitor capabilities and official sources before choosing
the smallest native mechanism. Avoid new bespoke screens where the existing backup
dialog and native OS file controls serve the same flow.

## Execution

Medium feature: one cohesive prototype file-delivery integration, design before code.
Standard review from project conventions; implementation follows dependency-verified
native startup. Current native check story remains the owner of broader interaction
evidence; this feature owns the failing export contract and its corrected round trip.
