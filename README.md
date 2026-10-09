# CruxControl

CruxControl is a local-first, installable web app for creating climbs and controlling
a home **Kilter Fullride 7x10**. It runs on Android and desktop Chromium, connects to
the board through Web Bluetooth, and keeps personal climbs and lists in the browser—no
account or application server required.

## What works now

- Create unrestricted climbs on a recognizable 305-hold board, use the four Kilter
  roles or any of the controller's 256 packed colors, and autosave locally.
- Move climbs between **Draft**, **Finished**, and recoverable **Trash** without losing
  their identity or contents. Trash remains until you explicitly choose **Delete forever**.
- Organize climbs into multiple named lists, reorder them, play through them on the
  board, and share complete lists by bounded URL or JSON file. Edit a local climb from
  a list and return to the same list or play-through entry. Play-through announces the
  climb and position and moves keyboard focus to the enabled navigation button when
  reaching either end. Dismissing the device's share sheet reports cancellation without
  an error alert.
- Download and restore a bounded whole-library JSON backup containing saved climbs,
  Trash, orphan climbs, all installations, playlists, shared memberships, IDs, revisions,
  timestamps, and animation recipes. Recovery adds missing IDs, skips identical records,
  and pauses on conflicts without overwriting current data. A playlist-store failure after
  a committed climb batch is reported as partial and can be retried with the retained file.
- Installed PWA updates wait for an explicit **Update and reload** action. The app keeps
  the workspace available while a new worker waits, but blocks applying it while an editor,
  list task, import/backup flow, pending library write, play-through, or board session is
  active. **Later** dismisses the banner while retaining an update entry; tabs coordinate
  through a shared browser lock, and browsers without Web Locks use close-and-reopen
  recovery instructions.
- Import Kilter Fullride screenshots through a local review-and-correction flow, or
  import the supplied set of 16 climbs as ordinary 40° drafts. Screenshot pixels are
  never uploaded or persisted.
- Connect the physical board from Android or desktop Chromium, then selected climbs,
  saved effects, and hold/effect edits light automatically. Connect/Reconnect remains
  an explicit action in the persistent workspace header beside **Keep screen awake**.
  **Retry lighting** appears when lighting is blocked or fails and animation is not running.
  The existing API-2 profile supports complete static scenes of up to 127 lights and complete
  animated scenes of up to 20 lights at 2 FPS; unsafe scenes are preserved but refused
  rather than silently truncated.
- Save and edit assignment effects and independent background presets, including
  Ocean Tide, Tie-dye Spiral, Matrix Rain, Snake, Beach Ball, Pac-Man, Pong, Bird
  Flock, Frogger, a fading circled inverted pentagram, and Curious Bumblebee. Version-2
  presets default to 90–150-second closed themed loops; Bumblebee adds wandering
  hover, flight, and dart phases with independently editable Body and Wings colors.
  Saved v1 recipes keep their original renderer until explicitly upgraded. Semantic route
  holds remain recognizable and animation capacity is preflighted before board playback,
  while intentionally empty frames remain valid animation output.

The installed PWA must remain in the foreground while an animation is playing. Page
visibility loss, disconnect, clear, or leaving the relevant view stops playback safely.
Returning to the foreground automatically lights the selected scene again when the
board is still connected and the normal capacity checks permit playback.
The persistent header groups board connection and the app-wide **Keep screen awake**
toggle above the library navigation and editor. A mobile climb-details dialog also
keeps connection controls accessible inside the dialog. **Keep screen awake** prevents
automatic screen timeout while the app is visible on supported browsers.
It starts off for each app session and requests screen wakefulness again when you
return to the app if still enabled. The device can
deny or release the request; the control shows its status and offers **Retry screen
awake**. Keeping the screen on uses more battery. Animation does not run in the
background or while the screen is manually locked.

The calibrated Fullride hold photograph is private, user-supplied source material for
local use. Public distribution requires permission or replacement artwork; the
definition-driven schematic renderer remains the distributable fallback. The original
Kilter reference documents and screenshot sources are also private inputs and are not
application assets.

Kilter community-catalog installation and browsing use
an explicitly older offline snapshot with unknown source freshness and no live updates;
public distribution of its catalog binary remains gated. Publication to Kilter,
logbook/session tracking, grade prediction, recommendations, iOS board control, and
other board models remain future work. See [docs/VISION.md](docs/VISION.md) for the
broader direction.

Catalog `.db.gz` files are gzip download artifacts. Hosts must serve the gzip bytes
as `application/gzip`, with absent or `identity` HTTP `Content-Encoding`; a transport
compression layer must encode that representation again rather than merely label
its existing gzip bytes. The Vite development and preview servers enforce identity
for these paths. The installer checks compressed and raw sizes and the SHA-256 of the exact
downloaded gzip bytes;
do not bypass those checks to accommodate an incorrectly configured host.

## Development

CruxControl is a client-only React 19 + Vite 6 TypeScript PWA. The repository also
contains research, future catalog/ML foundations, and the agile-workflow substrate;
the deployed artifact is `/web`.

```text
/web       TypeScript PWA
/ml        Future Python grade-prediction pipeline
/docs      Foundation docs, briefs, and knowledge index
/.research Research corpus and source attestations
/.work     Delivery substrate and current work state
/.github   CI and gated Cloudflare deployment
```

From the repository root:

```bash
npm install
npm run dev
npm run build
npm test
npm run typecheck
npm run lint
npm run format
npm -w web run test:e2e  # build first
```

Node 20 or newer is required (see `.nvmrc`). `/web` is an npm workspace; `/ml` is a
separate Python project.

An experimental [iOS shell](prototypes/ios/README.md) packages the existing screens
with Capacitor and an isolated native BLE adapter in a separate Node 22+ project.
It reuses the shared controller and local library, requires explicit connection,
and disconnects on backgrounding. Its setup guide covers adapter checks, synthetic
data, and the pending simulator/device work. A complete Save to Files backup and
restore round trip has passed in the iPhone simulator; real-board operation,
real-device storage pressure, and authentication still need proof before iOS support
can ship.

### Implementation highlights

- One immutable Fullride definition owns all 305 placement identities, coordinates,
  LED positions, supported angles, and semantic role presets.
- Independent versioned IndexedDB repositories own local climbs and lists, including
  optimistic revisions, lifecycle recovery, portable list snapshots, whole-library backup,
  and offline use. Workspace reads report corrupt or unsupported climb records while
  keeping healthy climbs and Trash available and leaving unreadable records untouched.
  Climbs and lists refresh independently; a list read failure retains previously loaded
  lists and offers **Retry loading lists** in Lists.
- Library backup uses a 25 MiB file limit with limits of 10,000 climbs, 1,000 playlists,
  and 100,000 playlist references. Export checks for changes across the two stores and
  asks you to finish edits in other tabs; the check is bounded and does not form one
  cross-database atomic snapshot. It uses the existing browser-local origin and saved
  records only; no schema rewrite, cloud upload, or account is involved. Backup reads
  remain strict: unreadable records block export rather than producing an incomplete
  backup. The backup file cannot salvage corrupt raw records.
- A version-dispatched pure frame engine drives both screen preview and BLE output. It
  preserves v1 snapshots, uses prepared definition geometry and per-group held-frame/path
  reuse for v2, and leaves saved recipes editable as the preset library evolves. Stable
  target samples carry tide bands and spiral geometry through loop joins; actor ordering
  and Pong paddle contacts remain coherent when direction reverses.
- API-2 and API-3 codecs, Web Bluetooth transport, latest-frame controller arbitration,
  and the existing capacity policy sit behind typed boundaries. V2 decorative colors avoid
  exact encoded role colors and black after API-2 conversion; this is byte-level protection,
  not a perceptual distinction guarantee.
- The installable Workbox app shell is precached. An app-owned update coordinator keeps new
  workers waiting, admits one tab for explicit activation, and reloads only the requesting
  tab after its worker takes control. Animation remains deliberately foreground-bound
  because mobile browsers suspend background work.

Automated checks include Vitest tests, strict TypeScript, ESLint, production PWA build
checks, and Playwright Chromium browser workflows. A real three-generation Workbox fixture
checks that a climb survives legacy generation A's natural waiting transition to generation
B and generation B's explicit safe apply to generation C. CI runs the browser workflows
against the production build and retains traces and screenshots from failures for seven days.
Automated transport and renderer tests use deterministic fakes for repeatability. Prior
Android/API-2 physical checks cover the current effects dogfooding and conservative controller
profile; API-3 and other device, browser, and controller-profile acceptance remain unmeasured.

## Deployment

Static assets deploy to **Cloudflare Workers (Static Assets)** through the gated GitHub
Actions workflow. One-time setup and safety controls are documented in
[docs/DEPLOY.md](docs/DEPLOY.md).

Query current delivery state with `.work/bin/work-view --ready`.
