// Integer-partition statistics, over `_x` = the parts in WEAKLY DECREASING order.
//
// The conjugate is the workhorse: the conjugate of λ has, in position i, the number of parts
// of λ that are at least i. Written once here, several statistics that read "down the
// columns" become statements about the conjugate rather than fresh definitions — which is
// exactly the reduction-to-lesser-symbols the whole exercise is for.

import type { Definition, MathJSON } from "../../src/statistics/types.ts";
import {
  add,
  adjacent,
  and,
  at,
  atLeastValue,
  atMostValue,
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
const withConjugate = (body: MathJSON): MathJSON => bind("c", conjugate, body, "list<integer>");
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

/** m!, with 0! = 1 (`Range(1, 0)` stays symbolic). */
const factorialOf = (m: MathJSON): MathJSON => ["If", equals(m, 0), 1, ["Product", ["Range", 1, m]]];
/** The product of the factorials of the multiplicities: a part's factor is its place within its run of equal parts. */
const multiplicityFactorials: MathJSON = ["Product", forEach(positions, count(upTo("i"), equals(at("j"), here), "j"))];
/** The sum of the greatest common divisors of all pairs of parts. */
const pairwiseGreatestCommonDivisorSum: MathJSON = sumOver(
  positions,
  sumOver(
    positions,
    ["If", less("j", "i"), ["Divide", ["Multiply", at("i"), at("j")], ["LCM", at("i"), at("j")]], 0],
    "j",
  ),
);
/** The least common multiple and the greatest common divisor of the parts. */
const leastCommonMultiple: MathJSON = fold(["Rest", x], at(1), ["LCM", "a", "b"]);
const greatestCommonDivisor: MathJSON = fold(["Rest", x], at(1), ["Divide", ["Multiply", "a", "b"], ["LCM", "a", "b"]]);
/** C(n, 2) and C(n, 3), for n a count. */
const choose2 = (n: MathJSON): MathJSON => ["Divide", ["Multiply", n, subtract(n, 1)], 2];
const choose3 = (n: MathJSON): MathJSON => ["Divide", ["Multiply", n, subtract(n, 1), subtract(n, 2)], 6];
/** How many parts equal `value`, outside a definition that already binds `i`. */
const partsEqualTo = (value: number): MathJSON => count(positions, equals(here, value));
/** C(n, k) for counts, 0 when k > n. */
const binomialOf = (n: MathJSON, k: MathJSON): MathJSON => [
  "If",
  greater(k, n),
  0,
  ["Divide", factorialOf(n), ["Multiply", factorialOf(k), factorialOf(subtract(n, k))]],
];

/** 1 when `p` is even, 0 when odd. */
const deltaEven = (p: MathJSON): MathJSON => ["If", equals(["Mod", p, 2], 0), 1, 0];
/** Half the last part, rounded up when it is odd: (last + 1 - delta)/2. */
const lastFactor: MathJSON = ["Divide", subtract(add(at(length()), 1), deltaEven(at(length()))), 2];

/** The gap from part i to the next, less 1 for each of the two that is even. */
const pairGap: MathJSON = subtract(
  subtract(subtract(here, at(add("i", 1))), deltaEven(here)),
  deltaEven(at(add("i", 1))),
);

/** The number of standard Young tableaux: the size factorial over the hook product. */
const standardTableauxCount: MathJSON = ["Divide", factorialOf(total), hookProduct];
/** The number of semistandard tableaux with entries up to `k`: the product of (k + j - i) over the cells, over the hook product. */
const semistandardTableauxCount = (k: MathJSON): MathJSON => [
  "Divide",
  ["Product", forEach(positions, ["Product", forEach(upTo(here), add(k, subtract("j", "i")), "j")])],
  hookProduct,
];
/** The same, 0 where the shape has more rows than entries: spelled out, or the compiled form leaves a -0. */
const boundedSemistandardTableauxCount = (k: number): MathJSON => [
  "If",
  greater(length(), k),
  0,
  semistandardTableauxCount(k),
];
/** The sum of the squares of the hook lengths, reading the conjugate in place. */
const hookSquareSum: MathJSON = ["Sum", forEach(positions, ["Sum", forEach(upTo(here), ["Power", hookAt, 2], "j")])];
/** C(2p, p), as the rising product over p!. */
const centralBinomial = (p: MathJSON): MathJSON => [
  "Divide",
  ["Product", ["Range", add(p, 1), ["Multiply", 2, p]]],
  factorialOf(p),
];
/**
 * The partitions contained in the shape, row by row. Entry j + 1 counts the choices of the first rows whose last row has j cells (j = 0 .. largest part, so
 * `upTo(largest + 1)` positions); each row may be any size up to the shape's row and at most the row above, so its entry sums the entries from j up.
 * `least` is the smallest size a row may take, 0 or 1 (every row non-empty: same length).
 */
const subpartitionRow = (previous: MathJSON, least: number, rowLength: MathJSON): MathJSON =>
  forEach(upTo(add(largest, 1)), [
    "If",
    and(atLeastValue("i", least + 1), atMostValue("i", add(rowLength, 1))),
    sumOver(["Range", "i", add(largest, 1)], at("k", previous), "k"),
    0,
  ]);
const subpartitionCounts = (least: number): MathJSON =>
  fold(
    ["Rest", x],
    forEach(upTo(add(largest, 1)), ["If", atLeastValue("i", least + 1), 1, 0]),
    subpartitionRow("a", least, "b"),
  );
/** The parts before position i that are larger than part i: with the parts weakly decreasing, those that differ from it. */
const largerPartsBefore: MathJSON = count(positions, and(less("j", "i"), greater(at("j"), here)), "j");

/**
 * The partition numbers p(0), ..., p(largest part) as a list, by the table that adds one part size at a time:
 * with parts up to b allowed, p(s) is the sum of the old p(s - t b) over every t.
 */
const partitionNumberTable: MathJSON = fold(
  upTo(largest),
  forEach(upTo(add(largest, 1)), ["If", equals("i", 1), 1, 0]),
  forEach(
    upTo(add(largest, 1)),
    sumOver(
      ["Range", 0, ["Divide", subtract(subtract("i", 1), ["Mod", subtract("i", 1), "b"]), "b"]],
      at(subtract("i", ["Multiply", "t", "b"]), "a"),
      "t",
    ),
  ),
);
/**
 * The k-rim hooks removed to reach the k-core: (size - core size) / k. On the abacus the beads are the parts
 * shifted to distinct positions, part i + length - i; the core slides the c beads of each runner r (position mod k) to the
 * first c places of the runner, which sit at r, r + k, ..., so its beads sum to c r + k c (c - 1) / 2 over the runners.
 */
const rimHooksRemoved = (k: number): MathJSON => {
  const beadsOnRunner = count(positions, equals(["Mod", add(here, subtract(length(), "i")), k], "r"));
  const coreBeadSum = sumOver(
    ["Range", 0, k - 1],
    ["Multiply", beadsOnRunner, add("r", ["Divide", ["Multiply", k, subtract(beadsOnRunner, 1)], 2])],
    "r",
  );
  return ["Divide", subtract(total, subtract(coreBeadSum, choose2(length()))), k];
};
/** Part `i` of the highest weight (0 past the end) plus its Weyl shift for Sp(2r): the rho entry is r + 1 - i. */
const symplecticWeight = (i: number, r: number): MathJSON =>
  add(["If", atLeastValue(length(), i), at(i), 0], r + 1 - i);

/** The parts shortest first: the order a Ferrers board is filled row by row. */
const rowsAscending: MathJSON = forEach(positions, at(add(subtract(length(), "i"), 1)));
/**
 * The rook numbers r_0 .. r_length of the Ferrers board, as a list (entry k + 1 is r_k): a row of b cells takes its rook
 * in one of the b - (k - 1) columns the earlier rows' k - 1 rooks leave free.
 */
const rookNumbers: MathJSON = fold(
  rowsAscending,
  forEach(upTo(add(length(), 1)), ["If", equals("i", 1), 1, 0]),
  forEach(upTo(add(length(), 1)), [
    "If",
    equals("i", 1),
    at(1, "a"),
    add(at("i", "a"), ["Multiply", subtract("b", subtract("i", 2)), at(subtract("i", 1), "a")]),
  ]),
);
/** The parts that start a run of equal parts, one per distinct part size. */
const startsOfRuns: MathJSON = ["Or", equals("i", length()), greater(here, at(add("i", 1)))];
/** Euler's totient of `d`: the numbers up to d with no common factor with it. */
const totientOf = (d: MathJSON): MathJSON =>
  count(upTo(d), equals(["Divide", ["Multiply", "k", d], ["LCM", "k", d]], 1), "k");
/**
 * The standard tableaux counted by their major index: entry k + 1 of the list is the number whose major index is k (k up to size
 * (size + 1) / 2, past the largest possible). The q-hook formula: q^n(λ) times the product of 1 - q^i for i up to the size, over that of
 * 1 - q^h for the hooks h; multiply out, then divide by each 1 - q^h as the sum along its arithmetic progression.
 */
const majorIndexCounts: MathJSON = withConjugate(
  fold(
    ["Flatten", forEach(positions, forEach(upTo(here), hookWith, "j"))],
    fold(
      upTo(total),
      forEach(upTo(add(["Divide", ["Multiply", total, add(total, 1)], 2], 1)), ["If", equals("i", 1), 1, 0]),
      forEach(upTo(add(["Divide", ["Multiply", total, add(total, 1)], 2], 1)), [
        "If",
        greater("i", "b"),
        subtract(at("i", "a"), at(subtract("i", "b"), "a")),
        at("i", "a"),
      ]),
    ),
    forEach(
      upTo(add(["Divide", ["Multiply", total, add(total, 1)], 2], 1)),
      sumOver(
        ["Range", 0, ["Divide", subtract(subtract("i", 1), ["Mod", subtract("i", 1), "b"]), "b"]],
        at(subtract("i", ["Multiply", "t", "b"]), "a"),
        "t",
      ),
    ),
  ),
);
/** The minimum major index of a standard tableau: the sum over the rows of (row - 1) times its length. */
const minimalMajorIndex: MathJSON = sumOver(positions, ["Multiply", subtract("i", 1), here]);
/** The standard tableaux whose major index leaves remainder `remainder` on division by the size. */
const tableauxWithMajorIndexRemainder = (remainder: number): MathJSON =>
  bind(
    "m",
    minimalMajorIndex,
    bind(
      "q",
      majorIndexCounts,
      sumOver(upTo(add(["Divide", ["Multiply", total, add(total, 1)], 2], 1)), [
        "If",
        equals(["Mod", add(subtract("i", 1), "m"), total], remainder),
        at("i", "q"),
        0,
      ]),
      "list<integer>",
    ),
    "number",
  );
/**
 * The partitions that cover `partition` in dominance order, counted: Brylawski's covers move a cell from row j up to row i < j,
 * when the result is still a partition and the rows are adjacent or equal. `partition` is bound to `u`.
 */
const upperCoversIn = (partition: MathJSON): MathJSON => {
  const part = (k: MathJSON): MathJSON => at(k, "u");
  const rows: MathJSON = ["Length", "u"];
  return bind(
    "u",
    partition,
    sumOver(
      upTo(rows),
      count(
        upTo(rows),
        and(
          greater("j", "i"),
          and(
            or(equals("i", 1), greater(part(subtract("i", 1)), part("i"))),
            and(
              or(equals("j", rows), greater(part("j"), part(add("j", 1)))),
              or(equals("j", add("i", 1)), equals(part("i"), part("j"))),
            ),
          ),
        ),
        "j",
      ),
    ),
    "list<integer>",
  );
};
/** The number of odd parts. */
const oddParts: MathJSON = count(positions, equals(["Mod", here, 2], 1));
/** The product of the factorials of the halves of the parts, rounded down. */
const halfPartFactorials: MathJSON = [
  "Product",
  forEach(positions, factorialOf(["Divide", subtract(here, ["Mod", here, 2]), 2])),
];
/** The sum over the rotations of the cyclic group of the colorings each fixes: the d-th power of a rotation has d cycles of equal length. */
const rotationFixedColorings: MathJSON = bind(
  "g",
  greatestCommonDivisor,
  sumOver(
    upTo("g"),
    [
      "If",
      equals(["Mod", "g", "d"], 0),
      [
        "Divide",
        ["Multiply", totientOf("d"), factorialOf(["Divide", total, "d"])],
        ["Product", forEach(positions, factorialOf(["Divide", here, "d"]))],
      ],
      0,
    ],
    "d",
  ),
  "number",
);

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
    "HalfPerimeter",
    "Half the perimeter of the bounding rectangle of the Young diagram: largest part plus number of parts.",
    nonEmpty(add(largest, length())),
    "FindStat's St000459 calls the hook length of the base cell the perimeter; that is `HookLengthOfFirstCell`, one less than this.",
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
  stat(
    "StandardTableauCount",
    "The number of standard Young tableaux of the shape: the size factorial over the hook product.",
    nonEmpty(standardTableauxCount, 1),
    "Defined by the hook-length formula; PlancherelCount is its square.",
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
    "One more than `LargestShiftedPart`, except that both are 0 on the empty partition.",
  ),
  stat(
    "LargestShiftedPart",
    "The largest part after adding i - 1 to the i-th part.",
    nonEmpty(["Max", forEach(positions, add(here, subtract("i", 1)))]),
    "One less than `MaximalRectangleHalfPerimeter`, except that both are 0 on the empty partition.",
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
    "The sum, over the corners, of the step number along the boundary path from the bottom left: (number of parts - i) + the i-th part.",
    nonEmpty(
      sumOver(positions, [
        "If",
        or(equals("i", length()), greater(here, at(add("i", 1)))),
        add(subtract(length(), "i"), here),
        0,
      ]),
    ),
    "For (8, 6, 6, 4, 3, 3) the corners are at steps 3, 6, 9 and 13, so the value is 31 (FindStat's St000770 example).",
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
  stat("GreatestCommonDivisorOfParts", "The greatest common divisor of the parts.", nonEmpty(greatestCommonDivisor)),
  stat("LeastCommonMultipleOfParts", "The least common multiple of the parts.", nonEmpty(leastCommonMultiple, 1)),
  stat(
    "PairwiseGreatestCommonDivisorSum",
    "The sum of the greatest common divisors of all pairs of parts.",
    nonEmpty(pairwiseGreatestCommonDivisorSum),
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
    "DistinctEvenSubsetSums",
    "Distinct nonzero even sums of sub-multisets of the parts.",
    nonEmpty(bind("s", subsetSums, subtract(count("s", equals(["Mod", "i", 2], 0)), 1), "list<integer>")),
    'Follows FindStat\'s Sage code and its data, not its title: the "partial sums" it counts are the sums of arbitrary sub-multisets of the parts (the code runs over all subsets), not of the running prefixes. The empty sum, 0, is not counted.',
  ),
  stat(
    "DistinctOddSubsetSums",
    "Distinct odd sums of sub-multisets of the parts.",
    nonEmpty(bind("s", subsetSums, count("s", equals(["Mod", "i", 2], 1)), "list<integer>")),
    'Follows FindStat\'s Sage code and its data, not its title: the "partial sums" it counts are the sums of arbitrary sub-multisets of the parts (the code runs over all subsets), not of the running prefixes.',
  ),

  // ── FindStat's integer-partition statistics, third round ─────────────────────────────────

  // Parts by residue and parity.
  stat(
    "PartsNotCongruentToTwoModuloThree",
    "Parts that are not congruent to 2 modulo 3.",
    nonEmpty(count(positions, less(["Mod", here, 3], 2))),
  ),
  stat(
    "PartsNotCongruentToZeroModuloThree",
    "Parts that are not divisible by 3.",
    nonEmpty(count(positions, greater(["Mod", here, 3], 0))),
  ),
  stat(
    "PartsNotCongruentToOneModuloThree",
    "Parts that are not congruent to 1 modulo 3.",
    nonEmpty(count(positions, or(equals(["Mod", here, 3], 0), equals(["Mod", here, 3], 2)))),
  ),
  stat("PartsEqualTwo", "Parts equal to 2.", nonEmpty(partsEqualTo(2))),
  stat(
    "HalfSumOfEvenParts",
    "Half the sum of the even parts.",
    nonEmpty(["Divide", sumOver(positions, ["If", equals(["Mod", here, 2], 0), here, 0]), 2]),
  ),
  stat("HalfLargestEvenPart", "Half the largest even part; 0 if there is none.", nonEmpty(["Divide", largestEven, 2])),
  stat(
    "DistinctOddPartsBelowLargestEvenPart",
    "Distinct odd part sizes smaller than the largest even part.",
    nonEmpty(
      bind(
        "e",
        largestEven,
        count(
          upTo(largest),
          and(and(greater(multiplicityOf("k"), 0), equals(["Mod", "k", 2], 1)), less("k", "e")),
          "k",
        ),
        "number",
      ),
    ),
  ),

  // Products, quotients and counts built from the parts.
  stat(
    "PartSquareProduct",
    "The product of the squares of the parts.",
    nonEmpty(["Product", forEach(positions, ["Power", here, 2])], 1),
  ),
  stat(
    "MultinomialOfParts",
    "The multinomial coefficient of the size over the parts: the size factorial over the product of the factorials of the parts.",
    nonEmpty(["Divide", factorialOf(total), ["Product", forEach(positions, factorialOf(here))]], 1),
  ),
  stat(
    "ExponensConsonantiae",
    "The least common multiple of the parts over their greatest common divisor.",
    nonEmpty(["Divide", leastCommonMultiple, greatestCommonDivisor]),
  ),
  stat(
    "CyclicSievingPolynomialDegree",
    "(1 - 1/largest part) times the least common multiple of the parts: the degree of the cyclic sieving polynomial of a permutation with these cycle lengths.",
    nonEmpty(["Divide", ["Multiply", subtract(largest, 1), leastCommonMultiple], largest]),
    "FindStat leaves the empty partition undefined; it is 0 here.",
  ),
  stat(
    "GiniIndex",
    "The size plus 1 choose 2, less the sum over the columns of the column length plus 1 choose 2.",
    nonEmpty(
      subtract(
        ["Divide", ["Multiply", total, add(total, 1)], 2],
        sumOver(conjugate, ["Divide", ["Multiply", "i", add("i", 1)], 2]),
      ),
    ),
  ),
  stat(
    "InterlacingPartitionCount",
    "The number of partitions that interlace this one: the product over the parts of the gap to the next part (0 after the last) plus 1.",
    nonEmpty(
      ["Product", forEach(positions, add(subtract(here, ["If", equals("i", length()), 0, at(add("i", 1))]), 1))],
      1,
    ),
  ),
  stat(
    "MinimalSubpartitionSizeDifference",
    "The smallest difference in size between the two halves of a split of the parts into two sub-multisets.",
    nonEmpty(
      bind(
        "s",
        subsetSums,
        ["Min", forEach(where("s", atLeastValue(["Multiply", "i", 2], total)), subtract(["Multiply", "i", 2], total))],
        "list<integer>",
      ),
    ),
  ),
  stat(
    "AlladiWeight",
    "The last part times the product over consecutive parts of the gap less 1.",
    // The zero is spelled out: compiled, a -1 factor times a 0 one would leave -0.
    nonEmpty([
      "If",
      equals(length(), 1),
      at(length()),
      [
        "If",
        greater(count(adjacent, equals(subtract(here, at(add("i", 1))), 1)), 0),
        0,
        ["Multiply", at(length()), ["Product", forEach(adjacent, subtract(subtract(here, at(add("i", 1))), 1))]],
      ],
    ]),
  ),
  stat(
    "SecondAlladiWeight",
    "Half the last part (rounded up if odd), times the product over consecutive parts of half the gap less 1 for each even one of the two.",
    nonEmpty([
      "If",
      equals(length(), 1),
      lastFactor,
      [
        "If",
        greater(count(adjacent, equals(pairGap, 0)), 0),
        0,
        ["Multiply", lastFactor, ["Product", forEach(adjacent, ["Divide", pairGap, 2])]],
      ],
    ]),
    "Alladi's second weight: for each part, delta is 1 if it is even and 0 if odd; the factor for the last part is (last + 1 - delta)/2 and for each consecutive pair (gap - delta - delta')/2.",
  ),

  // Cycle types: a partition read as the cycle lengths of a permutation.
  stat(
    "CentralizerSize",
    "The size of the centralizer of a permutation with these cycle lengths: the product of the parts times the product of the factorials of the multiplicities.",
    nonEmpty(["Multiply", ["Product", x], multiplicityFactorials], 1),
  ),
  stat(
    "ConjugacyClassSize",
    "The number of permutations of the same cycle type: n! over the product of the cycle sizes and the factorials of the multiplicities.",
    nonEmpty(["Divide", factorialOf(total), ["Multiply", ["Product", x], multiplicityFactorials]], 1),
  ),
  stat(
    "SetPartitionsWithBlockSizesCount",
    "The number of set partitions whose block sizes are the parts: the size factorial over the product of the factorials of the parts and of the multiplicities.",
    nonEmpty(
      [
        "Divide",
        factorialOf(total),
        ["Multiply", ["Product", forEach(positions, factorialOf(here))], multiplicityFactorials],
      ],
      1,
    ),
  ),
  stat(
    "KrewerasNumber",
    "The number of noncrossing set partitions whose block sizes are the parts: the size factorial over the factorial of size + 1 - length and the factorials of the multiplicities.",
    nonEmpty(
      [
        "Divide",
        factorialOf(total),
        ["Multiply", factorialOf(subtract(add(total, 1), length())), multiplicityFactorials],
      ],
      1,
    ),
  ),
  stat(
    "InvariantSubsetCount",
    "Subsets of the points left invariant by a permutation with these cycle lengths: each cycle is in or out, 2 to the number of cycles.",
    nonEmpty(["Power", 2, length()], 1),
  ),
  stat(
    "InvariantTwoElementSubsetCount",
    "Invariant 2-element subsets: a pair of fixed points or a 2-cycle.",
    nonEmpty(add(choose2(ones), partsEqualTo(2))),
  ),
  stat(
    "InvariantThreeElementSubsetCount",
    "Invariant 3-element subsets: three fixed points, a fixed point and a 2-cycle, or a 3-cycle.",
    nonEmpty(add(add(choose3(ones), ["Multiply", ones, partsEqualTo(2)]), partsEqualTo(3))),
  ),
  stat(
    "EdgeOrbitCount",
    "Orbits of the complete graph's edges under a permutation with these cycle lengths: the sum of half the parts rounded down, plus the sum of gcd(part, part) over pairs.",
    nonEmpty(
      add(sumOver(positions, ["Divide", subtract(here, ["Mod", here, 2]), 2]), pairwiseGreatestCommonDivisorSum),
    ),
  ),

  // Symmetric functions evaluated at k ones, k the number of parts.
  stat(
    "ElementarySymmetricFunctionAtOne",
    "The elementary symmetric function indexed by the partition, in as many variables as it has parts, all set to 1: the product of the binomial coefficients of the number of parts and each part.",
    nonEmpty(["Product", forEach(positions, binomialOf(length(), here))], 1),
  ),

  // Subsets.
  stat(
    "SubsetGreatestCommonDivisorSum",
    "The sum, over the non-empty subsets of the parts, of their greatest common divisor: the sum over d of phi(d) times one less than 2 to the number of parts divisible by d.",
    nonEmpty(
      sumOver(
        upTo(largest),
        [
          "Multiply",
          count(upTo("d"), equals(["Divide", ["Multiply", "k", "d"], ["LCM", "k", "d"]], 1), "k"),
          subtract(["Power", 2, count(positions, equals(["Mod", here, "d"], 0))], 1),
        ],
        "d",
      ),
    ),
  ),

  // ── FindStat's integer-partition statistics, fourth round ────────────────────────────────

  // Tableau counts by the hook-length and hook-content formulas.
  stat(
    "SemistandardTableauCountWithEntriesUpToTwo",
    "Semistandard tableaux of the shape with entries at most 2: the product of 2 + j - i over the cells, over the hook product.",
    nonEmpty(boundedSemistandardTableauxCount(2), 1),
  ),
  stat(
    "SemistandardTableauCountWithEntriesUpToThree",
    "Semistandard tableaux of the shape with entries at most 3.",
    nonEmpty(boundedSemistandardTableauxCount(3), 1),
  ),
  stat(
    "SemistandardTableauCountWithEntriesUpToFour",
    "Semistandard tableaux of the shape with entries at most 4.",
    nonEmpty(boundedSemistandardTableauxCount(4), 1),
  ),
  stat(
    "SemistandardTableauCountWithEntriesUpToLength",
    "Semistandard tableaux of the shape with entries at most the number of parts.",
    nonEmpty(semistandardTableauxCount(length()), 1),
  ),
  stat(
    "SemistandardTableauCountWithEntriesUpToSize",
    "Semistandard tableaux of the shape with entries at most the size of the partition.",
    nonEmpty(semistandardTableauxCount(total), 1),
  ),
  stat(
    "PlancherelCount",
    "The square of the number of standard tableaux: the permutations whose Robinson-Schensted shape is this partition.",
    nonEmpty(["Power", standardTableauxCount, 2], 1),
  ),
  stat(
    "CubedStandardTableauCount",
    "The cube of the number of standard tableaux.",
    nonEmpty(["Power", standardTableauxCount, 3], 1),
  ),
  stat(
    "ShiftedStandardTableauCount",
    "Standard tableaux of the shifted shape: the multinomial of the parts times, over pairs of parts, the difference over the sum. 0 when two parts are equal.",
    nonEmpty(
      [
        "Divide",
        [
          "Multiply",
          factorialOf(total),
          [
            "Product",
            forEach(positions, [
              "Product",
              forEach(positions, ["If", less("j", "i"), subtract(at("j"), here), 1], "j"),
            ]),
          ],
        ],
        [
          "Multiply",
          ["Product", forEach(positions, factorialOf(here))],
          [
            "Product",
            forEach(positions, ["Product", forEach(positions, ["If", less("j", "i"), add(at("j"), here), 1], "j")]),
          ],
        ],
      ],
      1,
    ),
  ),
  stat(
    "TwiceMeanMajorIndexOfStandardTableaux",
    "Twice the mean major index over the standard tableaux: n choose 2, less the sum of the row lengths choose 2, plus the sum of the column lengths choose 2.",
    nonEmpty(add(subtract(choose2(total), sumOver(x, choose2("i"))), sumOver(conjugate, choose2("i")))),
  ),
  stat(
    "TwelveTimesMajorIndexVarianceOfStandardTableaux",
    "Twelve times the variance of the major index over the standard tableaux: the sum of the first n squares, less the sum of the squared hook lengths.",
    nonEmpty(subtract(sumOver(upTo(total), ["Power", "i", 2]), hookSquareSum)),
    "Follows FindStat's description, whose Sage code does not parse; the values agree with it.",
  ),
  stat(
    "PairsOfDistinctParts",
    "Pairs of parts that differ in size: the degree of the polynomial counting semistandard tableaux of the stretched shape.",
    nonEmpty(sumOver(positions, largerPartsBefore)),
  ),
  stat(
    "DiagonalArmSum",
    "The sum of the arms of the cells on the main diagonal.",
    nonEmpty(sumOver(positions, ["If", atLeastValue(here, "i"), subtract(here, "i"), 0])),
    "FindStat's spin (St000319) counts the crossings of the border strips and its dinv adjustment (St000320) sums over their starting columns; each strip contributes its first part less 1, which is the arm of one diagonal cell, and the two agree on every row.",
  ),
  stat(
    "RimHooksRemovedToTwoCore",
    "The 2-rim hooks removed to reach the 2-core: the size less the core's, over 2, the core read off the abacus.",
    nonEmpty(rimHooksRemoved(2)),
  ),
  stat("RimHooksRemovedToThreeCore", "The 3-rim hooks removed to reach the 3-core.", nonEmpty(rimHooksRemoved(3))),
  stat(
    "MultipartitionCount",
    "Tuples of partitions whose sizes are the parts: the product of the partition numbers of the parts.",
    nonEmpty(
      bind("p", partitionNumberTable, ["Product", forEach(positions, at(add(here, 1), "p"))], "list<integer>"),
      1,
    ),
  ),

  // Counts from a formula on the parts.
  stat(
    "PartRearrangementCount",
    "Distinct rearrangements of the parts, the compositions that sort to this partition: the number of parts factorial over the factorials of the multiplicities.",
    nonEmpty(["Divide", factorialOf(length()), multiplicityFactorials], 1),
  ),
  stat(
    "LagrangeInversionCoefficient",
    "The coefficient of the monomial in the compositional-inverse series: n (n + 1) ... (n + length - 2) over the factorials of the multiplicities.",
    nonEmpty(
      [
        "Divide",
        ["If", equals(length(), 1), 1, ["Product", forEach(["Range", 0, subtract(length(), 2)], add(total, "k"), "k")]],
        multiplicityFactorials,
      ],
      1,
    ),
  ),
  stat(
    "LogarithmicDerivativeCoefficient",
    "The coefficient of the monomial in the logarithmic derivative of 1 - c_1 x - c_2 x^2/2! - ..., times a factorial: the set partitions with these block sizes, times (length - 1)! for arranging the blocks in a cycle.",
    nonEmpty(
      [
        "Divide",
        [
          "Multiply",
          ["Divide", factorialOf(total), ["Product", forEach(positions, factorialOf(here))]],
          ["Divide", factorialOf(length()), multiplicityFactorials],
        ],
        length(),
      ],
      1,
    ),
  ),
  stat(
    "StarTranspositionFactorizationCount",
    "Minimal transitive factorizations of a permutation of this cycle type into star transpositions: the product of the parts times (n + 1) ... (n + length - 2).",
    nonEmpty(
      [
        "If",
        equals(length(), 1),
        1,
        [
          "Multiply",
          ["Product", x],
          ["If", equals(length(), 2), 1, ["Product", ["Range", add(total, 1), subtract(add(total, length()), 2)]]],
        ],
      ],
      1,
    ),
  ),
  stat(
    "TransitiveMonotoneFactorizationCount",
    "Transitive monotone factorizations of genus zero of a permutation of this cycle type, into n + length - 2 transpositions.",
    nonEmpty(
      [
        "Divide",
        [
          "Multiply",
          ["Product", forEach(positions, centralBinomial(here))],
          ["Product", x],
          [
            "If",
            less(length(), 4),
            1,
            ["Product", ["Range", add(["Multiply", 2, total], 1), subtract(add(["Multiply", 2, total], length()), 3)]],
          ],
        ],
        [
          "If",
          equals(length(), 1),
          ["Multiply", subtract(["Multiply", 2, total], 1), ["Multiply", 2, total]],
          ["If", equals(length(), 2), ["Multiply", 2, total], 1],
        ],
      ],
      1,
    ),
  ),
  // Dimensions of irreducible representations of the symplectic groups, by the Weyl formula
  // in the orthogonal basis: the partition (padded with zeros) is the highest weight.
  stat(
    "SymplecticDimensionRankTwo",
    "The dimension of the irreducible representation of Sp(4) with this highest weight; 0 if the partition has more than 2 parts.",
    nonEmpty(
      [
        "If",
        greater(length(), 2),
        0,
        [
          "Divide",
          [
            "Multiply",
            symplecticWeight(1, 2),
            symplecticWeight(2, 2),
            subtract(["Power", symplecticWeight(1, 2), 2], ["Power", symplecticWeight(2, 2), 2]),
          ],
          6,
        ],
      ],
      1,
    ),
  ),
  stat(
    "SymplecticDimensionRankThree",
    "The dimension of the irreducible representation of Sp(6) with this highest weight; 0 if the partition has more than 3 parts.",
    nonEmpty(
      [
        "If",
        greater(length(), 3),
        0,
        [
          "Divide",
          [
            "Multiply",
            symplecticWeight(1, 3),
            symplecticWeight(2, 3),
            symplecticWeight(3, 3),
            subtract(["Power", symplecticWeight(1, 3), 2], ["Power", symplecticWeight(2, 3), 2]),
            subtract(["Power", symplecticWeight(1, 3), 2], ["Power", symplecticWeight(3, 3), 2]),
            subtract(["Power", symplecticWeight(2, 3), 2], ["Power", symplecticWeight(3, 3), 2]),
          ],
          720,
        ],
      ],
      1,
    ),
  ),

  // The partitions below this one in the containment order.
  stat(
    "BorderSkewStandardTableauCount",
    "Standard tableaux of the skew shape that adds a cell to every column of the diagram: the size factorial over the factorials of the cells added to each row (the size less the largest part, then the gaps between consecutive parts).",
    nonEmpty(
      [
        "Divide",
        factorialOf(total),
        [
          "Multiply",
          factorialOf(subtract(total, largest)),
          [
            "Product",
            forEach(positions, factorialOf(subtract(here, ["If", equals("i", length()), 0, at(add("i", 1))]))),
          ],
        ],
      ],
      1,
    ),
  ),
  // Tables over the rows. `Max(..., 0)` floors the sum so the compiler types it real (it types a fold's sum complex otherwise).
  stat(
    "SubpartitionCount",
    "The partitions contained in this one.",
    nonEmpty(["Max", ["Sum", subpartitionCounts(0)], 0], 1),
  ),
  stat(
    "SameLengthSubpartitionCount",
    "The partitions with as many parts contained in this one.",
    nonEmpty(["Max", ["Sum", subpartitionCounts(1)], 0], 1),
  ),
  stat(
    "YoungLatticeCoveringRelationCount",
    "The covering relations of Young's lattice among the partitions contained in this one: the sum of their corners.",
    nonEmpty(
      bind(
        "t",
        fold(
          ["Rest", x],
          ["List", forEach(upTo(add(largest, 1)), 1), forEach(upTo(add(largest, 1)), 0)],
          [
            "List",
            subpartitionRow(["At", "a", 1], 0, "b"),
            forEach(upTo(add(largest, 1)), [
              "If",
              atMostValue("i", add("b", 1)),
              sumOver(
                ["Range", "i", add(largest, 1)],
                add(at("k", ["At", "a", 2]), ["If", greater("k", "i"), at("k", ["At", "a", 1]), 0]),
                "k",
              ),
              0,
            ]),
          ],
        ),
        [
          "Max",
          add(["Sum", ["At", "t", 2]], ["Sum", forEach(["Range", 2, add(largest, 1)], at("i", ["At", "t", 1]))]),
          0,
        ],
        "list<list<integer>>",
      ),
      0,
    ),
  ),

  // Parts counted, and the crank as FindStat's code reads it.
  stat("PartCount", "The number of parts.", length()),
  stat(
    "LengthCrank",
    "The number of parts when λ has no 1s, else (parts larger than the number of 1s) minus (the number of 1s).",
    nonEmpty(["If", equals(ones, 0), length(), subtract(count(positions, greater(here, ones)), ones)]),
    "Crank has the largest part where this has the number of parts; FindStat's St000146 follows the code, which takes the length.",
  ),

  // The sixth batch.
  stat(
    "SeaweedAlgebraDimension",
    "The dimension of the maximal parabolic seaweed algebra: half the sum of the squares of the parts and of the size.",
    nonEmpty(["Divide", add(sumOver(positions, ["Power", here, 2]), ["Power", total, 2]), 2]),
  ),
  stat(
    "CartanDeterminant",
    "The determinant of the matrix of the minimums of the distinct parts: the least distinct part times the gaps between consecutive distinct parts.",
    nonEmpty(
      [
        "Product",
        forEach(where(positions, startsOfRuns), subtract(here, ["If", equals("i", length()), 0, at(add("i", 1))])),
      ],
      1,
    ),
  ),
  stat(
    "RookPlacementCount",
    "The rook placements, of any number of rooks, on the Ferrers board of the diagram.",
    nonEmpty(bind("r", rookNumbers, ["Sum", "r"], "list<integer>"), 1),
  ),
  stat(
    "MaximalRookPlacementCount",
    "The ways to place as many non-attacking rooks as possible on the Ferrers board of the diagram.",
    nonEmpty(
      bind(
        "r",
        rookNumbers,
        at(["Max", forEach(upTo(add(length(), 1)), ["If", greater(at("i", "r"), 0), "i", 0])], "r"),
        "list<integer>",
      ),
      1,
    ),
  ),
  stat(
    "ShorterSideRookPlacementCount",
    "The ways to place as many non-attacking rooks as the shorter side of the Ferrers board's bounding rectangle has cells, 0 when they do not fit.",
    nonEmpty(bind("r", rookNumbers, at(add(["Min", length(), largest], 1), "r"), "list<integer>"), 1),
    "FindStat's title calls this the leading coefficient of the rook polynomial, but its code takes the entry for the shorter side, which is 0 when no placement fills it; the name follows the code.",
  ),
  stat(
    "NecklaceCount",
    "The colorings of a cycle with these color multiplicities, up to rotation: the size's divisors d of the greatest common divisor of the parts, each contributing totient(d) multinomials, over the size.",
    nonEmpty(["Divide", rotationFixedColorings, total]),
    "FindStat's St001605 (the cyclic group); its title says colourings of a cycle.",
  ),
  stat(
    "BraceletCount",
    "The colorings of a polygon with these color multiplicities, up to rotation and reflection: the necklaces and the colorings fixed by the reflections, over twice the size.",
    nonEmpty(
      bind(
        "o",
        oddParts,
        [
          "Divide",
          add(rotationFixedColorings, [
            "If",
            greater("o", 2),
            0,
            ["Multiply", total, ["Divide", factorialOf(["Divide", subtract(total, "o"), 2]), halfPartFactorials]],
          ]),
          ["Multiply", 2, total],
        ],
        "number",
      ),
    ),
    "FindStat's St001603 (the dihedral group); its title says colourings of a polygon. It is only defined there for sizes of at least 3.",
  ),
  stat(
    "BulgarianSolitairePreimageCount",
    "The partitions of the same size that Bulgarian solitaire (remove the first column, insert it as a row) sends to this one: the distinct part sizes of at least the number of parts less one.",
    nonEmpty(count(positions, and(startsOfRuns, atLeastValue(here, subtract(length(), 1)))), 1),
  ),
  stat(
    "InvariantOrientedCycleCount",
    "The cyclic permutations that a permutation of this cycle type fixes under conjugation: none unless the parts are all equal to some d, in which case totient(d) d^(m-1) (m-1)! for m parts.",
    nonEmpty(
      [
        "If",
        equals(largest, at(length())),
        ["Multiply", totientOf(largest), ["Power", largest, subtract(length(), 1)], factorialOf(subtract(length(), 1))],
        0,
      ],
      0,
    ),
  ),
  stat(
    "SmirnovWordCount",
    "The words with each letter used this many times and no letter twice in a row: the Carlitz-Scoville-Vaughan sum over the numbers of runs of each letter, taken as a binomial convolution over the parts.",
    // `Max(..., 0)` floors the sum so the compiler types it real.
    nonEmpty(
      [
        "Max",
        [
          "Sum",
          fold(
            x,
            forEach(upTo(add(total, 1)), ["If", equals("i", 1), 1, 0]),
            forEach(
              upTo(add(total, 1)),
              sumOver(
                upTo("i"),
                [
                  "Multiply",
                  binomialOf(subtract("i", 1), subtract("j", 1)),
                  at(add(subtract("i", "j"), 1), "a"),
                  [
                    "If",
                    or(equals("j", 1), greater(subtract("j", 1), "b")),
                    0,
                    [
                      "Multiply",
                      ["Power", -1, subtract("b", subtract("j", 1))],
                      binomialOf(subtract("b", 1), subtract("j", 2)),
                    ],
                  ],
                ],
                "j",
              ),
            ),
          ),
        ],
        0,
      ],
      1,
    ),
    "FindStat's St001097 reads it as a coefficient of the formal group law for linear orders; its description gives the Smirnov words.",
  ),
  stat(
    "StandardTableauCountWithMajorIndexCongruentToOneModuloSize",
    "The standard Young tableaux whose major index leaves remainder 1 on division by the size of the shape (never, when the size is 1).",
    nonEmpty(tableauxWithMajorIndexRemainder(1)),
  ),
  stat(
    "UpperCoverCountInDominanceOrder",
    "The partitions of the same size that cover this one in dominance order.",
    nonEmpty(upperCoversIn(x)),
  ),
  stat(
    "LowerCoverCountInDominanceOrder",
    "The partitions of the same size that this one covers in dominance order: the upper covers of its conjugate.",
    nonEmpty(upperCoversIn(conjugate)),
  ),
];
