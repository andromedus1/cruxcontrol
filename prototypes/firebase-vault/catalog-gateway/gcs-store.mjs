import { MAX_ARTIFACT_BYTES, PREFIX } from './contract.mjs';

/** Read-only view of the catalog bucket; reads are pinned to the listed generation. */
export function createGcsStore(bucket) {
  return {
    async list() {
      const [files] = await bucket.getFiles({ prefix: PREFIX, autoPaginate: true, maxResults: 5000 });
      return files.map(file => ({ name: file.name, generation: String(file.metadata.generation) }));
    },
    async read(name, generation) {
      if (!name.startsWith(PREFIX) || !/^[0-9]+$/.test(generation ?? '')) throw new Error('Unexpected object');
      const file = bucket.file(name, { generation });
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) > MAX_ARTIFACT_BYTES) throw new Error('Object too large');
      const [bytes] = await file.download({ validation: 'crc32c' });
      return bytes;
    },
  };
}
