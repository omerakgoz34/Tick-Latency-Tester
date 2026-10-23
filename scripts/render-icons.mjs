import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

const BG = [0x0f, 0x19, 0x23, 255];
const RED = [0xff, 0x46, 0x55, 255];
const PAPER = [0xec, 0xe8, 0xe1, 255];

const RED_PATH = [
  [4, 22.5],
  [11.2, 22.5],
  [14.4, 7.5],
  [19.6, 22.5],
  [28, 22.5],
];
const PAPER_PATH = [
  [14.4, 7.5],
  [14.4, 13.7],
];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function distToSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / ab2));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function strokeCover(vx, vy, path, radius, scale) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = distToSeg(vx, vy, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    if (d < best) best = d;
  }
  const edge = 0.65 / scale;
  if (best <= radius - edge) return 1;
  if (best >= radius + edge) return 0;
  return (radius + edge - best) / (edge * 2);
}

function mix(dst, src, cover) {
  if (cover <= 0) return;
  const k = Math.min(1, cover);
  const inv = 1 - k;
  dst[0] = src[0] * k + dst[0] * inv;
  dst[1] = src[1] * k + dst[1] * inv;
  dst[2] = src[2] * k + dst[2] * inv;
  dst[3] = 255;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = (0.36 * size) / 15.8;
  const ox = size / 2 - 16 * scale;
  const oy = size / 2 - 15 * scale;
  const samples = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pixel = [BG[0], BG[1], BG[2], 255];
      let red = 0;
      let paper = 0;
      for (const [sx, sy] of samples) {
        const vx = (x + sx - ox) / scale;
        const vy = (y + sy - oy) / scale;
        red += strokeCover(vx, vy, RED_PATH, 1.6, scale);
        paper += strokeCover(vx, vy, PAPER_PATH, 0.8, scale);
      }
      mix(pixel, RED, red / samples.length);
      mix(pixel, PAPER, paper / samples.length);
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(pixel[0]);
      rgba[i + 1] = Math.round(pixel[1]);
      rgba[i + 2] = Math.round(pixel[2]);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "icon-192.png"), render(192));
writeFileSync(join(outDir, "icon-512.png"), render(512));
writeFileSync(join(root, "public", "apple-touch-icon.png"), render(180));
