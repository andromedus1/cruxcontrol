import type { AppPlugin } from '@capacitor/app';
import type { createBackNavigation } from '../../../web/src/app/back-navigation.ts';

export async function bindAndroidBack(navigation: ReturnType<typeof createBackNavigation>, app: Pick<AppPlugin, 'addListener' | 'minimizeApp'>) {
  let disposed = false;
  const handle = await app.addListener('backButton', () => {
    if (!disposed && !navigation.dispatch()) void app.minimizeApp();
  });
  return () => {
    disposed = true;
    navigation.close();
    void handle.remove().catch(() => undefined);
  };
}
