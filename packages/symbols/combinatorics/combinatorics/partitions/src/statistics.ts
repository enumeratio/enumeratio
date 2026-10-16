// Integer-partition statistics, over `_x` = the parts in WEAKLY DECREASING order.
//
// The conjugate is the workhorse: the conjugate of λ has, in position i, the number of parts
// of λ that are at least i. Written once here, several statistics that read "down the
// columns" become statements about the conjugate rather than fresh definitions — which is
// exactly the reduction-to-lesser-symbols the whole exercise is for.

import type { Definition, MathJSON } from "../../src/statistics/types.ts";
import {
  add,
  and,
  at,
  atLeastValue,
  bind,
  count,
  equals,
  fold,
  forEach,
  greater,
  length,
  less,
  nonEmpty,
  or,
  positions,
  subtract,
  sumOver,
  upTo,
  where,
  x,
} from "../../src/statistics/vocabulary.ts";

const on = "IntegerPartition";
const stat = (head: string, summary: string, expr: Definition["expr"], note?: string): Definition => ({
  head,
  on,
  summary,
  expr,
  ...(note ? { note } : {}),
});

const here = at("i");
const largest: MathJSON = ["Max", x];

/** The conjugate partition: column i is how many parts are at least i. */
const conjugate: MathJSON = forEach(upTo(largest), count(positions, atLeastValue(at("j"), "i"), "j"));

/** The number of cells strictly right of the diagonal in row i — the arm of cell (i, i). */
const armAt = (i: MathJSON): MathJSON => subtract(at(i), i);
/** Cells strictly below the diagonal in column i — the leg of cell (i, i). */
const legAt = (i: MathJSON): MathJSON => subtract(["At", conjugate, i], i);

/** The hook length of cell (i, j): arm + leg + 1. */
const hookAt: MathJSON = add(add(subtract(at("i"), "j"), subtract(["At", conjugate, "j"], "i")), 1);
/** The product of every hook length. Named once so StandardTableauCount can be defined
 *  in terms of it rather than repeating the diagram walk. */
const hookProduct: MathJSON = ["Product", forEach(positions, ["Product", forEach(upTo(here), hookAt, "j")])];
/** How many parts equal 1 — the ω of the crank. */
const ones: MathJSON = count(positions, equals(here, 1));

/** The side of the Durfee square: the largest d with at least d parts of size at least d. */
const durfee: MathJSON = ["Count", where(positions, atLeastValue(here, "i"))];

/** How many parts equal `value`. */
const multiplicityOf = (value: MathJSON): MathJSON => count(positions, equals(here, value));
/** The sum of the parts. */
const total: MathJSON = ["Sum", x];
/** `body` with `c` bound to the conjugate, evaluated once rather than at every cell. */
const withConjugate = (body: MathJSON): MathJSON => bind("c", conjugate, body);
/** The conjugate's entry for column j, reading the bound `c`. */
const columnLength = (j: MathJSON): MathJSON => ["At", "c", j];
/** Arm minus leg of cell (i, j). */
const armMinusLeg: MathJSON = subtract(subtract(here, "j"), subtract(columnLength("j"), "i"));
/** Hook length of cell (i, j), reading the bound `c`. */
const hookWith: MathJSON = add(add(subtract(here, "j"), subtract(columnLength("j"), "i")), 1);
/** `body` summed over every cell (i, j); reads the bound `c`. */
const sumOverCells = (body: MathJSON): MathJSON =>
  nonEmpty(withConjugate(sumOver(positions, sumOver(upTo(here), body, "j"))));
/** The cells (i, j) satisfying `predicate`; reads the bound `c`. */
const cellsWhere = (predicate: MathJSON): MathJSON =>
  nonEmpty(withConjugate(sumOver(positions, count(upTo(here), predicate, "j"))));
/** The side of the largest staircase (k, k-1, ..., 1) that fits: the least part + i - 1 over rows 1 .. length + 1, where row length + 1 has part 0. */
const staircaseSide: MathJSON = [
  "Min",
  forEach(upTo(add(length(), 1)), ["If", equals("i", add(length(), 1)), length(), add(here, subtract("i", 1))]),
];

/** The largest even part, 0 if there is none. */
const largestEven: MathJSON = ["Max", forEach(positions, ["If", equals(["Mod", here, 2], 0), here, 0])];
/** The distinct sums of sub-multisets of the parts, 0 (the empty one) included: each part either joins or not. */
const subsetSums: MathJSON = fold(x, ["List", 0], ["Unique", ["Join", "a", forEach("a", add("i", "b"))]]);

export const PARTITION_STATISTICS: readonly Definition[] = [
  stat("LargestPart", "The largest part.", nonEmpty(largest)),
  stat(
    "MultiplicityOfLargestPart",
    "How many parts equal the largest.",
    nonEmpty(count(positions, equals(here, largest))),
  ),
  stat(
    "DistinctParts",
    "How many distinct part sizes occur.",
    nonEmpty(count(upTo(largest), greater(count(positions, equals(here, "j")), 0), "j")),
  ),
  stat("EvenParts", "Parts that are even.", nonEmpty(count(positions, equals(["Mod", here, 2], 0)))),
  stat("OddParts", "Parts that are odd.", nonEmpty(count(positions, equals(["Mod", here, 2], 1)))),
  stat("PartsEqualOne", "Parts equal to 1.", nonEmpty(count(positions, equals(here, 1)))),
  stat("PartsAtLeastTwo", "Parts of size at least 2.", nonEmpty(count(positions, atLeastValue(here, 2)))),

  // Inside a Filter the bound name is the VALUE, not the index — so these read the
  // conjugate's entries directly rather than indexing into it.
  stat(
    "ConjugateOddParts",
    "Odd parts of the conjugate — equivalently, the distinct part sizes of λ.",
    nonEmpty(count(conjugate, equals(["Mod", "i", 2], 1))),
  ),
  stat(
    "ConjugateDistinctParts",
    "Distinct part sizes of the conjugate.",
    nonEmpty(count(upTo(length()), greater(count(conjugate, equals("i", "j")), 0), "j")),
  ),

  stat(
    "DurfeeSquare",
    "The side of the Durfee square: the largest d with at least d parts of size at least d.",
    nonEmpty(durfee),
  ),
  stat("ArmOfFirstCell", "The arm of cell (1,1): the first part minus one.", nonEmpty(armAt(1))),
  stat("LegOfFirstCell", "The leg of cell (1,1): the number of parts minus one.", nonEmpty(legAt(1))),

  stat(
    "Corners",
    "Corner cells — parts strictly larger than the next part (the last part always counts).",
    nonEmpty(count(positions, ["Or", equals("i", length()), greater(here, at(add("i", 1)))])),
  ),
  stat(
    "Perimeter",
    "The perimeter of the Young diagram: largest part plus number of parts.",
    nonEmpty(add(largest, length())),
  ),

  stat(
    "IsSelfConjugate",
    "1 when λ equals its conjugate, 0 otherwise.",
    nonEmpty(
      [
        "If",
        and(
          equals(["Length", conjugate], length()),
          equals(count(positions, equals(here, at("i", conjugate))), length()),
        ),
        1,
        0,
      ],
      1,
    ),
  ),

  stat(
    "SumOfHookLengths",
    "The total of all hook lengths.",
    nonEmpty(sumOver(positions, sumOver(upTo(here), hookAt, "j"))),
    "Hook of cell (i, j) is arm + leg + 1 = (λ_i - j) + (λ'_j - i) + 1.",
  ),
  stat(
    "HookProduct",
    "The product of all hook lengths — the denominator in the hook-length formula.",
    nonEmpty(hookProduct, 1),
  ),

  stat("DysonRank", "Largest part minus number of parts.", nonEmpty(subtract(largest, length()))),

  stat(
    "Crank",
    "The Andrews-Garvan crank: the largest part when λ has no 1s, else (parts larger than the number of 1s) minus (the number of 1s).",
    nonEmpty(["If", equals(ones, 0), largest, subtract(count(positions, greater(here, ones)), ones)]),
  ),
  // ── FindStat's integer-partition statistics, named after their descriptions ──────────────

  // Hooks, diagonals and the Durfee square.
  stat(
    "HookLengthOfFirstCell",
    "The hook length of cell (1,1): the largest part plus the number of parts, less one.",
    nonEmpty(subtract(add(largest, length()), 1)),
  ),
  stat(
    "HookLengthOfLastDiagonalCell",
    "The hook length of the last cell on the main diagonal: that of cell (d,d) for Durfee side d.",
    nonEmpty(
      withConjugate(
        bind("d", durfee, add(subtract(at("d"), "d"), subtract(columnLength("d"), subtract("d", 1))), "number"),
      ),
    ),
  ),
  stat(
    "DiagonalHookLengthProduct",
    "The product of the hook lengths of the cells on the main diagonal.",
    nonEmpty(
      withConjugate([
        "Product",
        forEach(
          where(positions, atLeastValue(here, "i")),
          add(subtract(here, "i"), subtract(columnLength("i"), subtract("i", 1))),
        ),
      ]),
      1,
    ),
  ),
  stat(
    "SymmetricDiagonalHooks",
    "Cells on the main diagonal whose arm and leg are equal.",
    nonEmpty(withConjugate(count(where(positions, atLeastValue(here, "i")), equals(here, columnLength("i"))))),
  ),
  stat(
    "CellsOutsideDurfeeSquare",
    "Cells of the diagram outside its Durfee square.",
    nonEmpty(subtract(total, ["Power", durfee, 2])),
  ),
  stat(
    "FirstRowHookLengthSum",
    "The sum of the hook lengths in the first row: the size plus the binomial of the largest part and 2.",
    nonEmpty(add(total, ["Divide", ["Multiply", largest, subtract(largest, 1)], 2])),
  ),
  stat("HookLengthSquareSum", "The sum of the squares of all hook lengths.", sumOverCells(["Power", hookWith, 2])),
  stat(
    "CohookLengthProduct",
    "The product of the cohook lengths i + j - 1 of the cells.",
    nonEmpty(["Product", forEach(positions, ["Product", forEach(upTo(here), subtract(add("i", "j"), 1), "j")])], 1),
  ),
  stat(
    "DiagonalInversions",
    "Cells whose arm minus leg is 0 or 1.",
    cellsWhere(or(equals(armMinusLeg, 0), equals(armMinusLeg, 1))),
  ),
  stat(
    "DiagonalInversionDefect",
    "Cells whose arm minus leg is neither 0 nor 1.",
    cellsWhere(or(less(armMinusLeg, 0), greater(armMinusLeg, 1))),
  ),
  stat("CellsWithEqualArmAndLeg", "Cells whose arm and leg are equal.", cellsWhere(equals(armMinusLeg, 0))),

  // Part multiplicities.
  stat(
    "LargestRepeatedPart",
    "The largest part that occurs at least twice; 0 if the parts are distinct.",
    nonEmpty(["Max", forEach(upTo(largest), ["If", atLeastValue(multiplicityOf("k"), 2), "k", 0], "k")]),
  ),
  stat(
    "MultiplicityOfSmallestPart",
    "How many parts equal the smallest.",
    nonEmpty(count(positions, equals(here, at(length())))),
  ),
  stat(
    "FlooredHalfMultiplicitySum",
    "The sum, over part sizes, of half the multiplicity rounded down.",
    nonEmpty(
      sumOver(upTo(largest), ["Divide", subtract(multiplicityOf("k"), ["Mod", multiplicityOf("k"), 2]), 2], "k"),
    ),
  ),
  stat(
    "DistinctRepeatedParts",
    "Distinct part sizes that occur at least twice.",
    nonEmpty(count(upTo(largest), atLeastValue(multiplicityOf("k"), 2), "k")),
  ),
  stat(
    "SingletonParts",
    "Parts that occur exactly once.",
    nonEmpty(count(upTo(largest), equals(multiplicityOf("k"), 1), "k")),
  ),
  stat(
    "DistinctMultiplicities",
    "How many different multiplicities the part sizes have.",
    nonEmpty(count(upTo(length()), greater(count(upTo(largest), equals(multiplicityOf("k"), "v"), "k"), 0), "v")),
  ),
  stat(
    "LargestMultiplicity",
    "The largest multiplicity of a part.",
    nonEmpty(["Max", forEach(upTo(largest), multiplicityOf("k"), "k")]),
  ),
  stat(
    "PartsEqualToMultiplicity",
    "Parts equal to their own multiplicity.",
    nonEmpty(count(positions, equals(count(positions, equals(at("m"), here), "m"), here))),
  ),
  stat(
    "DistinctPartsEqualToMultiplicity",
    "Distinct part sizes equal to their multiplicity.",
    nonEmpty(count(upTo(largest), equals(multiplicityOf("k"), "k"), "k")),
  ),

  // Sizes, staircases and the rest.
  stat(
    "WeightedSize",
    "The sum of the parts weighted by their row, counting rows from 0.",
    nonEmpty(sumOver(positions, ["Multiply", subtract("i", 1), here])),
  ),
  stat(
    "AddableCells",
    "Cells that can be added to the diagram and leave a partition: one more than the distinct parts.",
    nonEmpty(add(count(upTo(largest), greater(multiplicityOf("j"), 0), "j"), 1), 1),
  ),
  stat(
    "PartsExceedingOnes",
    "Parts larger than the number of parts equal to 1.",
    nonEmpty(count(positions, greater(here, ones))),
  ),
  stat(
    "ContentSum",
    "The sum of the contents j - i of the cells.",
    nonEmpty(sumOver(positions, subtract(["Divide", ["Multiply", here, add(here, 1)], 2], ["Multiply", "i", here]))),
  ),
  stat(
    "LargestStaircaseSide",
    "The side of the largest staircase (k, k-1, ..., 1) inside the diagram.",
    nonEmpty(staircaseSide),
  ),
  stat(
    "ContainingSquareSide",
    "The side of the smallest square that contains the diagram: the larger of the largest part and the number of parts.",
    nonEmpty(["Max", largest, length()]),
  ),
  stat(
    "CellsOutsideLargestStaircase",
    "Cells of the diagram outside the largest staircase it contains.",
    nonEmpty(bind("s", staircaseSide, subtract(total, ["Divide", ["Multiply", "s", add("s", 1)], 2]), "number")),
  ),
  stat(
    "Aft",
    "The size minus the larger of the largest part and the number of parts.",
    nonEmpty(subtract(total, ["Max", largest, length()])),
  ),
  stat("SmallestMissingPart", "The smallest positive integer that is not a part.", [
    "If",
    equals(length(), 0),
    1,
    ["Min", where(upTo(add(length(), 1)), equals(multiplicityOf("k"), 0), "k")],
  ]),
  stat(
    "PairwiseProductSum",
    "The sum of the products of all pairs of parts.",
    nonEmpty(["Divide", subtract(["Power", total, 2], sumOver(positions, ["Power", here, 2])), 2]),
  ),

  // ── FindStat's integer-partition statistics, second round ────────────────────────────────

  // Extremes and shapes of the diagram.
  stat("PartRange", "The largest part minus the smallest.", nonEmpty(subtract(largest, ["Min", x]))),
  stat(
    "ContainingRectangleShortSide",
    "The shorter side of the smallest rectangle that contains the diagram: the smaller of the largest part and the number of parts.",
    nonEmpty(["Min", largest, length()]),
  ),
  stat(
    "MaximalRectangleHalfPerimeter",
    "Half the perimeter of the rectangle inside the diagram that has the greatest perimeter.",
    nonEmpty(["Max", forEach(positions, add(here, "i"))]),
  ),
  stat(
    "LargestShiftedPart",
    "The largest part after adding i - 1 to the i-th part.",
    nonEmpty(["Max", forEach(positions, add(here, subtract("i", 1)))]),
  ),
  stat(
    "RemovableHorizontalDominoes",
    "Parts from which 2 can be subtracted and leave a partition: rows ending in a removable horizontal domino.",
    nonEmpty(
      count(positions, [
        "If",
        equals("i", length()),
        atLeastValue(here, 2),
        atLeastValue(subtract(here, 2), at(add("i", 1))),
      ]),
    ),
  ),
  stat(
    "CellsOutsideFirstRow",
    "Cells of the diagram below the first row: the size minus the largest part.",
    nonEmpty(subtract(total, largest)),
  ),
  stat(
    "CellsOutsideFirstHook",
    "Cells in neither the first row nor the first column: the size minus the hook length of cell (1,1).",
    nonEmpty(subtract(total, subtract(add(largest, length()), 1))),
  ),
  stat(
    "RowCellPairs",
    "Pairs of cells in the same row: the sum over parts of the binomial coefficient of the part and 2.",
    nonEmpty(sumOver(positions, ["Divide", ["Multiply", here, subtract(here, 1)], 2])),
  ),
  stat(
    "CellsWithZeroLegAndOddArm",
    "Cells with leg 0 and an odd arm.",
    cellsWhere(and(equals(subtract(columnLength("j"), "i"), 0), equals(["Mod", subtract(here, "j"), 2], 1))),
  ),
  stat(
    "CornerMajorIndex",
    "The sum of the positions of the corners, counted from the bottom row.",
    nonEmpty(
      sumOver(positions, [
        "If",
        or(equals("i", length()), greater(here, at(add("i", 1)))),
        add(subtract(length(), "i"), here),
        0,
      ]),
    ),
  ),

  // Sums and products of the parts.
  stat("PartProduct", "The product of the parts.", nonEmpty(["Product", x], 1)),
  stat("PartSquareSum", "The sum of the squares of the parts.", nonEmpty(sumOver(positions, ["Power", here, 2]))),
  stat(
    "PartFactorialProduct",
    "The product of the factorials of the parts.",
    nonEmpty(["Product", forEach(positions, ["Product", upTo(here)])], 1),
  ),
  stat(
    "MultiplicityFactorialProduct",
    "The product of the factorials of the multiplicities of the parts.",
    nonEmpty(["Product", forEach(positions, count(upTo("i"), equals(at("j"), here), "j"))], 1),
  ),
  stat(
    "SumOfEvenParts",
    "The sum of the even parts.",
    nonEmpty(sumOver(positions, ["If", equals(["Mod", here, 2], 0), here, 0])),
  ),
  stat(
    "SumOfOddParts",
    "The sum of the odd parts.",
    nonEmpty(sumOver(positions, ["If", equals(["Mod", here, 2], 1), here, 0])),
  ),
  stat(
    "SumOfPartsAtLeastTwo",
    "The sum of the parts that are at least 2.",
    nonEmpty(sumOver(positions, ["If", atLeastValue(here, 2), here, 0])),
  ),
  stat(
    "GreatestCommonDivisorOfParts",
    "The greatest common divisor of the parts.",
    nonEmpty(fold(["Rest", x], at(1), ["Divide", ["Multiply", "a", "b"], ["LCM", "a", "b"]])),
  ),
  stat(
    "LeastCommonMultipleOfParts",
    "The least common multiple of the parts.",
    nonEmpty(fold(["Rest", x], at(1), ["LCM", "a", "b"]), 1),
  ),
  stat(
    "PairwiseGreatestCommonDivisorSum",
    "The sum of the greatest common divisors of all pairs of parts.",
    nonEmpty(
      sumOver(
        positions,
        sumOver(
          positions,
          ["If", less("j", "i"), ["Divide", ["Multiply", at("i"), at("j")], ["LCM", at("i"), at("j")]], 0],
          "j",
        ),
      ),
    ),
  ),

  // Parity of the parts.
  stat("LargestEvenPart", "The largest even part; 0 if there is none.", nonEmpty(largestEven)),
  stat(
    "EvenOddCrank",
    "The largest even part minus the number of odd parts.",
    nonEmpty(subtract(largestEven, count(positions, equals(["Mod", here, 2], 1)))),
    "Not the Andrews-Garvan `Crank`: this is the largest even part minus the number of odd parts.",
  ),
  stat(
    "OddPartsBelowLargestEvenPart",
    "Odd parts smaller than the largest even part.",
    nonEmpty(bind("e", largestEven, count(positions, and(less(here, "e"), equals(["Mod", here, 2], 1))), "number")),
  ),
  stat(
    "DistinctEvenParts",
    "Distinct even part sizes.",
    nonEmpty(count(upTo(largest), and(greater(multiplicityOf("k"), 0), equals(["Mod", "k", 2], 0)), "k")),
  ),
  stat(
    "BerkovichGarvanRank",
    "The sum of a checkerboard filling of the diagram, +1 on cells whose coordinates sum to an even number and -1 on the others.",
    nonEmpty(sumOver(positions, ["Multiply", ["If", equals(["Mod", "i", 2], 1), 1, -1], ["Mod", here, 2]])),
    "A row of even length cancels and one of odd length leaves a single cell, counted + in the first row, - in the second, and so on.",
  ),

  // Gaps, repeats and subset sums.
  stat(
    "PartsEqualToNextPart",
    "Parts whose next smaller part has the same size: the number of parts less the distinct parts.",
    nonEmpty(subtract(length(), count(upTo(largest), greater(multiplicityOf("k"), 0), "k"))),
  ),
  stat(
    "LargestMissingPart",
    "The largest integer below the largest part that is not a part; 0 if every smaller integer is.",
    nonEmpty(["Max", forEach(upTo(largest), ["If", equals(multiplicityOf("k"), 0), "k", 0], "k")]),
    "0 counts as a candidate, so the value is 0 when every smaller positive integer is a part.",
  ),
  stat(
    "SmallestNonRepeatedInteger",
    "The smallest positive integer that is not a part at least twice.",
    ["If", equals(length(), 0), 1, ["Min", where(upTo(add(length(), 1)), less(multiplicityOf("k"), 2), "k")]],
    "The integer need not be a part: it is the least k >= 1 with fewer than two parts equal to k.",
  ),
  stat(
    "DistinctSubsetSums",
    "Distinct sums of non-empty sub-multisets of the parts.",
    nonEmpty(bind("s", subsetSums, subtract(length("s"), 1))),
    'Follows FindStat\'s Sage code and its data, not its title: the "partial sums" it counts are the sums of arbitrary sub-multisets of the parts (the code runs over all subsets), not of the running prefixes.',
  ),
  stat(
    "EvenSubsetSums",
    "Distinct nonzero even sums of sub-multisets of the parts.",
    nonEmpty(bind("s", subsetSums, subtract(count("s", equals(["Mod", "i", 2], 0)), 1))),
    'Follows FindStat\'s Sage code and its data, not its title: the "partial sums" it counts are the sums of arbitrary sub-multisets of the parts (the code runs over all subsets), not of the running prefixes. The empty sum, 0, is not counted.',
  ),
  stat(
    "OddSubsetSums",
    "Distinct odd sums of sub-multisets of the parts.",
    nonEmpty(bind("s", subsetSums, count("s", equals(["Mod", "i", 2], 1)))),
    'Follows FindStat\'s Sage code and its data, not its title: the "partial sums" it counts are the sums of arbitrary sub-multisets of the parts (the code runs over all subsets), not of the running prefixes.',
  ),
];
