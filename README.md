# CruxControl

CruxControl is a local-first, installable web app for creating climbs and controlling
a home **Kilter Fullride 7x10**. It runs on Android and desktop Chromium, connects to
the board through Web Bluetooth, and keeps personal climbs and lists in the browser—no
account or application server required.

## What works now

- Create unrestricted climbs on a recognizable 305-hold board, use the four Kilter
  roles or any of the controller's 256 packed colors, and autosave locally.
- Move climbs between **Draft**, **Finished**, and recoverable **Trash** without losing
  their identity or contents.
- Organize climbs into multiple named lists, reorder them, play through them on the
  board, and share complete lists by bounded URL or JSON file.
- Import Kilter Fullride screenshots through a local review-and-correction flow, or
  import the supplied set of 16 climbs as ordinary 40° drafts. Screenshot pixels are
  never uploaded or persisted.
- Light and clear the physical board from Android or desktop Chromium. The existing
  API-2 profile supports complete static scenes of up to 127 lights and complete
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
The app-wide **Keep screen awake** toggle prevents automatic screen timeout while the
app is visible on supported browsers. It starts off for each app session and requests
screen wakefulness again when you return to the app if still enabled. The device can
deny or release the request; the control shows its status and offers **Retry screen
awake**. Keeping the screen on uses more battery. This does not restart playback stopped
by hiding the app or allow animation in the background or after manually locking the
screen.

The calibrated Fullride hold photograph is private, user-supplied source material for
local use. Public distribution requires permission or replacement artwork; the
definition-driven schematic renderer remains the distributable fallback. The original
Kilter reference documents and screenshot sources are also private inputs and are not
application assets.

Community-catalog installation and browsing, publication to Kilter, logbook/session
tracking, grade prediction, recommendations, iOS board control, and other board models
remain future work. See [docs/VISION.md](docs/VISION.md) for the broader direction.

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

### Implementation highlights

- One immutable Fullride definition owns all 305 placement identities, coordinates,
  LED positions, supported angles, and semantic role presets.
- Independent versioned IndexedDB repositories own local climbs and lists, including
  optimistic revisions, lifecycle recovery, portable list snapshots, and offline use.
- A version-dispatched pure frame engine drives both screen preview and BLE output. It
  preserves v1 snapshots, uses prepared definition geometry and per-group held-frame/path
  reuse for v2, and leaves saved recipes editable as the preset library evolves. Stable
  target samples carry tide bands and spiral geometry through loop joins; actor ordering
  and Pong paddle contacts remain coherent when direction reverses.
- API-2 and API-3 codecs, Web Bluetooth transport, latest-frame controller arbitration,
  and the existing capacity policy sit behind typed boundaries. V2 decorative colors avoid
  exact encoded role colors and black after API-2 conversion; this is byte-level protection,
  not a perceptual distinction guarantee.
- The installable Workbox app shell is precached and updates automatically. Animation
  remains deliberately foreground-bound because mobile browsers suspend background work.

Automated checks include Vitest tests, strict TypeScript, ESLint, production PWA build
checks, and Playwright Chromium browser workflows. CI runs the browser workflows against
the production build and retains traces and screenshots from failures for seven days.
Automated transport and renderer tests use deterministic fakes for repeatability; device-level
acceptance remains future work.

## Deployment

Static assets deploy to **Cloudflare Workers (Static Assets)** through the gated GitHub
Actions workflow. One-time setup and safety controls are documented in
[docs/DEPLOY.md](docs/DEPLOY.md).

Query current delivery state with `.work/bin/work-view --ready`.
