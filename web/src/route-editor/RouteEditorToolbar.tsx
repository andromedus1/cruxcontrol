import type { ApiLevel3Color } from '../domain/boards/types';
import { ApiLevel3ColorControl } from './ApiLevel3ColorControl';
import type { EditorTool } from './types';

export function RouteEditorToolbar({
  tool,
  advancedColor,
  onToolChange,
}: {
  readonly tool: EditorTool;
  readonly advancedColor: ApiLevel3Color;
  readonly onToolChange: (tool: EditorTool) => void;
}) {
  const custom = tool.kind === 'custom' ? tool.color : advancedColor;
  return (
    <section className="editor-tools" aria-labelledby="tools-heading">
      <h2 id="tools-heading">Hold tool</h2>
      <div className="tool-grid" role="radiogroup" aria-label="Assignment tool">
        <button
          type="button"
          role="radio"
          aria-checked={tool.kind === 'cycle'}
          onClick={() => onToolChange({ kind: 'cycle' })}
        >
          Cycle
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tool.kind === 'erase'}
          onClick={() => onToolChange({ kind: 'erase' })}
        >
          Erase
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tool.kind === 'eyedropper'}
          onClick={() => onToolChange({ kind: 'eyedropper' })}
        >
          <span className="tool-shape tool-shape--eyedropper" />
          Eyedropper
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tool.kind === 'custom'}
          onClick={() => onToolChange({ kind: 'custom', color: custom })}
        >
          <span
            className="tool-shape tool-shape--custom"
            style={{
              background:
                tool.kind === 'custom'
                  ? `rgb(${((tool.color >> 5) & 7) * 36},${((tool.color >> 2) & 7) * 36},${(tool.color & 3) * 85})`
                  : undefined,
            }}
          />
          Advanced Light
        </button>
      </div>
      {tool.kind === 'custom' && (
        <ApiLevel3ColorControl
          value={tool.color}
          onChange={(color) => onToolChange({ kind: 'custom', color })}
        />
      )}
    </section>
  );
}
