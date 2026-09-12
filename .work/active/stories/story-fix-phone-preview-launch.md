---
id: story-fix-phone-preview-launch
kind: story
stage: review
tags: [bug, infra]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-12
updated: 2026-09-12
---

# Make USB preview updates reliable and preserve the saved library

## Symptom

During an authorized phone update, the preview command started Vite but returned
HTTP 404 for `/sw.js`. Andrew also requested that every update preserve his saved
climbs and playlists without needing another reminder.

## Root cause

`scripts/start-phone.sh` invoked the root npm preview script, which invokes another
npm script. The host and port flags were consumed by the inner npm invocation,
leaving `vite preview 127.0.0.1 4173`. Vite treated the first positional argument as
the project root and served no application assets.

## Fix approach

Invoke the web workspace preview script directly so Vite receives its host and
port options. Record the standing phone-maintenance contract in `AGENTS.md`:
verify origin/profile, validate an external whole-library backup, respect update
admission, preserve authored data, and compare all records after updating.

## Verification

- The original command reproduced a `/sw.js` HTTP 404 with npm warnings and the
  incorrect Vite positional arguments visible in the preview log.
- The direct workspace invocation served `/sw.js` with HTTP 200.
- The phone accepted the merged application through its enabled **Update and
  reload** control at the existing origin. Every saved raw record matched the
  validated pre-update snapshot afterward. Backup files remain outside Git.
- Validate the final script's actual preview command against a separate local
  port, checking both the HTML module asset and service worker HTTP responses.
- Use a real command/HTTP smoke check for this single-line shell fix; a mock that
  merely asserts the new argument list would duplicate the implementation.

## Implementation notes

- Execution capability: direct inline implementation; one shell invocation and
  an operational rule with no application or database changes.
- Review weight: standard, from `.work/CONVENTIONS.md`; bounded inline standalone
  story review.
- No new UI surface or foundation-document contract change.

## Verification results

- Extracted the final script's actual npm preview invocation and ran it on an
  isolated local port without invoking adb or touching the phone. The configured
  port served the HTML, referenced JavaScript asset, and service worker with HTTP
  200. The original wrapper had reproduced service-worker HTTP 404.
- `bash -n scripts/start-phone.sh` and diff whitespace checks passed.
- The earlier authorized physical phone update used the app's enabled update
  control; complete saved raw records matched its freshly validated backup.
- Only operational instructions and shell argument forwarding changed; the app
  does not gain automatic backups from these instructions.

## Review (2026-09-12)

**Verdict**: Approve; CI completion pending before terminal transition.

**Blockers**: none.

**Notes**: Bounded inline standalone-story review, standard weight; no independent
code-review lane required. Reviewed the direct npm workspace invocation against its real HTTP smoke test. Verified standing preservation instructions match existing IndexedDB stores, backup codecs, and safe update admission. No data-clearing, origin-switching, profile-resetting, or library-writing operation is introduced.
