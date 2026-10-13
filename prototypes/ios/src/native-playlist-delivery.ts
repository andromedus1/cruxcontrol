import { createAndroidFileDelivery, type AndroidFileDeliveryDependencies } from './android-file-delivery.ts';

export function createNativePlaylistDelivery(dependencies: AndroidFileDeliveryDependencies) {
  return createAndroidFileDelivery(dependencies, 'playlist file');
}
