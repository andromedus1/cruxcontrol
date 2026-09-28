---
id: idea-laptop-migration-handoff
created: 2026-09-28
updated: 2026-09-28
tags: []
---

# Project paused for laptop migration

Andrew requested a pause on 2026-09-28 while moving to a new laptop and setting
up the work environment. Preserve this checkpoint; do not continue implementation
or treat dependency-ready items as permission to resume. Wait for Andrew to say
the new environment is ready and ask to continue.

## Saved stopping point

- Application main is `d8b294e`, the merge of
  [PR #29](https://github.com/andromedus1/cruxcontrol/pull/29), in
  `andromedus1/cruxcontrol`. The local checkout matched origin/main at the pause;
  no tracked application changes or open PRs remained.
- Everyday reliability work is merged. The isolated Capacitor shell and native
  BLE adapter preparation are merged and reviewed. The
  [adapter feature](../active/features/epic-ios-controller-bridge-native-ble.md)
  owns implementation and review evidence: 30 prototype tests, 664 web tests,
  lint/typechecks, builds, plugin sync, and packaged Chromium library checks.
  [Final PR CI](https://github.com/andromedus1/cruxcontrol/actions/runs/36464443845)
  passed before merge. These results do not establish native iPhone operation.
- The [iOS epic](../active/epics/epic-ios-controller-bridge.md) remains drafting
  with its research gate. Native compilation, simulator behavior, real board
  control, durable native storage/backup, sign-in, and distribution remain open.
  Capacitor remains an experiment, not a production framework commitment.
- Shared-library implementation stays behind the mobile proof. Its accepted
  audience, immediate invited-group publication, retained personal copies with
  explicit updates, and approved mock journeys are preserved in the
  [owning epic](../active/epics/epic-shared-climb-library.md) and
  [priority capture](roadmap-next-milestones.md). Do not restart those decisions.

## Preserve outside Git before retiring the old laptop

A clone preserves committed code, research, mockups and `.work/`; it does not
preserve browser databases, private backups, local credentials, or untracked files.
This handoff has not performed a device backup, file transfer, or migration.

- Local private inputs exist in `docs/kilter_docs/` and `docs/set_boulders/`.
  They were intentionally left untracked; copy them privately if retaining those
  reference documents and screenshot sources. Do not add them to Git as part of
  this migration. `.peeragent/` is also untracked and contains local agent-run
  records; it is optional for resumption, since decisions and review results are
  recorded in the committed work items.
- Export and validate a fresh whole-library backup from each browser/profile
  containing wanted authored data, using the app's normal **Back up & restore**
  flow. Preserve drafts, finished climbs, Trash, playlists, ordered memberships,
  and effect recipes. Save copies outside Git and outside the laptop being
  retired. Do not assume browser synchronization or a Git clone preserves these
  IndexedDB records. The app does not make automatic backups.
- Preserve any existing personal backups and needed ignored local configuration
  privately. Installed dependencies and generated web/native assets can be rebuilt;
  credentials belong in normal secure account setup, never in this checkpoint.
- Keep the existing phone origin/profile intact. The established USB preview
  origin is `http://localhost:4173/`; verify actual phone state before any future
  maintenance and follow [the preservation rules](../../AGENTS.md#phone-updates-and-library-preservation).
  Do not reset, uninstall, clear site data, or change origin to simplify migration.

## Resume after Andrew confirms readiness

1. Restore/clone `andromedus1/cruxcontrol`, verify `andromedus1` GitHub access, and
   read `AGENTS.md`, `.agents/rules/*.md`, the knowledge navigator, and the priority
   capture. Restore the project skills/plugins used by those instructions as part
   of the new work environment; do not assume old machine paths or logins exist.
2. Use the committed lockfiles and version files: root `.nvmrc` is Node 20;
   `prototypes/ios/.nvmrc` is Node 22. The prototype is a separate npm package.
   Follow the existing [prototype setup guide](../../prototypes/ios/README.md#setup)
   for dependency installation, build/sync, Xcode setup and commands. Recheck the
   new machine's actual tooling instead of inheriting the old Mac's preflight.
3. Resume with native compilation and the guide's synthetic-library simulator
   checklist. Full Xcode and an iOS runtime were absent on the old machine;
   neither native compilation nor simulator checks have run. Keep test data
   synthetic and record results in the owning iOS work items.
4. A real iPhone plus the Fullride board is still required for physical acceptance.
   Andrew has no test iPhone; timing depends on a friend's availability. Simulator
   or Android success does not discharge that gate. Resume shared-access design
   only after the mobile proof supports the relevant native-client contracts.

This is a resumption capture, not a new implementation feature or decomposition.
The linked work items remain the owners of scope and acceptance.
