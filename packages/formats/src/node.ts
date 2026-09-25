// Node-only additions to the registry: the PNG codec (which needs the native
// rasterizer) and file I/O (writeFormat / readFormat). Importing this registers
// the built-in text/SVG formats too, so a Node consumer can import just this.

import { readFileSync, writeFileSync } from "node:fs";
import { rasterize } from "@enumeratio/raster";
import { setRasterizer } from "./graphics.ts";
import "./index.ts"; // register the browser-safe formats (text, SVG)
import {
  exportTo,
  type Format,
  type FormatOptions,
  fileFormat,
  getFormat,
  type ImageValue,
  importFrom,
  registerFormat,
  sniffFormat,
} from "./registry.ts";

const asSvg = (v: unknown): string => {
  if (typeof v !== "string") throw new Error("expected an SVG string");
  return v;
};
const bytes = (d: string | Uint8Array): Uint8Array => (typeof d === "string" ? Buffer.from(d, "binary") : d);

registerFormat({
  name: "PNG",
  aliases: ["png"],
  mimeTypes: ["image/png"],
  extensions: ["png"],
  binary: true,
  encode: (v) => rasterize(asSvg(v)),
  decode: (d): ImageValue => ({ image: true, mimeType: "image/png", data: bytes(d) }),
  sniff: (d) => {
    const b = bytes(d);
    return b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  },
});

function resolve(path: string, format?: string | Format, sniff?: Uint8Array): Format {
  const f = format ? getFormat(format) : (fileFormat(path) ?? (sniff && sniffFormat(sniff)));
  if (!f) throw new Error(`cannot determine a format for ${path}`);
  return f;
}

/** Export a value to a file; format inferred from the extension when omitted. */
export function writeFormat(path: string, value: unknown, format?: string | Format, opts?: FormatOptions): Format {
  const f = resolve(path, format);
  writeFileSync(path, exportTo(value, f, opts));
  return f;
}

/** Import from a file; format from `format`, else the extension, else content-sniffed. */
export function readFormat(path: string, format?: string | Format, opts?: FormatOptions): unknown {
  const buf = readFileSync(path);
  const f = resolve(path, format, buf);
  return importFrom(f.binary ? buf : buf.toString("utf8"), f, opts);
}

export * from "./index.ts";

// Pixels are available here, so `Rasterize` can produce them.
setRasterizer((svg, options) => rasterize(svg, options));
