// Combinatorial maps: functions from an element of one carrier to an element of another.
//
// This is what the domains were for. Without them every map has the type
// `list<integer> -> list<integer>`, which is to say no type at all — `Inverse` and
// `ToLehmerCode` are indistinguishable to the engine and a composition of them is unchecked.
// With them, each map has a real signature, and `CycleType : permutation -> integer_partition`
// says something the engine can act on.
//
// A map's BODY is an expression over `_raw` (the contents of its argument), and its result is
// re-wrapped in the target domain's constructor. So a map is data, like a statistic — and the
// same reduction analysis applies to it.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { symbolInfo } from "@enumeratio/manifest";
import {
  applyComposition,
  attachConversion,
  extendBuiltin,
  registerEquivalence,
  registerOperation,
} from "@enumeratio/structures";
import { CARRIERS } from "./carriers.ts";
import { fastDefinition } from "./compiled.ts";
import {
  dyckPathBody,
  parentArrayBody,
  treeOfDyckPathBody,
  treeOfDyckPathGuard,
  treeOfParentArrayBody,
  treeOfParentArrayGuard,
} from "../trees/src/binary-tree.ts";
import { bstParents } from "../trees/src/bst.ts";
import {
  cycleDecompositionBody,
  permutationOfCycleDecompositionBody,
  permutationOfCycleDecompositionGuard,
} from "../permutations/src/cycle-decomposition.ts";
import {
  fromPermutationLeftChild,
  fromPermutationRightChild,
  fromPermutationRoot,
} from "../trees/src/increasing-binary-tree.ts";
import {
  insertionReadingWord,
  insertionRowWord,
  insertionShape,
  recordingRowWord,
  rskRowWords,
} from "../tableaux/src/tableau.ts";

export interface CombinatorialMap {
  readonly name: string;
  /** The carrier type this map takes. */
  readonly from: string;
  /** The carrier type it produces. */
  readonly to: string;
  /** The body, over `_raw` — the CONTENTS of the argument, since generic heads cannot see
   *  through a domain constructor (https://github.com/enumeratio/enumeratio/wiki/Domains §1.5). */
  readonly body?: unknown;
  /** A conversion between sibling carriers: no head of its own, but an overload of the target's
   *  constructor, so `SetPartition(RestrictedGrowthString([0, 1, 0]))` converts. Its `name` is
   *  that constructor, which is also its key for `CombinatorialMap` and for laws. */
  readonly convert?: boolean;
  /** FindStat map ids, for a map whose record doesn't state them (a conversion has none). */
  readonly findstat?: readonly string[];
  /** A predicate over `_raw`, checked before `body`. When it evaluates to anything but
   *  `"True"` the map DECLINES — the call stays unevaluated, the way a restriction's `Filter`
   *  never materialises what it excludes, rather than answering wrong for a subject outside
   *  the map's actual domain (KrewerasComplement, defined only on the non-crossing
   *  permutations). Absent, every subject of the right carrier is in domain. A guard may
   *  name `_image` for the MATERIALISED body: embedding the body expression itself hands a
   *  lazy `Map` to whatever reads it, and a kernel-backed statistic never finishes. */
  readonly guard?: unknown;
  /** Defined as a COMPOSITION of other maps, applied right to left — `["Complement",
   *  "Reverse"]` is complement-after-reverse. A composed map has no body of its own; it is
   *  the case that makes typed maps worth having, since each step's output type has to match
   *  the next step's input. */
  readonly composedOf?: readonly string[];
  /** Extra constructor arguments, for a carrier whose shape is a tuple. `finset` is
   *  `(members, n)`, so a map into it has to supply the ground size as well as the members. */
  readonly extra?: readonly unknown[];
  readonly summary: string;
  readonly note?: string;
  /** What Plausible checks on every element of every family over `from` (laws.ts). Beyond
   *  these, every map is checked to be TYPED: its result is a `to`. */
  readonly laws?: readonly Law[];
  /**
   * Whether the map preserves rank between two collections: the k-th element of `from` at
   * size n goes to the k-th of `to` at size n + `sizeOffset`. The strongest claim a bijection
   * can make; it lets either collection borrow the other's ranking. Checked by
   * tests/equivalence.test.ts.
   */
  readonly orderIsomorphism?: { readonly from: string; readonly to: string; readonly sizeOffset?: number };
}

/** A map's law: f∘f = id, f∘f = f, or g∘f = id for the named map g. */
export type Law = "involution" | "idempotent" | { readonly inverse: string };

// Every Range here states its step: compute-engine counts DOWN when the end is below the start,
// so `Range(1, 0)` is [1, 0] where Wolfram's is empty, and an empty permutation would get two
// positions.
const positions: MathJSON = ["Range", 1, ["Length", "_raw"], 1];
const at = (index: MathJSON, of: MathJSON = "_raw"): MathJSON => ["At", of, index];
const forEach = (over: MathJSON, body: MathJSON, variable = "i"): MathJSON => [
  "Map",
  ["Function", body, variable],
  over,
];

/** A MathJSON expression, structurally — declared locally so this package stays packable
 *  (a bundled package cannot import types from the src-only reference package). */
type MathJSON = string | number | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

const size: MathJSON = ["Count", "_raw"];

/** The smallest later position sharing i's label in the restricted growth string, or i
 *  itself when none does — i.e. i's successor within its own block. */
const nextInBlock = (i: MathJSON): MathJSON => {
  const later: MathJSON = ["Filter", ["Range", ["Add", i, 1], size, 1], ["Function", ["Equal", at("k"), at(i)], "k"]];
  return ["If", ["Greater", ["Length", later], 0], ["Min", later], i];
};

/** `body` with `name` bound to `value` — a `let`, as a lambda applied to its argument. The
 *  block structure a map reads at every position (`parts`, the leaders) is computed once
 *  here rather than once per position per read; see tableau.ts for the rule. */
const bind = (name: string, value: MathJSON, body: MathJSON): MathJSON => ["Apply", ["Function", body, name], value];

/** `expr` with every `from` symbol renamed `to`. */
const rename = (expr: MathJSON, from: string, to: string): MathJSON =>
  expr === from ? to : Array.isArray(expr) ? (expr as readonly MathJSON[]).map((x) => rename(x, from, to)) : expr;

/** A set partition's restricted growth string, labels from `base`: position i carries the index
 *  of its block, blocks in the order they are kept. */
const growthStringOf = (blocks: MathJSON, base = 0): MathJSON =>
  forEach(
    ["Range", 1, ["Length", ["Flatten", blocks]], 1],
    [
      "Fold",
      ["Function", ["If", ["Element", "i", ["At", blocks, "k"]], ["Add", "k", base - 1], "acc"], "acc", "k"],
      -1,
      ["Range", 1, ["Length", blocks], 1],
    ],
  );

/** The blocks of a restricted growth string whose labels start at `base`: block j holds the
 *  positions labelled j, in increasing order. Each block is folded, so it is a list rather than
 *  a lazy filter. */
const blocksOf = (word: MathJSON, base: number): MathJSON => [
  "If",
  ["Equal", ["Length", word], 0],
  ["List"],
  forEach(
    ["Range", base, ["Max", word], 1],
    [
      "Fold",
      ["Function", ["If", ["Equal", ["At", word, "p"], "j"], ["Join", "acc", ["List", "p"]], "acc"], "acc", "p"],
      ["List"],
      ["Range", 1, ["Length", word], 1],
    ],
    "j",
  ),
];

/** A composition's partial sums, folded into a list. */
const partialSums = (parts: MathJSON): MathJSON => [
  "Fold",
  [
    "Function",
    ["Join", "acc", ["List", ["Add", ["If", ["Equal", ["Length", "acc"], 0], 0, ["Last", "acc"]], ["At", parts, "i"]]]],
    "acc",
    "i",
  ],
  ["List"],
  ["Range", 1, ["Length", parts], 1],
];

/** A composition's size, n: the sum of its parts. */
const sizeOf = (parts: MathJSON): MathJSON => [
  "Fold",
  ["Function", ["Add", "acc", ["At", parts, "i"]], "acc", "i"],
  0,
  ["Range", 1, ["Length", parts], 1],
];

/** A composition of n as its cut word of length n - 1: bit j is 1 when the composition is cut
 *  after position n - j, so compositions and words are listed in the same order. */
const cutWordOf = (parts: MathJSON): MathJSON =>
  // `bind` spreads a list across the function's parameters, so the partial sums are inlined.
  bind("cn", sizeOf(parts), [
    "If",
    // n = 1: the empty word, and no range to walk.
    ["Less", "cn", 2],
    ["List"],
    forEach(
      ["Range", 1, ["Subtract", "cn", 1], 1],
      ["If", ["Element", ["Subtract", "cn", "j"], partialSums(parts)], 1, 0],
      "j",
    ),
  ]);

/** The composition of m + 1 a cut word of length m describes: the parts between the cuts. */
const compositionOfCutWord = (word: MathJSON): MathJSON =>
  bind(
    "bounds",
    [
      "Join",
      ["List", 0],
      [
        "Fold",
        [
          "Function",
          [
            "If",
            ["Equal", ["At", word, ["Subtract", ["Add", ["Length", word], 1], "p"]], 1],
            ["Join", "acc", ["List", "p"]],
            "acc",
          ],
          "acc",
          "p",
        ],
        ["List"],
        ["Range", 1, ["Length", word], 1],
      ],
      ["List", ["Add", ["Length", word], 1]],
    ],
    forEach(
      ["Range", 1, ["Subtract", ["Length", "bounds"], 1], 1],
      ["Subtract", ["At", "bounds", ["Add", "q", 1]], ["At", "bounds", "q"]],
      "q",
    ),
  );

/** A fold over `1 .. n`, indexing rather than iterating a structure — the rule from
 *  tableau.ts, which is what makes these evaluate at all. */
const byIndex = (n: MathJSON, initial: MathJSON, step: MathJSON, accumulator: string, variable: string): MathJSON => [
  "Fold",
  ["Function", step, accumulator, variable],
  initial,
  ["Range", 1, n, 1],
];

/** The least element of i's orbit — its cycle's representative. */
const orbitLeast = (i: MathJSON): MathJSON =>
  byIndex(size, i, ["Min", ["List", "omin", iterate(i, "kk")]], "omin", "kk");

/** The greatest element of i's orbit — the leader under Foata's convention, which writes
 *  each cycle starting at its largest element rather than its least. */
const orbitMax = (i: MathJSON): MathJSON => ["Max", forEach(positions, iterate(i, "k"), "k")];

/** How many cycle leaders are at most `bound` — the rank that labels i's block. */
const leadersUpTo = (bound: MathJSON): MathJSON =>
  byIndex(bound, 0, ["Add", "lacc", ["If", ["Equal", "jj", orbitLeast("jj")], 1, 0]], "lacc", "jj");

/** One entry per cycle, in position order (by increasing least element) — not sorted by
 *  length. Shared by CycleType (sorted descending, as the partition) and by
 *  ConjugateAfterCycleType (its conjugate). */
const cycleLengths: MathJSON = [
  "Map",
  ["Function", ["Length", ["Union", forEach(positions, iterate("i", "k"), "k")]], "i"],
  ["Filter", positions, ["Function", ["Equal", "i", ["Min", forEach(positions, iterate("i", "k"), "k")]], "i"]],
];

/** Count of cycle LEADERS (one check per position, `orbitLeast`-style — not a `Filter` over
 *  `cycleLengths` itself) whose cycle is at least `j` long. `cycleLengths` is a `Map`, which
 *  stays LAZY (see `materialise` below): fine for CycleType, which immediately feeds it to
 *  `descending`'s `Sort` (forces it once), but reading a `Map` result back out through a
 *  second `Filter` — as an earlier version of `conjugateOfCycleType` did — silently drops
 *  entries (caught by the exhaustive test: `[1, 3, 2]`'s conjugate came back one entry
 *  short). Walking positions with a plain `Range`-Fold and indexing `_raw` directly, the way
 *  every other map here does, sidesteps it entirely. */
const cyclesAtLeast = (j: MathJSON): MathJSON =>
  byIndex(
    size,
    0,
    [
      "Add",
      "ccacc",
      [
        "If",
        [
          "And",
          ["Equal", "cc", orbitLeast("cc")],
          ["GreaterEqual", ["Length", ["Union", forEach(positions, iterate("cc", "ck"), "ck")]], j],
        ],
        1,
        0,
      ],
    ],
    "ccacc",
    "cc",
  );

/** The conjugate of the cycle type: entry j counts the cycles of length >= j, for
 *  j = 1 .. the longest cycle — built by skipping the zero entries as they come up rather
 *  than computing the true bound (`Max(cycleLengths)`) and trimming after the fact, which
 *  needs a second read of `cycleLengths` in a different shape and hits the same lazy-`Map`
 *  problem `cyclesAtLeast` was written to avoid. */
const conjugateOfCycleType: MathJSON = byIndex(
  size,
  ["List"],
  ["If", ["Equal", cyclesAtLeast("q"), 0], "qacc", ["Join", "qacc", ["List", cyclesAtLeast("q")]]],
  "qacc",
  "q",
);

/** The cumulative sums of `list` — entry m is the sum of its first m entries — built as a
 *  list accumulator the way `descentPositions` and tableau.ts's recording tableau are (a
 *  `Join` onto the accumulator, indexed back with `At`). An earlier version summed the
 *  prefix afresh at every position instead, which put a fold inside a fold inside the map
 *  over positions; bound once with `bind`, this is read with a single `At`. */
const cumulative = (list: MathJSON): MathJSON =>
  byIndex(
    ["Count", list],
    ["List"],
    [
      "Join",
      "cacc",
      ["List", ["Add", ["If", ["Equal", "c", 1], 0, ["At", "cacc", ["Subtract", "c", 1]]], ["At", list, "c"]]],
    ],
    "cacc",
    "c",
  );

/** Which block (1-indexed) position `p` falls into, given the blocks' cumulative `ends` —
 *  one more than the number of ends before it. A `Range`-fold with `At`, per the rule. */
const blockIndexAt = (ends: MathJSON, p: MathJSON): MathJSON => [
  "Add",
  byIndex(["Count", ends], 0, ["Add", "bacc", ["If", ["Less", ["At", ends, "bi"], p], 1, 0]], "bacc", "bi"),
  1,
];
/** Where block `blk` starts, given the cumulative `ends`. */
const blockStart = (ends: MathJSON, blk: MathJSON): MathJSON => [
  "If",
  ["Equal", blk, 1],
  1,
  ["Add", ["At", ends, ["Subtract", blk, 1]], 1],
];

// ConjugacyClassRepresentative writes the canonical permutation for a cycle type: cycles in
// DECREASING length order, filled with consecutive integers, each cycle (a a+1 … a+len-1)
// written as the one-line word a+1, a+2, …, a+len-1, a — i.e. a cyclic left-shift of its
// block. (FindStat does not pin down an ordering for this map; this is the convention we
// picked and it is exercised end to end by the bijectivity test.)
const conjugacyClassRepresentative: MathJSON = bind(
  "ends",
  cumulative(descending(cycleLengths)),
  forEach(
    positions,
    bind("blk", blockIndexAt("ends", "i"), [
      "If",
      ["Less", "i", ["At", "ends", "blk"]],
      ["Add", "i", 1],
      blockStart("ends", "blk"),
    ]),
  ),
);

// Foata's (first) fundamental transformation: write the permutation in cycle notation with
// each cycle rotated to start at its own maximum, order the cycles by increasing maximum,
// and erase the parentheses. Blocks come from cycle lengths ordered by increasing cycle
// MAXIMUM rather than decreasing length, and each block's value is read off the permutation
// itself (via `iterate`) rather than renumbered.
const foataWord: MathJSON = (() => {
  const maximaAscending: MathJSON = ["Filter", positions, ["Function", ["Equal", "i", orbitMax("i")], "i"]];
  const lengthsByLeader: MathJSON = [
    "Map",
    ["Function", ["Length", ["Union", forEach(positions, iterate("m", "k"), "k")]], "m"],
    maximaAscending,
  ];
  const leader: MathJSON = ["At", "leaders", "blk"];
  const offset: MathJSON = ["Subtract", "i", blockStart("ends", "blk")];
  return bind(
    "leaders",
    maximaAscending,
    bind(
      "ends",
      cumulative(lengthsByLeader),
      forEach(
        positions,
        bind("blk", blockIndexAt("ends", "i"), ["If", ["Equal", offset, 0], leader, iterate(leader, offset)]),
      ),
    ),
  );
})();

/** The descent positions. `Range(1, 0)` never evaluates, so n < 2 is stated rather than
 *  left to fall out. */
const descentPositions: MathJSON = [
  "If",
  ["Less", size, 2],
  ["List"],
  byIndex(
    ["Subtract", size, 1],
    ["List"],
    ["If", ["Greater", at("d"), at(["Add", "d", 1])], ["Join", "dacc", ["List", "d"]], "dacc"],
    "dacc",
    "d",
  ),
];

/** n cut at the descents: the gaps between 0, the descent positions, and n. */
const descentComposition: MathJSON = (() => {
  const bounds: MathJSON = ["Join", ["List", 0], descentPositions, ["List", size]];
  return [
    "If",
    ["Less", size, 1],
    ["List"],
    byIndex(
      ["Subtract", ["Count", bounds], 1],
      ["List"],
      ["Join", "cc", ["List", ["Subtract", ["At", bounds, ["Add", "c", 1]], ["At", bounds, "c"]]]],
      "cc",
      "c",
    ),
  ];
})();

/** The long cycle c = (1 2 ... n), read at position i: i + 1, wrapping n back to 1 — the same
 *  `Mod` shape `CyclicShift` rotates the WORD by; here it is applied to the position instead
 *  to give c itself. */
const longCycleAt = (i: MathJSON): MathJSON => ["Add", ["Mod", i, ["Length", "_raw"]], 1];

/** K(w) at position i is w^{-1}(c(i)) — and `IndexOf` on the word already IS w^{-1} applied
 *  to its argument (the same reading `Inverse` uses), so no separate inversion or
 *  multiplication step is needed. */
const krewerasBody: MathJSON = forEach(positions, ["IndexOf", "_raw", longCycleAt("i")]);

/**
 * w sits below c in absolute order — equivalently, its cycles form a non-crossing partition —
 * iff the reflection lengths of w and K(w) split c's exactly: `cyc(w) + cyc(K(w)) = n + 1`.
 * Each side is wrapped back into a `Permutation` because `CycleCount` is declared over the
 * carrier, not the raw word.
 */
const krewerasGuard: MathJSON = [
  "Equal",
  ["Add", ["CycleCount", ["Permutation", "_raw"]], ["CycleCount", ["Permutation", "_image"]]],
  ["Add", size, 1],
];

export const MAPS: readonly CombinatorialMap[] = [
  {
    name: "Reverse",
    from: "permutation",
    to: "permutation",
    body: forEach(positions, at(["Subtract", ["Add", ["Length", "_raw"], 1], "i"])),
    summary: "The word read backwards.",
    laws: ["involution"],
  },
  {
    name: "Complement",
    from: "permutation",
    to: "permutation",
    body: forEach(positions, ["Subtract", ["Add", ["Length", "_raw"], 1], at("i")]),
    summary: "Each entry replaced by n + 1 minus itself.",
    laws: ["involution"],
  },
  {
    name: "Inverse",
    from: "permutation",
    to: "permutation",
    // The inverse sends i to the POSITION of i, which is what IndexOf reads off directly.
    body: forEach(positions, ["IndexOf", "_raw", "i"]),
    summary: "The inverse permutation: position of each value.",
    laws: ["involution"],
  },
  {
    name: "DescentSet",
    from: "permutation",
    to: "finset",
    extra: [["Length", "_raw"]],
    body: [
      "Filter",
      ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
      ["Function", ["Greater", at("i"), at(["Add", "i", 1])], "i"],
    ],
    summary: "The positions where the word falls.",
    note: "The statistics Descents and MajorIndex are the size and the sum of this set — which is the reduction worth having: a statistic of a map's output rather than a fresh walk.",
  },
  {
    name: "ToLehmerCode",
    from: "permutation",
    to: "subexcedant_seq",
    body: forEach(positions, [
      "Count",
      ["Filter", ["Range", ["Add", "i", 1], ["Length", "_raw"], 1], ["Function", ["Greater", at("i"), at("j")], "j"]],
    ]),
    summary: "Entry i counts the later entries smaller than p(i).",
    note: "Its total is the inversion count, which is the Lehmer code's whole point.",
  },
  {
    name: "CycleType",
    from: "permutation",
    to: "integer_partition",
    // Cycle lengths, largest first — the partition of n they form. Built on the same orbit
    // machinery the cycle statistics use: i leads its cycle when it is the least element of
    // its own orbit.
    // Sorted largest-first WITHOUT compute-engine's `Reverse`: this package declares a MAP
    // of that name over permutations, and a head can only mean one thing. Reading the sorted
    // list back to front by index says the same and shadows nothing.
    body: descending(cycleLengths),
    summary: "The multiset of cycle lengths, as a partition.",
    note: "The first map here that CROSSES carriers — permutation in, integer partition out — which is the case the types exist for.",
  },
  {
    name: "ReverseComplement",
    from: "permutation",
    to: "permutation",
    composedOf: ["Complement", "Reverse"],
    summary: "Reverse, then complement.",
    note: "A thin alias over Compose(Complement, Reverse). The catalog has the name, so we keep it — but the name is not what makes it work, and nothing stops a reader writing the composition directly.",
    laws: ["involution"],
  },
  {
    name: "InverseAfterComplementAfterReverse",
    from: "permutation",
    to: "permutation",
    composedOf: ["Inverse", "Complement", "Reverse"],
    summary: "Reverse, then complement, then invert.",
    note: "The name is FindStat's, and it is what a catalog produces when it cannot SAY composition. With Composition it is Compose(Inverse, Complement, Reverse) and needs no name at all — kept only because the catalog has it.",
  },
  {
    name: "CyclicShift",
    from: "permutation",
    to: "permutation",
    body: forEach(positions, at(["Add", ["Mod", "i", ["Length", "_raw"]], 1])),
    summary: "Rotate the word one place to the left.",
    laws: [{ inverse: "InverseCyclicShift" }],
  },
  {
    name: "InverseCyclicShift",
    from: "permutation",
    to: "permutation",
    body: forEach(
      positions,
      at(["Add", ["Mod", ["Add", ["Subtract", "i", 2], ["Length", "_raw"]], ["Length", "_raw"]], 1]),
    ),
    summary: "Rotate the word one place to the right.",
    laws: [{ inverse: "CyclicShift" }],
  },
  {
    name: "PeakSet",
    from: "permutation",
    to: "finset",
    extra: [["Length", "_raw"]],
    body: [
      "Filter",
      ["Range", 2, ["Subtract", ["Length", "_raw"], 1], 1],
      [
        "Function",
        ["And", ["Less", at(["Subtract", "i", 1]), at("i")], ["Greater", at("i"), at(["Add", "i", 1])]],
        "i",
      ],
    ],
    summary: "The interior positions that rise then fall.",
    note: "Its size is the Peaks statistic, exactly as DescentSet's is Descents.",
  },
  {
    name: "RskInsertion",
    from: "permutation",
    to: "standard_tableau",
    body: insertionRowWord,
    summary: "The insertion tableau of the RSK correspondence.",
    note: "Row insertion with bumping, as a fold over the word whose accumulator is the growing tableau. Emitted as a ROW WORD because that is what the carrier is; with RskShape it determines the tableau. See tableau.ts for the indexing rule that makes it evaluate at all.",
  },
  {
    name: "RskShape",
    from: "permutation",
    to: "integer_partition",
    body: insertionShape,
    summary: "The common shape of the RSK tableaux: the row lengths, as a partition of n.",
    note: "By Schensted, its first part is the longest increasing subsequence and its first COLUMN is the longest decreasing one — two statistics readable off this map.",
  },
  {
    name: "RskRecording",
    from: "permutation",
    to: "standard_tableau",
    body: recordingRowWord,
    summary: "The recording tableau of the RSK correspondence, as a row word.",
    note: "Records WHERE each insertion landed. The insertion logic is untouched — comparing row lengths before and after says which row grew, which is less work than instrumenting the bumping to report it.",
  },
  {
    name: "Rsk",
    from: "permutation",
    to: "standard_tableau_pair",
    body: rskRowWords,
    summary: "The RSK correspondence: the insertion and recording tableaux, as a pair.",
    note: "Both tableaux share a shape, so the pair plus RskShape determines them. A standard_tableau_pair is a tuple of two carriers — the first composite carrier anything here constructs.",
  },
  {
    name: "CyclePartition",
    from: "permutation",
    to: "set_partition",
    // Each position labelled with the rank of its cycle's least element (a restricted growth
    // string from 1), then read off as blocks.
    body: bind(
      "cw",
      byIndex(size, ["List"], ["Join", "cacc", ["List", leadersUpTo(orbitLeast("i"))]], "cacc", "i"),
      blocksOf("cw", 1),
    ),
    summary: "The orbits, as a set partition of the positions.",
    note: "Removed once for giving every position the same label. The cause was the laziness rule in tableau.ts — folding over a list taken out of the accumulator instead of indexing a range. Written by index it is right first time.",
  },
  {
    name: "DescentComposition",
    from: "permutation",
    to: "composition",
    body: descentComposition,
    summary: "The composition of n cut at the descent positions.",
    note: "Its parts sum to n and its length is one more than Descents — another statistic readable off a map. Removed once for erroring on words with no descents; `Range(1, 0)` never evaluates, so the short case has to be stated.",
  },
  {
    name: "BinarySearchTree",
    from: "permutation",
    to: "binary_tree",
    composedOf: ["BinaryTree", "BinarySearchTreeParentArray"],
    summary: "The tree built by inserting σ(1), σ(2), ... into an empty binary search tree.",
    note: "The sylvester congruence: two permutations land on the same tree exactly when they agree on which of any pair is inserted first. Built as its parent array (BinarySearchTreeParentArray), then read as a tree.",
  },
  {
    name: "CycleDecomposition",
    convert: true,
    from: "permutation",
    to: "cycle_decomposition",
    body: cycleDecompositionBody,
    summary:
      "A permutation in cycle notation, fixed points kept: each cycle from its least point, cycles in order of those points.",
    laws: [{ inverse: "Permutation" }],
  },
  {
    name: "Permutation",
    convert: true,
    from: "cycle_decomposition",
    to: "permutation",
    body: permutationOfCycleDecompositionBody,
    guard: permutationOfCycleDecompositionGuard,
    summary: "The permutation a cycle decomposition describes.",
    note: "Declines a decomposition that isn't canonical: a point missing or repeated, a cycle not starting at its least point, or cycles out of order.",
    laws: [{ inverse: "CycleDecomposition" }],
  },
  {
    name: "BinarySearchTreeParentArray",
    from: "permutation",
    to: "binary_tree_parent_array",
    body: bstParents,
    summary:
      "The binary search tree of σ as its parent array: entry v is the value v is inserted under, 0 for the root.",
    note: "A search tree's values are its in-order labels, so this is the tree's in-order parent array. See bst.ts for why a fold builds it this way.",
  },
  {
    name: "BinaryTreeParentArray",
    convert: true,
    from: "binary_tree",
    to: "binary_tree_parent_array",
    body: parentArrayBody,
    summary:
      "A binary tree as its parent array: its nodes numbered in order, entry k the number of the k-th node's parent, 0 at the root.",
    note: "An order isomorphism: the k-th tree BinaryTrees lists goes to the k-th array BinaryTreeParentArrays lists.",
    laws: [{ inverse: "BinaryTree" }],
    orderIsomorphism: { from: "BinaryTrees", to: "BinaryTreeParentArrays" },
  },
  {
    name: "BinaryTree",
    convert: true,
    from: "binary_tree_parent_array",
    to: "binary_tree",
    body: treeOfParentArrayBody,
    guard: treeOfParentArrayGuard,
    summary: "The binary tree an in-order parent array describes: a node below its parent goes left, above it right.",
    note: "Declines an array that isn't one: two roots, two left children, a cycle, or labels out of order.",
    laws: [{ inverse: "BinaryTreeParentArray" }],
    orderIsomorphism: { from: "BinaryTreeParentArrays", to: "BinaryTrees" },
  },
  {
    name: "DyckPath",
    convert: true,
    from: "binary_tree",
    to: "dyck_path",
    body: dyckPathBody,
    summary: "A binary tree [L, R] as the Dyck path U φ(L) D φ(R).",
    note: "FindStat's Mp00012. A bijection, so every Dyck path statistic answers on a tree; not order-preserving between BinaryTrees and DyckPaths, which list in different orders.",
    findstat: ["Mp00012"],
    laws: [{ inverse: "BinaryTree" }],
  },
  {
    name: "BinaryTree",
    convert: true,
    from: "dyck_path",
    to: "binary_tree",
    body: treeOfDyckPathBody,
    guard: treeOfDyckPathGuard,
    summary: "A Dyck path U A D B, cut at its first return, as the binary tree [φ⁻¹(A), φ⁻¹(B)].",
    laws: [{ inverse: "DyckPath" }],
  },
  {
    name: "FromPermutation",
    from: "permutation",
    to: "increasing_binary_tree",
    body: fromPermutationRoot,
    extra: [fromPermutationLeftChild, fromPermutationRightChild],
    summary:
      "The increasing binary tree built by minimum-splitting recursion: the position of the smallest value roots the tree, everything before it recurses to the left, everything after it to the right.",
    note: "Paired with ToPermutation, whose overload set (IncreasingBinaryTree among others) names this map's codomain — the catalog dump folds map rows to names with no source-collection field, so that pairing is what disambiguates it. The root is always 1: every permutation of [n] holds the value 1, and heap order puts the global minimum at the top regardless of which permutation it came from. See increasing-binary-tree.ts for the non-recursive (nearest-smaller-value) characterisation used to build it without folding over a list taken out of the accumulator (tableau.ts).",
  },
  {
    name: "KnuthClassRepresentative",
    from: "permutation",
    to: "permutation",
    body: insertionReadingWord,
    summary: "The row reading word of σ's RSK insertion tableau — the canonical word of its Knuth (plactic) class.",
    note: "Two permutations are Knuth-equivalent exactly when they share an insertion tableau (Schensted), so reading that tableau back out — bottom row to top, left to right — picks one fixed representative per class. Idempotent: the representative's own insertion tableau is the same P, so applying this again changes nothing.",
    laws: ["idempotent"],
  },
  {
    name: "KrewerasComplement",
    from: "permutation",
    to: "permutation",
    body: krewerasBody,
    guard: krewerasGuard,
    summary: "w⁻¹c, for w below the long cycle c = (1 2 ... n) in absolute order.",
    note: "Only defined on the non-crossing permutations (the embedding of NC(n) in S_n by absolute order beneath c) — everywhere else this declines rather than answering for a word it was never defined on. K∘K is conjugation by c, and K is a bijection of NC(n) onto itself.",
  },
  {
    name: "ConjugateAfterCycleType",
    from: "permutation",
    to: "integer_partition",
    body: conjugateOfCycleType,
    summary: "The conjugate partition of the cycle type.",
    note: "Entry j is the count of cycles of length at least j — non-increasing in j by construction, so it comes out sorted without needing one.",
  },
  {
    name: "ConjugacyClassRepresentative",
    from: "permutation",
    to: "permutation",
    body: conjugacyClassRepresentative,
    summary: "The canonical permutation with the same cycle type.",
    note: "FindStat does not fix an ordering for this map. Convention used here: cycles in decreasing length, filled with consecutive integers, each cycle (a a+1 … a+len-1) written as the one-line word a+1, …, a+len-1, a.",
    laws: ["idempotent"],
  },
  {
    name: "Foata",
    from: "permutation",
    to: "permutation",
    body: foataWord,
    summary:
      "Foata's fundamental bijection: cycles rotated to their max, ordered by increasing max, parentheses erased.",
    note: "The first fundamental transformation — it sends a permutation with k cycles to one with k left-to-right maxima. (The catalog's title also names maj → inv, which is the SECOND fundamental transformation's property; this map is the first.)",
  },
  {
    name: "RestrictedGrowthString",
    convert: true,
    from: "set_partition",
    to: "restricted_growth_string",
    body: growthStringOf("_raw"),
    summary: "A set partition's restricted growth string: each position labelled with its block's index, from 0.",
    note: "An order isomorphism: the k-th set partition of n, in the order SetPartitions lists them, goes to the k-th restricted growth string of length n. So everything defined on one carrier is available on the other through it.",
    laws: [{ inverse: "SetPartition" }],
    orderIsomorphism: { from: "SetPartitions", to: "RestrictedGrowthStrings" },
  },
  {
    name: "SetPartition",
    convert: true,
    from: "restricted_growth_string",
    to: "set_partition",
    body: blocksOf("_raw", 0),
    summary: "The set partition a restricted growth string labels: block j holds the positions labelled j.",
    note: "The inverse of RestrictedGrowthString(partition), and order-preserving in the same way.",
    laws: [{ inverse: "RestrictedGrowthString" }],
    orderIsomorphism: { from: "RestrictedGrowthStrings", to: "SetPartitions" },
  },
  {
    name: "Surjection",
    convert: true,
    from: "set_composition",
    to: "surjection",
    body: growthStringOf("_raw", 1),
    summary: "A set composition as a surjection: each position labelled with its block's index, from 1.",
    laws: [{ inverse: "SetComposition" }],
  },
  {
    name: "SetComposition",
    convert: true,
    from: "surjection",
    to: "set_composition",
    body: blocksOf("_raw", 1),
    summary: "The set composition a surjection labels: block j holds the positions labelled j.",
    laws: [{ inverse: "Surjection" }],
  },
  {
    name: "CutWord",
    from: "composition",
    to: "binary_word",
    body: cutWordOf("_raw"),
    // The composition of 0 has no word: words of length n - 1 start at n = 1.
    guard: ["Greater", ["Length", "_raw"], 0],
    summary: "A composition of n as the binary word of length n - 1 marking where it is cut.",
    note: "An order isomorphism: the k-th composition of n, as IntegerCompositions lists them, goes to the k-th binary word of length n - 1.",
    laws: [{ inverse: "Composition" }],
    orderIsomorphism: { from: "IntegerCompositions", to: "BinaryWords", sizeOffset: -1 },
  },
  {
    name: "Composition",
    convert: true,
    from: "binary_word",
    to: "composition",
    body: compositionOfCutWord("_raw"),
    summary: "The composition of m + 1 a binary word of length m cuts out.",
    note: "The inverse of CutWord, and order-preserving in the same way.",
    laws: [{ inverse: "CutWord" }],
    orderIsomorphism: { from: "BinaryWords", to: "IntegerCompositions", sizeOffset: 1 },
  },
  {
    name: "ArcRepresentation",
    from: "set_partition",
    to: "endofunction",
    // Read through the restricted growth string: position i's block label. A block's members
    // are in ascending order by position, so "the next element in i's block" is just the
    // smallest later position sharing i's label — a function on 1..n, which is exactly what
    // an endofunction IS. The arcs of the standard representation are the pairs (i, f(i)) with
    // f(i) != i; a position last in its block is a fixed point.
    body: bind("aw", growthStringOf("_raw"), rename(forEach(positions, nextInBlock("i")), "_raw", "aw")),
    summary: "Each position linked to the next in its block, or to itself when last.",
    note: "The statistics frontier calls this the arc representation: within each block, consecutive elements (b1,b2), (b2,b3), .... Encoding it as an endofunction rather than a bare list of pairs keeps it a typed carrier — Crossings, Nestings and CrossingNestingTotal (@enumeratio/statistics) read the arcs off this without needing a carrier of their own.",
  },
];

/** A list sorted largest-first, by reading the sorted list back to front. */
function descending(list: MathJSON): MathJSON {
  const sorted = ["Sort", list];
  const size = ["Count", sorted];
  return ["Map", ["Function", ["At", sorted, ["Subtract", ["Add", size, 1], "i"]], "i"], ["Range", 1, size, 1]];
}

/** p^k(i): apply the permutation k times, as a fold. */
function iterate(start: MathJSON, times: MathJSON): MathJSON {
  return ["Fold", ["Function", at("a"), "a", "b"], start, ["Range", 1, times, 1]];
}

/** Declare each map, typed by carrier: it takes a constructed value of `from` and returns a
 *  constructed value of `to`, so a composition that does not typecheck is caught. */
export function declareMaps(
  ce: ComputeEngine,
  constructorFor: Readonly<Record<string, string>>,
  maps: readonly CombinatorialMap[] = MAPS,
): void {
  const shapeOf = new Map(CARRIERS.map((carrier) => [carrier.type, carrier.shape]));
  for (const map of maps) {
    const wrap = constructorFor[map.to];
    if (wrap === undefined) throw new Error(`no constructor for ${map.to}`);
    // The definition as it runs: compiled where compute-engine's compiler takes it, memoized.
    const definition =
      map.body === undefined
        ? undefined
        : fastDefinition({
            ce,
            body: map.body,
            guard: map.guard,
            from: shapeOf.get(map.from),
            to: shapeOf.get(map.to),
            interpret: (contents) => evaluateDefinition(ce, map, contents),
          });

    const handle = (subject: BoxedExpression): BoxedExpression | undefined => {
      // A composed map applies its steps right to left, each through its own declared head —
      // so every intermediate value is a properly constructed carrier and the composition is
      // type-checked at each step rather than only at the ends.
      if (map.composedOf !== undefined) return applyComposition(ce, map.composedOf, subject);
      const contents = operandsOf(subject)[0];
      if (contents === undefined) return undefined;
      const image = definition?.(contents.json);
      if (image === undefined) return undefined;
      const main = ce.box(image as never);
      const extra = (map.extra ?? []).map((argument) => ce.box(fill(argument, contents.json) as never).evaluate());
      // A tuple-shaped carrier takes ONE argument that is a Tuple, not several arguments —
      // `finset` is `(members, n)`, so a map into it hands over a single Tuple.
      const argument = extra.length === 0 ? main : ce.function("Tuple", [main, ...extra]).evaluate();
      return ce.function(wrap, [argument]).evaluate();
    };

    const from = constructorFor[map.from];
    if (from !== undefined) {
      // FindStat's map ids (`Mp00066`), as the map's record states them.
      const findstat = [
        ...(map.findstat ?? []),
        ...(map.convert === true ? [] : (symbolInfo(map.name)?.findstat ?? []))
          .filter((ref) => ref.on === undefined || ref.on === from)
          .map((ref) => ref.id),
      ];
      registerOperation(ce, "CombinatorialMap", from, { name: map.name, type: map.to, findstat, definition: handle });
      // A map with an inverse between two carriers makes them equivalent: what one carrier
      // defines, the other reaches through the map (set partitions and their growth strings).
      const to = constructorFor[map.to];
      if (to !== undefined && to !== from && map.laws?.some((law) => typeof law === "object"))
        registerEquivalence(ce, from, to, handle);
    }

    if (map.convert === true) {
      if (from === undefined || map.name !== wrap) throw new Error(`${map.name}: a conversion is named for its target`);
      attachConversion(ce, wrap, from, map.from, map.to, handle);
      continue;
    }

    // `Reverse`, `Complement` and `Inverse` are already compute-engine heads. Extending
    // rather than replacing keeps every overload they had — see extend.ts for why that is
    // possible even for the collection-backed ones.
    const extended = extendBuiltin(ce, {
      head: map.name,
      on: map.from,
      returns: map.to,
      handle,
    });
    if (extended) continue;

    ce.declare(map.name, {
      signature: `(${map.from}) -> ${map.to}`,
      evaluate: (ops) => {
        const subject = ops[0];
        return subject === undefined ? undefined : handle(subject);
      },
    });
  }
}

/** What a map's definition gives for `contents` (MathJSON): the body, materialised, or
 *  undefined when its guard declines. */
export function evaluateDefinition(ce: ComputeEngine, map: CombinatorialMap, contents: unknown): unknown {
  const main = materialise(ce, ce.box(fill(map.body, contents) as never).evaluate());
  if (map.guard !== undefined) {
    const guard = fill(fill(map.guard, contents), main.json, "_image");
    if (ce.box(guard as never).evaluate().json !== "True") return undefined;
  }
  return main.json;
}

/** Force a lazy result into a concrete List.
 *
 *  `Map` and `Filter` over a `Range` stay lazy — `Range(1, 3)` does not even evaluate to a
 *  list on its own — which is right for a collection and wrong for a carrier VALUE. A
 *  permutation is a list of numbers, not a promise of one, so a map materialises before
 *  wrapping. */
function materialise(ce: ComputeEngine, value: BoxedExpression): BoxedExpression {
  // A Tuple is already a concrete value — and materialising one would flatten it into a
  // List, which is exactly wrong for a composite carrier like `standard_tableau_pair`.
  if (value.operator === "List" || value.operator === "Tuple") return value;
  const size = ce.function("Count", [value]).evaluate().re;
  if (!Number.isFinite(size)) return value;
  const entries = Array.from({ length: size }, (_, index) =>
    ce.function("At", [value, ce.number(index + 1)]).evaluate(),
  );
  return ce.function("List", entries).evaluate();
}

/** Replace `_raw` (or another placeholder) with the argument's contents, before boxing. */
function fill(node: unknown, contents: unknown, placeholder = "_raw"): unknown {
  if (node === placeholder) return contents;
  return Array.isArray(node) ? node.map((operand) => fill(operand, contents, placeholder)) : node;
}
