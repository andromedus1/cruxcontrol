import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { draftRevision, localDraftId } from '../drafts/codec';
import { draftContent } from '../drafts/test-fixtures';
import type { LocalDraftRepository } from '../drafts/repository';
import type { LocalClimbDraft } from '../drafts/types';
import { RouteEditorWorkspace } from './RouteEditorWorkspace';

const draft: LocalClimbDraft = { ...draftContent(), schemaVersion: 1, id: localDraftId('11111111-1111-4111-8111-111111111111'), revision: draftRevision(1), createdAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z', metadata: {} };
const repository: LocalDraftRepository = { create: vi.fn(), get: vi.fn(), list: vi.fn(), update: vi.fn(), delete: vi.fn() };

describe('RouteEditorWorkspace', () => {
  it('supports all semantic tools, exact custom channels, and unrestricted lighting copy', () => {
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={draft} repository={repository} onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Untitled climb' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Foot-only/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Advanced Light/ }));
    expect(screen.getByLabelText('red channel')).toHaveAttribute('max', '7');
    expect(screen.getByLabelText('blue channel')).toHaveAttribute('max', '3');
    expect(screen.getByRole('button', { name: 'Connect & light' })).toBeDisabled();
    expect(document.querySelector('.board-renderer__viewport')).toHaveAttribute('data-scale', '2.5');
  });

  it('cycles, directly assigns, and erases through the roving keyboard surface', () => {
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={draft} repository={repository} onBack={vi.fn()} />);
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

  it('switches from the compact 2.5 board to the wide scale-1 board', () => {
    let desktop = false;
    const listeners = new Set<EventListener>();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      get matches() { return query.includes('min-width') ? desktop : !desktop; },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { if (typeof listener === 'function') listeners.add(listener); },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { if (typeof listener === 'function') listeners.delete(listener); },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }));
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={draft} repository={repository} onBack={vi.fn()} />);
    expect(document.querySelector('.board-renderer__viewport')).toHaveAttribute('data-scale', '2.5');
    desktop = true;
    act(() => { for (const listener of listeners) listener(new Event('change')); });
    expect(document.querySelector('.board-renderer__viewport')).toHaveAttribute('data-scale', '1');
  });
});
