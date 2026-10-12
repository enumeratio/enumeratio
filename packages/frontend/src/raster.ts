// A `RasterBox`'s cells as an image any SVG draws: rows of `#rrggbb` colors in, a PNG data URI out.
// Pure and dependency-free, so Node and the browser write the same bytes. Only the bytes of the
// image reach markup (base64), never a cell's text, so a hostile cell can at worst be clear.

/** A `#rgb`, `#rrggbb` or `#rrggbbaa` color as `[r, g, b, a]` bytes; undefined for anything else. */
export function colorBytes(color: unknown): readonly [number, number, number, number] | undefined {
  if (typeof color !== "string") return undefined;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color)?.[1];
  if (hex === undefined) return undefined;
  const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
  const byte = (k: number): number => Number.parseInt(full.slice(2 * k, 2 * k + 2), 16);
  return [byte(0), byte(1), byte(2), full.length === 8 ? byte(3) : 255];
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: Uint8Array): number => {
  let [a, b] = [1, 0];
  for (const v of bytes) {
    a = (a + v) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

const concat = (parts: readonly ArrayLike<number>[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const body = new Uint8Array(4 + data.length);
  body.set(Array.from({ length: 4 }, (_, k) => type.charCodeAt(k)));
  body.set(data, 4);
  return concat([be32(data.length), body, be32(crc32(body))]);
};

/** zlib with stored (uncompressed) blocks: no compressor to carry, and the image is a data URI the page keeps. */
function stored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + 5 * blocks + 4);
  out.set([0x78, 0x01]);
  let at = 2;
  for (let k = 0; k < blocks; k++) {
    const part = raw.subarray(k * 65535, (k + 1) * 65535);
    const last = k === blocks - 1 ? 1 : 0;
    out.set([last, part.length & 255, part.length >>> 8, ~part.length & 255, (~part.length >>> 8) & 255], at);
    out.set(part, at + 5);
    at += 5 + part.length;
  }
  out.set(be32(adler32(raw)), at);
  return out;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i]!, bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64[(n >>> 18) & 63]! + BASE64[(n >>> 12) & 63]!;
    out += b === undefined ? "=" : BASE64[(n >>> 6) & 63]!;
    out += c === undefined ? "=" : BASE64[n & 63]!;
  }
  return out;
}

/**
 * The most cells a raster draws (a side of 512): the PNG is stored uncompressed, so a `data=` grid of
 * 1024 a side would put a ~5.6 MB data URI in the DOM. Past it the image is not built.
 */
export const MAX_RASTER_CELLS = 512 * 512;

/**
 * Rows of colors as a PNG data URI, the first row of `rows` at the BOTTOM of the image (the least y,
 * as a `RasterBox` lists it). A cell that is not a color is clear. Undefined for an empty or ragged
 * grid, or one past `MAX_RASTER_CELLS`.
 */
export function rasterHref(rows: readonly (readonly unknown[])[]): string | undefined {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0 || width * height > MAX_RASTER_CELLS) return undefined;
  if (!rows.every((r) => Array.isArray(r) && r.length === width)) return undefined;
  const cells = rows.map((r) => r.map(colorBytes));
  // Few colors (a gradient's bands, a quantized ramp) go as an indexed image, a quarter of the bytes.
  const palette = new Map<string, number>();
  let indexed = true;
  for (const row of cells)
    for (const c of row) {
      const key = c === undefined ? "clear" : c.join(",");
      if (!palette.has(key)) palette.set(key, palette.size);
      if (palette.size > 256) indexed = false;
    }
  const header = concat([be32(width), be32(height), Uint8Array.of(8, indexed ? 3 : 6, 0, 0, 0)]);
  const scanline = indexed ? 1 + width : 1 + 4 * width;
  const raw = new Uint8Array(height * scanline);
  // PNG rows run top to bottom: the last listed row first.
  for (let r = 0; r < height; r++) {
    const row = cells[height - 1 - r]!;
    let at = r * scanline + 1;
    for (const c of row) {
      if (indexed) raw[at++] = palette.get(c === undefined ? "clear" : c.join(","))!;
      else {
        raw.set(c ?? [0, 0, 0, 0], at);
        at += 4;
      }
    }
  }
  const parts: Uint8Array[] = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk("IHDR", header)];
  if (indexed) {
    const entries = [...palette.keys()].map((k) => (k === "clear" ? [0, 0, 0, 0] : k.split(",").map(Number)));
    parts.push(chunk("PLTE", new Uint8Array(entries.flatMap((e) => e.slice(0, 3)))));
    parts.push(chunk("tRNS", new Uint8Array(entries.map((e) => e[3]!))));
  }
  parts.push(chunk("IDAT", stored(raw)), chunk("IEND", new Uint8Array()));
  return `data:image/png;base64,${base64(concat(parts))}`;
}
