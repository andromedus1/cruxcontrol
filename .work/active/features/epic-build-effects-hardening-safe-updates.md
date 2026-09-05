---
id: epic-build-effects-hardening-safe-updates
kind: feature
stage: drafting
tags: [ui, infra]
parent: epic-build-effects-hardening
depends_on: [epic-build-effects-hardening-library-backup]
release_binding: null
gate_origin: null
created: 2026-09-05
updated: 2026-09-05
---

# Safe PWA updates during editing and playback

## Brief

Replace auto-activation/reload with a waiting update and explicit safe apply flow. Saved edits, active playback, and in-flight library mutations must settle before reload; no surprise interruption of board control or loss of unsaved local work. Handle dismissed prompts, multiple tabs/visibility as appropriate, update failures and offline usage. Preserve same origin and storage. Ground exact vite-plugin-pwa/Workbox behavior in installed sources and primary documentation; test old/new build transition and dirty/playback gates. Reuse existing UI patterns; create a standalone mock for any new update surface before production.

## Inherited direction

Parent epic owns priorities and accepted decisions. Preserve authored content, IDs,
memberships and old saved recipes. Resolve routine design choices under the authorized
autopilot scope. No controller upgrade or increased hardware capacity claim.

## Grounding

Read docs/SPEC.md, docs/ARCHITECTURE.md and docs/PRINCIPLES.md plus current code and
relevant completed route-creation/playlists features. Research navigator has no brief
blocking this epic. Existing protocol/board-control briefs and measured capacity feature
remain constraints; they are not evidence of unmeasured hardware performance.

## Mockups

Inherit .mockups/design-system/ and the parent bee study where relevant. Remaining motion,
backup and update surfaces require focused standalone mocks during design before code.

## Simplification opportunity

Extend existing pure frame/repository/UI boundaries; avoid new frameworks or replacement
storage. Share validated logic only where repeated consumers and contracts justify it.

## Architectural choice (prepared under autopilot)

Compared automatic reload gated by a dirty flag, the plugin's prompt helper, and native
registration with an explicit update coordinator. Choose native registration: installed
vite-plugin-pwa's prompt helper installs a controlling listener that can reload other
tabs, so merely disabling the current button does not protect other sessions. Keep
Workbox-generated precaching and prompt-mode build output; replace only registration
and activation policy. No storage/schema changes or new backend.

Use a shared Web Lock held for each running app tab. Before an explicit update, release
this tab's shared lease and request the same lock exclusively with ifAvailable. Other
running app tabs cause a clear close-other-tabs instruction; tabs opening during an
update wait for their lease before rendering the workspace. This deliberately avoids
unreliable presence timeouts for suspended background tabs. Without Web Locks, preserve
normal waiting-worker lifecycle and offer close-and-reopen instructions, not unsafe
immediate activation. No unsolicited reload on controllerchange in any tab.

## Implementation units

1. `web/src/pwa/update-service.ts`: `createAppUpdateService(dependencies): AppUpdateService`
   with stable `getSnapshot`, `subscribe`, awaitable `start`, `apply`, `dispose` and `setBlocked(reason)`.
   Snapshot distinguishes unavailable/current/waiting/applying/error and actionable text.
   Dependencies abstract ServiceWorkerContainer, LockManager, visibility and reload for
   deterministic tests. Register same-origin `BASE_URL + sw.js`, inspect both existing waiting
   and installing workers after registration resolves, observe updatefound/installed, and
   expose failures honestly. `start` admits runtime/workspace only after the shared lock
   callback has actually been granted. Before exclusive acquisition, resolve the shared
   callback and await its outer request promise; if exclusive is unavailable, reacquire
   and await shared admission before enabling work. Hold exclusive callback through reload.
   Explicit apply requires visible, unblocked state, exclusive lease and a still-waiting
   worker. Run the final safety check BEFORE posting SKIP_WAITING; disable workspace input
   before that point. Match controllerchange to the captured target and reload requester.
   Posting activation is irreversible: on timeout after posting, keep editing disabled and
   exclusive lock held, with an honest reload/close recovery instruction. Only restore
   editing if the target becomes redundant and the unchanged old controller proves failure.
   Pre-post failures may restore shared admission and normal editing. Never claim success
   merely from postMessage returning; other tabs never reload in response to activation.
2. `web/src/pwa/AppUpdateControl.tsx` and css: small persistent update banner above workspace,
   with Update and reload, Later, and status. Later dismisses prominent prompt but retains
   accessible Update available entry. Applying state announces status and disables work
   that could create unsaved data. Provide an explicit user-invoked Disconnect board action
   when connected; controller.disconnect exists but current UI has no disconnect control.
   Do not auto-disconnect on update arrival. Existing startup/retry covers tab admission.
3. `web/src/main.tsx`, `web/src/App.tsx`, `web/src/pwa/register-sw.ts`: start coordinator once,
   dispose in tests, no virtual helper reload listener. `web/vite.config.ts` uses prompt,
   skipWaiting false, clientsClaim false and `injectRegister: false` explicitly
   to avoid the plugin injecting a second unmanaged registration. Verify generated worker still supports SKIP_WAITING.
4. `web/src/app/CruxControlWorkspace.tsx`: report a conservative update block while editor
   is open (save and return to library first), any modal/edit/import/backup flow is open,
   or library mutation promise is pending. Combine with controller subscription blocking
   selecting, connecting, connected, disconnecting and non-idle operations. Blocking on
   whole editor/BLE session avoids an apparent safe gap between animation frames.
   Add child-to-workspace safety reporting for PlaylistLibrary's dirty metadata, active
   play-through (even disconnected), modal state and mutation promises. Operation counters
   or tokens span each promise through finally, including work continuing after a dialog
   closes; closing UI is not evidence a repository write settled. Include membership,
   portable import, backup and playlist mutations. Reuse backup's operation state where
   it supplies the same lifetime contract. Do not interrupt autosave,
   force-disconnect, clear lights or silently discard an edit to satisfy update request.

## Acceptance and verification

- A waiting update never reloads automatically, including visibility return or another
  tab's activation. Dirty/editor, connected/animating BLE, open import or pending mutation
  blocks apply. The explanatory action is save/back/disconnect/finish, not silent discard.
- Two tabs: one update attempt is blocked while another app holds its lease; closing the
  other permits apply; a newly opening tab cannot edit during exclusive activation.
- Update arrival before app subscription, existing waiting worker, dismiss/reopen, hidden
  requester, registration failure and unsupported locks stay usable. After activation was
  posted, delayed activation/timeout remains protected until reload/close; test that it
  cannot re-enable old editing and later surprise-reload.
- Unit tests coordinator with fake locks/SW lifecycle; component/workspace tests for gates.
- Real browser verification uses three immutable build generations served from one
  switchable same-origin local server: A legacy auto-update -> B first safe build proves
  B waits with A clients open and activates naturally once they close; B -> C proves the
  new prompt, blockers, two-tab locks and explicit activation. Preserve and reopen a real
  local climb across both transitions. Do not fake the service worker for this integration
  contract. Existing production browser suite passes.

## Research evidence

Primary references: https://vite-pwa-org.netlify.app/guide/prompt-for-update.html
(prompt activation contract), https://developer.chrome.com/docs/workbox/handling-service-worker-updates
(waiting lifecycle and explicit skip-waiting). Installed source inspected:
`node_modules/vite-plugin-pwa/dist/client/build/register.js`, controlling listener and
`node_modules/vite-plugin-pwa/dist/index.js`, autoUpdate forcing skipWaiting/clientsClaim.
API details must be checked against installed/primary sources during implementation.

## Risks

Cross-tab coordination is the trickiest unit. Shared lifetime leases trade immediate
multi-tab update convenience for deterministic safety; unsupported platforms retain
close/reopen behavior. Existing already-running pre-change clients cannot be retrofitted
with the new UI; verify that the first prompt-mode worker waits naturally rather than
activating over them. Do not clear application databases or change origin to test rollout.

## Design preparation

Prepared while earlier animation features run; implementation remains dependency-blocked
until library-backup has green verification. No child stories: one cohesive coordinator/UI
integration with acceptance checkpoints in this body. Host owns design, worker owns the
feature as one write set after upstream changes settle.

## UI alignment

Mock: `.mockups/screens/epic-build-effects-hardening-safe-updates/index.html`.
Two surface compositions considered: persistent banner versus modal. Select the banner
under autopilot judgment because it leaves library tasks visible and can explain why
updating must wait. Existing app tokens and controls apply; no design-system changes.

## Design advisory (2026-09-05)

One same-harness fresh-context Sol xhigh advisory reviewed lifecycle and integration.
Different-class peer invocation failed before review because its local OAuth session
expired; no authentication changes were needed to continue. Accepted all five material
findings: irreversible post-message activation, missing disconnect affordance, child
playlist/mutation safety state, awaitable lock admission/release, and three-generation
browser verification. Accepted explicit injectRegister false, installing-worker race
handling and captured-target controller matching. Retain native registration rather than
adding workbox-window: installed platform primitives suffice with these explicit tests.
This design advisory does not replace the later independent implementation review.

Additional primary contracts: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
and https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request (callback lifetime,
shared/exclusive compatibility and ifAvailable null result). Installed Workbox template
`node_modules/workbox-build/build/templates/sw-template.js` confirms SKIP_WAITING invokes
skipWaiting without an application acknowledgement or cancellation protocol.
