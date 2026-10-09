/** Main-thread ports backed by the serialized, Worker-owned catalog runtime. */

import { transfer, wrap, type Remote } from 'comlink';
import type { CatalogBootstrapPort, CatalogInstallResult, CatalogStorageStatus } from '../catalog/bootstrap-port.ts';
import { CatalogBootstrapError } from '../catalog/errors.ts';
import type { CatalogManifest } from '../catalog/manifest.ts';
import type { CatalogPort, Row, SqlValue } from '../port.ts';
import type { CatalogDbApi } from './catalog-db-api.ts';
import { isOpfsSyncAccessSupported } from './opfs-support.ts';
import { CatalogQueryError } from './errors.ts';

export class UnsupportedEnvironmentError extends CatalogBootstrapError {
  constructor(message = 'This browser does not support the OPFS and Web Locks required by the local catalog.') {
    super('unsupported', message);
    this.name = 'UnsupportedEnvironmentError';
    Object.setPrototypeOf(this, UnsupportedEnvironmentError.prototype);
  }
}

export type WorkerFactory = () => Worker;

export interface CatalogPortDeadlines {
  rpcMs: number;
  closeMs: number;
}

const DEFAULT_DEADLINES: CatalogPortDeadlines = { rpcMs: 60_000, closeMs: 3_000 };

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./catalog.worker.ts', import.meta.url), { type: 'module' });
}

export class SqliteCatalogPort implements CatalogPort, CatalogBootstrapPort {
  private readonly remote: Remote<CatalogDbApi>;
  private readonly pending = new Set<(error: CatalogBootstrapError) => void>();
  private tail: Promise<void> = Promise.resolve();
  private dead = false;
  private closing = false;
  private terminated = false;
  private readonly onWorkerError: (event: Event) => void;
  private readonly onMessageError: (event: MessageEvent) => void;

  private constructor(
    private readonly worker: Worker,
    deadlines: CatalogPortDeadlines,
    remote: Remote<CatalogDbApi>,
  ) {
    this.remote = remote;
    this.deadlines = deadlines;
    this.onWorkerError = (event) => {
      event.preventDefault();
      this.poison(new CatalogBootstrapError('closed', 'Catalog worker failed'));
    };
    this.onMessageError = () => this.poison(new CatalogBootstrapError('closed', 'Catalog worker sent an unreadable message'));
    worker.addEventListener('error', this.onWorkerError);
    worker.addEventListener('messageerror', this.onMessageError);
  }

  private readonly deadlines: CatalogPortDeadlines;

  static create(
    workerFactory: WorkerFactory = defaultWorkerFactory,
    deadlines: CatalogPortDeadlines = DEFAULT_DEADLINES,
  ): SqliteCatalogPort {
    if (!isOpfsSyncAccessSupported()) throw new UnsupportedEnvironmentError();
    const worker = workerFactory();
    return new SqliteCatalogPort(worker, deadlines, wrap<CatalogDbApi>(worker));
  }

  query<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    return this.enqueue(async () => {
      try {
        const rows = await this.call(() => this.remote.query(sql, params ? [...params] : undefined));
        return rows as T[];
      } catch (cause) {
        if (cause instanceof CatalogBootstrapError) throw cause;
        if (cause instanceof CatalogQueryError) throw cause;
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new CatalogQueryError(message, sql, { cause });
      }
    });
  }

  async isReady(): Promise<boolean> {
    const status = await this.catalogStatus();
    if (status.status === 'unavailable') throw new CatalogBootstrapError(status.code, status.message);
    return status.status === 'ready';
  }

  catalogStatus(): Promise<CatalogStorageStatus> {
    return this.enqueue<CatalogStorageStatus>(async () => {
      const status = await this.call<CatalogStorageStatus>(() => this.remote.catalogStatus());
      if (status.status === 'unavailable' && (status.code === 'busy' || status.code === 'closed')) {
        this.poison(new CatalogBootstrapError(status.code, status.message));
      }
      return status;
    });
  }

  installCatalog(manifest: CatalogManifest, compressed: ArrayBuffer): Promise<CatalogInstallResult> {
    return this.enqueue<CatalogInstallResult>(async () => {
      const result = await this.call<CatalogInstallResult>(() => this.remote.installCatalog(
        manifest,
        transfer(compressed, [compressed]),
      ));
      if (!result.ok && (result.code === 'busy' || result.code === 'closed')) {
        this.poison(new CatalogBootstrapError(result.code, result.message));
      }
      return result;
    });
  }

  close(): Promise<void> {
    if (this.closing) return this.tail;
    this.closing = true;
    const result = this.tail.then(async () => {
      if (this.dead) return;
      try {
        await this.call(() => this.remote.close(), this.deadlines.closeMs);
      } finally {
        this.terminate();
        this.dead = true;
      }
    });
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new CatalogBootstrapError('closed', 'Catalog port is closing'));
    if (this.dead) return Promise.reject(new CatalogBootstrapError('closed', 'Catalog worker is closed'));
    const result = this.tail.then(operation, operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  private call<T>(operation: () => Promise<T>, timeoutMs = this.deadlines.rpcMs): Promise<T> {
    if (this.dead) return Promise.reject(new CatalogBootstrapError('closed', 'Catalog worker is closed'));
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.pending.delete(onPoison);
        callback();
      };
      const onPoison = (error: CatalogBootstrapError) => finish(() => reject(error));
      const timer = setTimeout(() => {
        this.poison(new CatalogBootstrapError('closed', 'Catalog worker did not respond before its deadline'));
      }, timeoutMs);
      this.pending.add(onPoison);
      Promise.resolve().then(operation).then(
        (value) => finish(() => resolve(value)),
        (cause: unknown) => finish(() => reject(cause)),
      );
    });
  }

  private poison(error: CatalogBootstrapError): void {
    if (this.dead) return;
    this.dead = true;
    this.terminate();
    for (const reject of [...this.pending]) reject(error);
  }

  private terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.worker.removeEventListener('error', this.onWorkerError);
    this.worker.removeEventListener('messageerror', this.onMessageError);
    this.worker.terminate();
  }
}
