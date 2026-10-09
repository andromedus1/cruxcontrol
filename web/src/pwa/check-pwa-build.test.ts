// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPwaBuild } from '../../scripts/check-pwa-build.mjs';

const WORKER_ASSET = 'assets/catalog.worker-a1b2.js';
const WASM_ASSET = 'assets/wa-sqlite-c3d4.wasm';
const ARTWORK_ASSET = 'assets/kilter_fullride_7x10-reference.png';
const WASM_MAGIC = Buffer.from([0x00, 0x61, 0x73, 0x6d]);

interface FixtureOptions {
  workerReference?: string | null;
  wasmReference?: string;
  workerSource?: string;
  glueSource?: string;
  wasmBytes?: Buffer;
  precacheAssets?: string[];
  includeWorker?: boolean;
  includeGlue?: boolean;
  includeWasm?: boolean;
  includeServiceWorker?: boolean;
}

interface BuildFixture {
  dist: string;
  remove: (assetPath: string) => void;
  cleanup: () => void;
}

function createBuildFixture({
  workerReference = `/${WORKER_ASSET}`,
  wasmReference = `/${WASM_ASSET}`,
  workerSource = 'import "./sqlite/wa-sqlite-glue.js";',
  glueSource,
  wasmBytes = WASM_MAGIC,
  precacheAssets = [WORKER_ASSET, WASM_ASSET, ARTWORK_ASSET],
  includeWorker = true,
  includeGlue = true,
  includeWasm = true,
  includeServiceWorker = true,
}: FixtureOptions = {}): BuildFixture {
  const dist = mkdtempSync(join(tmpdir(), 'crux-pwa-build-'));
  const write = (assetPath: string, contents: string | Buffer) => {
    const filePath = join(dist, assetPath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  };

  write(
    'manifest.webmanifest',
    JSON.stringify({
      name: 'CruxControl',
      start_url: '/',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192' },
        { src: 'icons/icon-512.png', sizes: '512x512' },
        {
          src: 'icons/icon-512-maskable.png',
          sizes: '512x512',
          purpose: 'any maskable',
        },
      ],
    }),
  );
  write('icons/icon-192.png', 'icon');
  write('icons/icon-512.png', 'icon');
  write('icons/icon-512-maskable.png', 'icon');
  write(
    'index.html',
    '<script type="module" src="/assets/index-entry.js"></script>',
  );
  write(
    'assets/index-entry.js',
    'import { shellReady } from "./app-shell.js";import("./catalog-route.js");void shellReady;' +
      'navigator.serviceWorker.register(new URL("/sw.js", import.meta.url));',
  );
  write('assets/app-shell.js', 'export const shellReady = true;');
  write(
    'assets/catalog-route.js',
    workerReference
      ? `new Worker(new URL("${workerReference}", import.meta.url), { type: "module" });`
      : 'export const catalogRouteReady = true;',
  );
  if (includeWorker) write(WORKER_ASSET, workerSource);
  if (includeGlue) {
    write(
      'assets/sqlite/wa-sqlite-glue.js',
      glueSource ?? `new URL("${wasmReference}", import.meta.url).href;`,
    );
  }
  if (includeWasm) write(WASM_ASSET, wasmBytes);

  if (includeServiceWorker) {
    const entries = precacheAssets.map(
      (assetPath) => `{url:${JSON.stringify(assetPath)},revision:null}`,
    );
    write(
      'sw.js',
      `self.precacheAndRoute([${entries.join(',')}]);`,
    );
  }

  return {
    dist,
    remove: (assetPath: string) => rmSync(join(dist, assetPath), { force: true }),
    cleanup: () => rmSync(dist, { recursive: true, force: true }),
  };
}

function withBuildFixture(options: FixtureOptions, run: (fixture: BuildFixture) => void): void {
  const fixture = createBuildFixture(options);
  try {
    run(fixture);
  } finally {
    fixture.cleanup();
  }
}

describe('PWA build artifacts', () => {
  it('follows the application module graph to the catalog worker and WASM', () => {
    withBuildFixture({}, ({ dist }) => {
      const result = checkPwaBuild(dist);

      expect(result.precacheReferencesDb).toBe(false);
      expect(result.precacheReferencesPrivateArtwork).toBe(true);
      expect(result.iconCount).toBe(3);
      expect(result.catalogWorkerAsset).toBe(WORKER_ASSET);
      expect(result.catalogWasmAsset).toBe(WASM_ASSET);
    });
  });

  it('resolves relative worker and WASM URLs from their importing modules', () => {
    withBuildFixture(
      {
        workerReference: './catalog.worker-a1b2.js',
        wasmReference: '../wa-sqlite-c3d4.wasm',
        glueSource: 'new URL("../wa-sqlite-c3d4.wasm", import.meta.url).href;',
      },
      ({ dist }) => {
        expect(checkPwaBuild(dist)).toMatchObject({
          catalogWorkerAsset: WORKER_ASSET,
          catalogWasmAsset: WASM_ASSET,
        });
      },
    );
  });

  it('does not accept orphan worker and WASM files or their precache entries', () => {
    withBuildFixture({ workerReference: null }, ({ dist }) => {
      expect(() => checkPwaBuild(dist)).toThrow(/no catalog worker reference/);
    });
  });

  it('does not accept a precached orphan WASM when the reachable glue has no WASM reference', () => {
    withBuildFixture({ glueSource: 'export const ready = true;' }, ({ dist }) => {
      expect(() => checkPwaBuild(dist)).toThrow(/WASM/);
    });
  });

  it('fails when the app-referenced catalog worker is missing', () => {
    withBuildFixture({ includeWorker: false }, ({ dist }) => {
      expect(() => checkPwaBuild(dist)).toThrow(WORKER_ASSET);
    });
  });

  it('fails when a worker module imports missing SQLite glue', () => {
    withBuildFixture(
      { workerSource: 'import "./sqlite/missing-wa-sqlite-glue.js";' },
      ({ dist }) => {
        expect(() => checkPwaBuild(dist)).toThrow('missing-wa-sqlite-glue.js');
      },
    );
  });

  it('fails when the worker graph references a missing SQLite WASM', () => {
    withBuildFixture({ includeWasm: false }, ({ dist }) => {
      expect(() => checkPwaBuild(dist)).toThrow(WASM_ASSET);
    });
  });

  it('fails when the referenced WASM has an invalid magic header', () => {
    withBuildFixture({ wasmBytes: Buffer.from('not wasm') }, ({ dist }) => {
      expect(() => checkPwaBuild(dist)).toThrow(/invalid WASM magic header/);
    });
  });

  it('requires the referenced worker file to be nonempty', () => {
    withBuildFixture({}, ({ dist }) => {
      writeFileSync(join(dist, WORKER_ASSET), '');
      expect(() => checkPwaBuild(dist)).toThrow(/catalog worker target .* is empty/);
    });
  });

  it.each([
    ['catalog worker', WORKER_ASSET],
    ['wa-sqlite WASM', WASM_ASSET],
  ] as const)('requires the exact %s path in the service worker precache', (label, missingAsset) => {
    withBuildFixture(
      { precacheAssets: [WORKER_ASSET, WASM_ASSET, ARTWORK_ASSET].filter((asset) => asset !== missingAsset) },
      ({ dist }) => {
        expect(() => checkPwaBuild(dist)).toThrow(missingAsset);
        expect(() => checkPwaBuild(dist)).toThrow(`does not precache ${label}`);
      },
    );
  });

  it('does not let a same-named asset in another directory satisfy precache', () => {
    withBuildFixture(
      { precacheAssets: ['other/catalog.worker-a1b2.js', WASM_ASSET, ARTWORK_ASSET] },
      ({ dist }) => {
        expect(() => checkPwaBuild(dist)).toThrow(
          `does not precache catalog worker "${WORKER_ASSET}"`,
        );
      },
    );
  });

  it('fails when the manifest is missing', () => {
    withBuildFixture({}, ({ dist, remove }) => {
      remove('manifest.webmanifest');
      expect(() => checkPwaBuild(dist)).toThrow('manifest.webmanifest is missing');
    });
  });

  it('fails when a declared icon is missing', () => {
    withBuildFixture({}, ({ dist, remove }) => {
      remove('icons/icon-192.png');
      expect(() => checkPwaBuild(dist)).toThrow('icon-192.png');
    });
  });

  it('fails when the generated service worker is missing', () => {
    withBuildFixture({ includeServiceWorker: false }, ({ dist }) => {
      expect(() => checkPwaBuild(dist)).toThrow('dist/sw.js');
    });
  });

  it('fails when a catalog database is precached', () => {
    withBuildFixture(
      { precacheAssets: [WORKER_ASSET, WASM_ASSET, ARTWORK_ASSET, 'catalog/catalog.db.gz'] },
      ({ dist }) => {
        expect(() => checkPwaBuild(dist)).toThrow(/catalog DB/);
      },
    );
  });

  it('fails when private Fullride artwork is not precached', () => {
    withBuildFixture(
      { precacheAssets: [WORKER_ASSET, WASM_ASSET] },
      ({ dist }) => {
        expect(() => checkPwaBuild(dist)).toThrow(/private Fullride artwork/);
      },
    );
  });
});
