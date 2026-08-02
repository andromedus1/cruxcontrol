---
id: epic-route-creation-animated-light-designs
kind: feature
stage: review
tags: [ui, ble, data]
parent: epic-route-creation
depends_on:
  - epic-route-creation-editor-workspace
  - epic-board-control-light-scenes
release_binding: null
gate_origin: null
created: 2026-08-02
updated: 2026-08-02
---

# Saved animated light designs

## Brief

Make lighting effects part of locally saved climb designs. The editor can assign
coordinated Pulse, Color Cycle, Wave, Twinkle, and alternating pulse effects to
decorative or climbing holds without restricting which holds are eligible. Effects
have saved palette, speed, intensity, and group identity; several groups may run at
once. Static assignments remain the default.

The on-screen board previews effects without hardware. Lighting a draft starts a
BLE animation that respects the connected controller's API level, coalesces stale
frames, and stops safely on user request, clear, disconnect, editor exit, or page
visibility loss. Eyedropper copies only the instantaneous base color, not effect
membership.

As part of the same editor simplification, remove the direct Start, Middle, Finish,
and Foot-only toolbar buttons. Cycle remains the way to set semantic climb roles;
the visible tools become Cycle, Erase, Eyedropper, and Advanced Light.

## Strategic decisions

- Effects are persisted with the climb rather than existing as a separate party-mode
  surface.
- Any assigned hold may be animated, but ordinary climb roles remain static unless
  the user explicitly adds an effect.
- Shared effect groups coordinate multiple holds; multiple groups may coexist.
- The existing API3 color model remains authoritative and API2 reduction occurs only
  at the hardware boundary.

## Simplification opportunity

Reuse the light controller's latest-frame coalescing and the renderer's assignment
index. Remove four redundant direct-role controls while keeping unrestricted role
creation through Cycle.

## Design decisions

- Normalize effect configuration into draft-level groups; assignments carry only an optional group ID.
- Eyedropper copies base color and ignores effect membership.
- One pure frame generator drives both SVG preview and BLE output.
- API2 targets 6 FPS and API3 targets 10 FPS; stale previews are coalesced.
- Light Draft starts effects; Stop Animation settles the base scene. Disconnect,
  visibility loss, and editor unmount stop scheduling.
- Effects use a separate editor section rather than additional Hold Tool radios.
- Remove Save now while retaining autosave status and recovery actions.

## Architectural choice

Embedding a complete effect in every assignment would duplicate coordinated state;
a runtime-only animator could not save designs. The selected normalized model stores
immutable effect groups once on the draft and references them from assignments. A pure
`renderAnimationFrame` resolves the scene at a timestamp; React preview and BLE
scheduling are lifecycle adapters around the same function.

The highest-risk unit is slow BLE scheduling. The loop calls the controller's existing
latest-frame `preview`, derives frames from monotonic elapsed time rather than frame
count, and accepts superseded results. It never writes directly to transport or queues
unbounded interval work.

## Implementation Units

### Unit 1: Versioned saved effect contracts

**Files**: `web/src/board-renderer/types.ts`, `web/src/drafts/types.ts`,
`web/src/drafts/codec.ts`, fixtures and codec/repository tests
**Story**: `epic-route-creation-animated-light-designs-persistence`

```typescript
type LightEffectKind = 'pulse' | 'color-cycle' | 'wave' | 'twinkle' | 'alternate';
type LightEffectGroupId = Brand<string, 'LightEffectGroupId'>;
interface LightEffectGroup {
  readonly id: LightEffectGroupId;
  readonly kind: LightEffectKind;
  readonly palette: readonly ApiLevel3Color[];
  readonly periodMs: number;
  readonly intensity: number;
}
```

Advance stored drafts to schema v2 and migrate valid v1 records to empty groups.
Validate unique IDs, palette length 1–8, packed colors, period 250–10,000 ms,
intensity 0–1, and assignment references.

**Acceptance criteria**:
- [x] Existing v1 drafts reopen unchanged with no effects.
- [x] V2 effects and membership round-trip exactly.
- [x] Corrupt groups and dangling references surface typed corruption errors.

### Unit 2: Deterministic animation frame engine

**Files**: `web/src/light-effects/contracts.ts`, `web/src/light-effects/frame.ts`,
`web/src/light-effects/frame.test.ts`
**Story**: `epic-route-creation-animated-light-designs-engine`

```typescript
function renderAnimationFrame(options: {
  readonly definition: BoardDefinition;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly effectGroups: readonly LightEffectGroup[];
  readonly elapsedMs: number;
}): LightScene;
```

Static assignments remain exact. Pulse/twinkle modulate brightness; cycle/wave
interpolate saved palettes; alternate uses stable placement ordering for opposite
phases. Results quantize into the existing API3 byte.

**Acceptance criteria**:
- [x] Every effect is deterministic at boundary timestamps.
- [x] Static holds never change and output order remains assignment order.
- [x] Empty/one-color palettes, full intensity, and cycle wrap are covered.

### Unit 3: Editor authoring and simplified controls

**Files**: route-editor types/reducer/assignments, `RouteEditorToolbar.tsx`, new
`LightEffectsPanel.tsx`, `RouteEditorWorkspace.tsx`, styles and tests
**Story**: `epic-route-creation-animated-light-designs-editor-runtime`

```typescript
type EditorTool =
  | { readonly kind: 'cycle' | 'erase' | 'eyedropper' }
  | { readonly kind: 'custom'; readonly color: ApiLevel3Color }
  | { readonly kind: 'apply-effect'; readonly effectGroupId: LightEffectGroupId }
  | { readonly kind: 'remove-effect' };
```

The panel creates/selects groups, edits kind/speed/intensity, and adds/removes the
current Advanced Light color from the palette. Effect tools only alter existing holds.
Hold Tool retains Cycle, Erase, Eyedropper, Advanced Light. Remove Save now.

**Acceptance criteria**:
- [x] Applying/removing an effect preserves base color; unassigned holds are no-ops.
- [x] Direct role buttons and Save now are absent; cycle and autosave still work.

### Unit 4: Shared visual and BLE playback lifecycle

**Files**: `web/src/light-effects/use-animation-clock.ts`,
`web/src/route-editor/use-editor-lighting.ts`, workspace/renderer and hook tests
**Story**: `epic-route-creation-animated-light-designs-editor-runtime`

Preview the shared generated frame at capped cadence. Light Draft starts BLE playback;
Stop, visibility loss, disconnect, and unmount cancel timers and prevent later frames.

**Acceptance criteria**:
- [x] Screen and transport use the same frame generator.
- [x] Slow writes remain bounded; Stop settles the static base frame.
- [x] Lifecycle exits schedule no later frames.

## Implementation order

1. Versioned contracts and migration.
2. Pure frame engine.
3. Editor authoring and simplified controls.
4. Shared preview/BLE lifecycle and physical verification.

## Testing

Codec tests cover v1 migration, v2 round-trip, and corrupt references. Table-driven
engine tests cover five effects at exact timestamps. Editor tests cover group editing,
painting/removal, simplified tools, and autosave. Fake-timer hook tests cover cadence,
coalescing, stop, visibility, disconnect, and unmount. A Pixel 8 check confirms a side
design animates while semantic climb holds stay static.

## Risks

- **BLE capacity**: coalescing plus conservative API2 cadence bounds load.
- **Migration**: pure v1 decode migration never writes until a later user edit.
- **Stepped API2 fades**: 2/2/2 reduction necessarily produces visible steps.
- **Background throttling**: visibility loss stops rather than faking reliability.
- **Mode complexity**: effects remain separate from the four ordinary hold tools.

## Implementation summary

- Completed child checkpoints: persistence `e301da9`, deterministic engine `8298c93`, and editor/runtime `e6bb5f9`.
- Draft schema v2 stores normalized effect groups and optional assignment membership, while pure decoding migrates v1 drafts to empty groups without rewriting storage.
- One deterministic `renderAnimationFrame` now drives both the continuously animated SVG preview and API-aware BLE playback.
- The BLE scheduler runs at a maximum 6 FPS for API2 and 10 FPS for API3, waits for each preview write before scheduling another, and cancels on Stop, clear, disconnect, visibility loss, and unmount.
- The editor saves multiple effect groups with kind, palette, period, and intensity; effect painting/removal preserves each hold's base color. Eyedropper still samples only that base color.
- Hold Tool now exposes Cycle, Erase, Eyedropper, and Advanced Light. Direct semantic role buttons and Save now were removed; coalesced autosave and recovery actions remain.
- Integrated verification: 41 Vitest files / 256 tests pass, ESLint passes, and TypeScript plus the production Vite/PWA build pass.
- Review boundary: implementation is ready for independent review. A Pixel 8 + physical Fullride animation smoke remains pending and should confirm visual cadence/stepping on the API2 controller before final acceptance.
