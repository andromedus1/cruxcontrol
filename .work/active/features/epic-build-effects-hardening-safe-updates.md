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
   with stable `getSnapshot`, `subscribe`, `start`, `apply`, `dispose` and `setBlocked(reason)`.
   Snapshot distinguishes unavailable/current/waiting/applying/error and actionable text.
   Dependencies abstract ServiceWorkerContainer, LockManager, visibility and reload for
   deterministic tests. Register same-origin `BASE_URL + sw.js`, inspect existing waiting
   worker, observe updatefound/installed, expose failures honestly. Acquire shared lifetime
   lease before workspace admission. Explicit apply requires visible, unblocked state,
   exclusive lease and a still-waiting worker; post SKIP_WAITING then reload only requester
   after controllerchange and a final gate check. While applying block new workspace input.
   Timeout/failure restores normal usable state and shared lease; never claim activation
   success from postMessage returning. Other tabs never reload in response to activation.
2. `web/src/pwa/AppUpdateControl.tsx` and css: small persistent update banner above workspace,
   with Update and reload, Later, and status. Later dismisses prominent prompt but retains
   accessible Update available entry. Applying state announces status and disables work
   that could create unsaved data. Existing startup/retry presentation covers tab admission.
3. `web/src/main.tsx`, `web/src/App.tsx`, `web/src/pwa/register-sw.ts`: start coordinator once,
   dispose in tests, no virtual helper reload listener. `web/vite.config.ts` uses prompt,
   skipWaiting false, clientsClaim false, automatic injected registration disabled if needed
   to avoid double registration. Verify generated worker still supports SKIP_WAITING.
4. `web/src/app/CruxControlWorkspace.tsx`: report a conservative update block while editor
   is open (save and return to library first), any modal/edit/import/backup flow is open,
   or library mutation promise is pending. Combine with controller subscription blocking
   connecting, connected (disconnect board first) and non-idle operations. Blocking on
   whole editor/BLE session avoids an apparent safe gap between animation frames and keeps
   unsaved playlist metadata protected. Root may choose an equivalent simpler interface
   when backup implementation supplies its operation state. Do not interrupt autosave,
   force-disconnect, clear lights or silently discard an edit to satisfy update request.

## Acceptance and verification

- A waiting update never reloads automatically, including visibility return or another
  tab's activation. Dirty/editor, connected/animating BLE, open import or pending mutation
  blocks apply. The explanatory action is save/back/disconnect/finish, not silent discard.
- Two tabs: one update attempt is blocked while another app holds its lease; closing the
  other permits apply; a newly opening tab cannot edit during exclusive activation.
- Update arrival before app subscription, existing waiting worker, dismiss/reopen, hidden
  requester, registration failure, worker timeout and unsupported locks all stay usable.
- Unit tests coordinator with fake locks/SW lifecycle; component/workspace tests for gates.
- Real browser old-build/new-build test uses separate built fixtures and an isolated local
  server to exercise a waiting service worker, same-origin persisted climb, no unsolicited
  reload, explicit safe activation, and reopening data on the new build. Do not fake the
  service worker for this integration contract. Existing production browser suite passes.

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
