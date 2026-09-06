import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const execFile = promisify(execFileCallback);

export const LEGACY_PWA_COMMIT = '7e8c3861f02a4ca95da29b44fd3915e4be2d2318';
export type PwaGeneration = 'A' | 'B' | 'C';

export interface PwaGenerationBuild {
  readonly generation: PwaGeneration;
  readonly sourceRoot: string;
  readonly outputRoot: string;
  readonly marker: string;
  readonly workerHash: string;
  readonly workerSource: string;
}

export interface PwaGenerationBuilds {
  readonly root: string;
  readonly A: PwaGenerationBuild;
  readonly B: PwaGenerationBuild;
  readonly C: PwaGenerationBuild;
  cleanup(): Promise<void>;
}

const projectRoot = resolve(process.cwd(), '..');

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function ensureLegacyCommitAvailable(): Promise<void> {
  try {
    await execFile('git', ['cat-file', '-e', `${LEGACY_PWA_COMMIT}^{commit}`], {
      cwd: projectRoot,
    });
  } catch {
    throw new Error(
      `The PWA update fixture needs legacy commit ${LEGACY_PWA_COMMIT}; ` +
        'the checkout does not contain it. Run CI with actions/checkout fetch-depth: 0.',
    );
  }
}

async function copyCurrentSource(destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const path of [
    'package.json',
    'package-lock.json',
    'web',
    'docs/kilter_fullride_7x10.png',
    // Production CSS imports the token sheet from the mockup design system;
    // retain that source dependency while keeping the fixture copy bounded.
    '.mockups/design-system/tokens.css',
  ]) {
    const source = join(projectRoot, path);
    const target = join(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, {
      recursive: true,
      filter: (candidate) => {
        const pathFromRoot = relative(projectRoot, candidate).split(sep).join('/');
        return !(
          pathFromRoot === 'web/dist' ||
          pathFromRoot.startsWith('web/dist/') ||
          pathFromRoot === 'web/test-results' ||
          pathFromRoot.startsWith('web/test-results/') ||
          pathFromRoot === 'web/playwright-report' ||
          pathFromRoot.startsWith('web/playwright-report/') ||
          pathFromRoot === 'web/node_modules' ||
          pathFromRoot.startsWith('web/node_modules/')
        );
      },
    });
  }
}

async function makeLegacySource(destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  const archive = join(dirname(destination), 'legacy-source.tar');
  try {
    await execFile('git', ['archive', '--format=tar', `--output=${archive}`, LEGACY_PWA_COMMIT], {
      cwd: projectRoot,
    });
    await execFile('tar', ['-xf', archive, '-C', destination]);
  } finally {
    await rm(archive, { force: true });
  }
}

async function linkDependencies(sourceRoot: string): Promise<void> {
  await symlink(join(projectRoot, 'node_modules'), join(sourceRoot, 'node_modules'), 'dir');
}

async function addGenerationMarker(sourceRoot: string, generation: PwaGeneration): Promise<void> {
  const indexPath = join(sourceRoot, 'web/index.html');
  const current = await readFile(indexPath, 'utf8');
  const marker = `<meta name="cruxcontrol-build-generation" content="${generation}" />`;
  const withoutMarker = current.replace(
    /\s*<meta\s+name=["']cruxcontrol-build-generation["'][^>]*>/gi,
    '',
  );
  const next = withoutMarker.replace('</head>', `    ${marker}\n  </head>`);
  if (next === withoutMarker)
    throw new Error(`Could not add ${generation} build marker to ${indexPath}`);
  await writeFile(indexPath, next);
}

async function buildGeneration(
  sourceRoot: string,
  outputRoot: string,
  generation: PwaGeneration,
  markerSource: boolean,
): Promise<PwaGenerationBuild> {
  if (markerSource) await addGenerationMarker(sourceRoot, generation);
  if (generation === 'C') {
    // Delay the native activation call after Workbox receives SKIP_WAITING.
    // This simulates a busy worker while the app holds its irreversible-request
    // lease; worker states, controllers and native lock grants remain real.
    // Only this temporary build imports the scheduling hook.
    const configPath = join(sourceRoot, 'web/vite.config.ts');
    const config = await readFile(configPath, 'utf8');
    if (!config.includes('workbox: {')) throw new Error('Missing Workbox fixture configuration');
    await writeFile(
      configPath,
      config.replace('workbox: {', "workbox: { importScripts: ['/pwa-activation-gate.js'],"),
    );
    const publicRoot = join(sourceRoot, 'web/public');
    await mkdir(publicRoot, { recursive: true });
    await writeFile(
      join(publicRoot, 'pwa-activation-gate.js'),
      "const nativeSkipWaiting = self.skipWaiting.bind(self); self.skipWaiting = () => fetch('/__pwa_activation_gate__', {cache: 'no-store'}).then(() => nativeSkipWaiting());\n",
    );
  }
  try {
    await execFile(npmCommand(), ['run', 'build', '-w', 'web', '--', '--outDir', outputRoot], {
      cwd: sourceRoot,
      // These are production generations even if an earlier dev-server fixture
      // changed the Playwright worker's process environment.
      env: { ...process.env, NODE_ENV: 'production' },
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (cause) {
    const details = cause as { readonly stderr?: string; readonly stdout?: string };
    const output = (details.stderr || details.stdout || '').trim();
    throw new Error(
      `Could not build PWA generation ${generation}${output ? `:\n${output}` : '.'}`,
      { cause },
    );
  }
  const index = await readFile(join(outputRoot, 'index.html'), 'utf8');
  const marker = index.match(
    /<meta\s+name=["']cruxcontrol-build-generation["']\s+content=["']([ABC])["']/i,
  )?.[1];
  if (marker !== generation) {
    throw new Error(`Built ${generation} PWA has marker ${marker ?? 'missing'} in ${outputRoot}`);
  }
  const workerSource = await readFile(join(outputRoot, 'sw.js'), 'utf8');
  if (!/precacheAndRoute/.test(workerSource)) {
    throw new Error(`Built ${generation} PWA worker is not a Workbox precaching worker`);
  }
  const workerHash = createHash('sha256').update(workerSource).digest('hex');
  return Object.freeze({
    generation,
    sourceRoot,
    outputRoot,
    marker: generation,
    workerHash,
    workerSource,
  });
}

export async function buildPwaGenerations(): Promise<PwaGenerationBuilds> {
  await ensureLegacyCommitAvailable();
  const root = await mkdtemp(join(tmpdir(), 'cruxcontrol-pwa-'));
  try {
    const sourceA = join(root, 'source-A');
    const sourceB = join(root, 'source-B');
    const sourceC = join(root, 'source-C');
    await makeLegacySource(sourceA);
    await copyCurrentSource(sourceB);
    await copyCurrentSource(sourceC);
    await Promise.all([
      linkDependencies(sourceA),
      linkDependencies(sourceB),
      linkDependencies(sourceC),
    ]);
    const outputA = join(root, 'output-A');
    const outputB = join(root, 'output-B');
    const outputC = join(root, 'output-C');
    // Distinct output directories ensure the server can switch generations while
    // the browser's native SW cache continues to hold the active generation.
    await mkdir(outputA, { recursive: true });
    await mkdir(outputB, { recursive: true });
    await mkdir(outputC, { recursive: true });
    const A = await buildGeneration(sourceA, outputA, 'A', true);
    const B = await buildGeneration(sourceB, outputB, 'B', true);
    const C = await buildGeneration(sourceC, outputC, 'C', true);
    if (new Set([A.workerHash, B.workerHash, C.workerHash]).size !== 3) {
      throw new Error('Three PWA generations must have distinct generated worker revisions');
    }
    return Object.freeze({
      root,
      A,
      B,
      C,
      cleanup: () => rm(root, { recursive: true, force: true }),
    });
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
