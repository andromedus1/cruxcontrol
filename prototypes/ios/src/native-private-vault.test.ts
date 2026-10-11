import { describe, expect, it } from 'vitest';
import { decodeLibraryBackup, encodeLibraryBackup } from '../../../web/src/library-backup/codec.ts';
import { draftContent } from '../../../web/src/drafts/test-fixtures.ts';
import { draftRevision, localDraftId } from '../../../web/src/drafts/codec.ts';
import { countsForBackup } from '../../../web/src/private-vault/contract.ts';
import type { NativeVaultBridges } from './private-vault-plugin.ts';
import { createNativePrivateVault } from './native-private-vault.ts';

const INSTALLATION = '44444444-4444-4444-8444-444444444444';
const OWNER = 'synthetic-owner';
const DATE = new Date('2026-10-11T00:00:00.000Z');
const MAX_CHUNK = 64 * 1024;

async function digest(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer)), value => value.toString(16).padStart(2, '0')).join('');
}

function backupText(description = `🧗‍♀️${'é'.repeat(40_000)}`): string {
  return encodeLibraryBackup({
    drafts: [{
      ...draftContent({ name: 'Chunk-boundary', metadata: { description } }),
      metadata: { description },
      schemaVersion: 4,
      id: localDraftId('11111111-1111-4111-8111-111111111111'),
      revision: draftRevision(1),
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
    }],
    playlists: [],
  }, DATE);
}

function createHarness(text = backupText()) {
  const bytes = new TextEncoder().encode(text);
  let epoch = 4;
  let account: { uid: string; email: string | null } | null = { uid: OWNER, email: null };
  let interceptNextList = false;
  let resolvePendingList: ((value: unknown) => void) | null = null;
  let deferSignOut = false;
  let finishSignOut: (() => void) | null = null;
  const sealed = new Map<string, Uint8Array>();
  const active = new Map<string, { declared: number; digest: string; parts: Uint8Array[]; size: number }>();
  const calls = { stageChunkSizes: [] as number[], uploadCalls: 0, downloadFinish: 0 };
  let activeDownloadId = '';
  const snapshot = {
    slot: '00017', bytes: bytes.byteLength, sha256: '', generation: '7',
    createdAt: DATE.toISOString(), exportedAt: DATE.toISOString(),
    counts: countsForBackup(decodeLibraryBackup(text)),
  };
  let stableDigest = '';

  const currentStatus = () => ({
    configured: true, installationId: INSTALLATION, scope: 'library-v1', account,
  });
  const accountBridge = {
    status: async () => ({ configured: true, account, epoch }),
    verifySession: async () => ({ configured: true, account, epoch }),
    signIn: async () => ({ configured: true, account, epoch }),
    signOut: async () => {
      if (deferSignOut) await new Promise<void>(resolve => { finishSignOut = resolve; });
      epoch += 1;
      account = null;
      return { configured: true, account, epoch };
    },
  };
  const vaultBridge = {
    status: async () => ({ ...currentStatus(), epoch }),
    stageBegin: async ({ bytes: declared, sha256: expected, epoch: requestedEpoch }: { bytes: number; sha256: string; epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      const id = crypto.randomUUID();
      active.set(id, { declared, digest: expected, parts: [], size: 0 });
      return { id, epoch };
    },
    stageChunk: async ({ id, offset, base64, epoch: requestedEpoch }: { id: string; offset: number; base64: string; epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      const stage = active.get(id);
      if (!stage || stage.size !== offset) throw { code: 'STAGING_MISSING' };
      const part = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
      calls.stageChunkSizes.push(part.byteLength);
      if (part.byteLength > MAX_CHUNK) throw new Error('bridge chunk too large');
      stage.parts.push(part);
      stage.size += part.byteLength;
      return { id, offset: stage.size, epoch };
    },
    stageSeal: async ({ id, epoch: requestedEpoch }: { id: string; epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      const stage = active.get(id);
      if (!stage) throw { code: 'STAGING_MISSING' };
      const complete = new Uint8Array(stage.size);
      let offset = 0;
      for (const part of stage.parts) { complete.set(part, offset); offset += part.byteLength; }
      const actual = await digest(complete);
      if (actual !== stage.digest || complete.byteLength !== stage.declared) throw { code: 'STAGING_CORRUPT' };
      sealed.set(id, complete);
      active.delete(id);
      stableDigest = actual;
      snapshot.sha256 = actual;
      return { id, bytes: complete.byteLength, sha256: actual, epoch };
    },
    stageAbort: async ({ id }: { id: string }) => { active.delete(id); sealed.delete(id); return {}; },
    list: async ({ epoch: requestedEpoch }: { epoch: number }) => {
      if (interceptNextList) return await new Promise(resolve => {
        interceptNextList = false;
        resolvePendingList = resolve;
      });
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      return { responseText: JSON.stringify({ snapshots: [snapshot], capacity: { slots: 512, bytesPerSlot: 25 * 1024 * 1024 } }), epoch };
    },
    upload: async ({ id, epoch: requestedEpoch }: { id: string; epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      const stored = sealed.get(id);
      if (!stored) throw { code: 'STAGING_MISSING' };
      if (await digest(stored) !== stableDigest) throw { code: 'STAGING_CORRUPT' };
      calls.uploadCalls += 1;
      return { responseText: JSON.stringify({ snapshot, verified: true }), httpStatus: 201, epoch };
    },
    download: async ({ epoch: requestedEpoch }: { epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      activeDownloadId = crypto.randomUUID();
      return { id: activeDownloadId, bytes: bytes.byteLength, sha256: stableDigest, generation: snapshot.generation, epoch };
    },
    downloadChunk: async ({ offset, epoch: requestedEpoch }: { offset: number; epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      const part = bytes.subarray(offset, Math.min(offset + MAX_CHUNK, bytes.byteLength));
      let binary = '';
      for (let index = 0; index < part.byteLength; index += 8192) binary += String.fromCharCode(...part.subarray(index, index + 8192));
      return { id: activeDownloadId, offset, base64: btoa(binary), eof: offset + part.byteLength === bytes.byteLength, epoch };
    },
    downloadFinish: async () => { calls.downloadFinish += 1; return {}; },
    discard: async ({ id, epoch: requestedEpoch }: { id: string; epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      if (!sealed.delete(id)) throw { code: 'STAGING_MISSING' };
      return { epoch };
    },
    retainStaged: async ({ ids, epoch: requestedEpoch }: { ids: readonly string[]; epoch: number }) => {
      if (requestedEpoch !== epoch) throw { code: 'AUTH_CHANGED' };
      for (const id of sealed.keys()) if (!ids.includes(id)) sealed.delete(id);
      return { epoch };
    },
  };

  return {
    bridges: { account: accountBridge, vault: vaultBridge } as unknown as NativeVaultBridges,
    calls,
    bytes,
    snapshot,
    sealed,
    blockNextList() { interceptNextList = true; },
    resolvePendingList(value: unknown) { resolvePendingList?.(value); },
    blockSignOut() { deferSignOut = true; },
    finishSignOut() { finishSignOut?.(); },
    signBackIn() { epoch += 1; account = { uid: OWNER, email: null }; },
  };
}

describe('native private-vault adapter', () => {
  it('stages UTF-8 by bounded byte ranges and keeps sealed data retryable after adapter recreation', async () => {
    const harness = createHarness();
    const adapter = createNativePrivateVault(harness.bridges);
    const staged = await adapter.stage(OWNER, backupText());
    expect(staged.bytes).toBe(harness.bytes.byteLength);
    expect(harness.calls.stageChunkSizes.length).toBeGreaterThan(1);
    expect(Math.max(...harness.calls.stageChunkSizes)).toBeLessThanOrEqual(MAX_CHUNK);
    expect(harness.sealed.get(staged.id)).toEqual(harness.bytes);

    const restartedAdapter = createNativePrivateVault(harness.bridges);
    const receipt = await restartedAdapter.upload(OWNER, '00017', staged);
    expect(receipt.snapshot.sha256).toBe(staged.sha256);
    expect(harness.calls.uploadCalls).toBe(1);
  });

  it('incrementally decodes multibyte downloads and verifies the complete backup and receipt metadata', async () => {
    const harness = createHarness();
    const staged = await createNativePrivateVault(harness.bridges).stage(OWNER, backupText());
    const adapter = createNativePrivateVault(harness.bridges);
    const listing = await adapter.list(OWNER);
    expect(listing.snapshots).toHaveLength(1);
    expect(await adapter.download(OWNER, listing.snapshots[0]!)).toBe(backupText());
    expect(harness.calls.downloadFinish).toBe(1);
    expect(staged.sha256).toBe(listing.snapshots[0]!.sha256);
  });

  it('rejects changed-account completions, including sign-out then sign-in as the same UID', async () => {
    const harness = createHarness();
    harness.blockNextList();
    const adapter = createNativePrivateVault(harness.bridges);
    const pending = adapter.list(OWNER);
    await new Promise(resolve => setTimeout(resolve, 0));
    await adapter.signOut();
    harness.signBackIn();
    harness.resolvePendingList({ responseText: JSON.stringify({ snapshots: [], capacity: { slots: 512, bytesPerSlot: 25 * 1024 * 1024 } }), epoch: 4 });
    await expect(pending).rejects.toMatchObject({ code: 'account-changed' });
  });

  it('invalidates a transfer immediately while the native sign-out bridge is still pending', async () => {
    const harness = createHarness();
    harness.blockNextList();
    harness.blockSignOut();
    const adapter = createNativePrivateVault(harness.bridges);
    const pendingList = adapter.list(OWNER);
    await new Promise(resolve => setTimeout(resolve, 0));
    const pendingSignOut = adapter.signOut();
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(adapter.status()).rejects.toMatchObject({ code: 'account-changed' });
    await expect(adapter.list(OWNER)).rejects.toMatchObject({ code: 'account-changed' });
    harness.resolvePendingList({
      responseText: JSON.stringify({ snapshots: [], capacity: { slots: 512, bytesPerSlot: 25 * 1024 * 1024 } }),
      epoch: 4,
    });
    await expect(pendingList).rejects.toMatchObject({ code: 'account-changed' });
    harness.finishSignOut();
    await pendingSignOut;
  });

  it('rejects missing/corrupt sealed files and wrong receipts without discarding the pending bytes', async () => {
    const harness = createHarness();
    const adapter = createNativePrivateVault(harness.bridges);
    await expect(adapter.upload(OWNER, '00000', { id: crypto.randomUUID(), bytes: 1, sha256: 'a'.repeat(64) }))
      .rejects.toMatchObject({ code: 'staging-missing' });

    const wrongReceipt = createHarness();
    wrongReceipt.bridges.vault.upload = async () => ({
      responseText: JSON.stringify({ snapshot: { ...wrongReceipt.snapshot, slot: '00001' }, verified: true }),
      httpStatus: 201, epoch: 4,
    });
    const staged = await createNativePrivateVault(wrongReceipt.bridges).stage(OWNER, backupText());
    await expect(createNativePrivateVault(wrongReceipt.bridges).upload(OWNER, '00000', staged))
      .rejects.toMatchObject({ code: 'invalid-response' });
    expect(wrongReceipt.sealed.has(staged.id)).toBe(true);
    const corrupt = createHarness();
    const corruptAdapter = createNativePrivateVault(corrupt.bridges);
    const corruptStage = await corruptAdapter.stage(OWNER, backupText());
    corrupt.sealed.get(corruptStage.id)![0] ^= 0xff;
    await expect(corruptAdapter.upload(OWNER, '00000', corruptStage))
      .rejects.toMatchObject({ code: 'invalid-response' });
  });
});
