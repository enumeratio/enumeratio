// What the figure frames (strands, cells, trees, paths) share: reading MathJSON, and the
// shape of a layer `Show` can title, grid and describe.

import type { Vec2 } from "./lattice.ts";
import type { TileLayer } from "./tiles-canvas.ts";

export type Json = unknown;

export const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === "string" ? json[0] : undefined;
export const argsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);

/**
 * `head(head(x))` as `head(x)`: a constructor around a value that already carries its head, as
 * a family's `At` yields (`Permutation(Permutation([…]))`).
 */
export function unwrapped(json: Json): Json {
  let inner = json;
  while (headOf(inner) !== undefined && headOf(argsOf(inner)[0]) === headOf(inner)) inner = argsOf(inner)[0];
  return inner;
}

/** A subset's carrier, `Finset(Tuple(n, members))`, as a family's `At` yields it: its size and members. */
export function carrierOf(json: Json): { readonly n: number; readonly members: Json } | undefined {
  const tuple = headOf(json) === "Finset" ? argsOf(json)[0] : undefined;
  if (headOf(tuple) !== "Tuple") return undefined;
  const [n, members] = argsOf(tuple);
  const size = intOf(n);
  return size === undefined ? undefined : { n: size, members };
}

/** An integer, written as a number, a numeric string or `Negate(n)`. */
export function intOf(json: Json): number | undefined {
  if (headOf(json) === "Negate") {
    const v = intOf(argsOf(json)[0]);
    return v === undefined ? undefined : -v;
  }
  const n =
    typeof json === "number" ? json : typeof json === "string" && json.trim() !== "" ? Number(json) : Number.NaN;
  return Number.isInteger(n) ? n : undefined;
}

/** `[a, b, c]` as integers, or undefined when it is not a list of them. */
export function intsOf(json: Json): number[] | undefined {
  if (headOf(json) !== "List") return undefined;
  const xs = argsOf(json).map(intOf);
  return xs.every((x) => x !== undefined) ? (xs as number[]) : undefined;
}

/** A figure layer as `Show` reads it: the tile contract, and its own title, grid and descriptions. */
export interface FigureLayer extends TileLayer {
  readonly title: string;
  readonly grid: readonly [Vec2, Vec2];
  gridLabel(axis: 0 | 1, k: number): string;
  summary(): readonly (readonly [string, string])[];
  describe(i: number, j: number): { title: string; rows: readonly (readonly [string, string])[] };
}

/** A property or value name as the rules write it: `IsLeaf`, `Leaf` and `leaf` are one. */
export const normal = (name: string): string => name.replace(/^Is(?=[A-Z])/, "").toLowerCase();

/** The identity basis, for frames whose addresses are not a lattice. */
export const UNIT_BASIS: readonly [Vec2, Vec2] = [
  [1, 0],
  [0, 1],
];
