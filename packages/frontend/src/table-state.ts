// The DOM-free choices behind <notatio-collection-table>'s pickers: which columns `Automatic`
// stands for, which glyph, and how a size stepper rewrites the collection. The element and the
// tests read the same functions.

import { splitColumns } from "./collection-table.ts";
import glyphs from "../generated/head-glyphs.json" with { type: "json" };

/** What `Columns -> Automatic` and `Glyph -> Automatic` are written as. */
export const AUTOMATIC = "Automatic";

/** Columns a derived table opens with. */
export const DEFAULT_COLUMNS = 4;

/** The glyph kind of a carrier, or of the collection heads over it, from the carriers' `glyph:` records. */
export const HEAD_GLYPHS: Readonly<Record<string, string>> = glyphs;

const HEAD = /^\s*([A-Za-z]\w*)/;
const SIZED_CALL = /^\s*([A-Za-z]\w*)\s*\(\s*\d+\s*\)\s*$/;

/** The glyph a `glyph` attribute names: `Automatic` is the carrier's, else the collection head's. */
export function glyphKind(glyph: string, carrier: string, expr: string): string {
  if (glyph.trim() !== AUTOMATIC) return glyph;
  return HEAD_GLYPHS[carrier] ?? HEAD_GLYPHS[HEAD.exec(expr)?.[1] ?? ""] ?? "";
}

/** The columns a `columns` attribute names: `Automatic` is the first few statistics on offer. */
export function columnList(columns: string, statistics: readonly string[]): string[] {
  return columns.trim() === AUTOMATIC ? statistics.slice(0, DEFAULT_COLUMNS) : splitColumns(columns);
}

/** `Head({size})` for `Head(4)`: the one shape a size stepper rewrites; `undefined` for any other expression. */
export function templateOfExpr(expr: string): string | undefined {
  const head = SIZED_CALL.exec(expr)?.[1];
  return head === undefined ? undefined : `${head}({size})`;
}

/** The collection at `size`. */
export const exprAt = (template: string, size: number): string => template.replace("{size}", String(size));
