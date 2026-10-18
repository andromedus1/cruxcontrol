import { describe, expect, it, vi } from 'vitest';
import { createBackNavigation } from '../../../web/src/app/back-navigation.ts';
import { bindAndroidBack } from './native-back-navigation.ts';

describe('Android hardware Back lifecycle', () => {
  it('dispatches mounted actions, minimizes a safe root, and ignores callbacks after disposal', async () => {
    let press!: () => void;
    const remove = vi.fn(async () => {}); const minimizeApp = vi.fn(async () => {});
    const addListener = vi.fn(async (_event, callback) => { press = callback; return { remove }; });
    const navigation = createBackNavigation();
    const dispose = await bindAndroidBack(navigation, { addListener, minimizeApp });
    const closeDialog = vi.fn(); const unregister = navigation.register(closeDialog, 100);
    press(); expect(closeDialog).toHaveBeenCalledOnce(); expect(minimizeApp).not.toHaveBeenCalled();
    unregister(); press(); expect(minimizeApp).toHaveBeenCalledOnce();
    dispose(); press(); expect(minimizeApp).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
  });
});
