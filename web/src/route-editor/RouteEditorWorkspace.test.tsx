import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { apiLevel3Color } from '../domain/boards/colors';
import { draftRevision, localDraftId } from '../drafts/codec';
import { draftContent } from '../drafts/test-fixtures';
import type { LocalDraftRepository } from '../drafts/repository';
import type { LocalClimbDraft } from '../drafts/types';
import { RouteEditorWorkspace } from './RouteEditorWorkspace';

const draft: LocalClimbDraft = {
  ...draftContent(),
  schemaVersion: 1,
  id: localDraftId('11111111-1111-4111-8111-111111111111'),
  revision: draftRevision(1),
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  metadata: {},
};
const repository: LocalDraftRepository = {
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('RouteEditorWorkspace', () => {
  it('supports all semantic tools, exact custom channels, and unrestricted lighting copy', () => {
    render(
      <RouteEditorWorkspace
        definition={kilterFullride7x10Definition}
        draft={draft}
        repository={repository}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Untitled climb' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Foot-only/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Advanced Light/ }));
    expect(screen.getByLabelText('red channel')).toHaveAttribute('max', '7');
    expect(screen.getByLabelText('blue channel')).toHaveAttribute('max', '3');
    expect(screen.getByRole('button', { name: 'Connect & light' })).toBeDisabled();
    expect(document.querySelector('.board-renderer__viewport')).toHaveAttribute('data-scale', '1');
  });

  it('cycles, directly assigns, and erases through the roving keyboard surface', () => {
    render(
      <RouteEditorWorkspace
        definition={kilterFullride7x10Definition}
        draft={draft}
        repository={repository}
        onBack={vi.fn()}
      />,
    );
    const hold = screen.getByRole('button', { name: /^Hold 1, Unselected/ });
    fireEvent.keyDown(hold, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /^Hold 1, Start/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Finish/ }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Start/ }), { key: ' ' });
    expect(screen.getByRole('button', { name: /^Hold 1, Finish/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Erase' }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Finish/ }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: /^Hold 1, Unselected/ })).toBeInTheDocument();
  });

  it('starts fitted and supports controls and pinch zoom in the editor', () => {
    render(
      <RouteEditorWorkspace
        definition={kilterFullride7x10Definition}
        draft={draft}
        repository={repository}
        onBack={vi.fn()}
      />,
    );
    const viewport = document.querySelector('.board-renderer__viewport')!;
    expect(viewport).toHaveAttribute('data-scale', '1');
    expect(screen.getByLabelText('Board zoom')).toHaveTextContent('100%');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(viewport).toHaveAttribute('data-scale', '1.5');

    fireEvent.touchStart(viewport, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });
    fireEvent.touchMove(viewport, {
      touches: [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ],
    });
    expect(viewport).toHaveAttribute('data-scale', '3');

    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(viewport).toHaveAttribute('data-scale', '1');
  });

  it('samples semantic and custom colors into Advanced Light without dirtying', () => {
    const [first, second] = kilterFullride7x10Definition.placements;
    const sampledDraft: LocalClimbDraft = {
      ...draft,
      assignments: [
        { placementId: first.id, appearance: { kind: 'role', role: 'start' } },
        { placementId: second.id, appearance: { kind: 'custom', color: apiLevel3Color(255) } },
      ],
    };
    render(
      <RouteEditorWorkspace
        definition={kilterFullride7x10Definition}
        draft={sampledDraft}
        repository={repository}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Eyedropper/ }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 3, Unselected/ }), { key: 'Enter' });
    expect(screen.getByRole('radio', { name: /Eyedropper/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(document.querySelector('.save-chip')).toHaveTextContent('saved');

    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Start/ }), { key: 'Enter' });
    expect(screen.getByRole('radio', { name: /Advanced Light/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByLabelText('green channel')).toHaveValue('7');
    expect(document.querySelector('.save-chip')).toHaveTextContent('saved');

    fireEvent.click(screen.getByRole('radio', { name: /Eyedropper/ }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 2, Custom/ }), { key: 'Enter' });
    expect(screen.getByLabelText('red channel')).toHaveValue('7');
    expect(screen.getByLabelText('green channel')).toHaveValue('7');
    expect(screen.getByLabelText('blue channel')).toHaveValue('3');
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 3, Unselected/ }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: /^Hold 3, Custom #FFFFFF/ })).toBeInTheDocument();
    expect(document.querySelector('.save-chip')).toHaveTextContent('dirty');
  });
});
