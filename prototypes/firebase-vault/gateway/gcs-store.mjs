import {
  FORMAT, MAX_BYTES, PROOF_POOL, isPoolSlot, validateOwner, validateSnapshot,
} from './contract.mjs';
import { CRC32C } from '@google-cloud/storage';

const APP_METADATA_KEYS = ['climbs', 'drafts', 'exportedAt', 'finished', 'format', 'playlists', 'sha256', 'trash'];

export function createGcsStore(bucket, ownerUid, pool = PROOF_POOL) {
  validateOwner(ownerUid);
  const prefix = `owners/${ownerUid}/${pool.storagePath ? `${pool.storagePath}/` : ''}snapshots/`;
  const nameFor = slot => {
    if (!isPoolSlot(slot, pool)) throw new Error('Invalid snapshot slot');
    return `${prefix}${slot}`;
  };
  const canonicalCount = value => {
    if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error('Unexpected stored count');
    const count = Number(value);
    if (!Number.isSafeInteger(count)) throw new Error('Unexpected stored count');
    return count;
  };
  const describe = metadata => {
    const appPool = pool !== PROOF_POOL;
    const appMetadata = metadata.metadata ?? {};
    const expectedKeys = appPool ? APP_METADATA_KEYS : ['format', 'sha256'];
    if (typeof metadata.name !== 'string' || !metadata.name.startsWith(prefix)
      || metadata.contentType !== 'application/json' || metadata.metadata?.format !== FORMAT
      || Object.keys(appMetadata).sort().join(',') !== [...expectedKeys].sort().join(',')) {
      throw new Error('Unexpected stored object');
    }
    if (typeof metadata.size !== 'string' || !/^[1-9][0-9]*$/.test(metadata.size)) {
      throw new Error('Unexpected stored size');
    }
    const snapshot = {
      slot: metadata.name.slice(prefix.length), bytes: Number(metadata.size),
      sha256: appMetadata.sha256, generation: metadata.generation, createdAt: metadata.timeCreated,
    };
    if (appPool) {
      snapshot.exportedAt = appMetadata.exportedAt;
      snapshot.counts = {
        climbs: canonicalCount(appMetadata.climbs), finished: canonicalCount(appMetadata.finished),
        drafts: canonicalCount(appMetadata.drafts), trash: canonicalCount(appMetadata.trash),
        playlists: canonicalCount(appMetadata.playlists),
      };
      if (Object.values(appMetadata).some(value => typeof value !== 'string')) {
        throw new Error('Unexpected application metadata value');
      }
    }
    return validateSnapshot(snapshot, pool);
  };
  return {
    async list() {
      const [files, next] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: pool.slots + 1 });
      if (next || files.length > pool.slots) throw new Error('Unexpected snapshot pool');
      return files.map(file => describe(file.metadata)).sort((a, b) => a.slot.localeCompare(b.slot));
    },
    async read(slot) {
      const name = nameFor(slot);
      let metadata;
      try { [metadata] = await bucket.file(name).getMetadata(); }
      catch (error) { if (error?.code === 404) return null; throw error; }
      const snapshot = describe(metadata);
      const stream = bucket.file(name, { generation: snapshot.generation }).createReadStream({ validation: 'crc32c' });
      let size = 0;
      const chunks = [];
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > MAX_BYTES || size > snapshot.bytes) {
          stream.destroy();
          throw new Error('Oversized stored object');
        }
        chunks.push(chunk);
      }
      return { bytes: Buffer.concat(chunks, size), snapshot };
    },
    async create(slot, bytes, sha256, details = null) {
      const metadata = { format: FORMAT, sha256 };
      if (pool !== PROOF_POOL) {
        if (!details?.counts || typeof details.exportedAt !== 'string') throw new Error('Application metadata required');
        metadata.exportedAt = details.exportedAt;
        for (const key of ['climbs', 'finished', 'drafts', 'trash', 'playlists']) {
          metadata[key] = String(details.counts[key]);
        }
      }
      const crc = new CRC32C();
      crc.update(bytes);
      await bucket.file(nameFor(slot)).save(bytes, {
        resumable: false,
        // SDK post-upload checksum validation can automatically DELETE a mismatch.
        // Supply GCS's server-validated checksum instead; the handler independently
        // verifies exact readback before success and never deletes suspect bytes.
        validation: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: 'application/json', cacheControl: 'no-store', crc32c: crc.toString(),
          metadata },
      });
    },
  };
}
