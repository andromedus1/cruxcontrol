<!-- agile-workflow:start -->
## Agile-Workflow Substrate

Work tracked in `.work/` as markdown items with YAML frontmatter
(`kind, stage, tags, parent, depends_on, release_binding`).
Layout: `.work/active/{epics,features,stories}/`, `.work/backlog/`,
`.work/releases/<version>/`, `.work/archive/`.

**Primary query tool:** `.work/bin/work-view` filters by stage, tag, kind,
parent, and dependency. Common patterns:
- `work-view --ready` — items ready to work (deps satisfied)
- `work-view --stage review` — items awaiting an agent review pass (`/agile-workflow:review`)
- `work-view --parent <id>` / `--blocking <id>` — hierarchy / sequencing
- `work-view --scope all` — include terminal tiers: `releases/` (one summary doc per version) and
  `archive/` (bodyless ref stubs). Full bodies live in git history. By default work-view shows only
  active + backlog; `--release` / `--gate` auto-widen to all tiers.
- `work-view --help` for the full flag set

Foundation docs in `docs/` describe the system's current state or intended
future state, never the past; git history is the audit trail. Item files are
the durable state: update the body with implementation discoveries, review
findings, blockers, and decisions instead of relying on chat history.

Reusable code patterns live in `.agents/skills/patterns/` (load the `patterns`
skill for detail). Project agent rules live in `.agents/rules/*.md`
(plugin-managed rules in `.agents/rules/agile-workflow.md`); do not maintain
`.claude/rules/*.md` as a source of truth.

**Before designing, implementing, or reviewing, read `.agents/rules/*.md`** —
the project's force-loaded agent rules (tag semantics, test integrity, review
policy). The agile-workflow hook auto-loads these at session start and after
compaction; read them directly when working without the hook. Do not rely on
UserPromptSubmit for rules or queue snapshots; query `work-view` when queue
state is needed.

Project-specific refactor style conventions belong in this file under
`## Refactor Style Conventions`. Detailed refactor convention references belong
in `.agents/skills/refactor-conventions/` and extend `refactor-design`'s
defaults; they do not replace the built-in scan and they do not create
standalone plan docs.

<!-- agile-workflow:end -->

## GitHub access

The repository is `andromedus1/cruxcontrol`. When the default GitHub CLI account
cannot see it, use the existing `andromedus1` login for project commands via a
command-scoped `GH_TOKEN` from `gh auth token --hostname github.com --user andromedus1`.
Do not print or persist the token, or change the global active account. For HTTPS Git
operations, use `gh auth git-credential` as a command-scoped credential helper so Git
uses the same account. Keep application and infrastructure changes on pull requests.

## Phone updates and library preservation

Preserving Andrew's climbs and playlists is a standing requirement for every app
update; he does not need to repeat it.

- Identify the phone's existing app origin and browser profile before updating.
  Keep the same scheme, hostname, and port; `localhost` and `127.0.0.1`, or different
  ports, do not share browser storage. The established USB preview origin is
  `http://localhost:4173/`; verify the actual phone state rather than assuming it.
- Before agent-operated phone maintenance, save and validate a fresh whole-library
  backup outside Git, including drafts, finished climbs, Trash, playlists, ordered
  memberships, and effect recipes. The app does not make these backups automatically.
- Let saves finish and use the app's normal update admission flow. Do not bypass
  editing, pending-write, other-tab, or connected-board safeguards to force a reload.
- Routine update authorization does not authorize changing authored library data.
  Never clear site data, delete/recreate user databases, or uninstall/reset the browser
  or PWA as an update shortcut.
- Verify saved records and playlist ordering against the fresh backup after updating.
  Keep backups, personal library contents, and device identifiers out of Git.

<!-- ux-ui-design:installed -->
## UI/UX Design Convention

**Mockup-first.** All UI/UX design is done as standalone HTML/CSS/JS mockups
before any production code is written. Mockups are committed.

**Location.** Mockups live in `.mockups/` with three buckets:

- `.mockups/design-system/` — palette, typography, tokens (project-wide)
- `.mockups/screens/<feature-id>/` — single-screen options per feature
- `.mockups/flows/<flow-name>/` — multi-page user journeys

`<feature-id>` matches the agile-workflow item id when applicable, else a
kebab-case short name.

**Process.**
- Single screen with options to align on: `/ux-ui-design:screens`
- Multi-page user flow for sign-off: `/ux-ui-design:flows`
- Palette / typography / design tokens: `/ux-ui-design:palette`
- Convention reference (auto-loads): `/ux-ui-design:ux-ui-principles`

**Tech rule.** Single-file HTML per mock, vanilla CSS in `<style>`, vanilla JS
in `<script>`. No build step, no CSS framework CDNs. Hosted fonts (Google
Fonts, etc.) are fine when the palette specifies one.

**Linking.** Each substrate item with mocks gets a `## Mockups` section in its
body pointing at the relevant `.mockups/` paths.

**Skip mocking** for trivial copy changes, bug fixes that don't shift visual
structure, behind-the-scenes refactors, or feature-level UI that cleanly
reuses existing components and patterns. Mock new surfaces, design-system
shifts, and multi-screen epics.
