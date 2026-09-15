// A Wolfram-style format registry. Each Format declares its MIME types, file
// extensions, and (optionally) an encoder and/or decoder; `Export`/`Import`
// (here `exportTo`/`importFrom`) are generic behaviours that dispatch over it,
// and `mimeTypeToFormatList` is the reverse index (Wolfram's MIMETypeToFormatList).
// The registry is intentionally value-agnostic: text/math formats consume a boxed
// compute-engine expression, image formats consume an SVG string.

import type { ComputeEngine } from "@cortex-js/compute-engine";

export interface FormatOptions {
  /** Engine for formats whose decode parses into MathJSON (e.g. TeX). */
  ce?: ComputeEngine;
  [key: string]: unknown;
}

export interface Format {
  /** Canonical name, e.g. "PNG". */
  name: string;
  /** Alternate names resolved by `getFormat` (case-insensitive). */
  aliases?: readonly string[];
  mimeTypes: readonly string[];
  /** File extensions without the dot, e.g. `["wl", "m"]`. */
  extensions: readonly string[];
  /** True when the payload is bytes rather than text. */
  binary: boolean;
  /** Export: serialize a value to this format. */
  encode?(value: unknown, opts?: FormatOptions): string | Uint8Array;
  /** Import: parse this format's data back to a value (MathJSON for math formats). */
  decode?(data: string | Uint8Array, opts?: FormatOptions): unknown;
  /** Content sniffer: recognise this format from a data sample (Wolfram's FileFormat). */
  sniff?(data: string | Uint8Array): boolean;
}

/** An imported image: opaque bytes plus its MIME type (SVG also carries its text). */
export interface ImageValue {
  image: true;
  mimeType: string;
  data: Uint8Array;
  text?: string;
}

export function isImageValue(value: unknown): value is ImageValue {
  return typeof value === "object" && value !== null && (value as ImageValue).image === true;
}

const REGISTRY = new Map<string, Format>(); // key: lowercased name or alias

export function registerFormat(format: Format): void {
  for (const key of [format.name, ...(format.aliases ?? [])])
    REGISTRY.set(key.toLowerCase(), format);
}

export function getFormat(format: string | Format): Format | undefined {
  return typeof format === "string" ? REGISTRY.get(format.toLowerCase()) : format;
}

export function allFormats(): Format[] {
  return [...new Set(REGISTRY.values())];
}

/** Format names that can be exported / imported. */
export function exportFormats(): string[] {
  return allFormats()
    .filter((f) => f.encode !== undefined)
    .map((f) => f.name);
}
export function importFormats(): string[] {
  return allFormats()
    .filter((f) => f.decode !== undefined)
    .map((f) => f.name);
}

/** Wolfram's MIMETypeToFormatList: the format names that handle a MIME type. */
export function mimeTypeToFormatList(mime: string): string[] {
  const m = mime.toLowerCase();
  return allFormats()
    .filter((f) => f.mimeTypes.some((t) => t.toLowerCase() === m))
    .map((f) => f.name);
}

/** Format for a file extension or path (".png", "png", "dir/a.png"). */
export function formatForExtension(ext: string): Format | undefined {
  const e = ext.replace(/^.*\./, "").toLowerCase();
  return allFormats().find((f) => f.extensions.includes(e));
}

/** Format inferred from a path's extension (the trailing `.ext`). */
export function fileFormat(path: string): Format | undefined {
  const ext = /\.([^.\\/]+)$/.exec(path)?.[1];
  return ext ? formatForExtension(ext) : undefined;
}

/** Format recognised from a data sample by content (Wolfram's FileFormat). */
export function sniffFormat(data: string | Uint8Array): Format | undefined {
  return allFormats().find((f) => f.sniff?.(data));
}

/** Whether a format is an image (consumes an SVG graphic rather than an expression). */
export function isImageFormat(format: string | Format): boolean {
  const f = getFormat(format);
  return !!f && f.mimeTypes.some((m) => m.startsWith("image/"));
}

function resolve(format: string | Format): Format {
  const f = getFormat(format);
  if (!f) throw new Error(`unknown format: ${typeof format === "string" ? format : format.name}`);
  return f;
}

/** Export: serialize `value` in `format`. */
export function exportTo(
  value: unknown,
  format: string | Format,
  opts?: FormatOptions,
): string | Uint8Array {
  const f = resolve(format);
  if (!f.encode) throw new Error(`${f.name} is not exportable`);
  return f.encode(value, opts);
}

/** Import: parse `data` as `format`. */
export function importFrom(
  data: string | Uint8Array,
  format: string | Format,
  opts?: FormatOptions,
): unknown {
  const f = resolve(format);
  if (!f.decode) throw new Error(`${f.name} is not importable`);
  return f.decode(data, opts);
}

// File I/O (writeFormat / readFormat) and the PNG codec live in the Node-only
// `@enumeratio/formats/node` entry so this core stays browser-safe.
