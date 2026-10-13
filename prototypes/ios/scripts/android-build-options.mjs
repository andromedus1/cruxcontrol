import { resolve } from 'node:path';

export const MAX_VERSION_CODE = 2100000000;

export function androidBuildOptions(args) {
  const options = { compileOnly: false, syncOnly: false, variant: 'debug' };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error(`Repeated argument: ${arg}`);
    seen.add(arg);
    if (arg === '--catalog' && args[i + 1]) options.sourceFile = resolve(args[++i]);
    else if (arg === '--version-code') {
      const value = args[++i];
      if (!/^[1-9]\d*$/.test(value ?? '') || Number(value) > MAX_VERSION_CODE) {
        throw new Error(`--version-code must be an integer from 1 through ${MAX_VERSION_CODE}`);
      }
      options.versionCode = value;
    } else if (arg === '--compile-only') options.compileOnly = true;
    else if (arg === '--sync-only') options.syncOnly = true;
    else if (arg === '--release' || arg === '--signed-proof') {
      if (options.variant !== 'debug') throw new Error('Choose one signed build variant');
      options.variant = arg === '--release' ? 'release' : 'signedProof';
    } else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (options.compileOnly && options.sourceFile) throw new Error('Choose either an explicit private catalog or compile-only mode');
  if (!options.compileOnly && !options.sourceFile) throw new Error('Private APK requires --catalog /absolute/path/kilter-7x10.v1.db.gz (kept outside Git)');
  if (!options.compileOnly && !options.versionCode) throw new Error('Private build requires an explicit --version-code; choose a value above the installed version');
  if (options.compileOnly && options.variant !== 'debug') throw new Error('Signed builds require the private catalog');
  return options;
}

export function requireSigningEnvironment(environment) {
  const names = ['CRUX_ANDROID_KEYSTORE', 'CRUX_ANDROID_KEY_ALIAS', 'CRUX_ANDROID_STORE_PASSWORD', 'CRUX_ANDROID_KEY_PASSWORD'];
  if (names.some(name => !environment[name])) throw new Error('Signed build requires all four CRUX_ANDROID signing environment variables; keep credentials outside Git');
}
