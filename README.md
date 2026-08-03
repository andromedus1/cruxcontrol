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
- Light and clear the physical board from Android or desktop Chromium. The measured
  Android/API-2 profile supports complete static scenes of up to 127 lights and
  complete animated scenes of up to 20 lights at 2 FPS; unsafe scenes are preserved
  but refused rather than silently truncated.
- Save and edit assignment effects and independent background presets, including
  Ocean Tide, Tie-dye Spiral, Matrix Rain, Snake, Beach Ball, Pac-Man, Pong, Bird
  Flock, Frogger, and a fading circled inverted pentagram. Semantic route holds remain
  recognizable and animation capacity is preflighted before board playback.

The installed PWA must remain in the foreground while an animation is playing. Page
visibility loss, disconnect, clear, or leaving the relevant view stops playback safely.

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
- A pure frame engine drives both screen preview and BLE output. Saved recipe snapshots
  remain editable and do not change when the built-in preset library evolves.
- API-2 and API-3 codecs, Web Bluetooth transport, latest-frame controller arbitration,
  and the measured capacity policy sit behind typed boundaries.
- The installable Workbox app shell is precached and updates automatically. Animation
  remains deliberately foreground-bound because mobile browsers suspend background work.

The current automated baseline is **68 Vitest files / 443 tests**, plus strict
TypeScript, ESLint, production PWA build checks, and Playwright Chromium smokes. Physical
Android/Fullride dogfooding has verified pairing, hold mapping, lighting, and the API-2
capacity boundary described above; automated transport tests still use deterministic
fakes for repeatability.

## Deployment

Static assets deploy to **Cloudflare Workers (Static Assets)** through the gated GitHub
Actions workflow. One-time setup and safety controls are documented in
[docs/DEPLOY.md](docs/DEPLOY.md).

Query current delivery state with `.work/bin/work-view --ready`.
