import type { LibraryBackupService } from './service.ts';

export type LibraryBackupFile = Awaited<ReturnType<LibraryBackupService['exportFile']>>;

export interface LibraryBackupDeliveryResult {
  readonly status: 'download-started' | 'shared' | 'cancelled';
  readonly warning?: string;
}

export interface LibraryBackupDelivery {
  readonly kind: 'download' | 'share';
  deliver(file: LibraryBackupFile, signal?: AbortSignal): Promise<LibraryBackupDeliveryResult>;
}

const browserDelivery: LibraryBackupDelivery = {
  kind: 'download',
  async deliver(file, signal) {
    if (signal?.aborted) throw new DOMException('The backup export was cancelled.', 'AbortError');
    const url = URL.createObjectURL(new Blob([file.text], { type: 'application/json' }));
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.click();
      return { status: 'download-started' };
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};

export const browserLibraryBackupDelivery: LibraryBackupDelivery = Object.freeze(browserDelivery);
