import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocalClimbViewer } from '../climb-browser/LocalClimbViewer';
import type { ClimbViewKey } from '../climb-browser/types';
import { toClimbViewRecord } from '../drafts/to-climb-view-record';
import type { DraftContent, LocalClimbDraft, LocalDraftId } from '../drafts/types';
import type { DraftReadIssue } from '../drafts/repository';
import { PlaylistLibrary, type PlaylistEditReturn } from '../playlists/PlaylistLibrary';
import { PlaylistMembershipDialog } from '../playlists/PlaylistMembershipDialog';
import type { LocalPlaylist } from '../playlists/types';
import { RouteEditorWorkspace } from '../route-editor/RouteEditorWorkspace';
import { KilterScreenshotImportDialog } from '../screenshot-import/KilterScreenshotImportDialog';
import { LibraryBackupDialog } from '../library-backup';
import type { CruxControlRuntime } from './create-runtime';
import { AppUpdateControl } from '../pwa/AppUpdateControl.tsx';
import type { AppUpdateService, AppUpdateSnapshot } from '../pwa/update-service.ts';
import type { BoardLightState } from '../board-control/light-controller.ts';
import { BoardControlBar } from '../climb-browser/BoardControlBar';
import { ScreenAwakeControl } from '../pwa/ScreenAwakeControl';
import './CruxControlWorkspace.css';

export type LocalClimbCollection = 'finished' | 'drafts' | 'trash';
export type WorkspaceDestination = LocalClimbCollection | 'lists';

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
    emptyDescription: 'Climbs stay in Trash until you delete them forever.',
  },
};

const destinations: readonly WorkspaceDestination[] = ['finished', 'drafts', 'trash', 'lists'];

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

export interface PlaylistSafetyState {
  readonly dirty: boolean;
  readonly playing: boolean;
  readonly modalOpen: boolean;
  readonly pendingOperations: number;
}

const CLEAR_PLAYLIST_SAFETY: PlaylistSafetyState = Object.freeze({
  dirty: false,
  playing: false,
  modalOpen: false,
  pendingOperations: 0,
});

export interface CruxControlWorkspaceProps {
  readonly runtime: CruxControlRuntime;
  readonly updateService?: AppUpdateService;
}

export function CruxControlWorkspace({ runtime, updateService }: CruxControlWorkspaceProps) {
  const [drafts, setDrafts] = useState<readonly LocalClimbDraft[]>([]);
  const [playlists, setPlaylists] = useState<readonly LocalPlaylist[]>([]);
  const [readIssues, setReadIssues] = useState<readonly DraftReadIssue[]>([]);
  const [playlistError, setPlaylistError] = useState('');
  const [collection, setCollection] = useState<WorkspaceDestination>(() =>
    globalThis.location?.hash.startsWith('#playlist=') ? 'lists' : 'finished',
  );
  const [editing, setEditing] = useState<LocalDraftId | null>(null);
  const [playlistEditReturn, setPlaylistEditReturn] = useState<PlaylistEditReturn | null>(null);
  const [selectedKey, setSelectedKey] = useState<ClimbViewKey | null>(null);
  const [membershipDraft, setMembershipDraft] = useState<LocalClimbDraft | null>(null);
  const [importingScreenshots, setImportingScreenshots] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const backupButtonRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);
  const [playlistSafety, setPlaylistSafety] = useState<PlaylistSafetyState>(CLEAR_PLAYLIST_SAFETY);
  const [controllerState, setControllerState] = useState<BoardLightState | null>(() => runtime.controller?.getState() ?? null);
  const operationCount = useRef(0);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [updateSnapshot, setUpdateSnapshot] = useState<AppUpdateSnapshot | null>(() => updateService?.getSnapshot() ?? null);
  const updateBlocksWorkspace = updateSnapshot?.status === 'applying' || updateSnapshot?.status === 'reload-required';

  useEffect(() => {
    const controller = runtime.controller;
    if (!controller) {
      setControllerState(null);
      return;
    }
    setControllerState(controller.getState());
    return controller.subscribe(setControllerState);
  }, [runtime.controller]);

  useEffect(() => {
    if (!updateService) {
      setUpdateSnapshot(null);
      return;
    }
    return updateService.subscribe(setUpdateSnapshot);
  }, [updateService]);

  const beginOperation = useCallback(() => {
    operationCount.current += 1;
    setPendingOperations(operationCount.current);
  }, []);
  const endOperation = useCallback(() => {
    operationCount.current = Math.max(0, operationCount.current - 1);
    setPendingOperations(operationCount.current);
  }, []);

  const refreshPlaylists = useCallback(async (throwOnError = true) => {
    try {
      setPlaylists(await runtime.playlists.list());
      setPlaylistError('');
    } catch (cause) {
      setPlaylistError(cause instanceof Error ? cause.message : 'Could not load your lists.');
      if (throwOnError) throw cause;
    }
  }, [runtime]);

  const refreshClimbs = useCallback(async () => {
    try {
      const issues = new Map<string, DraftReadIssue>();
      const onUnreadableRecord = (issue: DraftReadIssue) => { issues.set(issue.key, issue); };
      const [active, trash] = await Promise.all([
        runtime.drafts.list({ collection: 'active', onUnreadableRecord }),
        runtime.drafts.list({ collection: 'trash', onUnreadableRecord }),
      ]);
      setDrafts(Object.freeze([...active, ...trash]));
      setReadIssues([...issues.values()]);
      setError('');
      setRetryAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the local workspace.');
      setRetryAction({ label: 'Retry refreshing climbs', run: () => { void refreshClimbs().catch(() => undefined); } });
      throw cause;
    }
  }, [runtime]);

  const refresh = useCallback(async (throwOnError = false) => {
    const results = await Promise.allSettled([refreshClimbs(), refreshPlaylists()]);
    const failed = results.find((result) => result.status === 'rejected');
    if (throwOnError && failed?.status === 'rejected') throw failed.reason;
  }, [refreshClimbs, refreshPlaylists]);

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

  const replacePlaylist = useCallback((playlist: LocalPlaylist) => {
    setPlaylists((values) =>
      Object.freeze([playlist, ...values.filter((candidate) => candidate.id !== playlist.id)]),
    );
  }, []);

  async function retryable(label: string, action: () => Promise<void>) {
    beginOperation();
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
    } finally {
      endOperation();
    }
  }

  const boardBlockReason = (() => {
    const transport = controllerState?.transport.status;
    if (transport === 'selecting' || transport === 'connecting') {
      return 'Finish connecting to the board before updating.';
    }
    if (transport === 'connected' || transport === 'disconnecting') {
      return 'Disconnect the board when your session is finished before updating.';
    }
    if (controllerState && controllerState.operation !== 'idle') {
      return 'Finish the board operation before updating.';
    }
    return null;
  })();
  const workspaceBlockReason = editing
    ? 'Finish saving your climb and return to the library before updating.'
    : backingUp
      ? 'Wait for your backup or restore to finish before updating.'
      : importingScreenshots
        ? 'Finish importing screenshots before updating.'
        : membershipDraft
          ? 'Finish updating list memberships before updating.'
          : pendingOperations > 0 || playlistSafety.pendingOperations > 0
            ? 'Wait for the current library change to finish before updating.'
            : playlistSafety.dirty
              ? 'Save your list changes before updating.'
              : playlistSafety.playing
                ? 'Finish the list play-through before updating.'
                : playlistSafety.modalOpen
                  ? 'Finish the open list task before updating.'
                  : boardBlockReason;

  useEffect(() => {
    updateService?.setBlocked(workspaceBlockReason);
  }, [updateService, workspaceBlockReason]);
  useEffect(() => () => updateService?.setBlocked(null), [updateService]);

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
    if (!window.confirm(`Move “${climbName(draft)}” to Trash? You can restore it until you delete it forever.`)) {
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

  const currentInstallationId = runtime.installation.config.id;
  const visibleDrafts = useMemo(
    () =>
      collection === 'lists'
        ? []
        : drafts.filter(
            (draft) =>
              draft.installationId === currentInstallationId && belongsTo(draft, collection),
          ),
    [collection, currentInstallationId, drafts],
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
    finished: drafts.filter(
      (draft) => draft.installationId === currentInstallationId && belongsTo(draft, 'finished'),
    ).length,
    drafts: drafts.filter(
      (draft) => draft.installationId === currentInstallationId && belongsTo(draft, 'drafts'),
    ).length,
    trash: drafts.filter(
      (draft) => draft.installationId === currentInstallationId && belongsTo(draft, 'trash'),
    ).length,
    lists: playlists.length,
  };
  const selectedDraft = compatibleDrafts.find(
    (draft) => toClimbViewRecord(draft).key === selectedKey,
  );
  const copy = collection === 'lists' ? null : collectionCopy[collection];

  const adoptDraftIdentity = useCallback(
    (draft: LocalClimbDraft) => {
      replaceDraft(draft);
      setCollection((current) => current === 'lists' ? current : draft.status === 'draft' ? 'drafts' : 'finished');
      setEditing(draft.id);
    },
    [replaceDraft],
  );

  const sessionControls = (
    <header className="workspace-session-controls" inert={updateBlocksWorkspace || undefined}>
      <ScreenAwakeControl />
      <BoardControlBar controller={runtime.controller} />
    </header>
  );

  if (active) {
    return (
      <>
        {sessionControls}
        {updateService && (
          <AppUpdateControl
            service={updateService}
            boardConnected={controllerState?.transport.status === 'connected'}
            onDisconnectBoard={() => runtime.controller?.disconnect()}
            onRetry={() => void updateService.retry?.()}
          />
        )}
        <div inert={updateBlocksWorkspace || undefined}>
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
        </div>
      </>
    );
  }

  return (
    <>
      {sessionControls}
      {updateService && (
        <AppUpdateControl
          service={updateService}
          boardConnected={controllerState?.transport.status === 'connected'}
          onDisconnectBoard={() => runtime.controller?.disconnect()}
          onRetry={() => void updateService.retry?.()}
        />
      )}
      <main
        className="climb-workspace"
        inert={updateBlocksWorkspace || undefined}
        aria-busy={updateBlocksWorkspace || undefined}
      >
      <nav className="collection-switch" aria-label="Workspace destinations">
        {destinations.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={collection === value}
            onClick={() => {
              setCollection(value);
              setPlaylistEditReturn(null);
              setSelectedKey(null);
              setMembershipDraft(null);
            }}
          >
            <span>{value === 'lists' ? 'Lists' : collectionCopy[value].label}</span>
            <span
              className="collection-switch__count"
              aria-label={`${counts[value]} ${
                value === 'lists'
                  ? counts[value] === 1
                    ? 'list'
                    : 'lists'
                  : counts[value] === 1
                    ? 'climb'
                    : 'climbs'
              }`}
            >
              {counts[value]}
            </span>
          </button>
        ))}
      </nav>
      {runtime.backup && (
        <div className="workspace-library-actions">
          <button ref={backupButtonRef} className="button button--secondary" type="button" onClick={() => setBackingUp(true)}>
            Back up &amp; restore
          </button>
        </div>
      )}
      {error && (
        <div className="workspace-error" role="alert">
          <p>{error}</p>
          {retryAction && (
            <button type="button" onClick={retryAction.run}>
              {retryAction.label}
            </button>
          )}
          <button type="button" onClick={() => void refresh()}>
            Refresh workspace
          </button>
        </div>
      )}
      {readIssues.length > 0 && (
        <div className="workspace-error" role="alert">
          <p>Some climbs could not be read. Their stored records are unchanged; healthy climbs and Trash remain available. Backups cannot include unreadable records until they are recovered.</p>
          <ul>{readIssues.map((issue) => <li key={issue.key}>{issue.key}: {issue.message}</li>)}</ul>
        </div>
      )}
      {collection === 'lists' && playlistError && (
        <div className="workspace-error" role="alert">
          <p>{playlistError}</p>
          <p>Your climbs are still available. Previously loaded lists are retained.</p>
          <button type="button" onClick={() => void refreshPlaylists(false)}>Retry loading lists</button>
        </div>
      )}
      {collection !== 'lists' && incompatibleDrafts.length > 0 && (
        <section
          className="incompatible-climbs"
          role="region"
          aria-labelledby="climb-recovery-heading"
        >
          <h2 id="climb-recovery-heading">Recovery needed</h2>
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
      {collection !== 'lists' && collection !== 'trash' && (
        <div className="workspace-import-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setImportingScreenshots(true)}
          >
            Import Kilter screenshots
          </button>
        </div>
      )}
      {collection === 'lists' ? (
        (!playlistError || playlists.length > 0) && <PlaylistLibrary
          playlists={playlists}
          localClimbs={drafts}
          repository={runtime.playlists}
          draftRepository={runtime.drafts}
          installation={runtime.installation}
          definition={runtime.installation.definition}
          controller={runtime.controller}
          compatibilityIssue={(draft) => draftCompatibilityIssue(draft, runtime)}
          onChanged={(playlist) => {
            if (playlist) replacePlaylist(playlist);
            else void refreshPlaylists(false);
          }}
          onRefresh={refresh}
          onSafetyStateChange={setPlaylistSafety}
          onOperationStart={beginOperation}
          onOperationEnd={endOperation}
          initialView={playlistEditReturn}
          onEditLocalClimb={(id, returnTo) => {
            const draft = drafts.find((candidate) => candidate.id === id);
            if (!draft || draft.trashedAt !== undefined || draftCompatibilityIssue(draft, runtime)) return;
            setPlaylistEditReturn(returnTo);
            setEditing(id);
          }}
          onOpenLocalClimb={(id) => {
            const draft = drafts.find((candidate) => candidate.id === id);
            if (!draft || draft.trashedAt !== undefined) return;
            setCollection(draft.status === 'draft' ? 'drafts' : 'finished');
            setSelectedKey(toClimbViewRecord(draft).key);
          }}
          initialImportFragment={
            globalThis.location?.hash.startsWith('#playlist=') ? globalThis.location.hash : null
          }
        />
      ) : (
        <LocalClimbViewer
          definition={runtime.installation.definition}
          climbs={compatibleDrafts.map(toClimbViewRecord)}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
          controller={runtime.controller}
          heading={copy!.label}
          emptyTitle={copy!.emptyTitle}
          emptyDescription={copy!.emptyDescription}
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
          onManageLists={
            collection === 'trash' || Boolean(playlistError)
              ? undefined
              : (key) => {
                  const draft = compatibleDrafts.find(
                    (value) => toClimbViewRecord(value).key === key,
                  );
                  if (draft) setMembershipDraft(draft);
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
      )}
      {membershipDraft && (
        <PlaylistMembershipDialog
          climbName={climbName(membershipDraft)}
          reference={{ kind: 'local', id: membershipDraft.id }}
          playlists={playlists}
          repository={runtime.playlists}
          onChanged={replacePlaylist}
          onRefresh={refreshPlaylists}
          onClose={() => setMembershipDraft(null)}
          onOperationStart={beginOperation}
          onOperationEnd={endOperation}
        />
      )}
      {importingScreenshots && (
        <KilterScreenshotImportDialog
          installation={runtime.installation}
          repository={runtime.drafts}
          onImported={async () => {
            await refresh();
            setCollection('drafts');
          }}
          onOperationStart={beginOperation}
          onOperationEnd={endOperation}
          onClose={() => setImportingScreenshots(false)}
        />
      )}
      {backingUp && runtime.backup && (
        <LibraryBackupDialog
          service={runtime.backup}
          onClose={() => {
            setBackingUp(false);
            queueMicrotask(() => backupButtonRef.current?.focus());
          }}
          onRestored={() => refresh(true)}
        />
      )}
      </main>
    </>
  );
}
