// Number theory's own carriers (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4
// step 4): moved from combinatorics' domains/LEFTOVER_DOMAINS, which is where every one of
// these used to be declared regardless of which package's arithmetic they actually are.
//
// `GaussianFractional` and `GaussianRational`'s shapes name `fractional_number` and
// `rational_number` — numerals' own carriers — so `declareNumberTheory` has to run after
// `declareNumerals` on any engine declaring both; every host already orders them that way.
// `ContinuedFraction` sits here rather than in numerals for a sharper reason: compute-engine's
// native `ContinuedFraction` is widened in place by `@enumeratio/modular` (the quadratic-
// irrational PQa expansion), and this carrier's constructor overloads onto whatever
// `ContinuedFraction` already is at declare time (`declareCarriers`' `declareConstructor`) — so
// it has to run after modular's widening, the same relative position combinatorics held it in
// before this move. Every host declares modular before number-theory already.

import type { Carrier } from "@enumeratio/structures";

export const NUMBER_THEORY_CARRIERS: readonly Carrier[] = [
  {
    name: "CollatzTrajectory",
    type: "collatz_trajectory",
    shape: "list<integer>",
    id: "collatz_trajectory",
    plural: "CollatzTrajectories",
  },
  {
    name: "ContinuedFraction",
    type: "continued_fraction",
    shape: "list<integer>",
    id: "continued_fraction",
  },
  {
    name: "EgyptianFraction",
    type: "egyptian_fraction",
    shape: "list<integer>",
    id: "egyptian_fraction",
    plural: "EgyptianFractions",
  },
  {
    name: "Factorization",
    type: "factorization",
    shape: "tuple<list<number>, list<integer>>",
    id: "factorization",
    plural: "Factorizations",
  },
  {
    name: "GaussianFractional",
    type: "gaussian_fractional",
    shape: "tuple<fractional_number, fractional_number>",
    id: "gaussian_fractional",
    plural: "GaussianFractionals",
  },
  {
    name: "GaussianInteger",
    type: "gaussian_integer",
    shape: "tuple<integer, integer>",
    id: "gaussian_integer",
    plural: "GaussianIntegers",
  },
  {
    name: "GaussianRational",
    type: "gaussian_rational",
    shape: "tuple<rational_number, rational_number>",
    id: "gaussian_rational",
    plural: "GaussianRationals",
  },
  {
    name: "GoldbachPartition",
    type: "goldbach_partition",
    shape: "tuple<integer, integer>",
    id: "goldbach_partition",
    plural: "GoldbachPartitions",
  },
  {
    name: "IntegerFactorization",
    type: "integer_factorization",
    shape: "tuple<boolean, list<number>, list<integer>>",
    id: "integer_factorization",
    plural: "IntegerFactorizations",
  },
  {
    name: "PythagoreanTriple",
    type: "pythagorean_triple",
    shape: "tuple<integer, integer, integer>",
    id: "pythagorean_triple",
    plural: "PythagoreanTriples",
  },
  {
    name: "SquareDecomposition",
    type: "square_decomposition",
    shape: "tuple<number, number>",
    id: "square_decomposition",
    plural: "SquareDecompositions",
  },
];
