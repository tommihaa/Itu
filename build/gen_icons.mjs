// Generoi PWA-ikonit (PNG) ilman ulkoisia riippuvuuksia: piirto pikselipuskuriin
// + zlib-pakkaus PNG-chunkeiksi. 4x supersample → pehmeät reunat.
// Aja: node build/gen_icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/icons");
mkdirSync(OUT, { recursive: true });

// --- värit (favicon-paletin mukaan) ---
const BG = [0x14, 0x11, 0x0c]; // tumma ruskea
const STEM = [0x6f, 0xae, 0x3a]; // varsi
const LEAF = [0x8b, 0xc3, 0x4a]; // lehti (vaaleampi)

const SS = 4; // supersample

// CRC32 PNG-chunkeille
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10,11,12 = 0 (deflate, adaptive, no interlace)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- piirto: renderöi suurella resoluutiolla, laatikkoalasämpläys ---
function roundRectInside(x, y, R, radius) {
  // true jos piste (x,y) on pyöristetyn neliön [0..R] sisällä
  const r = radius;
  const cx = Math.min(Math.max(x, r), R - r);
  const cy = Math.min(Math.max(y, r), R - r);
  if (x >= r && x <= R - r) return y >= 0 && y <= R; // keskialue pystyssä
  if (y >= r && y <= R - r) return x >= 0 && x <= R;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
function capsule(px, py, ax, ay, bx, by, rad) {
  // etäisyys janaan A-B <= rad
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey <= rad * rad;
}
function rotEllipse(px, py, cx, cy, a, b, ang) {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const dx = px - cx, dy = py - cy;
  const rx = dx * c - dy * s, ry = dx * s + dy * c;
  return (rx * rx) / (a * a) + (ry * ry) / (b * b) <= 1;
}

function renderIcon(size) {
  const R = size * SS;
  const out = Buffer.alloc(size * size * 4);
  // sprout-geometria suhteessa R:ään
  const bgRadius = 0.18 * R;
  const cxBase = 0.5 * R;
  const stemTop = 0.46 * R, stemBot = 0.80 * R, stemW = 0.045 * R;
  const leafA = 0.205 * R, leafB = 0.105 * R;
  const lcx = 0.355 * R, rcx = 0.645 * R, lcy = 0.405 * R;
  const ang = (38 * Math.PI) / 180;

  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ox * SS + sx + 0.5;
          const y = oy * SS + sy + 0.5;
          let col = null;
          if (roundRectInside(x, y, R, bgRadius)) col = BG;
          // varsi
          if (capsule(x, y, cxBase, stemBot, cxBase, stemTop, stemW)) col = STEM;
          // lehdet
          if (rotEllipse(x, y, lcx, lcy, leafA, leafB, ang)) col = LEAF;
          if (rotEllipse(x, y, rcx, lcy, leafA, leafB, -ang)) col = LEAF;
          if (col) {
            r += col[0]; g += col[1]; b += col[2]; a += 255;
          }
        }
      }
      const n = SS * SS;
      const i = (oy * size + ox) * 4;
      if (a > 0) {
        // keskiarvo vain katetuista subsampleista → siisti reuna
        const cov = a / (255 * n);
        const cnt = a / 255;
        out[i] = Math.round(r / cnt);
        out[i + 1] = Math.round(g / cnt);
        out[i + 2] = Math.round(b / cnt);
        out[i + 3] = Math.round(cov * 255);
      } else {
        out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      }
    }
  }
  return encodePNG(size, size, out);
}

for (const size of [192, 512]) {
  const png = renderIcon(size);
  writeFileSync(resolve(OUT, `icon-${size}.png`), png);
  console.log(`icon-${size}.png  (${png.length} B)`);
}
// maskable = sama kuva, mutta turvallinen reuna riittää koska tausta täyttää koko alan
writeFileSync(resolve(OUT, "icon-512-maskable.png"), renderIcon(512));
console.log("icon-512-maskable.png");
