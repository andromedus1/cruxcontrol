---
title: Android Chrome protected-file recovery access
description: Which access paths can preserve a missing Chrome IndexedDB library, and what must a specialist confirm before acquisition?
type: brief
kind: research
updated: 2026-10-09
status: locked
provenance: agent-synthesis
verification_status: reviewed-corrections-verified
summary: |
  Android app isolation prevents ordinary shell access to Chrome's private profile.
  Separate debugging file-input and file-drop pathways can grant access to explicit
  native paths. The examined Chromium revision routes diagnostic ZIP downloads through
  a file loader whose Android allowlist excludes internal cache paths. A failed export
  is not proof of database erasure. Specialist deleted-data recovery remains a compatibility
  question requiring exact model, OS and security-patch validation; public Pixel
  support claims alone do not establish deleted-record recoverability.
key_findings:
  - USB authorization does not confer Chrome's app identity or production ADB root access.
  - Source tracing predicts denial of internal-cache ZIP downloads; no per-download runtime attribution was captured.
  - Authorized debugging file reads are distinct from ordinary shell access and from a complete forensic acquisition.
  - Bootloader unlocking deliberately resets data and is unsuitable for preserving an existing library.
  - Public Pixel 8 filesystem-extraction support does not establish support for every OS/security patch or recovery of deleted records.
---

# Android Chrome protected-file recovery access

## Access boundary

Android isolates applications with per-app identities and kernel permissions. ADB's
production daemon drops to the shell identity; authorizing USB debugging does not
make it the Chrome process. {inferred: combines} Consequently, ordinary USB file
transfer or another unprivileged file manager does not provide Chrome-profile access.
[recovery-android-sandbox]{1} [recovery-adb-root]{2}

Bootloader unlocking is unsuitable for preserving existing phone contents: the
documented operation performs a factory data reset after confirmation. This does not
mean every possible specialist privilege-acquisition method erases data; it means
the standard bootloader-unlock route must not be mistaken for a recovery permission.
[recovery-android-bootloader]{3}

Android requires file-based encryption for devices launched with Android 10 or later.
Credential-encrypted files depend on user unlock and protected key handling.
{inferred: qualifies} Reading raw flash therefore cannot simply be equated with
obtaining readable Chrome database files. [recovery-android-fbe]{4}

## Diagnostic ZIP source-path restriction

The examined source is pinned to Chromium revision
`4ed32028bcb2d00bc07a8880eb85aca80c9c5ec6`. The call chain is:

1. IndexedDB internals requests a bucket ZIP, then starts a download from the returned
   `file://` path. Its callback does not hand archive bytes directly to the page.
   [recovery-chrome-idb-export]{5}
2. Bucket export creates a temporary directory and attempts ZIP generation. It
   ignores the ZIP helper's result before reporting success, so callback success
   alone does not certify that an archive exists. Android's default temp-directory
   resolution uses DIR_CACHE unless TMPDIR overrides it. [recovery-chrome-idb-zip]{6}
   [recovery-chrome-temp-dir]{16}
3. The normal file download uses FileURLLoaderFactory. That factory selects restricted
   file access and checks the browser's path policy before returning bytes.
   [recovery-chrome-download-loader]{7} [recovery-chrome-file-loader]{8}
4. Chrome delegates that policy to ChromeNetworkDelegate. Its Android allowlist
   covers external-storage/download locations, not the application's internal cache.
   The confusingly named private-download directories resolve to external app-specific
   download folders. [recovery-chrome-browser-client]{15}
   [recovery-chrome-file-allowlist]{9} [recovery-chrome-path-utils]{10}

{inferred: traces} A diagnostic ZIP located inside the ordinary internal Chrome cache
is therefore expected to fail this download path's source-access check under normal
production policy. Changing the destination to Downloads does not change that
source-path decision. This is a source-level explanation, not a captured per-download
runtime attribution. [recovery-chrome-idb-export]{5}
[recovery-chrome-download-loader]{7} [recovery-chrome-file-loader]{8}
[recovery-chrome-file-allowlist]{9} [recovery-chrome-path-utils]{10}

The inspected allowlist supplies a testing override, not a user permission prompt.
No ordinary download-permission toggle was established for this source-path check.
There are separate authorized debugging file-read pathways, described below;
download failure does not establish that all browser-owned access routes are blocked.
{inferred: distinguishes} [recovery-chrome-file-allowlist]{9}
[recovery-chrome-dom-file-access]{17}

Even a successfully transferred diagnostic ZIP archives only the paths selected for
the bucket Chrome currently recognizes. It is not a deleted-file scan or an inventory
of untracked files. A working transfer therefore answers a narrower question than a
specialist's deleted-data assessment. {inferred: bounds} [recovery-chrome-idb-zip]{6}
[recovery-swgde-preservation]{14}

An access error is not a database-existence test. The loader has a separate missing-file
branch; an aggregate interruption counter cannot identify which branch a particular
attempt took. Likewise, a ZIP initiation callback does not establish surviving
records. {inferred: distinguishes} [recovery-chrome-file-loader]{8}
[recovery-chrome-idb-zip]{6}

## Separate debugging file-read pathways

DOM.setFileInputFiles checks a debugging-client capability, grants the renderer read
access to explicit native paths, and passes them to the file-input implementation.
It does not perform a file-URL download. Directory selection takes a separate chooser
path, so success reading one explicit file does not establish directory enumeration.
[recovery-chrome-dom-file-access]{17} [recovery-chrome-file-input]{18}

Input.dispatchDragEvent also has a file-access capability check and converts supplied
native paths to browser drag data. This provides a separate route to receiving file
or directory entries, subject to the receiving context and platform behavior.
[recovery-chrome-debug-drag]{19}

These are possible live access mechanisms for an authorized debugger, not forensic
disk imaging. A bounded recovery operation should keep the receiving page under the
owner's control, avoid network uploads, open no source database engine, preserve copies
and hashes off-device, document browser state changes, and close temporary pages.
Reading available filesystem entries does not expose every deleted block or prove
that absent paths are permanently unrecoverable. {extends}
[recovery-chrome-dom-file-access]{17} [recovery-chrome-debug-drag]{19}
[recovery-swgde-preservation]{14}

## Specialist acquisition feasibility

MSAB's May 2025 XRY 11.0.1 Pro announcement explicitly names full-filesystem extraction
for Pixel 6 and Pixel 8 using their respective Generic profiles. Its public paragraph does not specify Android-version or
security-patch limits. Detailed release notes are linked through its customer portal.
This is a concrete compatibility lead, not confirmation for a current device.
[recovery-msab-pixel]{11}

Two service leads are Flashback Data / Array, whose mobile-forensics process starts
with case objectives and verified preservation copies, and DriveSavers, which offers
Android evaluation including Google devices. Neither fetched service page establishes
compatibility for a particular current patch or guarantees recovery of lost Chrome
records. These are candidates for an examiner's assessment, not endorsed outcomes.
[recovery-flashback-mobile]{12} [recovery-drivesavers-android]{13}

The proposed compatibility inquiry should specify model, OS, patch, Chrome build,
current unlock state, owner access and target private-profile data. Ask whether the
method can acquire those files without bootloader unlocking, factory reset, browser
replacement/downgrade or repair of the source database. Require disclosure of other
necessary changes before authorizing them. Request a verified acquisition and analysis
of a copy, with costs and success criteria tied to the missing records. {extends}
[recovery-android-bootloader]{3} [recovery-android-fbe]{4}
[recovery-swgde-preservation]{14}

Full-filesystem acquisition means available active files and folders. Such collections
can include remnants of deleted data, but the label does not promise recovery of files
already removed. An examiner must distinguish inaccessible surviving files, recoverable
fragments and physically unrecoverable data. [recovery-swgde-preservation]{14}

## Preservation pending assessment

SWGDE recommends avoiding unnecessary interaction, preserving power and an active
screen for an unlocked device, and leaving an already-off device off pending assessment.
It warns that an inactivity-triggered reboot can reduce available data by returning
the device to before-first-unlock state; an individual device's timer configuration
must be checked separately. Device-specific handling, including screen/lock state and
automatic or pending-update restarts, should be settled with the examiner.
{inferred: applies} [recovery-swgde-preservation]{14}

## Contradictions

No direct source contradiction was established. These qualifications matter:

| Sources | Relationship | Consequence |
|---|---|---|
| Chromium ZIP callback [recovery-chrome-idb-zip]{6}; file loader [recovery-chrome-file-loader]{8} | qualifies | ZIP initiation success does not imply successful readable-file transfer. |
| MSAB Pixel claim [recovery-msab-pixel]{11}; SWGDE acquisition definitions [recovery-swgde-preservation]{14} | qualifies | Device-family filesystem support does not establish deleted-record recovery. |
| Android sandbox [recovery-android-sandbox]{1}; MSAB acquisition claim [recovery-msab-pixel]{11} | qualifies | Ordinary-access denial is compatible with a specialist-specific acquisition capability. |
| Android sandbox [recovery-android-sandbox]{1}; debugging file grants [recovery-chrome-dom-file-access]{17} | qualifies | Shell access denial does not imply that an authorized Chrome debugging client cannot read native files through Chrome. |
| Android encryption [recovery-android-fbe]{4}; MSAB acquisition claim [recovery-msab-pixel]{11} | qualifies | Generic device support does not establish access in every unlock state. |

## Disconfirming analysis

- Checked whether changing download destination would address the restriction:
  source loading independently enforces the allowlist.
- Checked whether private-download directories actually include internal cache:
  PathUtils uses external app-specific download directories.
- Checked alternate loader behavior and testing overrides: both exist, but the
  inspected diagnostic handler supplies no alternate factory and the retail-policy
  override was not demonstrated. Do not claim no conceivable workaround exists.
- Checked whether a failed export proves missing input: the ZIP return value is
  ignored, and the loader distinguishes path denial from missing files. Neither
  mechanism alone establishes record survival or destruction.
- Sought a concrete device-family acquisition counterexample to ordinary-access
  denial: MSAB provides one. Exact software/patch compatibility remains unverified.
  [recovery-msab-pixel]{11}
- Checked another counterexample within Chrome: authorized file-input and file-drop
  debugging routes are distinct from file-URL loading. These qualify any categorical
  claim that shell/download denial makes native files inaccessible.
  [recovery-chrome-dom-file-access]{17} [recovery-chrome-debug-drag]{19}
- Checked whether full-filesystem access means deleted-file recovery: SWGDE's
  definition explicitly concerns available files; no recovery probability follows.

## Remaining acquisition questions

Once available files are preserved, the remaining operational question is an examiner's
ability to find/decode deleted or untracked remnants on the actual software/patch and
to assess the acquired files. Public sources do not answer it. MSAB's public page
points to detailed customer-portal release notes;
no authenticated portal session was available or requested. These notes remain an
enrichment lead, not evidence of support. No vendor was contacted, no commercial
service commissioned, and no recovery probability or cost range was established.

## Bibliography

1. [recovery-android-sandbox](../../attestation/recovery-android-sandbox.md)
2. [recovery-adb-root](../../attestation/recovery-adb-root.md)
3. [recovery-android-bootloader](../../attestation/recovery-android-bootloader.md)
4. [recovery-android-fbe](../../attestation/recovery-android-fbe.md)
5. [recovery-chrome-idb-export](../../attestation/recovery-chrome-idb-export.md)
6. [recovery-chrome-idb-zip](../../attestation/recovery-chrome-idb-zip.md)
7. [recovery-chrome-download-loader](../../attestation/recovery-chrome-download-loader.md)
8. [recovery-chrome-file-loader](../../attestation/recovery-chrome-file-loader.md)
9. [recovery-chrome-file-allowlist](../../attestation/recovery-chrome-file-allowlist.md)
10. [recovery-chrome-path-utils](../../attestation/recovery-chrome-path-utils.md)
11. [recovery-msab-pixel](../../attestation/recovery-msab-pixel.md)
12. [recovery-flashback-mobile](../../attestation/recovery-flashback-mobile.md)
13. [recovery-drivesavers-android](../../attestation/recovery-drivesavers-android.md)
14. [recovery-swgde-preservation](../../attestation/recovery-swgde-preservation.md)
15. [recovery-chrome-browser-client](../../attestation/recovery-chrome-browser-client.md)
16. [recovery-chrome-temp-dir](../../attestation/recovery-chrome-temp-dir.md)
17. [recovery-chrome-dom-file-access](../../attestation/recovery-chrome-dom-file-access.md)
18. [recovery-chrome-file-input](../../attestation/recovery-chrome-file-input.md)
19. [recovery-chrome-debug-drag](../../attestation/recovery-chrome-debug-drag.md)

## Revisions

- Pre-convergence correction, 2026-10-09: qualified export attribution, added Android
  temporary-directory grounding, separated export from deleted-data recovery, and
  completed preservation guidance following independent review.
- Pre-convergence correction, 2026-10-09: separate debugging file-read and file-drop
  mechanisms qualify the initial shell/download-access limitation. Device observations
  belong in the private case sheet, not as public source-direct citations here.

## Verification

Citation lint completed without high-severity findings or thin attestations. The
DriveSavers HEAD transport warning was checked against a successful browser fetch.
Independent adversarial review identified four material corrections, applied above.
A bounded review of newly added debugging-access evidence found one further handoff
disclosure issue: receiving-page origin and non-historical quota timestamps. That
private inquiry correction was applied and checked by the lead. No additional review
loop was run. Source claims, runtime observations and remaining recovery uncertainty
were spot-checked separately; the operational recovery investigation remains open.
