// Combinatorial maps whose `from` carrier is `permutation` (or, for the one conversion back,
// `cycle_decomposition` — a permutations-owned carrier too): step 6c of the layering migration
// moves each map into the area owning its source carrier. See `../../src/map-helpers.ts` for
// the generic pieces (`at`, `forEach`, `bind`, `positions`, `size`, `blocksOf`) shared with
// other areas, and `../../src/maps.ts` for how this area's `PERMUTATIONS_MAPS` gets declared
// (still LAST, after every package's own carriers — see that file's comment on why `declareMaps`
// stays out of `declareCombinatorics`).
//
// A map's BODY is an expression over `_raw` (the contents of its argument), and its result is
// re-wrapped in the target domain's constructor. So a map is data, like a statistic — and the
// same reduction analysis applies to it.

import {
  at,
  bind,
  blocksOf,
  forEach,
  type CombinatorialMap,
  type MathJSON,
  positions,
  size,
} from "../../src/map-helpers.ts";
import { bstParents } from "../../trees/src/bst.ts";
import { fromPermutationTree } from "../../trees/src/increasing-binary-tree.ts";
import {
  insertionReadingWord,
  insertionRows,
  insertionShape,
  recordingRows,
  rskRows,
} from "../../tableaux/src/tableau.ts";
import {
  cycleDecompositionBody,
  permutationOfCycleDecompositionBody,
  permutationOfCycleDecompositionGuard,
} from "./cycle-decomposition.ts";

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
  "list<integer>",
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
      "list<integer>",
    ),
    "list<integer>",
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

export const PERMUTATIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "Reverse",
    from: "permutation",
    to: "permutation",
    body: forEach(positions, at(["Subtract", ["Add", ["Length", "_raw"], 1], "i"])),
    summary: "The word read backwards.",
  },
  {
    name: "Complement",
    from: "permutation",
    to: "permutation",
    body: forEach(positions, ["Subtract", ["Add", ["Length", "_raw"], 1], at("i")]),
    summary: "Each entry replaced by n + 1 minus itself.",
  },
  {
    name: "Inverse",
    from: "permutation",
    to: "permutation",
    // The inverse sends i to the POSITION of i, which is what IndexOf reads off directly.
    body: forEach(positions, ["IndexOf", "_raw", "i"]),
    summary: "The inverse permutation: position of each value.",
  },
  {
    name: "DescentSet",
    from: "permutation",
    to: "finset",
    // Finset's shape is params-first (`tuple<integer, list<integer>>`) -- n as `body`, the
    // filtered positions as the sole `extra`.
    body: ["Length", "_raw"],
    extra: [
      [
        "Filter",
        ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
        ["Function", ["Greater", at("i"), at(["Add", "i", 1])], "i"],
      ],
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
  },
  {
    name: "PeakSet",
    from: "permutation",
    to: "finset",
    // Params-first, same as DescentSet above.
    body: ["Length", "_raw"],
    extra: [
      [
        "Filter",
        ["Range", 2, ["Subtract", ["Length", "_raw"], 1], 1],
        [
          "Function",
          ["And", ["Less", at(["Subtract", "i", 1]), at("i")], ["Greater", at("i"), at(["Add", "i", 1])]],
          "i",
        ],
      ],
    ],
    summary: "The interior positions that rise then fall.",
    note: "Its size is the Peaks statistic, exactly as DescentSet's is Descents.",
  },
  {
    name: "RskInsertion",
    from: "permutation",
    to: "standard_tableau",
    body: insertionRows,
    summary: "The insertion tableau of the RSK correspondence.",
    note: "Row insertion with bumping, as a fold over the word whose accumulator is the growing tableau, emitted as its rows. See tableau.ts for the indexing rule that makes it evaluate at all.",
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
    body: recordingRows,
    summary: "The recording tableau of the RSK correspondence, as its rows.",
    note: "Records WHERE each insertion landed. The insertion logic is untouched — comparing row lengths before and after says which row grew, which is less work than instrumenting the bumping to report it.",
  },
  {
    name: "Rsk",
    from: "permutation",
    to: "standard_tableau_pair",
    body: rskRows,
    summary: "The RSK correspondence: the insertion and recording tableaux, as a pair.",
    note: "Both tableaux share a shape (RskShape reads it off either), and each carries its own rows, so the pair alone determines them. A standard_tableau_pair is a tuple of two carriers — the first composite carrier anything here constructs.",
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
      "list<integer>",
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
    // No reference/Permutation/ record exists yet (a pre-existing gap) to hold this map's
    // laws, so it stays inline here rather than through maps-laws.generated.ts.
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
    name: "FromPermutation",
    from: "permutation",
    to: "increasing_binary_tree",
    body: fromPermutationTree,
    summary:
      "The increasing binary tree built by minimum-splitting recursion: the position of the smallest value roots the tree, everything before it recurses to the left, everything after it to the right.",
    note: "Paired with ToPermutation, whose overload set (IncreasingBinaryTree among others) names this map's codomain — the catalog dump folds map rows to names with no source-collection field, so that pairing is what disambiguates it. The root is always 1: every permutation of [n] holds the value 1, and heap order puts the global minimum at the top regardless of which permutation it came from. Built by real recursion (increasing-binary-tree.ts), the same [label, left, right] nesting IncreasingBinaryTrees' cartesianTree builds -- the nearest-smaller-value fact still finds each position's parent without folding over a list taken out of the accumulator (tableau.ts).",
  },
  {
    name: "KnuthClassRepresentative",
    from: "permutation",
    to: "permutation",
    body: insertionReadingWord,
    summary: "The row reading word of σ's RSK insertion tableau — the canonical word of its Knuth (plactic) class.",
    note: "Two permutations are Knuth-equivalent exactly when they share an insertion tableau (Schensted), so reading that tableau back out — bottom row to top, left to right — picks one fixed representative per class. Idempotent: the representative's own insertion tableau is the same P, so applying this again changes nothing.",
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
];

/** A list sorted largest-first, by reading the sorted list back to front. */
function descending(list: MathJSON): MathJSON {
  const sorted = ["Sort", list];
  const sortedSize = ["Count", sorted];
  return [
    "Map",
    ["Function", ["At", sorted, ["Subtract", ["Add", sortedSize, 1], "i"]], "i"],
    ["Range", 1, sortedSize, 1],
  ];
}

/** p^k(i): apply the permutation k times, as a fold. */
function iterate(start: MathJSON, times: MathJSON): MathJSON {
  return ["Fold", ["Function", at("a"), "a", "b"], start, ["Range", 1, times, 1]];
}
