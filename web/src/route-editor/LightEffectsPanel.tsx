import type { Dispatch } from 'react';
import {
  lightEffectGroupId,
  type BoardHoldAssignment,
  type LightEffectGroupId,
  type LightEffectKind,
} from '../board-renderer/types';
import { apiLevel3ColorHex } from '../domain/boards/colors';
import type { ApiLevel3Color } from '../domain/boards/types';
import type { RouteEditorAction, RouteEditorState } from './types';

const EFFECT_LABELS: Readonly<Record<LightEffectKind, string>> = {
  pulse: 'Pulse',
  'color-cycle': 'Color cycle',
  wave: 'Wave',
  twinkle: 'Twinkle',
  alternate: 'Alternating pulse',
};

function createGroupId(): LightEffectGroupId {
  return lightEffectGroupId(`effect-${crypto.randomUUID()}`);
}

export function LightEffectsPanel({
  state,
  assignments,
  selectedId,
  onSelectedIdChange,
  dispatch,
}: {
  readonly state: RouteEditorState;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly selectedId: LightEffectGroupId | null;
  readonly onSelectedIdChange: (id: LightEffectGroupId | null) => void;
  readonly dispatch: Dispatch<RouteEditorAction>;
}) {
  const selected = state.content.effectGroups.find(({ id }) => id === selectedId) ?? null;
  const update = (
    changes: Extract<RouteEditorAction, { type: 'update-effect-group' }>['changes'],
  ) => {
    if (selected) dispatch({ type: 'update-effect-group', id: selected.id, changes });
  };
  const addColor = (color: ApiLevel3Color) => {
    if (!selected || selected.palette.includes(color) || selected.palette.length >= 8) return;
    update({ palette: Object.freeze([...selected.palette, color]) });
  };
  const assignedCount = selected
    ? assignments.filter(({ effectGroupId }) => effectGroupId === selected.id).length
    : 0;

  return (
    <section className="light-effects" aria-labelledby="effects-heading">
      <div className="light-effects__heading">
        <div>
          <h2 id="effects-heading">Effects</h2>
          <p>Animate any assigned holds. Base climb colors stay intact.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const id = createGroupId();
            dispatch({
              type: 'add-effect-group',
              group: {
                id,
                kind: 'pulse',
                palette: Object.freeze([state.advancedColor]),
                periodMs: 1800,
                intensity: 0.75,
              },
            });
            onSelectedIdChange(id);
          }}
        >
          Add effect
        </button>
      </div>
      {selected ? (
        <div className="light-effects__editor">
          <label>
            Effect group
            <select
              aria-label="Effect group"
              value={selected.id}
              onChange={(event) => onSelectedIdChange(lightEffectGroupId(event.target.value))}
            >
              {state.content.effectGroups.map((group, index) => (
                <option key={group.id} value={group.id}>
                  {index + 1}. {EFFECT_LABELS[group.kind]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Effect kind
            <select
              aria-label="Effect kind"
              value={selected.kind}
              onChange={(event) => update({ kind: event.target.value as LightEffectKind })}
            >
              {Object.entries(EFFECT_LABELS).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Speed
            <input
              aria-label="Effect speed"
              type="range"
              min="250"
              max="10000"
              step="50"
              value={selected.periodMs}
              onChange={(event) => update({ periodMs: Number(event.target.value) })}
            />
            <output>{(selected.periodMs / 1000).toFixed(2)}s</output>
          </label>
          <label>
            Intensity
            <input
              aria-label="Effect intensity"
              type="range"
              min="0"
              max="100"
              value={Math.round(selected.intensity * 100)}
              onChange={(event) => update({ intensity: Number(event.target.value) / 100 })}
            />
            <output>{Math.round(selected.intensity * 100)}%</output>
          </label>
          <div className="light-effects__palette" aria-label="Effect palette">
            {selected.palette.map((color, index) => (
              <button
                key={`${color}-${index}`}
                type="button"
                aria-label={`Remove color ${apiLevel3ColorHex(color).toUpperCase()}`}
                title="Remove color"
                disabled={selected.palette.length === 1}
                style={{ background: apiLevel3ColorHex(color) }}
                onClick={() =>
                  update({
                    palette: Object.freeze(
                      selected.palette.filter((_, colorIndex) => colorIndex !== index),
                    ),
                  })
                }
              />
            ))}
            <button
              type="button"
              disabled={
                selected.palette.length >= 8 || selected.palette.includes(state.advancedColor)
              }
              onClick={() => addColor(state.advancedColor)}
            >
              Add current color
            </button>
          </div>
          <p>
            {assignedCount} {assignedCount === 1 ? 'hold' : 'holds'} in this effect
          </p>
          <div className="effect-tools" role="radiogroup" aria-label="Effect assignment tool">
            <button
              type="button"
              role="radio"
              aria-checked={
                state.tool.kind === 'apply-effect' && state.tool.effectGroupId === selected.id
              }
              onClick={() =>
                dispatch({
                  type: 'set-tool',
                  tool: { kind: 'apply-effect', effectGroupId: selected.id },
                })
              }
            >
              Apply selected effect
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={state.tool.kind === 'remove-effect'}
              onClick={() => dispatch({ type: 'set-tool', tool: { kind: 'remove-effect' } })}
            >
              Remove effect
            </button>
          </div>
          <button
            className="light-effects__delete"
            type="button"
            onClick={() => {
              const next =
                state.content.effectGroups.find(({ id }) => id !== selected.id)?.id ?? null;
              dispatch({ type: 'remove-effect-group', id: selected.id });
              onSelectedIdChange(next);
            }}
          >
            Delete effect group
          </button>
        </div>
      ) : (
        <p className="light-effects__empty">
          Add an effect group, tune it, then paint it onto assigned holds.
        </p>
      )}
    </section>
  );
}
