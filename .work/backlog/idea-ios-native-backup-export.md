---
id: idea-ios-native-backup-export
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
