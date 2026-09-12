import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { apiLevel3Color } from '../domain/boards/colors';
import { draftRevision, localDraftId } from '../drafts/codec';
import { draftContent } from '../drafts/test-fixtures';
import type { LocalDraftRepository } from '../drafts/repository';
import type { LocalClimbDraft } from '../drafts/types';
import { RouteEditorWorkspace } from './RouteEditorWorkspace';
import { createSpatialPreset } from '../light-effects/preset-library';

const draft: LocalClimbDraft = {
  ...draftContent(),
  schemaVersion: 3,
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
  trash: vi.fn(),
  restore: vi.fn(),
  deletePermanently: vi.fn(),
};

describe('RouteEditorWorkspace', () => {
  it('shows the simplified autosaving hold tools and exact custom channels', () => {
    render(
      <RouteEditorWorkspace
        definition={kilterFullride7x10Definition}
        draft={draft}
        repository={repository}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Untitled climb' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Start$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Middle$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Finish$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Foot-only$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Cycle' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Erase' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Eyedropper/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Advanced Light/ }));
    expect(screen.getByLabelText('red channel')).toHaveAttribute('max', '7');
    expect(screen.getByLabelText('blue channel')).toHaveAttribute('max', '3');
    expect(screen.queryByText('Live Preview', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save now' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark finished' })).toBeInTheDocument();
    expect(document.querySelector('.board-renderer__viewport')).toHaveAttribute('data-scale', '1');
    expect(screen.getByText('Board capacity test')).toBeInTheDocument();
  });

  it('changes lifecycle status without imposing climb validity rules', () => {
    render(
      <RouteEditorWorkspace
        definition={kilterFullride7x10Definition}
        draft={draft}
        repository={repository}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark finished' }));
    expect(screen.getByText('Finished · Fullride 7×10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to drafts' })).toBeInTheDocument();
    expect(document.querySelector('.save-chip')).toHaveTextContent('dirty');
    fireEvent.click(screen.getByRole('button', { name: 'Move to drafts' }));
    expect(screen.getByText('Draft · Fullride 7×10')).toBeInTheDocument();
  });

  it('cycles and erases through the roving keyboard surface', () => {
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
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Start/ }), { key: ' ' });
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Middle/ }), { key: ' ' });
    expect(screen.getByRole('button', { name: /^Hold 1, Finish/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Erase' }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Finish/ }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: /^Hold 1, Unselected/ })).toBeInTheDocument();
  });

  it('creates and edits a saved effect group, then paints membership on an existing hold', () => {
    render(
      <RouteEditorWorkspace
        definition={kilterFullride7x10Definition}
        draft={draft}
        repository={repository}
        onBack={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Unselected/ }), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add effect' }));
    expect(screen.getByLabelText('Effect kind')).toHaveValue('pulse');
    fireEvent.change(screen.getByLabelText('Effect kind'), { target: { value: 'wave' } });
    fireEvent.change(screen.getByLabelText('Effect cycle time'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('Effect intensity'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Apply selected effect' }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Start/ }), { key: 'Enter' });
    expect(screen.getByText('1 hold in this effect')).toBeInTheDocument();
    expect(document.querySelector('.save-chip')).toHaveTextContent('dirty');
    fireEvent.click(screen.getByRole('radio', { name: 'Remove effect' }));
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 1, Start/ }), { key: 'Enter' });
    expect(screen.getByText('0 holds in this effect')).toBeInTheDocument();
  });

  it('applies editable spatial presets without fake assignments and paints independent targets', () => {
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={draft} repository={repository} onBack={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: /Snake 7 lights/ }));
    expect(screen.getByLabelText('Effect target')).toHaveValue('unused');
    expect(screen.getByLabelText('Effect cycle time')).toHaveValue('150000');
    expect(screen.getByLabelText('Effect cycle time')).toHaveAttribute('max', '180000');
    expect(screen.getByText(/0 route\/static \+ 7 effects = 7\/20/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Effect target'), { target:{ value:'selected' } });
    fireEvent.click(screen.getByRole('button', { name:'Paint targets' }));
    fireEvent.keyDown(screen.getByRole('button', { name:/^Hold 2, Unselected/ }), { key:'Enter' });
    expect(screen.getByText(/Selected targets: 1/)).toBeInTheDocument();
    expect(screen.getByText('0 lit')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Effect footprint'), { target:{ value:'5' } });
    expect(screen.getByText(/0 route\/static \+ 5 effects = 5\/20/)).toBeInTheDocument();
  });

  it.each([1, 2] as const)('keeps saved v%i Frogger editable while retiring it from the preset picker', (recipeVersion) => {
    const frogger = { ...createSpatialPreset('frogger', 4), recipeVersion };
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={{ ...draft, effectGroups: [frogger] }} repository={repository} onBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Frogger 10 lights/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Traffic lanes')).toHaveValue(4);
    expect(screen.getByLabelText('Effect footprint')).toHaveValue(10);
    fireEvent.change(screen.getByLabelText('Traffic lanes'), { target: { value: '3' } });
    expect(screen.getByLabelText('Traffic lanes')).toHaveValue(3);
  });

  it('edits curious bee Body and Wings through labeled controls and keeps the two palette slots', () => {
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={draft} repository={repository} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Curious bumblebee 5 lights/ }));
    expect(screen.getByLabelText('Hover fraction')).toHaveValue(0.4);
    fireEvent.click(screen.getByRole('radio', { name: /Advanced Light/ }));
    fireEvent.change(screen.getByLabelText('red channel'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('green channel'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('blue channel'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Body to current color' }));
    fireEvent.change(screen.getByLabelText('red channel'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('green channel'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('blue channel'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Wings to current color' }));
    const colors = screen.getAllByRole('button', { name: /Remove color/ }).map((button) => button.getAttribute('aria-label'));
    expect(colors).toEqual(['Remove color #FFB600', 'Remove color #4924FF']);
  });

  it('keeps typed bee hover values inside the supported range without crashing preview', () => {
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={draft} repository={repository} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Curious bumblebee 5 lights/ }));
    fireEvent.change(screen.getByLabelText('Hover fraction'), { target: { value: '0.9' } });
    expect(screen.getByLabelText('Hover fraction')).toHaveValue(.8);
    fireEvent.change(screen.getByLabelText('Hover fraction'), { target: { value: '-1' } });
    expect(screen.getByLabelText('Hover fraction')).toHaveValue(0);
    fireEvent.change(screen.getByLabelText('Hover fraction'), { target: { value: '0.35' } });
    expect(screen.getByLabelText('Hover fraction')).toHaveValue(.35);
  });

  it('shows and explicitly adopts the longer seamless loop for a saved v1 effect', () => {
    const legacy = { ...createSpatialPreset('snake', 4), recipeVersion: 1 as const, periodMs: 5_000 };
    render(<RouteEditorWorkspace definition={kilterFullride7x10Definition} draft={{ ...draft, effectGroups: [legacy] }} repository={repository} onBack={vi.fn()} />);
    expect(screen.getByText('Original loop')).toBeInTheDocument();
    expect(screen.getByText(/Uses a 150-second loop/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use seamless loop' }));
    expect(screen.getByText('Seamless loop')).toBeInTheDocument();
    expect(screen.getByLabelText('Effect cycle time')).toHaveValue('150000');
    expect(document.querySelector('.save-chip')).toHaveTextContent('dirty');
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
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 3, Unselected/ }), {
      key: 'Enter',
    });
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
    fireEvent.keyDown(screen.getByRole('button', { name: /^Hold 3, Unselected/ }), {
      key: 'Enter',
    });
    expect(screen.getByRole('button', { name: /^Hold 3, Custom #FFFFFF/ })).toBeInTheDocument();
    expect(document.querySelector('.save-chip')).toHaveTextContent('dirty');
  });
});
