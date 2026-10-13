import { describe, expect, it, vi } from 'vitest';
import { createBackNavigation } from './back-navigation.ts';

describe('mounted Back navigation', () => {
  it('gives the top dialog first refusal and does not dismiss its parent when guarded', () => {
    const navigation = createBackNavigation();
    const parent = vi.fn(); const dialog = vi.fn();
    navigation.register(parent, 20);
    const unregister = navigation.register(dialog, 100);
    expect(navigation.dispatch()).toBe(true);
    expect(dialog).toHaveBeenCalledOnce(); expect(parent).not.toHaveBeenCalled();
    unregister();
    navigation.dispatch(); expect(parent).toHaveBeenCalledOnce();
  });
  it('prioritizes the last mounted equal-priority surface and permits safe root fallback', () => {
    const navigation = createBackNavigation();
    const earlier = vi.fn(() => false); const later = vi.fn(() => false);
    navigation.register(earlier, 0); navigation.register(later, 0);
    expect(navigation.dispatch()).toBe(false);
    expect(later.mock.invocationCallOrder[0]).toBeLessThan(earlier.mock.invocationCallOrder[0]);
    navigation.close();
    expect(navigation.dispatch()).toBe(false);
    expect(earlier).toHaveBeenCalledOnce();
  });
});
