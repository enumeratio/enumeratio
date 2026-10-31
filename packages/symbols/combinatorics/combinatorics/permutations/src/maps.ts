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
  lets,
  type CombinatorialMap,
  type MathJSON,
  positions,
  size,
  sortedRuns,
} from "../../src/map-helpers.ts";
import { bstParents } from "../../trees/src/bst.ts";
import { fromPermutationTree } from "../../trees/src/increasing-binary-tree.ts";
import {
  cactusEvacuation,
  insertionRows,
  insertionShape,
  readingWord,
  recordingRows,
} from "../../tableaux/src/flat.ts";
import { cactusEvacuationKernel } from "../../tableaux/src/promotion.ts";
import { rskRows } from "../../tableaux/src/tableau.ts";
import { rskInsertionKernel, rskRecordingKernel, rskShapeKernel } from "../../tableaux/src/rsk-kernels.ts";
import { foataInversionsToMajorBody, foataMajorToInversionsBody } from "./foata-bijection.ts";
import { lehmerCode, majorCode, permutationOfLehmerCode, permutationOfMajorCode } from "./codes.ts";
import {
  conjugacyClassRepresentative,
  conjugateOfCycleType,
  cycleDecompositionOf,
  cycleWord,
  plain,
  withLengths,
} from "./cycle-flat.ts";
import { permutationOfCycleDecompositionBody, permutationOfCycleDecompositionGuard } from "./cycle-decomposition.ts";

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

/** How many cycle leaders are at most `bound` — the rank that labels i's block. */
const leadersUpTo = (bound: MathJSON): MathJSON =>
  byIndex(bound, 0, ["Add", "lacc", ["If", ["Equal", "jj", orbitLeast("jj")], 1, 0]], "lacc", "jj");

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

/** The long cycle c = (1 2 ... n), read at position x: x + 1, wrapping n back to 1. */
const longCycleAt = (x: MathJSON): MathJSON => ["Add", ["Mod", x, ["Length", "_raw"]], 1];

/** FindStat's Mp00088, π ↦ π⁻¹c with Sage's left-to-right product: position i holds c(π⁻¹(i)).
 *  `IndexOf` on the word already IS π⁻¹ applied to its argument (the same reading `Inverse` uses). */
const krewerasBody: MathJSON = forEach(positions, longCycleAt(["IndexOf", "_raw", "i"]));

/** The position of value v in the word: where v sits. */
const where = (v: MathJSON): MathJSON => ["IndexOf", "_raw", v];

export const PERMUTATIONS_MAPS: readonly CombinatorialMap[] = [
  {
    name: "DescentWord",
    from: "permutation",
    to: "binary_word",
    body: forEach(
      ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
      ["If", ["Greater", at("i"), at(["Add", "i", 1])], 1, 0],
    ),
    guard: ["Greater", ["Length", "_raw"], 0],
    summary: "Letter i is 1 when the word falls between positions i and i + 1: the descent set as a binary word.",
    note: "One letter shorter than the permutation, so the empty permutation has no descent word.",
  },
  {
    name: "DescentTopWord",
    from: "permutation",
    to: "binary_word",
    // Value v is a descent top when it is followed by something smaller. Value 1 never is, so the word starts at 2.
    body: forEach(
      ["Range", 2, ["Length", "_raw"], 1],
      [
        "If",
        [
          "And",
          ["Less", where("v"), ["Length", "_raw"]],
          ["Greater", "v", at(["Min", ["Add", where("v"), 1], ["Length", "_raw"]])],
        ],
        1,
        0,
      ],
      "v",
    ),
    guard: ["Greater", ["Length", "_raw"], 0],
    summary: "Letter v - 1 is 1 when value v is a descent top: some smaller value immediately follows it.",
    note: "Value 1 is never a descent top, so the first letter stands for 2.",
  },
  {
    name: "DescentBottomWord",
    from: "permutation",
    to: "binary_word",
    // Value v is a descent bottom when it is preceded by something larger. Value n never is, so the word stops at n - 1.
    body: forEach(
      ["Range", 1, ["Subtract", ["Length", "_raw"], 1], 1],
      ["If", ["And", ["Greater", where("v"), 1], ["Greater", at(["Max", ["Subtract", where("v"), 1], 1]), "v"]], 1, 0],
      "v",
    ),
    guard: ["Greater", ["Length", "_raw"], 0],
    summary: "Letter v is 1 when value v is a descent bottom: some larger value immediately precedes it.",
    note: "Value n is never a descent bottom, so the last letter stands for n - 1.",
  },
  {
    name: "LongCycleConjugation",
    from: "permutation",
    to: "permutation",
    // c⁻¹πc adds 1 (mod n) to every entry of every cycle: the image sends i + 1 to π(i) + 1.
    body: forEach(positions, [
      "Add",
      [
        "Mod",
        at(["Add", ["Mod", ["Add", ["Subtract", "i", 2], ["Length", "_raw"]], ["Length", "_raw"]], 1]),
        ["Length", "_raw"],
      ],
      1,
    ]),
    summary: "Conjugation by the long cycle (1 2 ... n): each cycle's entries shifted up by one, cyclically.",
    note: "Reflects the permutation's cycle diagram around the circle one step; it fixes the cycle type, and its n-th power is the identity.",
  },
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
    to: "permutation_inversion",
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
    body: withLengths(plain(), "Min", () => true, descending("cy_lens")),
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
    body: insertionRows("rs", "_raw"),
    kernel: rskInsertionKernel,
    summary: "The insertion tableau of the RSK correspondence.",
    note: "Row insertion with bumping, as a fold over the word whose accumulator is the growing tableau, emitted as its rows. See tableau.ts for the indexing rule that makes it evaluate at all.",
  },
  {
    name: "RskShape",
    from: "permutation",
    to: "integer_partition",
    body: insertionShape("rs", "_raw"),
    kernel: rskShapeKernel,
    summary: "The common shape of the RSK tableaux: the row lengths, as a partition of n.",
    note: "By Schensted, its first part is the longest increasing subsequence and its first COLUMN is the longest decreasing one — two statistics readable off this map.",
  },
  {
    name: "RskRecording",
    from: "permutation",
    to: "standard_tableau",
    body: recordingRows("rs", "_raw"),
    kernel: rskRecordingKernel,
    summary: "The recording tableau of the RSK correspondence, as its rows.",
    note: "Records WHERE each insertion landed: the row the bumped entries end in gets k in its new cell.",
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
    body: cycleDecompositionOf(plain()),
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
    name: "SubexcedantSeq",
    convert: true,
    from: "permutation",
    to: "subexcedant_seq",
    body: forEach(positions, [
      "Count",
      ["Filter", ["Range", 1, ["Subtract", "i", 1], 1], ["Function", ["Greater", at("j"), at("i")], "j"]],
    ]),
    summary: "Entry i counts the earlier entries larger than p(i): the permutation's inversion sequence.",
  },
  {
    name: "Permutation",
    convert: true,
    from: "subexcedant_seq",
    to: "permutation",
    // Standardise the first i entries: entry i is the (a(i) + 1)-th largest of them, so it is
    // i − a(i) once the earlier entries at or above that shift up by one.
    body: [
      "Fold",
      [
        "Function",
        [
          "Join",
          [
            "Map",
            ["Function", ["If", ["GreaterEqual", "x", ["Subtract", "i", at("i")]], ["Add", "x", 1], "x"], "x"],
            "acc",
          ],
          ["List", ["Subtract", "i", at("i")]],
        ],
        "acc",
        "i",
      ],
      ["List"],
      positions,
    ],
    guard: [
      "Fold",
      ["Function", ["And", "ok", ["LessEqual", 0, at("i")], ["Less", at("i"), "i"]], "ok", "i"],
      "True",
      positions,
    ],
    summary: "The permutation a subexcedant sequence is the inversion sequence of.",
    note: "Declines a word that isn't subexcedant: entry i must lie in 0..i − 1.",
    laws: [{ inverse: "SubexcedantSeq" }],
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
    note: "Paired with ToPermutation, whose overload set (IncreasingBinaryTree among others) names this map's codomain. The root is always 1: every permutation of [n] holds the value 1, and heap order puts the global minimum at the top regardless of which permutation it came from. Built by real recursion, the same [label, left, right] nesting IncreasingBinaryTrees' cartesianTree builds.",
  },
  {
    name: "KnuthClassRepresentative",
    from: "permutation",
    to: "permutation",
    body: readingWord("rs", "_raw"),
    summary: "The row reading word of σ's RSK insertion tableau — the canonical word of its Knuth (plactic) class.",
    note: "Two permutations are Knuth-equivalent exactly when they share an insertion tableau (Schensted), so reading that tableau back out — bottom row to top, left to right — picks one fixed representative per class. Idempotent: the representative's own insertion tableau is the same P, so applying this again changes nothing.",
  },
  {
    name: "KrewerasComplement",
    from: "permutation",
    to: "permutation",
    body: krewerasBody,
    summary: "π⁻¹c with the long cycle c = (1 2 ... n), FindStat's order: position i holds c(π⁻¹(i)).",
    note: "Total, a bijection of S_n; it restricts to the classical Kreweras complement of the non-crossing permutations (those below c in absolute order), mapping NC(n) onto itself. K∘K is conjugation by c.",
  },
  {
    name: "ConjugateAfterCycleType",
    from: "permutation",
    to: "integer_partition",
    body: withLengths(plain(), "Min", () => true, conjugateOfCycleType),
    summary: "The conjugate partition of the cycle type.",
    note: "Entry j is the count of cycles of length at least j — non-increasing in j by construction, so it comes out sorted without needing one.",
  },
  {
    name: "ConjugacyClassRepresentative",
    from: "permutation",
    to: "permutation",
    body: withLengths(plain(), "Min", () => true, conjugacyClassRepresentative),
    summary: "The canonical permutation with the same cycle type.",
    note: "FindStat does not fix an ordering for this map. Convention used here: cycles in decreasing length, filled with consecutive integers, each cycle (a a+1 … a+len-1) written as the one-line word a+1, …, a+len-1, a.",
  },
  {
    name: "Foata",
    from: "permutation",
    to: "permutation",
    // Each cycle starts at its maximum; the cycles ascend by maximum.
    body: withLengths(
      plain(),
      "Max",
      () => true,
      cycleWord(plain(), (word) => word),
    ),
    summary:
      "Foata's fundamental bijection: cycles rotated to their max, ordered by increasing max, parentheses erased.",
    note: "The first fundamental transformation — it sends a permutation with k cycles to one with k left-to-right maxima. (The catalog's title also names maj → inv, which is the SECOND fundamental transformation's property; this map is the first.)",
  },
  {
    name: "InverseFoata",
    from: "permutation",
    to: "permutation",
    // Entry v is where v goes in its cycle: on to the next entry of the word, or back to the cycle's
    // first entry (the running maximum) when the next entry starts a new left-to-right maximum.
    body: forEach(
      positions,
      bind(
        "p",
        where("i"),
        bind(
          "top",
          ["Max", forEach(["Range", 1, "p", 1], at("k"), "k")],
          [
            "If",
            ["Or", ["Equal", "p", size], ["Greater", at(["Min", ["Add", "p", 1], size]), "top"]],
            "top",
            at(["Add", "p", 1]),
          ],
        ),
      ),
    ),
    summary:
      "The permutation whose cycles are the stretches of the word between successive left-to-right maxima, each read as a cycle.",
    note: "FindStat's Mp00086, the inverse of Foata: a word's left-to-right maxima open its cycles.",
  },
  {
    name: "InverseKrewerasComplement",
    from: "permutation",
    to: "permutation",
    body: forEach(positions, where(longCycleAt("i"))),
    summary: "cπ⁻¹ with the long cycle c = (1 2 ... n), FindStat's order: position i holds π⁻¹(c(i)).",
    note: "FindStat's Mp00089; the inverse of KrewerasComplement.",
  },
  {
    name: "LehmerCodeToMajorCode",
    from: "permutation",
    to: "permutation",
    body: permutationOfMajorCode(lehmerCode),
    summary: "The permutation whose major code is this permutation's Lehmer code.",
    note: "FindStat's Mp00062. It carries the inversion count to the major index; the inverse is MajorCodeToLehmerCode.",
  },
  {
    name: "MajorCodeToLehmerCode",
    from: "permutation",
    to: "permutation",
    body: permutationOfLehmerCode(majorCode),
    summary: "The permutation whose Lehmer code is this permutation's major code.",
    note: "FindStat's Mp00073. It carries the major index to the inversion count; the inverse is LehmerCodeToMajorCode.",
  },
  {
    name: "LehmerCodeRotation",
    from: "permutation",
    to: "permutation",
    // Entry i of a Lehmer code runs 0 .. n - i, so adding one wraps at n - i + 1.
    body: bind(
      "lehmer",
      lehmerCode,
      permutationOfLehmerCode(
        forEach(positions, ["Mod", ["Add", at("i", "lehmer"), 1], ["Subtract", ["Add", size, 1], "i"]]),
      ),
      "list<integer>",
    ),
    summary: "The permutation whose Lehmer code is this one's with every entry one larger, cyclically.",
    note: "FindStat's Mp00149. Entry i wraps from n - i back to 0.",
  },
  {
    name: "ConnectivityWord",
    from: "permutation",
    to: "binary_word",
    // The first i entries lie below the rest exactly when they are 1 .. i.
    body: forEach(
      ["Range", 1, ["Subtract", size, 1], 1],
      ["If", ["Equal", ["Max", forEach(["Range", 1, "i", 1], at("k"), "k")], "i"], 1, 0],
    ),
    guard: ["Greater", size, 0],
    summary:
      "Letter i is 1 when the first i entries are all smaller than the rest: the connectivity set as a binary word.",
    note: "FindStat's Mp00114. One letter shorter than the permutation; the word is all 0 exactly when the permutation is connected.",
  },
  {
    name: "LeftToRightMaximaDyckPath",
    from: "permutation",
    to: "dyck_path",
    // Each left-to-right maximum at position q opens a rise up to its value and a fall as long as its reign.
    body: [
      "If",
      ["Equal", size, 0],
      ["List"],
      bind(
        "maxima",
        [
          "Fold",
          [
            "Function",
            [
              "If",
              ["Equal", at("q"), ["Max", forEach(["Range", 1, "q", 1], at("k"), "k")]],
              ["Join", "acc", ["List", "q"]],
              "acc",
            ],
            "acc",
            "q",
          ],
          ["List"],
          positions,
        ],
        [
          "Flatten",
          forEach(
            ["Range", 1, ["Length", "maxima"], 1],
            forEach(
              [
                "Range",
                1,
                [
                  "Add",
                  [
                    "Subtract",
                    at(at("j", "maxima")),
                    ["If", ["Equal", "j", 1], 0, at(at(["Subtract", "j", 1], "maxima"))],
                  ],
                  [
                    "Subtract",
                    ["If", ["Equal", "j", ["Length", "maxima"]], ["Add", size, 1], at(["Add", "j", 1], "maxima")],
                    at("j", "maxima"),
                  ],
                ],
                1,
              ],
              [
                "If",
                [
                  "LessEqual",
                  "t",
                  [
                    "Subtract",
                    at(at("j", "maxima")),
                    ["If", ["Equal", "j", 1], 0, at(at(["Subtract", "j", 1], "maxima"))],
                  ],
                ],
                1,
                0,
              ],
              "t",
            ),
            "j",
          ),
        ],
        "list<integer>",
      ),
    ],
    summary: "The Dyck path whose rises climb to each left-to-right maximum and whose falls run to the next one.",
    note: "FindStat's Mp00127. Restricted to the 321-avoiding permutations it is a bijection with the Dyck paths.",
  },
  {
    name: "FoataMajorToInversions",
    from: "permutation",
    to: "permutation",
    body: foataMajorToInversionsBody,
    summary:
      "Foata's bijection: each letter is put on the end of the image so far, which is cut into blocks, and every block is rotated one place right.",
    note: "FindStat's Mp00067, Sage's foata_bijection. It sends the major index to the number of inversions; the inverse is FoataInversionsToMajor. Not the cycle-based Foata, which is FindStat's first fundamental transformation.",
  },
  {
    name: "FoataInversionsToMajor",
    from: "permutation",
    to: "permutation",
    body: foataInversionsToMajorBody,
    summary:
      "The inverse of Foata's major-to-inversions bijection: peel off the last letter, rotate the blocks of the rest back.",
    note: "FindStat's Mp00175, Sage's foata_bijection_inverse. It sends the number of inversions to the major index.",
  },
  {
    name: "CactusEvacuation",
    from: "permutation",
    to: "permutation",
    body: cactusEvacuation,
    kernel: cactusEvacuationKernel,
    summary: "The permutation with the same insertion tableau and the evacuation of the recording tableau.",
    note: "FindStat's Mp00126, an involution: RSK, evacuate the recording tableau, RSK backwards.",
  },
  {
    name: "RunSort",
    from: "permutation",
    to: "permutation",
    // The runs start with different entries, so lexicographic order is the order of their first entries.
    body: sortedRuns((first) => at(first)),
    summary: "The permutation with its increasing runs sorted lexicographically.",
    note: "FindStat's Mp00223. Lossy: the runs' order is forgotten.",
  },
  {
    name: "WeakExceedancePartition",
    from: "permutation",
    to: "set_partition",
    // The coarsest set partition containing the arcs (i, π(i)) with i ≤ π(i): each element takes the least label
    // reachable along them, n rounds of passing the least label across every arc.
    body: [
      "If",
      ["Equal", ["Length", "_raw"], 0],
      ["List"],
      lets(
        [["we_position", forEach(positions, ["IndexOf", "_raw", "i"]), "list<integer>"]],
        bind(
          "we_labels",
          [
            "Fold",
            [
              "Function",
              forEach(
                positions,
                [
                  "Min",
                  at("i", "acc"),
                  ["If", ["LessEqual", "i", at("i")], at(at("i"), "acc"), at("i", "acc")],
                  ["If", ["LessEqual", at("i", "we_position"), "i"], at(at("i", "we_position"), "acc"), at("i", "acc")],
                ],
                "i",
              ),
              "acc",
              "r",
            ],
            positions,
            positions,
          ],
          [
            "Map",
            ["Function", ["Filter", positions, ["Function", ["Equal", at("p", "we_labels"), "m"], "p"]], "m"],
            // One block per label that is its own least element.
            ["Filter", positions, ["Function", ["Equal", at("p", "we_labels"), "p"], "p"]],
          ],
          "list<integer>",
        ),
      ),
    ],
    summary: "The coarsest set partition containing every arc from i to π(i) with i ≤ π(i).",
    note: "FindStat's Mp00240, the weak exceedance partition. Not injective.",
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
