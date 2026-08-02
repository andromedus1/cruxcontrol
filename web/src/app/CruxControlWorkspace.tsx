import { useCallback, useEffect, useState } from 'react';
import { LocalClimbViewer } from '../climb-browser/LocalClimbViewer';
import type { ClimbViewKey } from '../climb-browser/types';
import { toClimbViewRecord } from '../drafts/to-climb-view-record';
import type { LocalClimbDraft, LocalDraftId } from '../drafts/types';
import { RouteEditorWorkspace } from '../route-editor/RouteEditorWorkspace';
import type { CruxControlRuntime } from './create-runtime';

export function CruxControlWorkspace({ runtime }: { readonly runtime: CruxControlRuntime }) {
  const [drafts, setDrafts] = useState<readonly LocalClimbDraft[]>([]);
  const [editing, setEditing] = useState<LocalDraftId | null>(null);
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(() => runtime.drafts.list({ installationId: runtime.installation.config.id }).then(setDrafts).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load drafts.')), [runtime]);
  useEffect(() => { void refresh(); }, [refresh]);
  const active = editing ? drafts.find(({ id }) => id === editing) : undefined;
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
      setDrafts((values) => Object.freeze([draft, ...values])); setEditing(draft.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create a draft.'); }
  };
  if (active) return <RouteEditorWorkspace definition={runtime.installation.definition} draft={active} repository={runtime.drafts} controller={runtime.controller} onBack={() => { setEditing(null); void refresh(); }} onDraftIdentityChange={adoptDraftIdentity} />;
  return <>{error && <div role="alert">{error}</div>}<LocalClimbViewer definition={runtime.installation.definition} climbs={drafts.map(toClimbViewRecord)} selectedKey={selectedKey} onSelectedKeyChange={setSelectedKey} controller={runtime.controller} onCreateClimb={() => void create()} onEditClimb={(key) => { const draft = drafts.find((value) => toClimbViewRecord(value).key === key); if (draft) setEditing(draft.id); }} /></>;
}
