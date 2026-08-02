---
id: epic-route-creation-board-light-capacity-envelope-instrumentation
kind: story
stage: done
tags: [perf, ble]
parent: epic-route-creation-board-light-capacity-envelope
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Instrumented Bounded Board-Capacity Runner

## Brief

Implement Optimization 1 from the parent feature: exact cost modeling, sanitized User
Timing/trace events, diagnostic pacing/timeout/force-disconnect behavior, deterministic
mock coverage, benchmark baseline, and the explicit local operator surface.

## Implementation

See the parent feature's `## Optimization Plan` and do not infer physical thresholds.

## Implementation notes

- Execution capability: GPT-5.6 Codex, xhigh; the BLE timeout/recovery and trace-privacy
  boundaries warranted a strong implementation pass.
- Review weight: standard, from `.work/CONVENTIONS.md`; not applicable at this child-story
  checkpoint because the feature owns review.
- Files changed: `web/src/board-control/{capacity-model,capacity-trace}.ts`, transport
  adapters, light controller, `BoardCapacityDiagnostics.tsx`, focused tests,
  `RouteEditorWorkspace.{tsx,css}`, and current-state `docs/{SPEC,ARCHITECTURE}.md`.
- Tests added/removed: formula-to-codec boundary coverage; trace-summary coverage; bounded
  runner coverage for ordered clearing, one active case, cancellation, sanitized errors,
  hanging-write timeout, and immediate disconnect; editor presence regression. No tests
  removed.
- Simplification: reused the existing controller queue, codecs, transport adapters, and
  editor rail; no second BLE runtime, telemetry service, or inferred threshold store.
- Discrepancies from design: diagnostic methods are optional on the public controller
  interface so non-hardware UI test doubles remain source-compatible; production
  Fullride controllers implement them. The benchmark was already committed with the
  parent perf design. Physical thresholds and board observations remain intentionally
  absent.
- Adjacent issues parked: none.

## Verification

- `npm -w web run test -- --run src/board-control` — 98 tests passed.
- `npm -w web run test -- --run src/app/CruxControlWorkspace.test.tsx src/route-editor/RouteEditorWorkspace.test.tsx` — 15 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed with two pre-existing/concurrent playlist Fast Refresh warnings.
- `npm exec --workspace web vitest bench --run src/board-control/capacity-model.bench.ts`
  — 14 encoder baselines passed; no BLE threshold inferred.
- Full-suite first pass: all instrumentation tests passed; one concurrent playlist-share
  assertion failed independently of this story. `npm run build` was subsequently blocked
  by an unused import in that same concurrent uncommitted playlist surface. The last clean
  pre-sharing build and this story's typecheck are green.
