import { useEffect, useRef, useState } from 'react';
import { BoardRenderer } from '../board-renderer/BoardRenderer';
import type { BoardHoldAssignment } from '../board-renderer/types';
import type { LocalDraftRepository } from '../drafts/repository';
import type { ConfiguredBoardInstallation } from '../installations/contracts';
import { applyEditorTool } from '../route-editor/assignments';
import { analyzeKilterScreenshotFile } from './file-analysis';
import { importScreenshotCandidates } from './import-batch';
import { createSuppliedFullrideCandidates } from './supplied-batch';
import type {
  AnalyzedScreenshot,
  ConfirmedScreenshotCandidate,
  ScreenshotImportCandidate,
  ScreenshotImportResult,
} from './types';
import './KilterScreenshotImportDialog.css';

interface ReviewItem {
  readonly candidate: ScreenshotImportCandidate;
  readonly file: File | null;
  readonly name: string;
  readonly assignments: readonly BoardHoldAssignment[];
  readonly warningsOverridden: boolean;
}

export interface KilterScreenshotImportDialogProps {
  readonly installation: ConfiguredBoardInstallation;
  readonly repository: LocalDraftRepository;
  readonly onImported: (result: ScreenshotImportResult) => Promise<void>;
  readonly onClose: () => void;
  readonly onOperationStart?: () => void;
  readonly onOperationEnd?: () => void;
  readonly analyzeFile?: typeof analyzeKilterScreenshotFile;
  readonly importCandidates?: typeof importScreenshotCandidates;
  readonly loadSuppliedCandidates?: typeof createSuppliedFullrideCandidates;
  readonly createObjectUrl?: (file: File) => string;
  readonly revokeObjectUrl?: (url: string) => void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const browserCreateObjectUrl = (file: File) => URL.createObjectURL(file);
const browserRevokeObjectUrl = (url: string) => URL.revokeObjectURL(url);

function toReviewItem(analyzed: AnalyzedScreenshot): ReviewItem {
  return Object.freeze({
    candidate: analyzed.candidate,
    file: analyzed.file,
    name: analyzed.candidate.name,
    assignments: analyzed.candidate.assignments,
    warningsOverridden: false,
  });
}

function suppliedReviewItem(candidate: ScreenshotImportCandidate): ReviewItem {
  return Object.freeze({
    candidate,
    file: null,
    name: candidate.name,
    assignments: candidate.assignments,
    warningsOverridden: false,
  });
}

export function KilterScreenshotImportDialog({
  installation,
  repository,
  onImported,
  onClose,
  onOperationStart,
  onOperationEnd,
  analyzeFile = analyzeKilterScreenshotFile,
  importCandidates = importScreenshotCandidates,
  loadSuppliedCandidates = createSuppliedFullrideCandidates,
  createObjectUrl = browserCreateObjectUrl,
  revokeObjectUrl = browserRevokeObjectUrl,
}: KilterScreenshotImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const analysisGeneration = useRef(0);
  const [items, setItems] = useState<readonly ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'choose' | 'analyzing' | 'review' | 'importing'>('choose');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [titleUrl, setTitleUrl] = useState('');
  const [scale, setScale] = useState(1);
  const current = items[index];
  const currentFile = current?.file;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      analysisGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!currentFile) {
      setTitleUrl('');
      return;
    }
    const url = createObjectUrl(currentFile);
    setTitleUrl(url);
    return () => revokeObjectUrl(url);
  }, [createObjectUrl, currentFile, revokeObjectUrl]);

  function close(): void {
    analysisGeneration.current += 1;
    onClose();
  }

  async function chooseFiles(files: readonly File[]): Promise<void> {
    onOperationStart?.();
    const generation = ++analysisGeneration.current;
    setItems([]);
    setIndex(0);
    setError('');
    setPhase('analyzing');
    const analyzed: ReviewItem[] = [];
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        setStatus(`Analyzing ${fileIndex + 1} of ${files.length}…`);
        const result = await analyzeFile(files[fileIndex]!, installation.definition);
        if (generation !== analysisGeneration.current) return;
        analyzed.push(toReviewItem(result));
      }
      if (generation !== analysisGeneration.current) return;
      setItems(Object.freeze(analyzed));
      setStatus('');
      setPhase('review');
    } catch (cause) {
      if (generation !== analysisGeneration.current) return;
      setStatus('');
      setError(message(cause));
      setPhase('choose');
    } finally {
      onOperationEnd?.();
    }
  }

  function loadSupplied(): void {
    analysisGeneration.current += 1;
    setError('');
    setStatus('');
    try {
      setItems(
        Object.freeze(loadSuppliedCandidates(installation.definition).map(suppliedReviewItem)),
      );
      setIndex(0);
      setScale(1);
      setPhase('review');
    } catch (cause) {
      setItems([]);
      setPhase('choose');
      setError(message(cause));
    }
  }

  function updateCurrent(changes: Partial<ReviewItem>): void {
    setItems((values) =>
      Object.freeze(
        values.map((item, itemIndex) =>
          itemIndex === index ? Object.freeze({ ...item, ...changes }) : item,
        ),
      ),
    );
  }

  async function confirm(): Promise<void> {
    if (phase !== 'review') return;
    onOperationStart?.();
    const confirmed: ConfirmedScreenshotCandidate[] = items.map((item) => ({
      sourceName: item.candidate.sourceName,
      name: item.name,
      assignments: item.assignments,
      warningsOverridden: item.warningsOverridden,
    }));
    setPhase('importing');
    setError('');
    setStatus(`Importing ${confirmed.length} drafts…`);
    try {
      const result = await importCandidates(repository, installation, confirmed);
      await onImported(result);
      if (result.failures.length > 0) {
        setError(
          `${result.created.length} created, ${result.skipped.length} skipped, ${result.failures.length} failed. ${result.failures.map((failure) => `${failure.sourceName}: ${failure.message}`).join(' ')}`,
        );
        setStatus('');
        setPhase('review');
      } else {
        close();
      }
    } catch (cause) {
      setError(message(cause));
      setStatus('');
      setPhase('review');
    } finally {
      onOperationEnd?.();
    }
  }

  const warningBlocked = Boolean(
    current && current.candidate.warnings.length > 0 && !current.warningsOverridden,
  );
  const itemReady = Boolean(current?.name.trim()) && !warningBlocked;
  const allReady =
    items.length > 0 &&
    items.every(
      (item) =>
        item.name.trim() && (item.candidate.warnings.length === 0 || item.warningsOverridden),
    );

  return (
    <dialog
      ref={dialogRef}
      className="screenshot-import-dialog"
      aria-labelledby="screenshot-import-heading"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={close}
    >
      <header>
        <div>
          <p className="eyebrow">Local migration</p>
          <h2 id="screenshot-import-heading">Import Kilter screenshots</h2>
        </div>
        <button
          type="button"
          className="screenshot-import-close"
          aria-label="Close screenshot import"
          onClick={close}
        >
          ×
        </button>
      </header>

      <label className="screenshot-import-file">
        Screenshot files
        <input
          type="file"
          accept="image/png,.png"
          multiple
          disabled={phase === 'analyzing' || phase === 'importing'}
          onChange={(event) => {
            const files = [...(event.currentTarget.files ?? [])];
            event.currentTarget.value = '';
            if (files.length > 0) void chooseFiles(files);
          }}
        />
      </label>
      <button
        className="button button--secondary screenshot-import-supplied"
        type="button"
        disabled={phase === 'analyzing' || phase === 'importing'}
        onClick={loadSupplied}
      >
        Load supplied 16
      </button>
      <p className="screenshot-import-help">
        Analysis stays on this device. Review every title and hold before importing; choosing or
        canceling files does not save climbs.
      </p>

      {status && (
        <div className="screenshot-import-status" role="status" aria-live="polite">
          {status}
        </div>
      )}
      {error && (
        <div className="screenshot-import-error" role="alert">
          {error}
        </div>
      )}

      {current && (
        <section className="screenshot-import-review" aria-labelledby="screenshot-review-name">
          <div className="screenshot-import-progress">
            <span>
              Screenshot {index + 1} of {items.length}
            </span>
            <span>{current.file?.name ?? current.candidate.sourceName}</span>
          </div>
          {titleUrl && (
            <div className="screenshot-import-title-crop">
              <img
                src={titleUrl}
                alt={`Visible title from ${current.file?.name ?? current.candidate.sourceName}`}
              />
            </div>
          )}
          <label className="screenshot-import-name">
            Climb name
            <input
              id="screenshot-review-name"
              required
              value={current.name}
              onChange={(event) => updateCurrent({ name: event.currentTarget.value })}
            />
          </label>

          {current.candidate.warnings.length > 0 && (
            <div className="screenshot-import-warnings">
              <h3>Needs confirmation</h3>
              <ul>
                {current.candidate.warnings.map((warning, warningIndex) => (
                  <li key={`${warning.code}-${warningIndex}`}>{warning.message}</li>
                ))}
              </ul>
              <label>
                <input
                  type="checkbox"
                  checked={current.warningsOverridden}
                  onChange={(event) =>
                    updateCurrent({ warningsOverridden: event.currentTarget.checked })
                  }
                />
                I reviewed and accept these warnings
              </label>
            </div>
          )}

          <div className="screenshot-import-board">
            <p id="screenshot-import-board-help">
              Tap a hold to cycle Start, Middle, Finish, Foot-only, then erase. Pinch to zoom.
            </p>
            <BoardRenderer
              definition={installation.definition}
              assignments={current.assignments}
              interactionMode="select"
              scale={scale}
              onScaleChange={setScale}
              labelledBy="screenshot-import-board-help"
              onPlacementActivate={(placementId) =>
                updateCurrent({
                  assignments: applyEditorTool(current.assignments, placementId, { kind: 'cycle' }),
                })
              }
            />
          </div>

          <footer className="screenshot-import-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={index === 0 || phase === 'importing'}
              onClick={() => {
                setIndex((value) => value - 1);
                setScale(1);
              }}
            >
              Back
            </button>
            {index < items.length - 1 ? (
              <button
                type="button"
                className="button button--primary"
                disabled={!itemReady || phase === 'importing'}
                onClick={() => {
                  setIndex((value) => value + 1);
                  setScale(1);
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary"
                disabled={!allReady || phase === 'importing'}
                onClick={() => void confirm()}
              >
                Import {items.length} {items.length === 1 ? 'draft' : 'drafts'}
              </button>
            )}
            <button
              type="button"
              className="button button--secondary"
              disabled={phase === 'importing'}
              onClick={close}
            >
              Cancel
            </button>
          </footer>
        </section>
      )}
    </dialog>
  );
}
