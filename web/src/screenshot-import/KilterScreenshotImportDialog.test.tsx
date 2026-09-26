import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { activeInstallationId, createAppInstallationRegistry } from '../app/installations';
import type { LocalDraftRepository } from '../drafts/repository';
import { KilterScreenshotImportDialog } from './KilterScreenshotImportDialog';
import type { AnalyzedScreenshot, ScreenshotImportResult, ScreenshotImportWarning } from './types';

const installation = createAppInstallationRegistry().require(activeInstallationId);

function repository(): LocalDraftRepository {
  return {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
  };
}

function analyzed(
  file: File,
  name: string,
  warning: boolean | ScreenshotImportWarning = false,
  assignments: AnalyzedScreenshot['candidate']['assignments'] = [],
): AnalyzedScreenshot {
  const warnings =
    typeof warning === 'boolean'
      ? warning
        ? [{ code: 'title-required' as const, message: 'Confirm this title.' }]
        : []
      : [warning];
  return {
    file,
    candidate: {
      sourceName: file.name,
      sourceSha256: 'f'.repeat(64),
      name,
      assignments,
      warnings,
    },
  };
}

const emptyResult: ScreenshotImportResult = { created: [], skipped: [], failures: [] };

describe('KilterScreenshotImportDialog', () => {
  it('loads exactly 16 pixel-free supplied candidates into the same write-free review', async () => {
    const repo = repository();
    const importCandidates = vi.fn(async (_repo, _installation, candidates) => {
      expect(candidates).toHaveLength(16);
      expect(candidates[0]).toMatchObject({ name: 'Figure 5-?', assignments: expect.any(Array) });
      expect(candidates[15]).toMatchObject({
        name: 'Chinchiller 3',
        assignments: expect.any(Array),
      });
      return emptyResult;
    });
    render(
      <KilterScreenshotImportDialog
        installation={installation}
        repository={repo}
        importCandidates={importCandidates}
        createObjectUrl={vi.fn()}
        revokeObjectUrl={vi.fn()}
        onImported={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load supplied 16' }));
    expect(screen.getByText('Screenshot 1 of 16')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Figure 5-?')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Visible title/ })).not.toBeInTheDocument();
    expect(repo.create).not.toHaveBeenCalled();
    for (let index = 1; index < 16; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Import 16 drafts' }));
    await waitFor(() => expect(importCandidates).toHaveBeenCalledOnce());
  }, 10_000);

  it('analyzes selected files sequentially and performs no writes during review or cancel', async () => {
    const files = [new File(['a'], 'a.png'), new File(['b'], 'b.png')];
    let active = 0;
    let maximumActive = 0;
    const analyzeFile = vi.fn(async (file: File) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      return analyzed(file, file.name.replace('.png', ''));
    });
    const repo = repository();
    const onClose = vi.fn();
    const revokeObjectUrl = vi.fn();
    const { unmount } = render(
      <KilterScreenshotImportDialog
        installation={installation}
        repository={repo}
        analyzeFile={analyzeFile}
        importCandidates={vi.fn()}
        createObjectUrl={(file) => `blob:${file.name}`}
        revokeObjectUrl={revokeObjectUrl}
        onImported={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText('Screenshot files'), { target: { files } });
    expect(await screen.findByDisplayValue('a')).toBeInTheDocument();
    expect(analyzeFile).toHaveBeenCalledTimes(2);
    expect(maximumActive).toBe(1);
    expect(repo.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByDisplayValue('b')).toBeInTheDocument();
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith('blob:a.png'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(repo.create).not.toHaveBeenCalled();
    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:b.png');
  });

  it('resolves the title warning after naming and imports after the corrected hold is reviewed', async () => {
    const file = new File(['a'], 'unknown.png');
    const importCandidates = vi.fn(async (_repo, _installation, candidates) => {
      expect(candidates[0]).toMatchObject({
        name: 'Corrected title',
        warningsOverridden: false,
        assignments: [expect.objectContaining({ appearance: { kind: 'role', role: 'start' } })],
      });
      return emptyResult;
    });
    const onImported = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(
      <KilterScreenshotImportDialog
        installation={installation}
        repository={repository()}
        analyzeFile={vi.fn(async () => analyzed(file, '', true))}
        importCandidates={importCandidates}
        createObjectUrl={() => 'blob:unknown'}
        revokeObjectUrl={vi.fn()}
        onImported={onImported}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText('Screenshot files'), { target: { files: [file] } });
    const importButton = await screen.findByRole('button', { name: 'Import 1 draft' });
    expect(importButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Climb name'), { target: { value: 'Corrected title' } });
    expect(importButton).toBeEnabled();
    expect(
      screen.queryByRole('checkbox', { name: 'I reviewed and accept these warnings' }),
    ).not.toBeInTheDocument();
    const firstHold = screen.getByRole('button', { name: 'Hold 1, Unselected' });
    fireEvent.keyDown(firstHold, { key: 'Enter' });
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);
    await waitFor(() => expect(importCandidates).toHaveBeenCalledOnce());
    expect(onImported).toHaveBeenCalledWith(emptyResult);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('reconciles a low-confidence warning only for its cell and restores it when reverted', async () => {
    const file = new File(['a'], 'low-confidence.png');
    const initialAssignment = {
      placementId: installation.definition.placements[0]!.id,
      appearance: { kind: 'role' as const, role: 'start' as const },
    };
    const warning: ScreenshotImportWarning = {
      code: 'low-confidence',
      column: 0,
      row: 28,
      role: 'start',
      message: 'The start ring requires confirmation.',
    };
    const importCandidates = vi.fn(async (_repo, _installation, candidates) => {
      expect(candidates[0]).toMatchObject({ warningsOverridden: false });
      return emptyResult;
    });
    render(
      <KilterScreenshotImportDialog
        installation={installation}
        repository={repository()}
        analyzeFile={vi.fn(async () => analyzed(file, 'Named climb', warning, [initialAssignment]))}
        importCandidates={importCandidates}
        createObjectUrl={() => 'blob:low-confidence'}
        revokeObjectUrl={vi.fn()}
        onImported={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Screenshot files'), { target: { files: [file] } });
    const importButton = await screen.findByRole('button', { name: 'Import 1 draft' });
    expect(importButton).toBeDisabled();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Hold 2, Unselected' }), { key: 'Enter' });
    expect(screen.getByText(warning.message)).toBeInTheDocument();
    expect(importButton).toBeDisabled();

    const firstHold = screen.getByRole('button', { name: 'Hold 1, Start' });
    fireEvent.keyDown(firstHold, { key: 'Enter' });
    expect(screen.queryByText(warning.message)).not.toBeInTheDocument();
    expect(importButton).toBeEnabled();

    for (let index = 0; index < 4; index += 1) {
      fireEvent.keyDown(firstHold, { key: 'Enter' });
    }
    expect(screen.getByText(warning.message)).toBeInTheDocument();
    expect(importButton).toBeDisabled();

    fireEvent.keyDown(firstHold, { key: 'Enter' });
    expect(screen.queryByText(warning.message)).not.toBeInTheDocument();
    fireEvent.click(importButton);
    await waitFor(() => expect(importCandidates).toHaveBeenCalledOnce());
  });

  it('reports partial failures and permits an idempotent retry without closing', async () => {
    const file = new File(['a'], 'a.png');
    const failure: ScreenshotImportResult = {
      created: [],
      skipped: [],
      failures: [{ sourceName: 'a.png', message: 'storage full' }],
    };
    const importCandidates = vi
      .fn()
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(emptyResult);
    const onClose = vi.fn();
    render(
      <KilterScreenshotImportDialog
        installation={installation}
        repository={repository()}
        analyzeFile={vi.fn(async () => analyzed(file, 'A'))}
        importCandidates={importCandidates}
        createObjectUrl={() => 'blob:a'}
        revokeObjectUrl={vi.fn()}
        onImported={vi.fn(async () => undefined)}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText('Screenshot files'), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 1 draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 failed');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 draft' }));
    await waitFor(() => expect(importCandidates).toHaveBeenCalledTimes(2));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
