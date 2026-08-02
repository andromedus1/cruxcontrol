import { apiLevel3Color } from '../domain/boards/colors';
import type { BoardDefinition, ClimbRole } from '../domain/boards/definition';
import { ApiLevel3ColorControl } from './ApiLevel3ColorControl';
import type { EditorTool } from './types';

const roles: readonly ClimbRole[] = ['start', 'middle', 'finish', 'foot-only'];

export function RouteEditorToolbar({ tool, definition, onToolChange }: { readonly tool: EditorTool; readonly definition: BoardDefinition; readonly onToolChange: (tool: EditorTool) => void }) {
  const custom = tool.kind === 'custom' ? tool.color : apiLevel3Color(0b001_100_10);
  return <section className="editor-tools" aria-labelledby="tools-heading">
    <h2 id="tools-heading">Hold tool</h2>
    <div className="tool-grid" role="radiogroup" aria-label="Assignment tool">
      <button type="button" role="radio" aria-checked={tool.kind === 'cycle'} onClick={() => onToolChange({ kind: 'cycle' })}>Cycle</button>
      {roles.map((role) => <button type="button" role="radio" aria-checked={tool.kind === 'role' && tool.role === role} key={role} onClick={() => onToolChange({ kind: 'role', role })}><span className={`tool-shape tool-shape--${role}`} style={{ background: definition.rolePresets[role].screenColor }} />{definition.rolePresets[role].label}</button>)}
      <button type="button" role="radio" aria-checked={tool.kind === 'erase'} onClick={() => onToolChange({ kind: 'erase' })}>Erase</button>
      <button type="button" role="radio" aria-checked={tool.kind === 'custom'} onClick={() => onToolChange({ kind: 'custom', color: custom })}><span className="tool-shape tool-shape--custom" style={{ background: tool.kind === 'custom' ? `rgb(${((tool.color >> 5) & 7) * 36},${((tool.color >> 2) & 7) * 36},${(tool.color & 3) * 85})` : undefined }} />Advanced Light</button>
    </div>
    {tool.kind === 'custom' && <ApiLevel3ColorControl value={tool.color} onChange={(color) => onToolChange({ kind: 'custom', color })} />}
  </section>;
}
