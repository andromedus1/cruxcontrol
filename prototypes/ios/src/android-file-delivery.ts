import type { LibraryBackupDelivery, LibraryBackupDeliveryResult } from '../../../web/src/library-backup/delivery.ts';
import type { LibraryBackupFilePlugin } from './library-backup-file-plugin.ts';

export interface AndroidFileDeliveryDependencies {
  readonly filePicker: LibraryBackupFilePlugin;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function errorCode(cause: unknown): unknown {
  return cause && typeof cause === 'object' && 'code' in cause
    ? (cause as { code?: unknown }).code
    : undefined;
}

function isSaveCancellation(cause: unknown): boolean {
  return errorCode(cause) === 'FILE_SAVE_CANCELED';
}

function deliveryFailureMessage(cause: unknown, label: string): string {
  const message = errorMessage(cause).trim();
  const punctuation = /[.!?]$/.test(message) ? '' : '.';
  const partialFileCaveat = errorCode(cause) === 'FILE_SAVE_FAILED'
    ? ' An empty or partial file may remain in the chosen location.'
    : '';
  return `Unable to save the ${label}: ${message}${punctuation}${partialFileCaveat}`;
}

function validateFilename(filename: string): void {
  if (!filename || filename === '.' || filename === '..' || /[\\/]/.test(filename) || !filename.endsWith('.json')) {
    throw new Error('The exported filename must be a JSON basename.');
  }
}

function isContentUri(uri: string | undefined): uri is string {
  if (!uri) return false;
  try {
    return new URL(uri).protocol === 'content:';
  } catch {
    return false;
  }
}

export function createAndroidFileDelivery(
  dependencies: AndroidFileDeliveryDependencies,
  label: string,
): LibraryBackupDelivery {
  let inFlight = false;

  return Object.freeze({
    kind: 'save' as const,
    async deliver(
      file: Parameters<LibraryBackupDelivery['deliver']>[0],
      signal?: Parameters<LibraryBackupDelivery['deliver']>[1],
    ): Promise<LibraryBackupDeliveryResult> {
      if (inFlight) throw new Error(`A ${label} save is already in progress.`);
      validateFilename(file.filename);
      if (signal?.aborted) return { status: 'cancelled' };

      inFlight = true;
      try {
        // AbortSignal cannot cancel the Android picker/write operation. Once it starts,
        // report only the native result so a completed file is never called canceled.
        const result = await dependencies.filePicker.save({ filename: file.filename, text: file.text });
        if (!isContentUri(result.uri)) throw new Error('The Android file picker did not return a content URI.');
        return { status: 'saved' };
      } catch (cause) {
        if (isSaveCancellation(cause)) return { status: 'cancelled' };
        throw new Error(deliveryFailureMessage(cause, label), { cause });
      } finally {
        inFlight = false;
      }
    },
  });
}
