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
import { operandsOf } from "@enumeratio/boxed";
import { bstParents } from "./bst.ts";
import { applyComposition } from "./compose.ts";
import { extendBuiltin } from "./extend.ts";
import { fromPermutationLeftChild, fromPermutationRightChild, fromPermutationRoot } from "./increasing-binary-tree.ts";
import { insertionReadingWord, insertionRowWord, insertionShape, recordingRowWord, rskRowWords } from "./tableau.ts";

export interface CombinatorialMap {
  readonly name: string;
  /** The carrier type this map takes. */
  readonly from: string;
  /** The carrier type it produces. */
  readonly to: string;
  /** The body, over `_raw` — the CONTENTS of the argument, since generic heads cannot see
   *  through a domain constructor (design/domains.md §1.5). */
  readonly body?: unknown;
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
}

/** A map's law: f∘f = id, f∘f = f, or g∘f = id for the named map g. */
export type Law = "involution" | "idempotent" | { readonly inverse: string };

const positions: MathJSON = ["Range", 1, ["Length", "_raw"]];
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
  const later: MathJSON = ["Filter", ["Range", ["Add", i, 1], size], ["Function", ["Equal", at("k"), at(i)], "k"]];
  return ["If", ["Greater", ["Length", later], 0], ["Min", later], i];
};

/** `body` with `name` bound to `value` — a `let`, as a lambda applied to its argument. The
 *  block structure a map reads at every position (`parts`, the leaders) is computed once
 *  here rather than once per position per read; see tableau.ts for the rule. */
const bind = (name: string, value: MathJSON, body: MathJSON): MathJSON => ["Apply", ["Function", body, name], value];

/** A fold over `1 .. n`, indexing rather than iterating a structure — the rule from
 *  tableau.ts, which is what makes these evaluate at all. */
const byIndex = (n: MathJSON, initial: MathJSON, step: MathJSON, accumulator: string, variable: string): MathJSON => [
  "Fold",
  ["Function", step, accumulator, variable],
  initial,
  ["Range", 1, n],
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
 * Each side is wrapped back into a `Permutations` value because `CycleCount` is declared over
 * the carrier, not the raw word.
 */
const krewerasGuard: MathJSON = [
  "Equal",
  ["Add", ["CycleCount", ["Permutations", "_raw"]], ["CycleCount", ["Permutations", "_image"]]],
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
      ["Range", 1, ["Subtract", ["Length", "_raw"], 1]],
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
      ["Filter", ["Range", ["Add", "i", 1], ["Length", "_raw"]], ["Function", ["Greater", at("i"), at("j")], "j"]],
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
      ["Range", 2, ["Subtract", ["Length", "_raw"], 1]],
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
    // Each position labelled with the rank of its cycle's least element — which is exactly a
    // restricted growth string, and therefore exactly what a set_partition IS.
    body: byIndex(size, ["List"], ["Join", "cacc", ["List", leadersUpTo(orbitLeast("i"))]], "cacc", "i"),
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
    body: bstParents,
    summary: "The tree built by inserting σ(1), σ(2), ... into an empty binary search tree.",
    note: "The sylvester congruence: two permutations land on the same tree exactly when they agree on which of any pair is inserted first. See bst.ts for the parent-pointer encoding chosen for `binary_tree` and why.",
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
    name: "ArcRepresentation",
    from: "set_partition",
    to: "endofunction",
    // `_raw` is the restricted growth string: position i's block label. A block's members
    // are already in ascending order by position, so "the next element in i's block" is just
    // the smallest later position sharing i's label — a function on 1..n, which is exactly
    // what an endofunction IS. The arcs of the standard representation are the pairs
    // (i, f(i)) with f(i) != i; a position last in its block is a fixed point.
    body: forEach(positions, nextInBlock("i")),
    summary: "Each position linked to the next in its block, or to itself when last.",
    note: "The statistics frontier calls this the arc representation: within each block, consecutive elements (b1,b2), (b2,b3), .... Encoding it as an endofunction rather than a bare list of pairs keeps it a typed carrier — Crossings, Nestings and CrossingNestingTotal (@enumeratio/statistics) read the arcs off this without needing a carrier of their own.",
  },
];

/** A list sorted largest-first, by reading the sorted list back to front. */
function descending(list: MathJSON): MathJSON {
  const sorted = ["Sort", list];
  const size = ["Count", sorted];
  return ["Map", ["Function", ["At", sorted, ["Subtract", ["Add", size, 1], "i"]], "i"], ["Range", 1, size]];
}

/** p^k(i): apply the permutation k times, as a fold. */
function iterate(start: MathJSON, times: MathJSON): MathJSON {
  return ["Fold", ["Function", at("a"), "a", "b"], start, ["Range", 1, times]];
}

/** Declare each map, typed by carrier: it takes a constructed value of `from` and returns a
 *  constructed value of `to`, so a composition that does not typecheck is caught. */
export function declareMaps(
  ce: ComputeEngine,
  constructorFor: Readonly<Record<string, string>>,
  maps: readonly CombinatorialMap[] = MAPS,
): void {
  for (const map of maps) {
    const wrap = constructorFor[map.to];
    if (wrap === undefined) throw new Error(`no constructor for ${map.to}`);

    const handle = (subject: BoxedExpression): BoxedExpression | undefined => {
      // A composed map applies its steps right to left, each through its own declared head —
      // so every intermediate value is a properly constructed carrier and the composition is
      // type-checked at each step rather than only at the ends.
      if (map.composedOf !== undefined) return applyComposition(ce, map.composedOf, subject);
      const contents = operandsOf(subject)[0];
      if (contents === undefined) return undefined;
      const main = materialise(ce, ce.box(fill(map.body, contents.json) as never).evaluate());
      if (map.guard !== undefined) {
        const guard = fill(fill(map.guard, contents.json), main.json, "_image");
        if (ce.box(guard as never).evaluate().json !== "True") return undefined;
      }
      const extra = (map.extra ?? []).map((argument) => ce.box(fill(argument, contents.json) as never).evaluate());
      // A tuple-shaped carrier takes ONE argument that is a Tuple, not several arguments —
      // `finset` is `(members, n)`, so a map into it hands over a single Tuple.
      const argument = extra.length === 0 ? main : ce.function("Tuple", [main, ...extra]).evaluate();
      return ce.function(wrap, [argument]).evaluate();
    };

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
