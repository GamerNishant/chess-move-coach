// icons.mjs — draws the toolbar icon (dark tile, green speech bubble, white "!")
// as anti-aliased PNGs with no dependencies, plus an SVG twin for the web page.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x++) raw[y * (size * 4 + 1) + 1 + x] = px[y * size * 4 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Shapes in a 0..1 unit square. Signed-distance helpers.
const rrect = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.abs(x - cx) - hw + r, dy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
const tri = (x, y) => { // bubble tail: triangle (0.30,0.66) (0.30,0.86) (0.48,0.66)
  const inside = y >= 0.62 && y <= 0.86 && x >= 0.28 && (x - 0.28) <= (0.86 - y) * (0.2 / 0.24) + 0.0;
  return inside ? -1 : 1;
};
function color(x, y) {
  if (rrect(x, y, 0.5, 0.5, 0.5, 0.5, 0.22) > 0) return null;              // outside tile
  const bubble = rrect(x, y, 0.5, 0.45, 0.32, 0.24, 0.12) <= 0 || tri(x, y) < 0;
  const bang = rrect(x, y, 0.5, 0.39, 0.045, 0.12, 0.04) <= 0 || Math.hypot(x - 0.5, y - 0.6) <= 0.05;
  if (bubble && bang) return [255, 255, 255];
  if (bubble) return [129, 182, 76];
  return [38, 37, 34];
}
function render(size) {
  const px = new Uint8Array(size * size * 4);
  const S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = color((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const i = (y * size + x) * 4;
    if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a; px[i + 3] = (a / (S * S)) * 255; }
  }
  return png(size, px);
}

mkdirSync(join(root, 'extension/icons'), { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(join(root, `extension/icons/icon${s}.png`), render(s));
writeFileSync(join(root, 'docs/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#262522"/>
<rect x="18" y="21" width="64" height="48" rx="12" fill="#81b64c"/>
<path d="M28 62 L28 86 L48 66 Z" fill="#81b64c"/>
<rect x="45.5" y="27" width="9" height="24" rx="4" fill="#fff"/>
<circle cx="50" cy="60" r="5" fill="#fff"/>
</svg>
`);
console.log('icons written');
