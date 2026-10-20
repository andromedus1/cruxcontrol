// Mirrors web/scripts/catalog/storage_layout.py; storage-layout.fixture.json keeps them aligned.
export const PREFIX = 'kilter-7x10/';
export const MAX_VERSION = 999_999;
export const MAX_MANIFEST_BYTES = 16 * 1024;
export const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
const ARTIFACT_OBJECT = /^kilter-7x10\/artifacts\/kilter-7x10\.v([1-9][0-9]{0,5})\.db\.gz$/;
const MANIFEST_OBJECT = /^kilter-7x10\/manifests\/v([0-9]{6})\.json$/;
export const ARTIFACT_FILE = /^kilter-7x10\.v([1-9][0-9]{0,5})\.db\.gz$/;

function check(version) {
  if (!Number.isSafeInteger(version) || version < 1 || version > MAX_VERSION) {
    throw new RangeError(`catalog version out of range: ${version}`);
  }
  return version;
}

export const artifactObject = version => `${PREFIX}artifacts/kilter-7x10.v${check(version)}.db.gz`;
export const manifestObject = version => `${PREFIX}manifests/v${String(check(version)).padStart(6, '0')}.json`;

/** Highest version with both artifact and manifest present, or null. */
export function latestVersion(names) {
  const artifacts = new Set();
  const manifests = new Set();
  for (const name of names) {
    const artifact = ARTIFACT_OBJECT.exec(name);
    if (artifact) { artifacts.add(Number(artifact[1])); continue; }
    const manifest = MANIFEST_OBJECT.exec(name);
    if (manifest && Number(manifest[1]) >= 1) manifests.add(Number(manifest[1]));
  }
  const published = [...artifacts].filter(version => manifests.has(version));
  return published.length ? Math.max(...published) : null;
}

/**
 * Minimal identity checks before serving a manifest; the app performs full validation.
 * Returns the parsed manifest or throws.
 */
export function checkManifest(bytes, version) {
  if (bytes.length > MAX_MANIFEST_BYTES) throw new Error('Manifest too large');
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)
    || manifest.schemaVersion !== 3 || manifest.source !== 'boardsesh-kilter'
    || manifest.version !== version || manifest.file !== `kilter-7x10.v${version}.db.gz`
    || typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)
    || !Number.isSafeInteger(manifest.bytesGzipped) || manifest.bytesGzipped <= 0
    || manifest.bytesGzipped > MAX_ARTIFACT_BYTES) {
    throw new Error('Unexpected manifest');
  }
  return manifest;
}

export function validateAdmitted(uids) {
  if (!Array.isArray(uids) || uids.length === 0 || uids.length > 32
    || !uids.every(uid => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid))) {
    throw new Error('Invalid admitted account configuration');
  }
  return new Set(uids);
}
