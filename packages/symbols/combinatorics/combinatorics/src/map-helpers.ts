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
  /** An optional hand-written fast path over the plain-JS contents (`toJs`/`fromJs`), for a map whose
   *  nested Epsil can't compile. `undefined` declines to the Epsil, which stays the meaning: tests/
   *  map-kernels.test.ts holds the two to the same answers. */
  readonly kernel?: (raw: never) => unknown;
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

/** The word read backwards: entry i is entry n + 1 - i. */
export const reversedWord: MathJSON = forEach(positions, at(["Subtract", ["Add", ["Length", "_raw"], 1], "i"]));

/** A list sorted largest-first, by reading the sorted list back to front. */
export const descending = (list: MathJSON): MathJSON => [
  "Map",
  ["Function", ["At", ["Sort", list], ["Subtract", ["Add", ["Length", list], 1], "i"]], "i"],
  ["Range", 1, ["Length", list], 1],
];

/** The word rotated one place left (first entry last), and right (last entry first). */
export const rotatedLeft: MathJSON = forEach(positions, at(["Add", ["Mod", "i", ["Length", "_raw"]], 1]));
export const rotatedRight: MathJSON = forEach(
  positions,
  at(["Add", ["Mod", ["Add", ["Subtract", "i", 2], ["Length", "_raw"]], ["Length", "_raw"]], 1]),
);

/** `body` with `name` bound to `value` — a `let`, as a lambda applied to its argument. A
 *  list value needs its `type`, e.g. `"list<integer>"`: an untyped lambda applied to a list
 *  maps over it, so `Max(cw)` would run once per element; and compiled `Max` of a
 *  `collection`-typed parameter comes out `null`. */
export const bind = (name: string, value: MathJSON, body: MathJSON, type?: string): MathJSON => [
  "Apply",
  ["Function", body, type === undefined ? name : ["Typed", name, `'${type}'`]],
  value,
];

/** Nested `bind`s, outermost first: each binding is `[name, value, type?]`. */
export const lets = (bindings: readonly (readonly [string, MathJSON, string?])[], body: MathJSON): MathJSON =>
  bindings.toReversed().reduce((inner, [name, value, type]) => bind(name, value, inner, type), body);

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

/** The word `_raw` with its weakly increasing runs (cut where an entry is above the next) reordered by `runKey`
 *  of each run's first and last position, ties keeping their order: the runs' keys are sorted along with their
 *  indices, and the runs read off in that order. */
export const sortedRuns = (runKey: (first: MathJSON, last: MathJSON) => MathJSON): MathJSON => [
  "If",
  ["Equal", ["Length", "_raw"], 0],
  ["List"],
  bind(
    "rs_starts",
    [
      "Fold",
      [
        "Function",
        [
          "If",
          ["Or", ["Equal", "p", 1], ["Greater", at(["Max", ["Subtract", "p", 1], 1]), at("p")]],
          ["Join", "acc", ["List", "p"]],
          "acc",
        ],
        "acc",
        "p",
      ],
      ["List"],
      positions,
    ],
    bind(
      "rs_count",
      ["Length", "rs_starts"],
      bind(
        "rs_end",
        forEach(
          ["Range", 1, "rs_count", 1],
          ["If", ["Equal", "k", "rs_count"], ["Length", "_raw"], ["Subtract", at(["Add", "k", 1], "rs_starts"), 1]],
          "k",
        ),
        bind(
          "rs_order",
          forEach(
            [
              "Sort",
              forEach(
                ["Range", 1, "rs_count", 1],
                ["Add", ["Multiply", runKey(at("k", "rs_starts"), at("k", "rs_end")), ["Add", "rs_count", 1]], "k"],
                "k",
              ),
            ],
            ["Mod", "c", ["Add", "rs_count", 1]],
            "c",
          ),
          [
            "Fold",
            [
              "Function",
              ["Join", "acc", forEach(["Range", at("o", "rs_starts"), at("o", "rs_end"), 1], at("p"), "p")],
              "acc",
              "o",
            ],
            ["List"],
            "rs_order",
          ],
          "list<integer>",
        ),
        "list<integer>",
      ),
      "integer",
    ),
    "list<integer>",
  ),
];

/** The lengths of the maximal runs of equal entries of `_raw`, left to right. */
export const runLengths: MathJSON = (() => {
  const starts: MathJSON = [
    "Fold",
    [
      "Function",
      [
        "If",
        ["Or", ["Equal", "p", 1], ["Not", ["Equal", at("p"), at(["Max", ["Subtract", "p", 1], 1])]]],
        ["Join", "acc", ["List", "p"]],
        "acc",
      ],
      "acc",
      "p",
    ],
    ["List"],
    positions,
  ];
  return [
    "If",
    ["Equal", ["Length", "_raw"], 0],
    ["List"],
    bind(
      "starts",
      starts,
      bind(
        "bounds",
        ["Join", "starts", ["List", ["Add", ["Length", "_raw"], 1]]],
        forEach(
          ["Range", 1, ["Length", "starts"], 1],
          ["Subtract", at(["Add", "q", 1], "bounds"), at("q", "bounds")],
          "q",
        ),
        "list<integer>",
      ),
      "list<integer>",
    ),
  ];
})();
