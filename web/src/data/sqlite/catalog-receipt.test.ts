// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CatalogBootstrapError } from '../catalog/errors.ts';
import type { CatalogManifest } from '../catalog/manifest.ts';
import { CATALOG_RECEIPT_DATABASE, CATALOG_RECEIPT_KEY, CATALOG_RECEIPT_STORE } from './catalog-config.ts';
import { IndexedDbCatalogReceiptStore, type CatalogReceipt } from './catalog-receipt.ts';

const manifest: CatalogManifest = {
  schemaVersion: 2,
  version: 1,
  board: 'kilter-fullride-7x10',
  file: 'kilter-7x10.v1.db.gz',
  compression: 'gzip',
  sha256: 'b'.repeat(64),
  bytesGzipped: 100,
  bytesRaw: 4096,
  generatedOn: '2026-06-14',
  source: 'legacy-aurora-kilter',
  sourceDataThrough: null,
  generatedFrom: 'receipt test fixture',
  filter: 'layout_id=8',
};

const receipt: CatalogReceipt = {
  schemaVersion: 1,
  slot: 'a',
  manifest,
  installedAt: '2026-06-14T12:00:00.000Z',
};

function waitFor<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('IndexedDbCatalogReceiptStore', () => {
  it('reads empty state and waits for durable transaction completion before returning a receipt', async () => {
    const store = await IndexedDbCatalogReceiptStore.open(new IDBFactory());
    await expect(store.read()).resolves.toBeNull();
    await expect(store.write(receipt)).resolves.toBeUndefined();
    await expect(store.read()).resolves.toEqual(receipt);
    store.close();
  });

  it('requests strict transaction durability and rejects an aborted receipt commit', async () => {
    let transactionArguments: unknown[] = [];
    const transaction = {
      error: new DOMException('disk write failed', 'UnknownError'),
      onabort: null as ((this: IDBTransaction, event: Event) => unknown) | null,
      onerror: null as ((this: IDBTransaction, event: Event) => unknown) | null,
      oncomplete: null as ((this: IDBTransaction, event: Event) => unknown) | null,
      objectStore: () => ({ put: () => ({ onerror: null, error: null }) }),
      abort: vi.fn(),
    };
    const database = {
      onversionchange: null,
      close: vi.fn(),
      transaction: (...args: unknown[]) => {
        transactionArguments = args;
        queueMicrotask(() => transaction.onabort?.call(transaction as unknown as IDBTransaction, new Event('abort')));
        return transaction;
      },
    } as unknown as IDBDatabase;
    const openRequest = {
      result: database,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
    } as unknown as IDBOpenDBRequest;
    const factory = { open: () => {
      queueMicrotask(() => openRequest.onsuccess?.call(openRequest, new Event('success')));
      return openRequest;
    } } as unknown as IDBFactory;
    const store = await IndexedDbCatalogReceiptStore.open(factory);

    await expect(store.write(receipt)).rejects.toMatchObject({ code: 'storage' });
    expect(transactionArguments).toEqual([
      CATALOG_RECEIPT_STORE,
      'readwrite',
      { durability: 'strict' },
    ]);
    store.close();
  });

  it('treats malformed stored metadata as corruption, never as empty state', async () => {
    const store = await IndexedDbCatalogReceiptStore.open(new IDBFactory());
    await store.write({ ...receipt, slot: 'other' } as unknown as CatalogReceipt);
    await expect(store.read()).rejects.toMatchObject({ code: 'storage' });
    store.close();
  });

  it('maps an uncloneable receipt to an explicit storage failure', async () => {
    const store = await IndexedDbCatalogReceiptStore.open(new IDBFactory());
    const invalid = { ...receipt, installedAt: () => 'not cloneable' } as unknown as CatalogReceipt;
    await expect(store.write(invalid)).rejects.toBeInstanceOf(CatalogBootstrapError);
    await expect(store.write(invalid)).rejects.toMatchObject({ code: 'storage' });
    store.close();
  });

  it('closes its connection on versionchange', async () => {
    const factory = new IDBFactory();
    const store = await IndexedDbCatalogReceiptStore.open(factory);
    const upgrade = factory.open(CATALOG_RECEIPT_DATABASE, 2);
    upgrade.onupgradeneeded = () => {
      if (!upgrade.result.objectStoreNames.contains(CATALOG_RECEIPT_STORE)) {
        upgrade.result.createObjectStore(CATALOG_RECEIPT_STORE);
      }
    };
    const upgraded = await waitFor(upgrade);
    expect(upgraded.version).toBe(2);
    expect(() => store.read()).toThrow(expect.objectContaining({ code: 'closed' }));
    upgraded.close();
  });

  it('reports a blocked metadata open as a storage failure', async () => {
    const factory = {
      open: () => {
        const request = {
          result: undefined,
          error: null,
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
        };
        const blockedRequest = request as unknown as IDBOpenDBRequest;
        queueMicrotask(() => blockedRequest.onblocked?.call(
          blockedRequest,
          Object.assign(new Event('blocked'), { oldVersion: 0, newVersion: 1 }) as unknown as IDBVersionChangeEvent,
        ));
        return request;
      },
    } as unknown as IDBFactory;
    await expect(IndexedDbCatalogReceiptStore.open(factory)).rejects.toMatchObject({ code: 'storage' });
  });

  it('uses the fixed metadata key and store', async () => {
    const factory = new IDBFactory();
    const store = await IndexedDbCatalogReceiptStore.open(factory);
    await store.write(receipt);
    const database = await waitFor(factory.open(CATALOG_RECEIPT_DATABASE));
    const transaction = database.transaction(CATALOG_RECEIPT_STORE, 'readonly');
    const stored = await waitFor(transaction.objectStore(CATALOG_RECEIPT_STORE).get(CATALOG_RECEIPT_KEY));
    expect(stored).toEqual(receipt);
    database.close();
    store.close();
  });
});
