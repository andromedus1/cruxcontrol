import type { CatalogFailureCode } from './errors.ts';
import type { CatalogManifest } from './manifest.ts';
import type { CatalogReceipt } from '../sqlite/catalog-receipt.ts';

export type CatalogStorageStatus =
  | { status: 'empty' }
  | { status: 'ready'; receipt: CatalogReceipt }
  | { status: 'unavailable'; code: CatalogFailureCode; message: string };

export type CatalogInstallResult =
  | { ok: true; receipt: CatalogReceipt; unchanged: boolean }
  | { ok: false; code: CatalogFailureCode; message: string; retained: CatalogReceipt | null };

export interface CatalogBootstrapPort {
  catalogStatus(): Promise<CatalogStorageStatus>;
  installCatalog(manifest: CatalogManifest, compressed: ArrayBuffer): Promise<CatalogInstallResult>;
}
