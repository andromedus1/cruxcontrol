import { describe, expect, it, vi } from 'vitest';
import { endAnnouncement, listNavigation } from './navigation';

describe('listNavigation', () => {
  it('moves through the list as shown and reports the position', () => {
    const select = vi.fn();
    const middle = listNavigation(['a', 'b', 'c'], 'b', select)!;
    expect(middle).toMatchObject({ positionLabel: '2 of 3', canPrevious: true, canNext: true });
    middle.onPrevious();
    middle.onNext();
    expect(select.mock.calls).toEqual([['a'], ['c']]);
  });

  it('stops at both ends without selecting anything', () => {
    const select = vi.fn();
    const first = listNavigation(['a', 'b'], 'a', select)!;
    const last = listNavigation(['a', 'b'], 'b', select)!;
    expect(first.canPrevious).toBe(false);
    expect(last.canNext).toBe(false);
    first.onPrevious();
    last.onNext();
    expect(select).not.toHaveBeenCalled();
    expect(listNavigation(['a'], 'a', select)).toMatchObject({ positionLabel: '1 of 1', canPrevious: false, canNext: false });
  });

  it('continues beyond the loaded keys with an offset and a "+" while more exist', () => {
    const select = vi.fn();
    const onNextBeyond = vi.fn(async () => true);
    const onPreviousBeyond = vi.fn();
    const navigation = listNavigation(['x', 'y'], 'y', select, { offset: 25, more: true, onNextBeyond, onPreviousBeyond })!;
    expect(navigation.positionLabel).toBe('27 of 27+');
    expect(navigation.canNext).toBe(true);
    void navigation.onNext();
    expect(onNextBeyond).toHaveBeenCalledOnce();
    const top = listNavigation(['x', 'y'], 'x', select, { offset: 25, onPreviousBeyond })!;
    expect(top.positionLabel).toBe('26 of 27');
    expect(top.canPrevious).toBe(true);
    top.onPrevious();
    expect(onPreviousBeyond).toHaveBeenCalledOnce();
    // Without more results, a beyond handler is not offered.
    expect(listNavigation(['x'], 'x', select, { onNextBeyond })!.canNext).toBe(false);
  });

  it('is unavailable when the current key is not in the list', () => {
    expect(listNavigation(['a'], 'missing', vi.fn())).toBeNull();
  });

  it('names the ends', () => {
    expect(endAnnouncement('previous')).toBe('First climb');
    expect(endAnnouncement('next')).toBe('Last climb');
  });
});
