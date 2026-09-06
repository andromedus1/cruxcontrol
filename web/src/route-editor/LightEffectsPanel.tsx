import type { Dispatch } from 'react';
import { LIGHT_EFFECT_PERIOD_MAX_MS, lightEffectGroupId, type BoardHoldAssignment, type LightEffectGroupId, type LightEffectKind, type SpatialEffectKind } from '../board-renderer/types';
import { apiLevel3ColorHex } from '../domain/boards/colors';
import type { ApiLevel3Color } from '../domain/boards/types';
import { spatialCapacityPlan } from '../light-effects/capacity-plan';
import { createSpatialPreset, SPATIAL_PRESETS, upgradeSpatialPreset } from '../light-effects/preset-library';
import type { RouteEditorAction, RouteEditorState } from './types';

const EFFECT_LABELS: Readonly<Record<LightEffectKind, string>> = { pulse: 'Pulse', 'color-cycle': 'Color cycle', wave: 'Wave', twinkle: 'Twinkle', alternate: 'Alternating pulse' };
const groupLabel = (group: RouteEditorState['content']['effectGroups'][number]) => group.model === 'spatial' ? SPATIAL_PRESETS.find(({ kind }) => kind === group.recipe.kind)?.label ?? group.recipe.kind : EFFECT_LABELS[group.kind];
const createGroupId = (): LightEffectGroupId => lightEffectGroupId(`effect-${crypto.randomUUID()}`);
const shapeField = (kind: SpatialEffectKind) => ({'ocean-tide':'foam','tie-dye-spiral':'arms','matrix-rain':'columns',snake:'bodyLength','beach-ball':'size','pac-man':'mouthBeat',pong:'paddleSize','bird-flock':'quietFraction',frogger:'lanes',pentagram:'fadeRate',bumblebee:'hoverFraction'} as Partial<Record<SpatialEffectKind, string>>)[kind];
const shapeValue = (recipe: import('../board-renderer/types').SpatialRecipe) => { switch(recipe.kind) { case 'ocean-tide': return recipe.foam; case 'tie-dye-spiral': return recipe.arms; case 'matrix-rain': return recipe.columns; case 'snake': return recipe.bodyLength; case 'beach-ball': return recipe.size; case 'pac-man': return recipe.mouthBeat; case 'pong': return recipe.paddleSize; case 'bird-flock': return recipe.quietFraction; case 'frogger': return recipe.lanes; case 'pentagram': return recipe.fadeRate; case 'bumblebee': return recipe.hoverFraction; } };
const shapeLimits = (kind: SpatialEffectKind) => kind === 'ocean-tide' || kind === 'bird-flock'
  ? { min: 0, max: kind === 'bird-flock' ? .95 : 1, step: .05 }
  : kind === 'bumblebee' ? { min: 0, max: .8, step: .05 }
  : kind === 'tie-dye-spiral' ? { min: 2, max: 4, step: 1 }
    : kind === 'frogger' ? { min: 1, max: 8, step: 1 }
      : kind === 'pentagram' ? { min: .25, max: 8, step: .25 }
        : { min: 1, max: 20, step: 1 };
const shapeLabel = (kind: SpatialEffectKind) => ({
  'ocean-tide': 'Foam',
  'tie-dye-spiral': 'Arms',
  'matrix-rain': 'Columns',
  snake: 'Body length',
  'beach-ball': 'Ball size',
  'pac-man': 'Mouth beats',
  pong: 'Paddle size',
  'bird-flock': 'Quiet fraction',
  frogger: 'Traffic lanes',
  pentagram: 'Fade rate',
  bumblebee: 'Hover fraction',
} as Partial<Record<SpatialEffectKind, string>>)[kind];

export function LightEffectsPanel({ state, assignments, selectedId, onSelectedIdChange, dispatch }: { readonly state: RouteEditorState; readonly assignments: readonly BoardHoldAssignment[]; readonly selectedId: LightEffectGroupId | null; readonly onSelectedIdChange: (id: LightEffectGroupId | null) => void; readonly dispatch: Dispatch<RouteEditorAction> }) {
  const selected = state.content.effectGroups.find(({ id }) => id === selectedId) ?? null;
  const update = (changes: Readonly<Record<string, unknown>>) => { if (selected) dispatch({ type: 'update-effect-group', id: selected.id, changes }); };
  const addColor = (color: ApiLevel3Color) => { if (selected && !selected.palette.includes(color) && selected.palette.length < 8) update({ palette: Object.freeze([...selected.palette, color]) }); };
  const setBumblebeeColor = (index: 0 | 1) => {
    if (selected?.model !== 'spatial' || selected.recipe.kind !== 'bumblebee') return;
    const palette = [...selected.palette];
    while (palette.length < 2) palette.push(palette[0] ?? state.advancedColor);
    palette[index] = state.advancedColor;
    update({ palette: Object.freeze(palette) });
  };
  const plan = spatialCapacityPlan(assignments, state.content.effectGroups);
  const addPreset = (kind: SpatialEffectKind) => { const group = createSpatialPreset(kind); dispatch({ type: 'add-effect-group', group }); onSelectedIdChange(group.id); };
  const move = (offset: number) => {
    if (!selected) return;
    const groups = [...state.content.effectGroups]; const index = groups.findIndex(({ id }) => id === selected.id); const target = index + offset;
    if (target < 0 || target >= groups.length) return;
    [groups[index], groups[target]] = [groups[target]!, groups[index]!];
    dispatch({ type: 'replace-effect-groups', groups: Object.freeze(groups) });
  };
  return <section className="light-effects" aria-labelledby="effects-heading">
    <div className="light-effects__heading"><div><h2 id="effects-heading">Effects</h2><p>Route colors stay protected. Background presets use the remaining light budget.</p></div></div>
    <details><summary>Add a preset</summary><div className="preset-grid">{SPATIAL_PRESETS.filter(({ kind }) => kind !== 'frogger').map((preset) => <button key={preset.kind} type="button" onClick={() => addPreset(preset.kind)}>{preset.label}<small>{preset.footprint} lights</small></button>)}</div></details>
    <button type="button" onClick={() => { const id = createGroupId(); dispatch({ type: 'add-effect-group', group: { model: 'assigned', id, kind: 'pulse', palette: Object.freeze([state.advancedColor]), periodMs: 1800, intensity: .75 } }); onSelectedIdChange(id); }}>Add effect</button>
    <p className={plan.worstCaseLights > 20 ? 'capacity-warning' : ''}>Board reserve: {plan.assignmentLights} route/static + {plan.spatialReserves.reduce((sum, item) => sum + item.lights, 0)} effects = {plan.worstCaseLights}/20 lights at 2 FPS</p>
    {selected ? <div className="light-effects__editor">
      <label>Effect group<select aria-label="Effect group" value={selected.id} onChange={(event) => onSelectedIdChange(lightEffectGroupId(event.target.value))}>{state.content.effectGroups.map((group, index) => <option key={group.id} value={group.id}>{index + 1}. {groupLabel(group)}</option>)}</select></label>
      {selected.model !== 'spatial' ? <label>Effect kind<select aria-label="Effect kind" value={selected.kind} onChange={(event) => update({ kind: event.target.value as LightEffectKind })}>{Object.entries(EFFECT_LABELS).map(([kind,label]) => <option key={kind} value={kind}>{label}</option>)}</select></label> : <>
        <label>Target<select aria-label="Effect target" value={selected.target.scope} onChange={(event) => update({ target: Object.freeze({ ...selected.target, scope: event.target.value }) })}><option value="unused">Unused holds</option><option value="background-board">Whole background</option><option value="selected">Selected holds</option></select></label>
        <label>Light reserve<input aria-label="Effect footprint" type="number" min="1" max="20" value={selected.footprint} onChange={(event) => update({ footprint: Math.max(1,Math.min(20,Number(event.target.value))) })}/><output>{selected.footprint}</output></label>
        {'direction' in selected.recipe && <label>Direction<select aria-label="Effect direction" value={selected.recipe.direction} onChange={(event) => update({recipe:Object.freeze({...selected.recipe,direction:event.target.value})})}>{selected.recipe.kind==='ocean-tide' ? <><option value="in">In</option><option value="out">Out</option></> : selected.recipe.kind==='tie-dye-spiral' ? <><option value="clockwise">Clockwise</option><option value="counterclockwise">Counterclockwise</option></> : selected.recipe.kind==='matrix-rain' ? <><option value="down">Down</option><option value="up">Up</option></> : selected.recipe.kind==='bird-flock' ? <><option value="left">Left</option><option value="right">Right</option></> : <><option value="forward">Forward</option><option value="reverse">Reverse</option></>}</select></label>}
        {shapeField(selected.recipe.kind) && <label>{shapeLabel(selected.recipe.kind)}<input aria-label={selected.recipe.kind === 'bumblebee' ? 'Hover fraction' : 'Effect shape'} type="number" {...shapeLimits(selected.recipe.kind)} value={shapeValue(selected.recipe)} onChange={(event) => {
          const value = Number(event.currentTarget.value);
          if (!Number.isFinite(value)) return;
          const { min, max } = shapeLimits(selected.recipe.kind);
          update({ recipe: Object.freeze({ ...selected.recipe, [shapeField(selected.recipe.kind)!]: Math.max(min, Math.min(max, value)) }) });
        }}/></label>}
        {selected.recipe.kind === 'bumblebee' && <div className="light-effects__bee-palette" aria-label="Bumblebee Body and Wings colors">
          <p>Body <span style={{ background: apiLevel3ColorHex(selected.palette[0] ?? 0) }} aria-hidden="true" /> <button type="button" onClick={() => setBumblebeeColor(0)}>Set Body to current color</button></p>
          <p>Wings <span style={{ background: apiLevel3ColorHex(selected.palette[1] ?? selected.palette[0] ?? 0) }} aria-hidden="true" /> <button type="button" onClick={() => setBumblebeeColor(1)}>Set Wings to current color</button></p>
          <small>Current advanced color: {apiLevel3ColorHex(state.advancedColor).toUpperCase()}</small>
        </div>}
        <div className="light-effects__loop-status" aria-live="polite">
          <p>{selected.recipeVersion === 1 ? 'Original loop' : 'Seamless loop'}</p>
          {selected.recipeVersion === 1 && <>
            <p>Uses a {(Math.max(selected.periodMs, SPATIAL_PRESETS.find(({ kind }) => kind === selected.recipe.kind)?.periodMs ?? selected.periodMs) / 1000).toFixed(0)}-second loop; keeps your colors, shape, targets and light reserve.</p>
            <button type="button" onClick={() => { const upgraded = upgradeSpatialPreset(selected); dispatch({ type: 'update-effect-group', id: selected.id, changes: { recipeVersion: upgraded.recipeVersion, periodMs: upgraded.periodMs } }); }}>Use seamless loop</button>
          </>}
          {selected.recipeVersion === 2 && <p>Background colors may shift slightly to keep climb colors distinct on the board. Your saved palette stays unchanged.</p>}
        </div>
        <p>Selected targets: {selected.target.include.length}; exclusions: {selected.target.exclude.length}. Route roles are always protected.</p>
        <div className="effect-tools"><button type="button" aria-checked={state.tool.kind === 'spatial-include'} onClick={() => dispatch({ type:'set-tool', tool:{ kind:'spatial-include', effectGroupId:selected.id }})}>Paint targets</button><button type="button" aria-checked={state.tool.kind === 'spatial-exclude'} onClick={() => dispatch({ type:'set-tool', tool:{ kind:'spatial-exclude', effectGroupId:selected.id }})}>Paint exclusions</button></div>
      </>}
      <label>Cycle time<input aria-label="Effect cycle time" type="range" min="5000" max={LIGHT_EFFECT_PERIOD_MAX_MS} step="500" value={selected.periodMs} onChange={(event) => update({ periodMs:Number(event.target.value) })}/><output>{(selected.periodMs/1000).toFixed(1)}s</output></label>
      <label>Intensity<input aria-label="Effect intensity" type="range" min="0" max="100" value={Math.round(selected.intensity*100)} onChange={(event) => update({ intensity:Number(event.target.value)/100 })}/><output>{Math.round(selected.intensity*100)}%</output></label>
      <div className="light-effects__palette" aria-label="Effect palette">{selected.palette.map((color,index) => <button key={`${color}-${index}`} type="button" aria-label={`Remove color ${apiLevel3ColorHex(color).toUpperCase()}`} disabled={selected.palette.length===1} style={{background:apiLevel3ColorHex(color)}} onClick={() => update({palette:Object.freeze(selected.palette.filter((_,i)=>i!==index))})}/>)}<button type="button" disabled={selected.palette.length>=8||selected.palette.includes(state.advancedColor)} onClick={() => addColor(state.advancedColor)}>Add current color</button></div>
      {selected.model !== 'spatial' && <><p>{assignments.filter(({effectGroupId}) => effectGroupId === selected.id).length} {assignments.filter(({effectGroupId}) => effectGroupId === selected.id).length === 1 ? 'hold' : 'holds'} in this effect</p><div className="effect-tools" role="radiogroup" aria-label="Effect assignment tool"><button type="button" role="radio" aria-checked={state.tool.kind==='apply-effect'} onClick={() => dispatch({type:'set-tool',tool:{kind:'apply-effect',effectGroupId:selected.id}})}>Apply selected effect</button><button type="button" role="radio" aria-checked={state.tool.kind==='remove-effect'} onClick={() => dispatch({type:'set-tool',tool:{kind:'remove-effect'}})}>Remove effect</button></div></>}
      <div className="effect-tools"><button type="button" onClick={() => move(-1)}>Layer up</button><button type="button" onClick={() => move(1)}>Layer down</button></div>
      <button className="light-effects__delete" type="button" onClick={() => { const next=state.content.effectGroups.find(({id})=>id!==selected.id)?.id??null; dispatch({type:'remove-effect-group',id:selected.id}); onSelectedIdChange(next); }}>Delete effect group</button>
    </div> : <p className="light-effects__empty">Choose a preset or add a hold effect.</p>}
  </section>;
}
