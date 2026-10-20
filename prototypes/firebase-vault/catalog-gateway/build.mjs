import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
await build({ entryPoints: [new URL('index.mjs', import.meta.url).pathname],
  outfile: new URL('lib/index.mjs', import.meta.url).pathname,
  bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'external' });
if (process.argv.includes('--tests')) {
  const files = (await readdir(new URL('.', import.meta.url))).filter(name => name.endsWith('.test.mjs'));
  await build({ entryPoints: files.map(name => new URL(name, import.meta.url).pathname),
    outdir: new URL('lib/', import.meta.url).pathname, outExtension: { '.js': '.mjs' },
    bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'external' });
}
