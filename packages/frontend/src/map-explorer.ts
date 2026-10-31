// A map's behavior on a small size, read from its images: the element-to-image table and the
// properties that follow from it (injective, onto, an involution, its order). DOM-free and
// engine-free: a host asks its engine for the collection and for the map over it, and reads the
// answers here. Computed on demand and capped, never stored.

import { glyphValue } from "./collection-table.ts";
import { type GlyphKind, GLYPH_KINDS, renderGlyph } from "./glyphs.ts";

/** The largest size a map is explored at, whatever the carrier's `maxSize` says: every element is mapped. */
export const MAP_MAX_SIZE = 7;
/** The most elements a size is mapped over (`SymmetricGroup(7)` is 5040). */
export const MAP_ROW_CAP = 5_040;
/** Rows the table lists; the properties read every element. */
export const MAP_TABLE_ROWS = 24;

type Json = unknown;

/** Why a size is not mapped, or `undefined` when it is. */
export function mapDeclineReason(limits: {
  readonly size?: number;
  readonly maxSize?: number;
  readonly count?: bigint;
}): string | undefined {
  const { size, maxSize, count } = limits;
  if (size !== undefined && maxSize !== undefined && size > maxSize)
    return `a map is explored up to size ${maxSize}; this is size ${size}`;
  if (count !== undefined && count > BigInt(MAP_ROW_CAP))
    return `a map is applied to every element; ${count.toLocaleString("en-US")} is past the ${MAP_ROW_CAP.toLocaleString("en-US")} it takes`;
  return undefined;
}

/** The text of `List(collection)` or `List(CombinatorialMap(collection, name))`: `List` wraps the one list the engine made. */
export function readCollection(json: Json): Json[] | undefined {
  if (!Array.isArray(json) || json[0] !== "List" || json.length !== 2) return undefined;
  const inner: unknown = json[1];
  return Array.isArray(inner) && inner[0] === "List" ? inner.slice(1) : undefined;
}

/** A value the map left undone: a guard declined, or the engine left the call. */
const undone = (value: Json): boolean =>
  Array.isArray(value) && (value[0] === "CombinatorialMap" || value[0] === "Error" || value[0] === "Nothing");

/** Each image of the list, or `undefined` where the map declined. */
export const readImages = (json: Json): Json[] | undefined =>
  readCollection(json)?.map((v) => (undone(v) ? undefined : v));

/** A value with its carrier wrapper dropped (`Permutation([2,1])` and `[2,1]` are one point), as a key. */
export function keyOf(value: Json): string {
  const bare =
    Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && value[0] !== "List"
      ? value[1]
      : value;
  return JSON.stringify(bare);
}

/** A value on one line: `Permutation([2, 3, 1])`. */
export function showJson(value: Json): string {
  if (Array.isArray(value)) {
    const [head, ...rest] = value as [unknown, ...unknown[]];
    if (head === "List") return `[${rest.map(showJson).join(", ")}]`;
    return `${String(head)}(${rest.map(showJson).join(", ")})`;
  }
  if (typeof value === "object" && value !== null && "num" in value) return String((value as { num: string }).num);
  return String(value).replace(/^'(.*)'$/, '"$1"');
}

/** A value drawn as the glyph `kind` names, or `undefined` when there is no glyph or the value does not fit it. */
export function glyphSvg(kind: string | undefined, value: Json): string | undefined {
  if (kind === undefined || !GLYPH_KINDS.has(kind)) return undefined;
  const glyph = glyphValue(kind, value as never);
  if (!glyph) return undefined;
  try {
    return renderGlyph(kind as GlyphKind, glyph);
  } catch {
    return undefined;
  }
}

/** What one size of a map does. */
export interface MapCheck {
  /** Elements of the source collection. */
  readonly count: number;
  /** Elements the map gave an image to. */
  readonly defined: number;
  /** No two elements share an image. */
  readonly injective: boolean;
  /** One-to-one and onto the target: decided only when the target's size is known. */
  readonly bijection?: boolean;
  /** Every image is itself in the sample, so the map is a self-map of it. */
  readonly selfMap: boolean;
  /** Applying the map twice returns every element (only for a self-map). */
  readonly involution?: boolean;
  /** The fewest applications that return every element: the lcm of the cycle lengths (only for a bijective self-map). */
  readonly order?: string;
}

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

/**
 * The properties of a map read off its images: `elements[i]` goes to `images[i]`. `targetCount` is
 * the target's size when known; `sameCarrier` says the target is the source's own carrier, which
 * is what makes an image's being in the sample meaningful (a self-map, with an order).
 */
export function checkMap(
  elements: readonly Json[],
  images: readonly Json[],
  options: { readonly targetCount?: bigint; readonly sameCarrier?: boolean } = {},
): MapCheck {
  const { sameCarrier = false } = options;
  // A self-map at one size lands in the same collection, so onto means as many images as elements.
  const targetCount = options.targetCount ?? (sameCarrier ? BigInt(elements.length) : undefined);
  const index = new Map<string, number>();
  elements.forEach((e, i) => index.set(keyOf(e), i));
  const keys = images.map((image) => (image === undefined ? undefined : keyOf(image)));
  const present = keys.filter((k): k is string => k !== undefined);
  const defined = present.length;
  const injective = new Set(present).size === defined;
  const total = defined === elements.length;
  const to = keys.map((k) => (k === undefined ? undefined : index.get(k)));
  const selfMap = sameCarrier && total && to.every((j) => j !== undefined);
  const result: {
    -readonly [K in keyof MapCheck]: MapCheck[K];
  } = { count: elements.length, defined, injective, selfMap };
  if (targetCount !== undefined) result.bijection = total && injective && BigInt(defined) === targetCount;
  if (selfMap) {
    result.involution = to.every((j, i) => to[j!] === i);
    if (injective) {
      // A bijective self-map is a permutation of the sample: its order is the lcm of its cycle lengths.
      const seen = new Array<boolean>(to.length).fill(false);
      let order = 1n;
      for (let start = 0; start < to.length; start++) {
        if (seen[start]) continue;
        let length = 0n;
        for (let at: number | undefined = start; at !== undefined && !seen[at]; at = to[at]) {
          seen[at] = true;
          length++;
        }
        order = (order * length) / gcd(order, length);
      }
      result.order = order.toString();
    }
  }
  return result;
}

/** A size's row of the properties table: the check, or why the size was not mapped. */
export type MapRow = { readonly n: number } & (
  | { readonly ok: true; readonly check: MapCheck }
  | { readonly ok: false; readonly reason: string }
);

/** The properties that hold at every size that was mapped, as badges: `[]` when no size was. */
export function mapBadges(rows: readonly MapRow[]): string[] {
  const done = rows.flatMap((r) => (r.ok ? [r.check] : []));
  if (done.length === 0) return [];
  const sizes = done.length === 1 ? "this size" : `all ${done.length} sizes`;
  const badges: string[] = [];
  if (done.every((c) => c.bijection === true)) badges.push(`bijection on ${sizes}`);
  else if (done.every((c) => c.injective && c.defined === c.count)) badges.push(`injective on ${sizes}`);
  if (done.every((c) => c.involution === true)) badges.push(`involution on ${sizes}`);
  const orders = done.map((c) => c.order);
  if (orders.every((o) => o !== undefined))
    badges.push(new Set(orders).size === 1 ? `order ${orders[0]} on ${sizes}` : `order by size: ${orders.join(", ")}`);
  return badges;
}
