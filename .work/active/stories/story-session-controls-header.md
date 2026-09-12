---
id: story-session-controls-header
kind: story
stage: review
tags: [ui]
parent: null
depends_on: [feature-selected-climb-controls]
release_binding: null
gate_origin: null
created: 2026-09-12
updated: 2026-09-12
---

# Group board connection and screen-awake controls at the top

## Brief

Andrew wants board connection beside the Keep screen awake checkbox at the top
of the app. These controls establish the session and belong above library tabs,
playlist content, and the route editor.

## Design

- Compose the existing awake and connection controls into a shared workspace
  header, using existing colors, spacing, and touch targets. Keep both groups
  side by side at phone widths while allowing their text and actions to wrap.
- Keep the header mounted across workspace/editor navigation so an enabled wake
  lock remains enabled. Apply the existing update-inert state to its controls.
- Remove connection rows from nested library, editor, and playlist surfaces.
- Retain a connection control inside the mobile climb-details modal, since the
  shared header is inaccessible behind a modal. Suppress this extra row for
  desktop modeless details and playlist play-through.

## Simplification opportunity

One persistent connection owner replaces repeated per-screen rows. Keep the
mobile modal's existing accessible connection path.

## Mockups

Skipped under the project convention for small UI changes that cleanly reuse
existing controls and patterns. The user's requested grouping pins the layout.

## Acceptance and verification

- Awake and board controls precede workspace navigation and the editor.
- The awake checkbox retains its enabled state while entering/leaving editing.
- Connecting remains possible from library, playlists, editor, and mobile details.
- Visually inspect phone and desktop layouts, including long connection status.
- Run existing component/workspace and browser tests; update assertions whose
  connection-control ownership moved to the containing workspace.

## Implementation notes

- Execution capability: inline; existing component composition and responsive CSS.
- Review weight: standard, from project conventions; bounded standalone review.
- The dependency is merged and archived. No database or schema changes.

## Verification results

- Existing workspace/selection/editor tests pass, including pairing from lists
  and preserving the edited playlist entry. The existing screen-awake browser
  workflow preserves the checkbox through editor and list navigation.
- All 12 browser workflows passed. Direct Chromium inspection at 320, 390, and
  1440 CSS pixels showed no overflow, including long connection status text.
- Mobile details retain a clickable connection button inside the native modal;
  resizing to desktop leaves only the shared header connection button.
- A manual probe initially expected Playwright role queries to exclude controls
  behind the native modal. That test assumption was wrong; the corrected probe
  checks the actual modal button's actionability and desktop deduplication.
