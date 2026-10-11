import { FORMAT, MAX_BYTES, SLOT_COUNT, isSlot, validateOwner, validateSnapshot } from './contract.mjs';
import { CRC32C } from '@google-cloud/storage';

export function createGcsStore(bucket, ownerUid) {
  validateOwner(ownerUid);
  const prefix = `owners/${ownerUid}/snapshots/`;
  const nameFor = slot => {
    if (!isSlot(slot)) throw new Error('Invalid snapshot slot');
    return `${prefix}${slot}`;
  };
  const describe = metadata => {
    if (typeof metadata.name !== 'string' || !metadata.name.startsWith(prefix)
      || metadata.contentType !== 'application/json' || metadata.metadata?.format !== FORMAT
      || Object.keys(metadata.metadata).some(key => !['format', 'sha256'].includes(key))) {
      throw new Error('Unexpected stored object');
    }
    return validateSnapshot({ slot: metadata.name.slice(prefix.length), bytes: Number(metadata.size),
      sha256: metadata.metadata.sha256, generation: metadata.generation, createdAt: metadata.timeCreated });
  };
  return {
    async list() {
      const [files, next] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: SLOT_COUNT + 1 });
      if (next || files.length > SLOT_COUNT) throw new Error('Unexpected snapshot pool');
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
    async create(slot, bytes, sha256) {
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
          metadata: { format: FORMAT, sha256 } },
      });
    },
  };
}
