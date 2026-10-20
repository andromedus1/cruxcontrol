import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { swipeDirection, useHorizontalSwipe } from './use-horizontal-swipe';

let now = 0;

function Zone({ onSwipe, enabled = true, onClick }: {
  onSwipe: (direction: 'previous' | 'next') => void;
  enabled?: boolean;
  onClick?: () => void;
}) {
  const ref = useHorizontalSwipe<HTMLDivElement>({ enabled, onSwipe });
  return (
    <div ref={ref} data-testid="zone">
      <button type="button" onClick={onClick}>Inside</button>
      <input aria-label="Text" />
      <div role="slider" aria-label="Slider" aria-valuenow={1} tabIndex={0} />
      <div data-no-swipe="" data-testid="opted-out">Opted out</div>
    </div>
  );
}

function drag(
  target: Element,
  { dx, dy = 0, ms = 200, pointerType = 'touch', cancel = false }:
    { dx: number; dy?: number; ms?: number; pointerType?: string; cancel?: boolean },
) {
  fireEvent.pointerDown(target, { pointerId: 7, pointerType, isPrimary: true, clientX: 200, clientY: 300 });
  now += ms / 2;
  fireEvent.pointerMove(target, { pointerId: 7, pointerType, clientX: 200 + dx / 2, clientY: 300 + dy / 2 });
  now += ms / 2;
  if (cancel) fireEvent.pointerCancel(target, { pointerId: 7, pointerType });
  else fireEvent.pointerUp(target, { pointerId: 7, pointerType, clientX: 200 + dx, clientY: 300 + dy });
}

beforeEach(() => {
  now = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

describe('swipeDirection', () => {
  it('requires distance or a fast flick, with horizontal dominance', () => {
    expect(swipeDirection(-56, 0, 1_000)).toBe('next');
    expect(swipeDirection(56, 0, 1_000)).toBe('previous');
    expect(swipeDirection(-55, 0, 1_000)).toBeNull();
    // 24 px flick at 0.4 px/ms counts; slower or shorter does not.
    expect(swipeDirection(-24, 0, 60)).toBe('next');
    expect(swipeDirection(-24, 0, 61)).toBeNull();
    expect(swipeDirection(-23, 0, 10)).toBeNull();
    // |dx| must be at least 1.5 × |dy|.
    expect(swipeDirection(-90, 60, 200)).toBe('next');
    expect(swipeDirection(-89, 60, 200)).toBeNull();
    expect(swipeDirection(0, 0, 10)).toBeNull();
  });
});

describe('useHorizontalSwipe', () => {
  it('reports left and right touch swipes as next and previous', () => {
    const onSwipe = vi.fn();
    render(<Zone onSwipe={onSwipe} />);
    drag(screen.getByTestId('zone'), { dx: -80 });
    drag(screen.getByTestId('zone'), { dx: 80, pointerType: 'pen' });
    expect(onSwipe.mock.calls).toEqual([['next'], ['previous']]);
  });

  it('accepts a short fast flick but not a short slow drag', () => {
    const onSwipe = vi.fn();
    render(<Zone onSwipe={onSwipe} />);
    drag(screen.getByTestId('zone'), { dx: -30, ms: 500 });
    expect(onSwipe).not.toHaveBeenCalled();
    drag(screen.getByTestId('zone'), { dx: -30, ms: 50 });
    expect(onSwipe).toHaveBeenCalledWith('next');
  });

  it('leaves vertical scrolling, diagonal drags, taps and mouse drags alone', () => {
    const onSwipe = vi.fn();
    render(<Zone onSwipe={onSwipe} />);
    const zone = screen.getByTestId('zone');
    drag(zone, { dx: 10, dy: -200 });
    drag(zone, { dx: -70, dy: 60 });
    drag(zone, { dx: 2, dy: 1, ms: 80 });
    drag(zone, { dx: -120, pointerType: 'mouse' });
    // Scrolling that turns horizontal late is still a scroll.
    fireEvent.pointerDown(zone, { pointerId: 7, pointerType: 'touch', clientX: 200, clientY: 300 });
    fireEvent.pointerMove(zone, { pointerId: 7, pointerType: 'touch', clientX: 200, clientY: 340 });
    fireEvent.pointerUp(zone, { pointerId: 7, pointerType: 'touch', clientX: 100, clientY: 340 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('ignores gestures that start in text fields, sliders or opted-out elements, and cancelled or disabled ones', () => {
    const onSwipe = vi.fn();
    const view = render(<Zone onSwipe={onSwipe} />);
    drag(screen.getByLabelText('Text'), { dx: -100 });
    drag(screen.getByRole('slider'), { dx: -100 });
    drag(screen.getByTestId('opted-out'), { dx: -100 });
    drag(screen.getByTestId('zone'), { dx: -100, cancel: true });
    view.rerender(<Zone onSwipe={onSwipe} enabled={false} />);
    drag(screen.getByTestId('zone'), { dx: -100 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('does not let a swipe that ends on a button also activate it', () => {
    const onSwipe = vi.fn();
    const onClick = vi.fn();
    render(<Zone onSwipe={onSwipe} onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Inside' });
    drag(button, { dx: -100 });
    fireEvent.click(button);
    expect(onSwipe).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
