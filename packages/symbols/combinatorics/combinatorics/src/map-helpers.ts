// Generic pieces a combinatorial map's Epsil body is built from, shared across more than one
// area (step 6c: maps carved into the areas that own their `from` carrier — this is what stays
// centralized because more than one area's `src/maps.ts` uses it). A helper only ONE area's
// maps use lives next to those maps instead — see e.g. `permutations/src/maps.ts`'s
// `byIndex`/`orbitLeast`/…, `set-partitions/src/maps.ts`'s `growthStringOf`/`blocksOf`.

import type { MapDeclaration } from "@enumeratio/structures";

/** A MathJSON expression, structurally — declared locally so this package stays packable
 *  (a bundled package cannot import types from the src-only reference package). */
export type MathJSON = string | number | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

/** A combinatorics map: `MapDeclaration` (@enumeratio/structures) plus FindStat ids, the one
 *  field a generic map has no business knowing about. */
export interface CombinatorialMap extends MapDeclaration {
  /** FindStat map ids, for a map whose record doesn't state them (a conversion has none). */
  readonly findstat?: readonly string[];
}

// Every Range here states its step: compute-engine counts DOWN when the end is below the start,
// so `Range(1, 0)` is [1, 0] where Wolfram's is empty, and an empty permutation would get two
// positions.
export const positions: MathJSON = ["Range", 1, ["Length", "_raw"], 1];
export const at = (index: MathJSON, of: MathJSON = "_raw"): MathJSON => ["At", of, index];
export const forEach = (over: MathJSON, body: MathJSON, variable = "i"): MathJSON => [
  "Map",
  ["Function", body, variable],
  over,
];

export const size: MathJSON = ["Count", "_raw"];

/** `body` with `name` bound to `value` — a `let`, as a lambda applied to its argument. */
export const bind = (name: string, value: MathJSON, body: MathJSON): MathJSON => [
  "Apply",
  ["Function", body, name],
  value,
];

/** The blocks of a restricted growth string whose labels start at `base`: block j holds the
 *  positions labelled j, in increasing order. Shared by set-partitions' own maps
 *  (SetPartition, SetComposition) and permutations' CyclePartition. */
export const blocksOf = (word: MathJSON, base: number): MathJSON => [
  "If",
  ["Equal", ["Length", word], 0],
  ["List"],
  [
    "Map",
    [
      "Function",
      ["Filter", ["Range", 1, ["Length", word], 1], ["Function", ["Equal", ["At", word, "p"], "j"], "p"]],
      "j",
    ],
    ["Range", base, ["Max", word], 1],
  ],
];
