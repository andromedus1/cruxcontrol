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
