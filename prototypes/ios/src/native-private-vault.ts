import { decodeLibraryBackup, LIBRARY_BACKUP_LIMITS } from '../../../web/src/library-backup/codec.ts';
import {
  countsForBackup,
  decodeVaultListing,
  decodeVaultReceipt,
  decodeVaultSnapshot,
  decodeVaultStatus,
  VaultError,
  validateStagedBackup,
  VAULT_SLOT_PATTERN,
} from '../../../web/src/private-vault/contract.ts';
import type {
  PrivateVault,
  VaultAccount,
  VaultReceipt,
  VaultStatus,
} from '../../../web/src/private-vault/types.ts';
import { nativeVaultBridges } from './private-vault-plugin.ts';
import type { NativeVaultBridges } from './private-vault-plugin.ts';

const MAX_BRIDGE_CHUNK = 64 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new VaultError('invalid-response');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new VaultError('invalid-response');
  }
}

function readEpoch(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new VaultError('invalid-response');
  return value as number;
}

function readId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new VaultError('invalid-response');
  return value;
}

function accountResult(value: unknown): { readonly configured: boolean; readonly account: VaultAccount | null; readonly epoch: number } {
  const result = object(value);
  exactKeys(result, ['configured', 'account', 'epoch']);
  if (typeof result.configured !== 'boolean') throw new VaultError('invalid-response');
  const decoded = decodeVaultStatus({
    configured: result.configured,
    installationId: '44444444-4444-4444-8444-444444444444',
    scope: 'library-v1',
    account: result.account,
  });
  return { configured: decoded.configured, account: decoded.account, epoch: readEpoch(result.epoch) };
}

function vaultStatus(value: unknown): { readonly status: VaultStatus; readonly epoch: number } {
  const raw = object(value);
  exactKeys(raw, ['configured', 'installationId', 'scope', 'account', 'epoch']);
  const { epoch, ...publicStatus } = raw;
  return { status: decodeVaultStatus(publicStatus), epoch: readEpoch(epoch) };
}

function toVaultError(error: unknown): VaultError {
  if (error instanceof VaultError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string' ? error.code : '';
  switch (code) {
    case 'not-configured': case 'AUTH_NOT_CONFIGURED': return new VaultError('not-configured');
    case 'signed-out': case 'AUTH_REQUIRED': return new VaultError('signed-out');
    case 'account-changed': case 'AUTH_CHANGED': return new VaultError('account-changed');
    case 'not-admitted': case 'ACCOUNT_NOT_ADMITTED': case 'VAULT_HTTP_403': return new VaultError('not-admitted');
    case 'cancelled': case 'AUTH_CANCELED': return new VaultError('cancelled');
    case 'offline': case 'NETWORK_UNAVAILABLE': return new VaultError('offline');
    case 'conflict': case 'SNAPSHOT_EXISTS': case 'VAULT_HTTP_409': return new VaultError('conflict');
    case 'missing': case 'VAULT_HTTP_404': return new VaultError('missing');
    case 'staging-missing': case 'STAGING_MISSING': return new VaultError('staging-missing');
    case 'STAGING_CORRUPT': case 'DOWNLOAD_INVALID': case 'VAULT_RESPONSE_INVALID':
      return new VaultError('invalid-response');
    case 'VAULT_HTTP_400': case 'VAULT_HTTP_413': case 'VAULT_HTTP_415':
      return new VaultError('invalid-backup');
    case 'invalid-response': return new VaultError('invalid-response');
    case 'invalid-backup': return new VaultError('invalid-backup');
    case 'VAULT_HTTP_401': return new VaultError('signed-out');
    default: return new VaultError('unavailable');
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary);
}

function decodeBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || value.length > Math.ceil(MAX_BRIDGE_CHUNK / 3) * 4) {
    throw new VaultError('invalid-response');
  }
  let binary: string;
  try { binary = atob(value); } catch { throw new VaultError('invalid-response'); }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes.length > MAX_BRIDGE_CHUNK || encodeBase64(bytes) !== value) throw new VaultError('invalid-response');
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  try {
    const input = new Uint8Array(bytes.byteLength);
    input.set(bytes);
    const digest = await crypto.subtle.digest('SHA-256', input.buffer);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new VaultError('unavailable');
  }
}

function checkedSlot(slot: string): string {
  if (!VAULT_SLOT_PATTERN.test(slot) || Number(slot) > 511 || String(Number(slot)).padStart(5, '0') !== slot) {
    throw new VaultError('invalid-backup');
  }
  return slot;
}

function ensureBackupText(text: string): { readonly bytes: Uint8Array; readonly backup: ReturnType<typeof decodeLibraryBackup> } {
  let backup: ReturnType<typeof decodeLibraryBackup>;
  try { backup = decodeLibraryBackup(text); } catch { throw new VaultError('invalid-backup'); }
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength < 1 || bytes.byteLength > LIBRARY_BACKUP_LIMITS.bytes) throw new VaultError('invalid-backup');
  try {
    if (new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== text) throw new VaultError('invalid-backup');
  } catch { throw new VaultError('invalid-backup'); }
  return { bytes, backup };
}

export function createNativePrivateVault(bridges: NativeVaultBridges = nativeVaultBridges): PrivateVault {
  let observedEpoch: number | null = null;
  let operationGeneration = 0;
  let accountOperationPending = false;

  const assertGeneration = (expectedGeneration: number): void => {
    if (operationGeneration !== expectedGeneration) throw new VaultError('account-changed');
  };

  const current = async (
    uid: string | undefined,
    expectedGeneration: number,
    allowPendingAccountOperation = false,
  ): Promise<{ readonly status: VaultStatus; readonly epoch: number }> => {
    try {
      if (accountOperationPending && !allowPendingAccountOperation) throw new VaultError('account-changed');
      const state = vaultStatus(await bridges.vault.status());
      assertGeneration(expectedGeneration);
      if (accountOperationPending && !allowPendingAccountOperation) throw new VaultError('account-changed');
      observedEpoch = state.epoch;
      if (!state.status.configured) throw new VaultError('not-configured');
      if (!state.status.account) throw new VaultError('signed-out');
      if (uid !== undefined && state.status.account.uid !== uid) throw new VaultError('account-changed');
      return state;
    } catch (error) { throw toVaultError(error); }
  };

  const verifyEpoch = (value: unknown, expectedEpoch: number, expectedGeneration: number): void => {
    const response = object(value);
    assertGeneration(expectedGeneration);
    if (accountOperationPending || readEpoch(response.epoch) !== expectedEpoch || observedEpoch !== expectedEpoch) {
      throw new VaultError('account-changed');
    }
  };

  const invoke = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation(); } catch (error) { throw toVaultError(error); }
  };

  return {
    async status() {
      const generation = operationGeneration;
      try {
        if (accountOperationPending) throw new VaultError('account-changed');
        const state = vaultStatus(await bridges.vault.status());
        assertGeneration(generation);
        if (accountOperationPending) throw new VaultError('account-changed');
        observedEpoch = state.epoch;
        return state.status;
      } catch (error) { throw toVaultError(error); }
    },

    async signIn() {
      const generation = ++operationGeneration;
      accountOperationPending = true;
      observedEpoch = null;
      try {
        const result = accountResult(await bridges.account.signIn());
        assertGeneration(generation);
        observedEpoch = result.epoch;
        if (!result.configured) throw new VaultError('not-configured');
        if (!result.account) throw new VaultError('signed-out');
        const state = await current(result.account.uid, generation, true);
        if (state.epoch !== result.epoch) throw new VaultError('account-changed');
        accountOperationPending = false;
        return result.account;
      } catch (error) {
        if (operationGeneration === generation) accountOperationPending = false;
        throw toVaultError(error);
      }
    },

    async signOut() {
      const generation = ++operationGeneration;
      accountOperationPending = true;
      observedEpoch = null;
      try {
        const result = accountResult(await bridges.account.signOut());
        assertGeneration(generation);
        observedEpoch = result.epoch;
        if (result.account !== null) throw new VaultError('invalid-response');
        const status = vaultStatus(await bridges.vault.status());
        assertGeneration(generation);
        observedEpoch = status.epoch;
        if (status.status.account !== null) throw new VaultError('account-changed');
        accountOperationPending = false;
      } catch (error) {
        if (operationGeneration === generation) accountOperationPending = false;
        throw toVaultError(error);
      }
    },

    async list(uid) {
      const generation = operationGeneration;
      const { epoch } = await current(uid, generation);
      return invoke(async () => {
        const raw = object(await bridges.vault.list({ uid, epoch }));
        exactKeys(raw, ['responseText', 'epoch']);
        verifyEpoch(raw, epoch, generation);
        if (typeof raw.responseText !== 'string' || raw.responseText.length > 512 * 1024) {
          throw new VaultError('invalid-response');
        }
        let decoded: unknown;
        try { decoded = JSON.parse(raw.responseText) as unknown; } catch { throw new VaultError('invalid-response'); }
        return decodeVaultListing(decoded);
      });
    },

    async stage(uid, text) {
      const generation = operationGeneration;
      const { epoch } = await current(uid, generation);
      const { bytes } = ensureBackupText(text);
      const digest = await sha256(bytes);
      assertGeneration(generation);
      let id: string | null = null;
      try {
        const begin = object(await bridges.vault.stageBegin({ uid, epoch, bytes: bytes.byteLength, sha256: digest }));
        exactKeys(begin, ['id', 'epoch']);
        verifyEpoch(begin, epoch, generation);
        id = readId(begin.id);
        for (let offset = 0; offset < bytes.byteLength; offset += MAX_BRIDGE_CHUNK) {
          const end = Math.min(offset + MAX_BRIDGE_CHUNK, bytes.byteLength);
          const response = object(await bridges.vault.stageChunk({
            uid, epoch, id, offset, base64: encodeBase64(bytes.subarray(offset, end)),
          }));
          exactKeys(response, ['id', 'offset', 'epoch']);
          verifyEpoch(response, epoch, generation);
          if (response.id !== id || response.offset !== end) throw new VaultError('invalid-response');
        }
        const seal = object(await bridges.vault.stageSeal({ uid, epoch, id }));
        exactKeys(seal, ['id', 'bytes', 'sha256', 'epoch']);
        verifyEpoch(seal, epoch, generation);
        if (seal.id !== id) throw new VaultError('invalid-response');
        const staged = validateStagedBackup({ id, bytes: seal.bytes, sha256: seal.sha256 });
        if (staged.bytes !== bytes.byteLength || staged.sha256 !== digest) throw new VaultError('invalid-response');
        return staged;
      } catch (error) {
        if (id !== null) {
          try { await bridges.vault.stageAbort({ uid, epoch, id }); } catch { /* A sealed file remains discoverable for authoritative cleanup. */ }
        }
        throw toVaultError(error);
      }
    },

    async upload(uid, slot, stagedValue) {
      checkedSlot(slot);
      const staged = validateStagedBackup(stagedValue);
      const generation = operationGeneration;
      const { epoch } = await current(uid, generation);
      return invoke(async () => {
        const raw = object(await bridges.vault.upload({
          uid, epoch, slot, id: staged.id, bytes: staged.bytes, sha256: staged.sha256,
        }));
        exactKeys(raw, ['responseText', 'httpStatus', 'epoch']);
        verifyEpoch(raw, epoch, generation);
        if ((raw.httpStatus !== 200 && raw.httpStatus !== 201) || typeof raw.responseText !== 'string'
          || raw.responseText.length > 64 * 1024) throw new VaultError('invalid-response');
        let decoded: unknown;
        try { decoded = JSON.parse(raw.responseText) as unknown; } catch { throw new VaultError('invalid-response'); }
        const receipt: VaultReceipt = decodeVaultReceipt(decoded);
        if (receipt.snapshot.slot !== slot || receipt.snapshot.bytes !== staged.bytes
          || receipt.snapshot.sha256 !== staged.sha256) throw new VaultError('invalid-response');
        return receipt;
      });
    },

    async download(uid, snapshotValue) {
      const snapshot = decodeVaultSnapshot(snapshotValue);
      const generation = operationGeneration;
      const { epoch } = await current(uid, generation);
      let transferId: string | null = null;
      try {
        const start = object(await bridges.vault.download({
          uid, epoch, slot: snapshot.slot, generation: snapshot.generation,
          bytes: snapshot.bytes, sha256: snapshot.sha256,
        }));
        exactKeys(start, ['id', 'bytes', 'sha256', 'generation', 'epoch']);
        verifyEpoch(start, epoch, generation);
        transferId = readId(start.id);
        if (start.bytes !== snapshot.bytes || start.sha256 !== snapshot.sha256
          || start.generation !== snapshot.generation) throw new VaultError('invalid-response');

        const rawBytes = new Uint8Array(snapshot.bytes);
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const textParts: string[] = [];
        let offset = 0;
        while (offset < snapshot.bytes) {
          const response = object(await bridges.vault.downloadChunk({ uid, epoch, id: transferId, offset }));
          exactKeys(response, ['id', 'offset', 'base64', 'eof', 'epoch']);
          verifyEpoch(response, epoch, generation);
          if (response.id !== transferId || response.offset !== offset || typeof response.eof !== 'boolean') {
            throw new VaultError('invalid-response');
          }
          const chunk = decodeBase64(response.base64);
          const nextOffset = offset + chunk.byteLength;
          if (chunk.byteLength === 0 || nextOffset > snapshot.bytes || response.eof !== (nextOffset === snapshot.bytes)) {
            throw new VaultError('invalid-response');
          }
          rawBytes.set(chunk, offset);
          try { textParts.push(decoder.decode(chunk, { stream: true })); } catch { throw new VaultError('invalid-backup'); }
          offset = nextOffset;
        }
        try { textParts.push(decoder.decode()); } catch { throw new VaultError('invalid-backup'); }
        if (await sha256(rawBytes) !== snapshot.sha256) throw new VaultError('invalid-response');
        const text = textParts.join('');
        if (new TextEncoder().encode(text).byteLength !== snapshot.bytes) throw new VaultError('invalid-backup');
        let backup: ReturnType<typeof decodeLibraryBackup>;
        try { backup = decodeLibraryBackup(text); } catch { throw new VaultError('invalid-backup'); }
        const counts = countsForBackup(backup);
        if (backup.exportedAt !== snapshot.exportedAt
          || Object.keys(counts).some(key => counts[key as keyof typeof counts] !== snapshot.counts[key as keyof typeof snapshot.counts])) {
          throw new VaultError('invalid-response');
        }
        return text;
      } catch (error) {
        throw toVaultError(error);
      } finally {
        if (transferId !== null) {
          try { await bridges.vault.downloadFinish({ uid, epoch, id: transferId }); } catch { /* Startup removes abandoned native download files. */ }
        }
      }
    },

    async discard(uid, stagedId) {
      const id = readId(stagedId);
      const generation = operationGeneration;
      const { epoch } = await current(uid, generation);
      await invoke(async () => {
        const result = object(await bridges.vault.discard({ uid, epoch, id }));
        exactKeys(result, ['epoch']);
        verifyEpoch(result, epoch, generation);
      });
    },

    async retainStaged(uid, ids) {
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !UUID.test(id))
        || new Set(ids).size !== ids.length) throw new VaultError('invalid-response');
      const generation = operationGeneration;
      const { epoch } = await current(uid, generation);
      await invoke(async () => {
        const result = object(await bridges.vault.retainStaged({ uid, epoch, ids }));
        exactKeys(result, ['epoch']);
        verifyEpoch(result, epoch, generation);
      });
    },
  };
}

export const nativePrivateVault = createNativePrivateVault();
