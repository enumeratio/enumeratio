// Integer-partition statistics, over `_x` = the parts in WEAKLY DECREASING order.
//
// The conjugate is the workhorse: the conjugate of λ has, in position i, the number of parts
// of λ that are at least i. Written once here, several statistics that read "down the
// columns" become statements about the conjugate rather than fresh definitions — which is
// exactly the reduction-to-lesser-symbols the whole exercise is for.

import type { Definition, MathJSON } from "./types.ts";
import {
  add,
  and,
  at,
  atLeastValue,
  count,
  equals,
  forEach,
  greater,
  length,
  nonEmpty,
  positions,
  subtract,
  sumOver,
  upTo,
  where,
  x,
} from "./vocabulary.ts";

const on = "IntegerPartitions";
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
];
