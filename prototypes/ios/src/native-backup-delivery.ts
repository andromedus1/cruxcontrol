import { Directory, Encoding } from '@capacitor/filesystem';
import type { FilesystemPlugin } from '@capacitor/filesystem';
import type { SharePlugin } from '@capacitor/share';
import type { LibraryBackupDelivery, LibraryBackupDeliveryResult } from '../../../web/src/library-backup/delivery.ts';

const exportDirectory = 'cruxcontrol-backup-export';
const cleanupWarning = "The temporary backup copy could not be removed from this app's storage.";

export interface NativeBackupDeliveryDependencies {
  readonly filesystem: Pick<FilesystemPlugin, 'writeFile' | 'rmdir'>;
  readonly share: Pick<SharePlugin, 'share'>;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isMissingFileError(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'OS-PLUG-FILE-0008';
}

function isShareCancellation(cause: unknown): boolean {
  return cause instanceof Error
    ? cause.message === 'Share canceled'
    : cause === 'Share canceled';
}

function validFileUri(uri: string | undefined): uri is string {
  if (!uri) return false;
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'file:' && parsed.pathname.length > 1 && parsed.pathname !== '/';
  } catch {
    return false;
  }
}

function validateFilename(filename: string): void {
  if (!filename || filename === '.' || filename === '..' || /[\\/]/.test(filename)) {
    throw new Error('The library backup filename must be a nonempty basename.');
  }
}

export function createNativeBackupDelivery(
  dependencies: NativeBackupDeliveryDependencies,
): LibraryBackupDelivery {
  let inFlight = false;

  async function removeOwnedDirectory(): Promise<void> {
    try {
      await dependencies.filesystem.rmdir({
        path: exportDirectory,
        directory: Directory.Cache,
        recursive: true,
      });
    } catch (cause) {
      if (!isMissingFileError(cause)) throw cause;
    }
  }

  const delivery: LibraryBackupDelivery = {
    kind: 'share',
    async deliver(file, signal): Promise<LibraryBackupDeliveryResult> {
      if (inFlight) throw new Error('A library backup export is already in progress.');
      validateFilename(file.filename);
      inFlight = true;

      let outcome: LibraryBackupDeliveryResult | undefined;
      let failure: Error | undefined;
      try {
        if (signal?.aborted) {
          outcome = { status: 'cancelled' };
        } else {
          await removeOwnedDirectory();
          const { uri } = await dependencies.filesystem.writeFile({
            path: `${exportDirectory}/${file.filename}`,
            data: file.text,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
            recursive: true,
          });

          if (signal?.aborted) {
            outcome = { status: 'cancelled' };
          } else {
            if (!validFileUri(uri)) {
              throw new Error('Filesystem did not return a valid local backup file URI.');
            }
            try {
              await dependencies.share.share({ files: [uri], title: 'CruxControl library backup' });
              outcome = { status: 'shared' };
            } catch (cause) {
              if (isShareCancellation(cause)) outcome = { status: 'cancelled' };
              else throw new Error(`Unable to share the library backup: ${errorMessage(cause)}.`, { cause });
            }
          }
        }
      } catch (cause) {
        const message = errorMessage(cause);
        failure = cause instanceof Error && message.startsWith('Unable to share the library backup:')
          ? cause
          : new Error(`Unable to export the library backup: ${message}`, { cause });
      }

      try {
        await removeOwnedDirectory();
      } catch {
        if (failure) {
          const message = /[.!?]$/.test(failure.message) ? failure.message : `${failure.message}.`;
          failure = new Error(`${message} ${cleanupWarning}`, { cause: failure });
        } else {
          outcome = { ...outcome!, warning: cleanupWarning };
        }
      } finally {
        inFlight = false;
      }

      if (failure) throw failure;
      if (!outcome) throw new Error('The library backup export finished without an outcome.');
      return outcome;
    },
  };

  return Object.freeze(delivery);
}
