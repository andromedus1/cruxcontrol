import { deflateSync } from 'node:zlib';
import { generatedKilterFullride7x10 as board } from '../../../web/src/domain/boards/definitions/kilter-fullride-7x10.generated.ts';

const colors = { start: [49, 230, 91], middle: [0, 213, 245], finish: [252, 78, 245] };
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}

// Fictional colored discs at public Fullride geometry. No supplied/private image,
// catalog text, or owner screenshot participates in this fixture.
export function syntheticScreenshots() {
  const width = 270, height = 600;
  const placements = board.placements.filter(p => Number.isInteger((p.x + 40) / 4) && Number.isInteger((140 - p.y) / 4));
  return [['start', 'finish'], ['start', 'middle', 'finish']].map((roles, index) => {
    const pixels = Buffer.alloc(width * height * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([35, 35, 35, 255], offset);
    const assignments = roles.map((role, position) => {
      const p = placements[index * 3 + position];
      const column = (p.x + 40) / 4, row = (140 - p.y) / 4;
      const x = (48.5 + 49.05 * column) * width / 1080, y = (652 + 49.05 * row) * height / 2400;
      for (let py = Math.floor(y - 2); py <= Math.ceil(y + 2); py += 1) for (let px = Math.floor(x - 2); px <= Math.ceil(x + 2); px += 1) {
        if ((px - x) ** 2 + (py - y) ** 2 <= 4) pixels.set([...colors[role], 255], (py * width + px) * 4);
      }
      return { placementId: `kilter:${board.revision}:placement:${p.placement_id}`, appearance: { kind: 'role', role } };
    });
    assignments.sort((a, b) => {
      const position = assignment => placements.find(p => `kilter:${board.revision}:placement:${p.placement_id}` === assignment.placementId);
      return position(b).y - position(a).y || position(a).x - position(b).x;
    });
    const rows = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y += 1) pixels.copy(rows, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
    return { filename: `CruxControl-fictional-${index + 1}.png`, name: `Synthetic picker route ${index + 1}`, assignments,
      bytes: Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]) };
  });
}
