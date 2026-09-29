// The DOM-free half of <notatio-collection-table>: column specs, the row wildcard,
// count formatting, and the glyph adapters. Kept apart from the element so it can be
// tested without a document.

import type { BoxedType, ComputeEngine, Type } from "@cortex-js/compute-engine";
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

/**
 * Replace every `_` in `json` with `bare` or `wrapped`, chosen PER OCCURRENCE: one that is a
 * direct argument of some function head asks `decide(head, argIndex)`; one with no enclosing
 * head (a column that is bare `_` itself) always gets `bare`. This is what lets one column
 * mix a carrier-typed statistic with a bare-list one -- `CycleCount(_)` next to `Max(_) -
 * Min(_)` -- each argument position judged by what its own head declares, not by a single
 * table-wide choice. Handles both MathJSON encodings `substituteRow` does: the shorthand
 * array (`["CycleCount", "_"]`) and the parsed form, where `_` carries source offsets
 * (`{ sym: "_", sourceOffsets: [...] }`) rather than being the bare string.
 */
export function substituteRowPerHead(
  json: MathJsonExpression,
  bare: MathJsonExpression,
  wrapped: MathJsonExpression,
  decide: (head: string, argIndex: number) => boolean,
): MathJsonExpression {
  const resolve = (head?: string, argIndex?: number): MathJsonExpression =>
    head !== undefined && argIndex !== undefined && decide(head, argIndex) ? wrapped : bare;
  const at = (node: unknown, head?: string, argIndex?: number): unknown => {
    if (node === ROW) return resolve(head, argIndex);
    if (Array.isArray(node)) {
      const [h, ...args] = node as unknown[];
      return typeof h === "string" ? [h, ...args.map((a, i) => at(a, h, i))] : node.map((n) => at(n));
    }
    if (node !== null && typeof node === "object") {
      const obj = node as { sym?: string; fn?: unknown[] };
      // The parsed (not shorthand-array) encoding: `_` carries source offsets as
      // `{ sym: "_", sourceOffsets: [...] }`, so its ROW-ness has to be read off `sym`, not
      // object identity -- but it is the same wildcard, judged the same way.
      if (obj.sym === ROW) return resolve(head, argIndex);
      if (Array.isArray(obj.fn)) {
        const [h, ...args] = obj.fn;
        return typeof h === "string"
          ? { ...obj, fn: [h, ...args.map((a, i) => at(a, h, i))] }
          : { ...obj, fn: obj.fn.map((n) => at(n)) };
      }
    }
    return node;
  };
  return at(json) as MathJsonExpression;
}

/**
 * The candidate types for `head`'s argument at `argIndex`: one per arm of an overload (an
 * INTERSECTION of signatures, `((A) -> X) & ((B) -> Y)`), each read whole -- a UNION param
 * (`list | permutation`) is one candidate, not decomposed, since `BoxedType.matches` already
 * treats "matches a union" as "matches some member". A purely variadic signature (`Max`'s
 * `(any*) -> any`) has no positional `args`, so a requested index past them falls back to the
 * variadic slot's type.
 */
function argumentTypesAt(ce: ComputeEngine, head: string, argIndex: number): BoxedType[] {
  const def = ce.lookupDefinition(head);
  const operator = def && "operator" in def ? def.operator : undefined;
  const sig = operator?.signature;
  if (!sig) return [];
  const walk = (t: Type): Type[] => {
    if (t === null || typeof t !== "object") return [];
    const node = t as { kind?: string; args?: { type: Type }[]; variadicArg?: { type: Type }; types?: Type[] };
    if (node.kind === "signature") {
      const positional = node.args?.[argIndex]?.type;
      const arg = positional ?? (argIndex >= (node.args?.length ?? 0) ? node.variadicArg?.type : undefined);
      return arg ? [arg] : [];
    }
    if (node.kind === "intersection") return (node.types ?? []).flatMap(walk);
    return [];
  };
  try {
    return walk(sig.type).map((t) => ce.type(t));
  } catch {
    return [];
  }
}

/**
 * Whether `head`'s declared type at `argIndex` calls for the row wrapped in its carrier
 * rather than passed bare, given the row's own bare type -- read once from the signature, per
 * (head, argIndex, carrier), and never retried or re-checked per row (https://github.com/enumeratio/enumeratio/wiki/Plausible
 * §4.2, BL-1). A head whose declared type already accepts the bare row -- `Length`'s `any`,
 * a word statistic's `list | permutation` union -- gets it unwrapped even when the carrier
 * would ALSO satisfy the type; only a head that REJECTS the bare row and accepts the carrier
 * (`CycleCount(permutation) -> integer`, `DurfeeSquare(integer_partition) -> integer`) gets
 * the wrap. `carrierType` undefined (no registered or overridden carrier) always answers
 * `false`: nothing to wrap into.
 */
export function wantsCarrier(
  ce: ComputeEngine,
  head: string,
  argIndex: number,
  bareType: BoxedType,
  carrierType: BoxedType | undefined,
): boolean {
  try {
    const candidates = argumentTypesAt(ce, head, argIndex);
    if (candidates.length === 0) return false;
    if (candidates.some((t) => bareType.matches(t))) return false;
    return carrierType !== undefined && candidates.some((t) => carrierType.matches(t));
  } catch {
    return false;
  }
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

/** A flat integer list from a `["List", …]` MathJSON, or from a carrier value wrapping one
 *  (`["Permutation", ["List", …]]`), or undefined for anything else. */
export function flatInts(json: MathJsonExpression): number[] | undefined {
  if (Array.isArray(json) && json.length === 2 && Array.isArray(json[1]) && json[1][0] === "List")
    return flatInts(json[1] as unknown as MathJsonExpression);
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
