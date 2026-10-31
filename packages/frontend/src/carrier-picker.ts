// Picking one element of a carrier: the collection to draw from, a size stepper's bounds, a rank
// slider's bounds at a size, and the glyph that draws the choice. Pure: records in, a spec out.
// Wolfram would spell the choice `{p, collection}`; here it is a size `n` and a rank `k`, and the
// element is `At(collection(n), k)`.

import { distributionSourceOf, type CollectionRecord, type ExplorerCatalog, START_SIZE } from "./explorer.ts";
import { GLYPH_KINDS } from "./glyphs.ts";
import { exprAt } from "./table-state.ts";

export interface CarrierPicker {
  readonly carrier: string;
  /** The collection the elements come from. */
  readonly collection: string;
  /** The collection with its size as `{size}`: `SymmetricGroup({size})`. */
  readonly template: string;
  readonly size: { readonly min: number; readonly max: number; readonly start: number };
  /** The glyph kind that draws an element (`GLYPH_KINDS`); absent when the carrier has none. */
  readonly glyph?: string;
}

/** A carrier with no picker, and why. */
export interface NoPicker {
  readonly carrier: string;
  readonly reason: string;
}

/** The largest rank a slider offers: more notches than that are not placeable by hand. */
export const MAX_RANK = 1_000_000;

/** `integer_partition` (a signature's type) as the carrier name `IntegerPartition`; a union names its first member that is a carrier. */
export function carrierOfType(type: string, carriers: ReadonlySet<string>): string | undefined {
  for (const member of type.replace(/^\s*\((.*)\)\??\s*$/s, "$1").split("|")) {
    const bare = member.trim().replace(/\?$/, "");
    if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(bare)) continue;
    const name = bare.replace(/(^|_)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
    if (carriers.has(name)) return name;
  }
  return undefined;
}

/** The picker for `carrier`, or why it has none. */
export async function pickerOf(
  carrier: string,
  records: readonly CollectionRecord[],
  catalog: ExplorerCatalog,
): Promise<CarrierPicker | NoPicker> {
  const source = await distributionSourceOf(carrier, records, catalog);
  if (source === undefined) return { carrier, reason: "no collection of sized elements on this carrier" };
  const glyph = catalog.glyphOf(carrier);
  return {
    carrier,
    collection: source.collection,
    template: source.template,
    size: { min: 1, max: source.maxSize, start: Math.min(START_SIZE, source.maxSize) },
    ...(glyph !== undefined && GLYPH_KINDS.has(glyph) && { glyph }),
  };
}

export const hasPicker = (picker: CarrierPicker | NoPicker): picker is CarrierPicker => "template" in picker;

/** The ranks a slider offers over `count` elements: `1..count`, held to what a slider can place; none for an empty collection. */
export function rankBounds(count: bigint | number): { readonly min: number; readonly max: number } | undefined {
  const n = typeof count === "bigint" ? count : BigInt(Math.floor(count));
  return n < 1n ? undefined : { min: 1, max: n > BigInt(MAX_RANK) ? MAX_RANK : Number(n) };
}

/** `rank` made whole and put in `1..max`: where a thumb lands when the size, and so the count, changes. */
export const clampRank = (rank: number, max: number): number =>
  Math.min(Math.max(1, Math.round(Number.isFinite(rank) ? rank : 1)), Math.max(1, max));

/** The Epsil of the element at `rank` of the collection at `size`. */
export const elementText = (template: string, size: number, rank: number): string =>
  `At(${exprAt(template, size)}, ${rank})`;

/** The parameter a head's Try it lets a reader pick an element for, and where the elements come from. */
export interface CarrierSlot {
  readonly index: number;
  readonly picker: CarrierPicker;
}

/** The first parameter typed as a carrier that has a picker, or `undefined`. */
export async function carrierSlotOf(
  parameters: readonly { readonly type: string }[],
  carriers: ReadonlySet<string>,
  records: readonly CollectionRecord[],
  catalog: ExplorerCatalog,
): Promise<CarrierSlot | undefined> {
  for (const [index, { type }] of parameters.entries()) {
    const carrier = carrierOfType(type, carriers);
    if (carrier === undefined) continue;
    const picker = await pickerOf(carrier, records, catalog);
    if (hasPicker(picker)) return { index, picker };
  }
  return undefined;
}

/** The parts of a call, `["F", a, b]` or `{ fn: ["F", a, b] }`; undefined for anything else. */
const partsOf = (node: unknown): unknown[] | undefined => {
  const parts = Array.isArray(node) ? node : (node as { fn?: unknown } | null)?.fn;
  return Array.isArray(parts) ? parts : undefined;
};

/** The first call of `head` in `expr`, depth first, as its parts. */
function callOf(expr: unknown, head: string): unknown[] | undefined {
  const parts = partsOf(expr);
  if (parts === undefined) return undefined;
  if (parts[0] === head) return parts;
  for (const part of parts.slice(1)) {
    const found = callOf(part, head);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The argument at `index` (from 0) of the first call of `head` in `expr`, if the call has one. */
export const argumentOf = (expr: unknown, head: string, index: number): unknown => callOf(expr, head)?.[index + 1];

/** `expr` with that argument replaced by `element`: a copy, or `expr` itself when there is no such argument. */
export function withElement(expr: unknown, head: string, index: number, element: unknown): unknown {
  const target = callOf(expr, head);
  if (target === undefined || target.length <= index + 1) return expr;
  const swap = (node: unknown): unknown => {
    const parts = partsOf(node);
    if (parts === undefined) return node;
    const next = parts === target ? target.map((p, i) => (i === index + 1 ? element : p)) : parts.map(swap);
    return Array.isArray(node) ? next : { ...(node as object), fn: next };
  };
  return swap(expr);
}
