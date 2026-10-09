// PWA build-artifact assertion.
//
// Run after `vite build`: node scripts/check-pwa-build.mjs
// The focused Vitest contract tests use isolated filesystem fixtures; CI runs
// this check against its fresh production output.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST = join(__dirname, '..', 'dist');
const CATALOG_WORKER_NAME = /^catalog\.worker-[A-Za-z0-9_-]+\.js$/;
const CATALOG_WASM_NAME = /^wa-sqlite-[A-Za-z0-9_-]+\.wasm$/;
const WASM_MAGIC = Buffer.from([0x00, 0x61, 0x73, 0x6d]);

function relativeAssetPath(distRoot, absolutePath) {
  return relative(distRoot, absolutePath).split(sep).join('/');
}

function isRemoteReference(reference) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference);
}

function resolveLocalReference(distRoot, importerPath, reference, description) {
  const pathWithoutSuffix = reference.split(/[?#]/, 1)[0];
  if (!pathWithoutSuffix || isRemoteReference(pathWithoutSuffix)) return null;

  // Emitted Vite chunks use relative or root-relative URLs. Ignore bare
  // specifiers so this bounded checker never treats a package name as a path.
  if (!pathWithoutSuffix.startsWith('/') && !pathWithoutSuffix.startsWith('.')) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathWithoutSuffix);
  } catch {
    throw new Error(
      `PWA build check: ${description} has an invalid escaped path "${reference}".`,
    );
  }

  const absolutePath = resolve(
    distRoot,
    decodedPath.startsWith('/')
      ? `.${decodedPath}`
      : join(dirname(importerPath), decodedPath),
  );
  const fromRoot = relative(distRoot, absolutePath);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(
      `PWA build check: ${description} resolves outside dist/ to "${reference}".`,
    );
  }
  return absolutePath;
}

function resolvePrecacheReference(distRoot, reference) {
  const pathWithoutSuffix = reference.split(/[?#]/, 1)[0];
  if (!pathWithoutSuffix || isRemoteReference(pathWithoutSuffix)) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathWithoutSuffix);
  } catch {
    throw new Error(
      `PWA build check: service worker precache URL "${reference}" has an invalid escaped path.`,
    );
  }
  const absolutePath = resolve(
    distRoot,
    decodedPath.startsWith('/') ? `.${decodedPath}` : decodedPath,
  );
  const fromRoot = relative(distRoot, absolutePath);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(
      `PWA build check: service worker precache URL "${reference}" resolves outside dist/.`,
    );
  }
  return absolutePath;
}

function requireNonemptyFile(filePath, description, distRoot) {
  const assetPath = relativeAssetPath(distRoot, filePath);
  if (!existsSync(filePath)) {
    throw new Error(`PWA build check: ${description} target "${assetPath}" is missing.`);
  }
  if (!statSync(filePath).isFile() || statSync(filePath).size === 0) {
    throw new Error(`PWA build check: ${description} target "${assetPath}" is empty.`);
  }
}

function moduleEntrypoints(distRoot, html) {
  const entrypoints = new Set();
  for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
    const attributes = new Map();
    for (const attribute of tag[0].matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    )) {
      attributes.set(
        attribute[1].toLowerCase(),
        attribute[2] ?? attribute[3] ?? attribute[4] ?? '',
      );
    }
    if (attributes.get('type')?.toLowerCase() !== 'module') continue;
    const src = attributes.get('src');
    if (!src) continue;

    const entrypoint = resolveLocalReference(
      distRoot,
      join(distRoot, 'index.html'),
      src,
      'index.html module script',
    );
    if (entrypoint) entrypoints.add(entrypoint);
  }
  return [...entrypoints];
}

function moduleReferences(source) {
  const references = new Set();
  const patterns = [
    // Side-effect imports, including Vite's minified `import"./chunk.js"`.
    /\bimport\s*(['"])([^'"\\\r\n]+)\1/g,
    // Static imports and re-exports, including minified `import{x}from"..."`.
    /\b(?:import|export)\s*[^;'"`]*?\bfrom\s*(['"])([^'"\\\r\n]+)\1/g,
    // Only literal dynamic imports are part of the emitted module graph.
    /\bimport\s*\(\s*(['"])([^'"\\\r\n]+)\1\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) references.add(match[2]);
  }
  return [...references];
}

function walkJavaScriptGraph(distRoot, roots, description) {
  const pending = [...roots];
  const visited = new Set();
  const sources = new Map();

  while (pending.length > 0) {
    const modulePath = pending.pop();
    if (visited.has(modulePath)) continue;
    visited.add(modulePath);

    requireNonemptyFile(modulePath, `${description} module`, distRoot);
    const source = readFileSync(modulePath, 'utf8');
    sources.set(modulePath, source);

    for (const reference of moduleReferences(source)) {
      const targetPath = resolveLocalReference(
        distRoot,
        modulePath,
        reference,
        `${description} import "${reference}"`,
      );
      if (!targetPath || !/\.m?js$/i.test(extname(targetPath))) continue;
      requireNonemptyFile(
        targetPath,
        `${description} import "${reference}"`,
        distRoot,
      );
      if (!visited.has(targetPath)) pending.push(targetPath);
    }
  }

  return sources;
}

function catalogWorkerReferences(source) {
  const references = new Set();
  const pattern =
    /\bnew\s+Worker\s*\(\s*new\s+URL\s*\(\s*(['"])([^'"\\\r\n]+)\1\s*,\s*import\.meta\.url\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const reference = match[2].split(/[?#]/, 1)[0];
    const name = reference.slice(reference.lastIndexOf('/') + 1);
    if (CATALOG_WORKER_NAME.test(name)) references.add(match[2]);
  }
  return [...references];
}

function catalogWasmReferences(source) {
  const references = new Set();
  const pattern =
    /\bnew\s+URL\s*\(\s*(['"])([^'"\\\r\n]+)\1\s*,\s*import\.meta\.url\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const reference = match[2].split(/[?#]/, 1)[0];
    const name = reference.slice(reference.lastIndexOf('/') + 1);
    if (CATALOG_WASM_NAME.test(name)) references.add(match[2]);
  }
  return [...references];
}

function singleReferencedAsset(references, distRoot, description) {
  if (references.length === 0) {
    throw new Error(`PWA build check: no ${description} reference was found.`);
  }
  const targets = new Map();
  for (const { reference, importerPath } of references) {
    const targetPath = resolveLocalReference(
      distRoot,
      importerPath,
      reference,
      `${description} reference "${reference}"`,
    );
    if (targetPath) targets.set(targetPath, reference);
  }
  if (targets.size !== 1) {
    const paths = [...targets.values()].join('", "');
    throw new Error(
      `PWA build check: expected one ${description} target, found ${targets.size} ("${paths}").`,
    );
  }
  return [...targets.keys()][0];
}

function precachePaths(sw, distRoot) {
  const paths = new Set();
  for (const match of sw.matchAll(/\burl\s*:\s*(['"])([^'"\\\r\n]+)\1/g)) {
    const target = resolvePrecacheReference(distRoot, match[2]);
    if (target) paths.add(relativeAssetPath(distRoot, target));
  }
  return paths;
}

/**
 * Validate PWA prerequisites plus the app-reachable catalog worker and its
 * referenced SQLite WASM. Returns normalized asset paths on success and throws
 * an Error describing the first failed prerequisite.
 */
export function checkPwaBuild(distDir = DEFAULT_DIST) {
  const distRoot = resolve(distDir);
  if (!existsSync(distRoot)) {
    throw new Error(
      `PWA build check: ${distRoot} not found. Run \`npm run build -w @cruxcontrol/web\` first.`,
    );
  }

  // 1. Manifest exists and is well-formed.
  const manifestPath = join(distRoot, 'manifest.webmanifest');
  if (!existsSync(manifestPath)) {
    throw new Error('PWA build check: dist/manifest.webmanifest is missing.');
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!manifest.name) {
    throw new Error('PWA build check: manifest is missing `name`.');
  }
  if (!manifest.start_url) {
    throw new Error('PWA build check: manifest is missing `start_url`.');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('PWA build check: manifest declares no icons.');
  }
  const hasMaskable = manifest.icons.some((icon) =>
    /(^|\s)maskable(\s|$)/.test(icon.purpose ?? ''),
  );
  if (!hasMaskable) {
    throw new Error('PWA build check: manifest has no maskable icon.');
  }

  // 2. Every declared icon file exists in dist/.
  for (const icon of manifest.icons) {
    const iconPath = join(distRoot, icon.src);
    if (!existsSync(iconPath)) {
      throw new Error(`PWA build check: manifest icon "${icon.src}" not found in dist/.`);
    }
  }

  // 3. Keep the existing generated service worker and app-shell checks.
  const swPath = join(distRoot, 'sw.js');
  if (!existsSync(swPath)) {
    throw new Error('PWA build check: dist/sw.js (generated service worker) is missing.');
  }
  const sw = readFileSync(swPath, 'utf8');
  const dbMatch = sw.match(/["'][^"']*\.db(?:\.gz)?["']/);
  if (dbMatch) {
    throw new Error(
      `PWA build check: service worker precache references a catalog DB (${dbMatch[0]}); it must never be precached.`,
    );
  }
  const precache = precachePaths(sw, distRoot);
  const privateArtwork = [...precache].find((asset) =>
    /(^|\/)kilter_fullride_7x10-[^/]+\.png$/.test(asset),
  );
  if (!privateArtwork) {
    throw new Error(
      'PWA build check: service worker does not precache the private Fullride artwork.',
    );
  }

  // 4. Start only from local module scripts in index.html, then follow emitted
  // JavaScript imports. A worker that exists only as an orphan cannot pass.
  const htmlPath = join(distRoot, 'index.html');
  if (!existsSync(htmlPath)) {
    throw new Error('PWA build check: dist/index.html is missing.');
  }
  const entrypoints = moduleEntrypoints(distRoot, readFileSync(htmlPath, 'utf8'));
  if (entrypoints.length === 0) {
    throw new Error('PWA build check: index.html has no local module script entry.');
  }
  const appModules = walkJavaScriptGraph(distRoot, entrypoints, 'application');
  const workerReferences = [];
  for (const [modulePath, source] of appModules) {
    workerReferences.push(
      ...catalogWorkerReferences(source).map((reference) => ({ reference, importerPath: modulePath })),
    );
  }
  const workerPath = singleReferencedAsset(
    workerReferences,
    distRoot,
    'catalog worker',
  );
  requireNonemptyFile(workerPath, 'catalog worker', distRoot);

  // 5. Follow the worker's own emitted imports to the glue that names the WASM.
  const workerModules = walkJavaScriptGraph(distRoot, [workerPath], 'catalog worker');
  const wasmReferences = [];
  for (const [modulePath, source] of workerModules) {
    wasmReferences.push(
      ...catalogWasmReferences(source).map((reference) => ({ reference, importerPath: modulePath })),
    );
  }
  const wasmPath = singleReferencedAsset(
    wasmReferences,
    distRoot,
    'wa-sqlite WASM',
  );
  requireNonemptyFile(wasmPath, 'wa-sqlite WASM', distRoot);
  const wasmBytes = readFileSync(wasmPath);
  if (wasmBytes.length < WASM_MAGIC.length || !wasmBytes.subarray(0, 4).equals(WASM_MAGIC)) {
    throw new Error(
      `PWA build check: wa-sqlite WASM target "${relativeAssetPath(distRoot, wasmPath)}" has an invalid WASM magic header.`,
    );
  }

  // 6. Compare complete normalized paths so a same-named orphan in another
  // directory cannot stand in for either reachable app-code asset.
  for (const [description, assetPath] of [
    ['catalog worker', workerPath],
    ['wa-sqlite WASM', wasmPath],
  ]) {
    const normalizedPath = relativeAssetPath(distRoot, assetPath);
    if (!precache.has(normalizedPath)) {
      throw new Error(
        `PWA build check: service worker does not precache ${description} "${normalizedPath}".`,
      );
    }
  }

  return {
    iconCount: manifest.icons.length,
    precacheReferencesDb: false,
    precacheReferencesPrivateArtwork: true,
    catalogWorkerAsset: relativeAssetPath(distRoot, workerPath),
    catalogWasmAsset: relativeAssetPath(distRoot, wasmPath),
  };
}

// When run directly (not imported), execute the check and report.
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  try {
    const result = checkPwaBuild();
    console.log(
      `PWA build check passed: manifest + ${result.iconCount} icons + sw.js + ${result.catalogWorkerAsset} + ${result.catalogWasmAsset}; no catalog DB precached.`,
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
