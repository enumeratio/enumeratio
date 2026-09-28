// The DOM-free half of <notatio-collection-table>: column specs, the row wildcard,
// count formatting, and the glyph adapters. Kept apart from the element so it can be
// tested without a document.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";

/** The row placeholder in a column or filter expression: `Descents(_)`, `Length(_) == 2`. */
export const ROW = "_";

/** Split a comma-separated column list at the top-level commas only: `Descents, Part(_, 1)`. */
export function splitColumns(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

const HEAD = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * A column is an expression over the row `_`. A bare head name is the shorthand for
 * applying that head to the row -- `Descents` means `Descents(_)`.
 */
export function columnSource(text: string): string {
  const t = text.trim();
  return HEAD.test(t) ? `${t}(${ROW})` : t;
}

/** The label a column shows: the head for a shorthand, the expression otherwise. */
export function columnLabel(text: string): string {
  return text.trim();
}

/** Replace every `_` symbol in a MathJSON tree with the row's expression. */
export function substituteRow(json: MathJsonExpression, row: MathJsonExpression): MathJsonExpression {
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return node === ROW ? row : node;
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      const obj = node as { sym?: string; fn?: unknown[] };
      if (obj.sym === ROW) return row;
      if (Array.isArray(obj.fn)) return { ...obj, fn: obj.fn.map(walk) };
    }
    return node;
  };
  return walk(json) as MathJsonExpression;
}

/** Does the expression mention the row at all? (A column that doesn't is a constant.) */
export function mentionsRow(json: MathJsonExpression): boolean {
  const walk = (node: unknown): boolean => {
    if (typeof node === "string") return node === ROW;
    if (Array.isArray(node)) return node.some(walk);
    if (node !== null && typeof node === "object") {
      const obj = node as { sym?: string; fn?: unknown[] };
      return obj.sym === ROW || (Array.isArray(obj.fn) && obj.fn.some(walk));
    }
    return false;
  };
  return walk(json);
}

/** The largest index a collection can be paged to with exact unranking. */
export const MAX_INDEX = Number.MAX_SAFE_INTEGER;

/**
 * A count for display. Exact with separators while it is an exact integer; a collection
 * past 2^53 is only approximately counted (and only approximately indexable), so say so.
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (Number.isSafeInteger(n)) return n.toLocaleString("en-US");
  const [mantissa, exp] = n.toExponential(2).split("e");
  return `≈ ${mantissa} × 10${superscript(Number(exp))}`;
}

const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹";
function superscript(n: number): string {
  return `${n < 0 ? "⁻" : ""}${String(Math.abs(n))
    .split("")
    .map((d) => SUPER[Number(d)])
    .join("")}`;
}

/** A cell value: numeric when the engine gave a number (so sorting is numeric), else text. */
export interface CellValue {
  readonly num?: number;
  readonly text: string;
}

/** Order cells: numbers ascending first, then everything else by text. */
export function compareCells(a: CellValue, b: CellValue): number {
  if (a.num !== undefined && b.num !== undefined) return a.num - b.num;
  if (a.num !== undefined) return -1;
  if (b.num !== undefined) return 1;
  return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
}

/** A flat integer list from a `["List", …]` MathJSON, or undefined for anything else. */
export function flatInts(json: MathJsonExpression): number[] | undefined {
  if (!Array.isArray(json) || json[0] !== "List") return undefined;
  const items: unknown[] = (json as readonly unknown[]).slice(1);
  return items.every((x) => typeof x === "number" && Number.isInteger(x)) ? (items as number[]) : undefined;
}

/** A list of integer lists (set-partition blocks), or undefined. */
export function blockLists(json: MathJsonExpression): number[][] | undefined {
  if (!Array.isArray(json) || json[0] !== "List") return undefined;
  const items: unknown[] = (json as readonly unknown[]).slice(1);
  const blocks = items.map((b) => flatInts(b as MathJsonExpression));
  return blocks.every((b) => b !== undefined) ? (blocks as number[][]) : undefined;
}

/** Set-partition blocks `{1,2,4} {3} {5}` → the restricted-growth string `[0,0,1,0,2]`. */
export function blocksToRgs(blocks: number[][]): number[] {
  const n = Math.max(0, ...blocks.flat());
  const rgs: number[] = Array.from({ length: n }, () => 0);
  blocks.forEach((block, b) => {
    for (const x of block) if (x >= 1 && x <= n) rgs[x - 1] = b;
  });
  return rgs;
}

/** How many pages a view of `count` rows has at `pageSize` (at least one). */
export function pageCount(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.min(count, MAX_INDEX) / pageSize));
}
