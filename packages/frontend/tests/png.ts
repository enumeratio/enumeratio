// A PNG data URI decoded to RGBA, with zlib and a CRC check, so a test reads the pixels a
// raster drew rather than the bytes that carry them.

import { inflateSync } from "node:zlib";

export interface Decoded {
  readonly width: number;
  readonly height: number;
  /** Rows top to bottom, each pixel `[r, g, b, a]`. */
  readonly pixels: (readonly [number, number, number, number])[][];
}

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
};

export function decodePng(href: string): Decoded {
  const prefix = "data:image/png;base64,";
  if (!href.startsWith(prefix)) throw new Error("not a PNG data URI");
  const bytes = Buffer.from(href.slice(prefix.length), "base64");
  expectSignature(bytes);
  let at = 8;
  let header: Buffer | undefined;
  let palette: Buffer | undefined;
  let alpha: Buffer | undefined;
  const data: Buffer[] = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("latin1", at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    const crc = bytes.readUInt32BE(at + 8 + length);
    if (crc32(bytes.subarray(at + 4, at + 8 + length)) !== crc) throw new Error(`bad CRC in ${type}`);
    if (type === "IHDR") header = body;
    if (type === "PLTE") palette = body;
    if (type === "tRNS") alpha = body;
    if (type === "IDAT") data.push(body);
    at += 12 + length;
  }
  if (!header) throw new Error("no IHDR");
  const [width, height, depth, kind] = [header.readUInt32BE(0), header.readUInt32BE(4), header[8], header[9]];
  if (depth !== 8) throw new Error("only 8-bit images");
  const raw = inflateSync(Buffer.concat(data));
  const per = kind === 3 ? 1 : 4;
  const pixels: (readonly [number, number, number, number])[][] = [];
  for (let y = 0; y < height; y++) {
    const row: (readonly [number, number, number, number])[] = [];
    const base = y * (1 + per * width);
    if (raw[base] !== 0) throw new Error("filtered rows are not written");
    for (let x = 0; x < width; x++) {
      const i = base + 1 + per * x;
      if (kind === 3) {
        const k = raw[i]!;
        row.push([palette![3 * k]!, palette![3 * k + 1]!, palette![3 * k + 2]!, alpha?.[k] ?? 255]);
      } else row.push([raw[i]!, raw[i + 1]!, raw[i + 2]!, raw[i + 3]!]);
    }
    pixels.push(row);
  }
  return { width, height, pixels };
}

function expectSignature(bytes: Buffer): void {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("bad signature");
}

/** The images in an SVG, in order, decoded. */
export function imagesIn(svg: string): Decoded[] {
  return [...svg.matchAll(/<image [^>]*href="([^"]*)"/g)].map((m) => decodePng(m[1]!));
}
