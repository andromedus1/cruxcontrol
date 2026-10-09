/**
 * Ambient declaration for the wa-sqlite OPFS sync-access-handle VFS example,
 * which ships as untyped JS (the package types declare some example VFSes but
 * not this one).
 *
 * Typed minimally as it is used here: construct with a directory path, await its
 * `isReady` provisioning promise, read its fixed `name`. The instance is passed
 * to `CatalogDb.open` as a `SQLiteVFS` (cast at the call site — the example VFS
 * impls intentionally diverge from the strict `SQLiteVFS` interface signatures).
 */
declare module 'wa-sqlite/src/examples/AccessHandlePoolVFS.js' {
  export class AccessHandlePoolVFS {
    constructor(directoryPath: string);
    /** Resolves once the OPFS access-handle pool is provisioned. */
    readonly isReady: Promise<unknown>;
    /** Fixed VFS name ('AccessHandlePool'); pass as `open_v2`'s zVfs. */
    readonly name: string;
    xOpen(name: string | null, fileId: number, flags: number, pOutFlags: DataView): number;
    xClose(fileId: number): number;
    xRead(fileId: number, pData: Uint8Array, iOffset: number): number;
    xWrite(fileId: number, pData: Uint8Array, iOffset: number): number;
    xTruncate(fileId: number, iSize: number): number;
    xSync(fileId: number, flags: number): number;
    xFileSize(fileId: number, pSize64: DataView): number;
    xAccess(name: string, flags: number, pResOut: DataView): number;
    xDelete(name: string, syncDir: number): number;
    close(): Promise<void>;
  }
}
