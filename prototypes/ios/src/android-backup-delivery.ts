import { createAndroidFileDelivery, type AndroidFileDeliveryDependencies } from './android-file-delivery.ts';

export type AndroidBackupDeliveryDependencies = AndroidFileDeliveryDependencies;

export function createAndroidBackupDelivery(dependencies: AndroidBackupDeliveryDependencies) {
  return createAndroidFileDelivery(dependencies, 'library backup');
}
