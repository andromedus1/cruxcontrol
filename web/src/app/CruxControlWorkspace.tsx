import { useCallback, useEffect, useState } from 'react';
import { LocalClimbViewer } from '../climb-browser/LocalClimbViewer';
import type { ClimbViewKey } from '../climb-browser/types';
import { toClimbViewRecord } from '../drafts/to-climb-view-record';
import type { LocalClimbDraft, LocalDraftId } from '../drafts/types';
import { RouteEditorWorkspace } from '../route-editor/RouteEditorWorkspace';
import type { CruxControlRuntime } from './create-runtime';

function draftCompatibilityIssue(
  draft: LocalClimbDraft,
  runtime: CruxControlRuntime,
): string | null {
  const { definition } = runtime.installation;
  if (draft.definitionId !== definition.id) return 'uses a different board definition';
  if (draft.layoutRevision !== definition.layoutRevision) return 'uses a different layout revision';
  if (!definition.supportedAngles.includes(draft.angle)) return `uses unsupported angle ${draft.angle}°`;
  const placementIds = new Set(definition.placements.map(({ id }) => id));
  const unknown = draft.assignments.find(({ placementId }) => !placementIds.has(placementId));
  return unknown ? `references unavailable hold ${unknown.placementId}` : null;
}

export function CruxControlWorkspace({ runtime }: { readonly runtime: CruxControlRuntime }) {
  const [drafts, setDrafts] = useState<readonly LocalClimbDraft[]>([]);
  const [editing, setEditing] = useState<LocalDraftId | null>(null);
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setDrafts(await runtime.drafts.list({ installationId: runtime.installation.config.id }));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load drafts.');
    }
  }, [runtime]);
  useEffect(() => { void refresh(); }, [refresh]);
  const compatibility = drafts.map((draft) => ({ draft, issue: draftCompatibilityIssue(draft, runtime) }));
  const compatibleDrafts = compatibility.filter(({ issue }) => issue === null).map(({ draft }) => draft);
  const incompatibleDrafts = compatibility.filter((entry): entry is { draft: LocalClimbDraft; issue: string } => entry.issue !== null);
  const active = editing ? compatibleDrafts.find(({ id }) => id === editing) : undefined;
  const adoptDraftIdentity = useCallback((draft: LocalClimbDraft) => {
    setDrafts((values) => {
      const currentIndex = values.findIndex(({ id }) => id === editing);
      const duplicateIndex = values.findIndex(({ id }) => id === draft.id);
      if (currentIndex >= 0 && values[currentIndex] === draft && editing === draft.id) return values;
      const next = values.filter((_, index) => index !== currentIndex && index !== duplicateIndex);
      next.splice(currentIndex >= 0 ? currentIndex : 0, 0, draft);
      return Object.freeze(next);
    });
    setEditing(draft.id);
  }, [editing]);
  const create = async () => {
    try {
      const draft = await runtime.drafts.create({ installationId: runtime.installation.config.id, definitionId: runtime.installation.definition.id, layoutRevision: runtime.installation.definition.layoutRevision, name: '', angle: runtime.installation.config.angle, assignments: Object.freeze([]), metadata: Object.freeze({}) });
      setError('');
      setDrafts((values) => Object.freeze([draft, ...values])); setEditing(draft.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create a draft.'); }
  };
  if (active) return <RouteEditorWorkspace definition={runtime.installation.definition} draft={active} repository={runtime.drafts} controller={runtime.controller} onBack={() => { setEditing(null); void refresh(); }} onDraftIdentityChange={adoptDraftIdentity} />;
  return <>
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => void refresh()}>Retry loading drafts</button></div>}
    {incompatibleDrafts.length > 0 && <section role="alert" aria-label="Draft recovery needed">
      <p>{incompatibleDrafts.length} local {incompatibleDrafts.length === 1 ? 'draft needs' : 'drafts need'} recovery before {incompatibleDrafts.length === 1 ? 'it can' : 'they can'} open on this board. The stored {incompatibleDrafts.length === 1 ? 'draft is' : 'drafts are'} unchanged.</p>
      <ul>{incompatibleDrafts.map(({ draft, issue }) => <li key={draft.id}>{draft.name.trim() || 'Untitled draft'}: {issue}.</li>)}</ul>
    </section>}
    <LocalClimbViewer definition={runtime.installation.definition} climbs={compatibleDrafts.map(toClimbViewRecord)} selectedKey={selectedKey} onSelectedKeyChange={setSelectedKey} controller={runtime.controller} onCreateClimb={() => void create()} onEditClimb={(key) => { const draft = compatibleDrafts.find((value) => toClimbViewRecord(value).key === key); if (draft) setEditing(draft.id); }} />
  </>;
}
