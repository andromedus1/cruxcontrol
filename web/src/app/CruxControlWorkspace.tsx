import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocalClimbViewer } from '../climb-browser/LocalClimbViewer';
import type { ClimbViewKey } from '../climb-browser/types';
import { toClimbViewRecord } from '../drafts/to-climb-view-record';
import type { DraftContent, LocalClimbDraft, LocalDraftId } from '../drafts/types';
import { RouteEditorWorkspace } from '../route-editor/RouteEditorWorkspace';
import type { CruxControlRuntime } from './create-runtime';
import './CruxControlWorkspace.css';

export type LocalClimbCollection = 'finished' | 'drafts' | 'trash';

const collectionCopy: Record<
  LocalClimbCollection,
  { readonly label: string; readonly emptyTitle: string; readonly emptyDescription: string }
> = {
  finished: {
    label: 'My Climbs',
    emptyTitle: 'No finished climbs yet',
    emptyDescription: 'Mark a draft finished when it is ready for your main climb library.',
  },
  drafts: {
    label: 'Drafts',
    emptyTitle: 'No drafts yet',
    emptyDescription: 'Create a climb to experiment with holds, colors, and light effects.',
  },
  trash: {
    label: 'Trash',
    emptyTitle: 'Trash is empty',
    emptyDescription: 'Deleted climbs stay recoverable here for 30 days.',
  },
};

function draftCompatibilityIssue(
  draft: LocalClimbDraft,
  runtime: CruxControlRuntime,
): string | null {
  const { definition } = runtime.installation;
  if (draft.definitionId !== definition.id) return 'uses a different board definition';
  if (draft.layoutRevision !== definition.layoutRevision) return 'uses a different layout revision';
  if (!definition.supportedAngles.includes(draft.angle))
    return `uses unsupported angle ${draft.angle}°`;
  const placementIds = new Set(definition.placements.map(({ id }) => id));
  const unknown = draft.assignments.find(({ placementId }) => !placementIds.has(placementId));
  return unknown ? `references unavailable hold ${unknown.placementId}` : null;
}

function contentOf(draft: LocalClimbDraft, status = draft.status): DraftContent {
  return {
    status,
    installationId: draft.installationId,
    definitionId: draft.definitionId,
    layoutRevision: draft.layoutRevision,
    name: draft.name,
    angle: draft.angle,
    assignments: draft.assignments,
    effectGroups: draft.effectGroups,
    metadata: draft.metadata,
  };
}

function belongsTo(draft: LocalClimbDraft, collection: LocalClimbCollection): boolean {
  if (collection === 'trash') return draft.trashedAt !== undefined;
  return (
    draft.trashedAt === undefined &&
    draft.status === (collection === 'drafts' ? 'draft' : 'finished')
  );
}

function climbName(draft: LocalClimbDraft): string {
  return draft.name.trim() || 'Untitled climb';
}

interface RetryAction {
  readonly label: string;
  readonly run: () => void;
}

export function CruxControlWorkspace({ runtime }: { readonly runtime: CruxControlRuntime }) {
  const [drafts, setDrafts] = useState<readonly LocalClimbDraft[]>([]);
  const [collection, setCollection] = useState<LocalClimbCollection>('finished');
  const [editing, setEditing] = useState<LocalDraftId | null>(null);
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  const [error, setError] = useState('');
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);

  const refresh = useCallback(async () => {
    let cleanupError = '';
    try {
      await runtime.drafts.purgeExpiredTrash();
    } catch (cause) {
      cleanupError =
        cause instanceof Error ? cause.message : 'Could not remove expired Trash climbs.';
    }
    try {
      const [active, trash] = await Promise.all([
        runtime.drafts.list({
          installationId: runtime.installation.config.id,
          collection: 'active',
        }),
        runtime.drafts.list({
          installationId: runtime.installation.config.id,
          collection: 'trash',
        }),
      ]);
      setDrafts(Object.freeze([...active, ...trash]));
      setError(cleanupError);
      setRetryAction(
        cleanupError ? { label: 'Retry refreshing climbs', run: () => void refresh() } : null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load local climbs.');
      setRetryAction({ label: 'Retry refreshing climbs', run: () => void refresh() });
    }
  }, [runtime]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const replaceDraft = useCallback((draft: LocalClimbDraft) => {
    setDrafts((values) =>
      Object.freeze([draft, ...values.filter((candidate) => candidate.id !== draft.id)]),
    );
  }, []);

  const removeDraft = useCallback((id: LocalDraftId) => {
    setDrafts((values) => Object.freeze(values.filter((candidate) => candidate.id !== id)));
  }, []);

  async function retryable(label: string, action: () => Promise<void>) {
    try {
      await action();
      setError('');
      setRetryAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${label.toLowerCase()}.`);
      setSelectedKey(null);
      setRetryAction({
        label: `Retry ${label.toLowerCase()}`,
        run: () => void retryable(label, action),
      });
    }
  }

  const create = async () => {
    await retryable('create climb', async () => {
      const draft = await runtime.drafts.create({
        status: 'draft',
        installationId: runtime.installation.config.id,
        definitionId: runtime.installation.definition.id,
        layoutRevision: runtime.installation.definition.layoutRevision,
        name: '',
        angle: runtime.installation.config.angle,
        assignments: Object.freeze([]),
        effectGroups: Object.freeze([]),
        metadata: Object.freeze({}),
      });
      replaceDraft(draft);
      setCollection('drafts');
      setEditing(draft.id);
    });
  };

  function changeStatus(draft: LocalClimbDraft, status: DraftContent['status']) {
    return retryable(status === 'finished' ? 'mark finished' : 'move to Drafts', async () => {
      const updated = await runtime.drafts.update(
        draft.id,
        draft.revision,
        contentOf(draft, status),
      );
      replaceDraft(updated);
      setSelectedKey(null);
    });
  }

  function moveToTrash(draft: LocalClimbDraft) {
    if (!window.confirm(`Move “${climbName(draft)}” to Trash? You can restore it for 30 days.`)) {
      return Promise.resolve();
    }
    return retryable('move to Trash', async () => {
      replaceDraft(await runtime.drafts.trash(draft.id, draft.revision));
      setSelectedKey(null);
    });
  }

  function restore(draft: LocalClimbDraft) {
    return retryable('restore climb', async () => {
      replaceDraft(await runtime.drafts.restore(draft.id, draft.revision));
      setSelectedKey(null);
    });
  }

  function deleteForever(draft: LocalClimbDraft) {
    if (!window.confirm(`Delete “${climbName(draft)}” forever? This cannot be undone.`)) {
      return Promise.resolve();
    }
    return retryable('delete forever', async () => {
      await runtime.drafts.deletePermanently(draft.id, draft.revision);
      removeDraft(draft.id);
      setSelectedKey(null);
    });
  }

  const visibleDrafts = useMemo(
    () => drafts.filter((draft) => belongsTo(draft, collection)),
    [collection, drafts],
  );
  const compatibility = visibleDrafts.map((draft) => ({
    draft,
    issue: draftCompatibilityIssue(draft, runtime),
  }));
  const compatibleDrafts = compatibility
    .filter(({ issue }) => issue === null)
    .map(({ draft }) => draft);
  const incompatibleDrafts = compatibility.filter(
    (entry): entry is { draft: LocalClimbDraft; issue: string } => entry.issue !== null,
  );
  const active = editing
    ? drafts.find(({ id, trashedAt }) => id === editing && trashedAt === undefined)
    : undefined;
  const counts = {
    finished: drafts.filter((draft) => belongsTo(draft, 'finished')).length,
    drafts: drafts.filter((draft) => belongsTo(draft, 'drafts')).length,
    trash: drafts.filter((draft) => belongsTo(draft, 'trash')).length,
  };
  const selectedDraft = compatibleDrafts.find(
    (draft) => toClimbViewRecord(draft).key === selectedKey,
  );
  const copy = collectionCopy[collection];

  const adoptDraftIdentity = useCallback(
    (draft: LocalClimbDraft) => {
      replaceDraft(draft);
      setCollection(draft.status === 'draft' ? 'drafts' : 'finished');
      setEditing(draft.id);
    },
    [replaceDraft],
  );

  if (active) {
    return (
      <RouteEditorWorkspace
        definition={runtime.installation.definition}
        draft={active}
        repository={runtime.drafts}
        controller={runtime.controller}
        onBack={() => {
          setEditing(null);
          void refresh();
        }}
        onDraftIdentityChange={adoptDraftIdentity}
      />
    );
  }

  return (
    <main className="climb-workspace">
      <nav className="collection-switch" aria-label="Local climb collections">
        {(Object.keys(collectionCopy) as LocalClimbCollection[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={collection === value}
            onClick={() => {
              setCollection(value);
              setSelectedKey(null);
            }}
          >
            <span>{collectionCopy[value].label}</span>
            <span className="collection-switch__count" aria-label={`${counts[value]} climbs`}>
              {counts[value]}
            </span>
          </button>
        ))}
      </nav>
      {error && (
        <div className="workspace-error" role="alert">
          <p>{error}</p>
          {retryAction && (
            <button type="button" onClick={retryAction.run}>
              {retryAction.label}
            </button>
          )}
          <button type="button" onClick={() => void refresh()}>
            Refresh climbs
          </button>
        </div>
      )}
      {incompatibleDrafts.length > 0 && (
        <section className="incompatible-climbs" role="alert" aria-label="Climb recovery needed">
          <h2>Recovery needed</h2>
          <p>These local climbs cannot open on this board. Their stored content is unchanged.</p>
          <ul>
            {incompatibleDrafts.map(({ draft, issue }) => (
              <li key={draft.id}>
                <div>
                  <strong>{climbName(draft)}</strong>
                  <span>{issue}.</span>
                </div>
                <div className="incompatible-climbs__actions">
                  {collection === 'trash' ? (
                    <>
                      <button type="button" onClick={() => void restore(draft)}>
                        Restore {climbName(draft)}
                      </button>
                      <button type="button" onClick={() => void deleteForever(draft)}>
                        Delete {climbName(draft)} forever
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void moveToTrash(draft)}>
                      Move {climbName(draft)} to Trash
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <LocalClimbViewer
        definition={runtime.installation.definition}
        climbs={compatibleDrafts.map(toClimbViewRecord)}
        selectedKey={selectedKey}
        onSelectedKeyChange={setSelectedKey}
        controller={runtime.controller}
        heading={copy.label}
        emptyTitle={copy.emptyTitle}
        emptyDescription={copy.emptyDescription}
        onCreateClimb={collection === 'trash' ? undefined : () => void create()}
        onEditClimb={
          collection === 'trash'
            ? undefined
            : (key) => {
                const draft = compatibleDrafts.find(
                  (value) => toClimbViewRecord(value).key === key,
                );
                if (draft) setEditing(draft.id);
              }
        }
        primaryAction={
          selectedDraft
            ? collection === 'drafts'
              ? {
                  label: 'Mark finished',
                  onActivate: () => void changeStatus(selectedDraft, 'finished'),
                }
              : collection === 'finished'
                ? {
                    label: 'Move to drafts',
                    onActivate: () => void changeStatus(selectedDraft, 'draft'),
                  }
                : { label: 'Restore', onActivate: () => void restore(selectedDraft) }
            : undefined
        }
        destructiveAction={
          selectedDraft
            ? collection === 'trash'
              ? { label: 'Delete forever', onActivate: () => void deleteForever(selectedDraft) }
              : { label: 'Move to trash', onActivate: () => void moveToTrash(selectedDraft) }
            : undefined
        }
      />
    </main>
  );
}
