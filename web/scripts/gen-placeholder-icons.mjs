// Deterministic placeholder PWA icon generator.
//
// PLACEHOLDER ASSETS — replace with real branding at epic-climb-browser.
// Produces solid-background PNGs with a blocky "CC" glyph at the exact sizes
// declared in the web manifest, so PWA installability prerequisites pass.
//
// No image dependencies: we encode PNGs by hand using Node's built-in zlib.
// Pixels are generated procedurally (a 5x7 bitmap font scaled to fit), so the
// output is byte-for-byte deterministic across machines/CI.
//
// Usage: node scripts/gen-placeholder-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'icons');

// Brand-neutral placeholder palette (deep slate bg, light glyph).
const BG = [30, 41, 59]; // #1e293b
const FG = [226, 232, 240]; // #e2e8f0

// 5x7 bitmap for the letter "C" (1 = foreground pixel).
const C_GLYPH = [
  [0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 1, 0],
];
const GLYPH_W = 5;
const GLYPH_H = 7;

// CRC-32 (PNG spec) with a precomputed table.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Render a "CC" icon as an RGBA pixel buffer of size x size, then PNG-encode.
function renderIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  // Fill background.
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0];
    px[i * 4 + 1] = BG[1];
    px[i * 4 + 2] = BG[2];
    px[i * 4 + 3] = 255;
  }

  // Lay out two "C" glyphs centered horizontally. Maskable icons need a safe
  // zone (keep content within the central ~80%), so scale conservatively.
  const safe = size * 0.6; // glyph band width
  const cellH = Math.floor(safe / GLYPH_H);
  const cellW = cellH; // square pixels
  const blockW = GLYPH_W * cellW;
  const gap = cellW; // gap between the two C's
  const totalW = blockW * 2 + gap;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - GLYPH_H * cellH) / 2);

  const drawGlyph = (offsetX) => {
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (!C_GLYPH[gy][gx]) continue;
        const x0 = offsetX + gx * cellW;
        const y0 = startY + gy * cellH;
        for (let dy = 0; dy < cellH; dy++) {
          for (let dx = 0; dx < cellW; dx++) {
            const x = x0 + dx;
            const y = y0 + dy;
            if (x < 0 || x >= size || y < 0 || y >= size) continue;
            const idx = (y * size + x) * 4;
            px[idx] = FG[0];
            px[idx + 1] = FG[1];
            px[idx + 2] = FG[2];
            px[idx + 3] = 255;
          }
        }
      }
    }
  };
  drawGlyph(startX);
  drawGlyph(startX + blockW + gap);

  return encodePng(px, size, size);
}

function encodePng(rgba, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type 6 = RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Scanlines, each prefixed with filter-type byte 0 (None).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-512-maskable.png', 512],
];
for (const [name, size] of targets) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size));
  console.log(`wrote ${name} (${size}x${size})`);
}
