import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  operandsOf,
  threadOverLists,
  wrapOperator,
} from "@enumeratio/boxed";
import { valuation } from "@enumeratio/residues";
import { gaussianAt, gaussianExpression, isComplexGaussian } from "./boxed-gaussian.ts";
import { declareBacklog } from "./declare-backlog.ts";
import { declareGaussian } from "./declare-gaussian.ts";
import { declareWidened } from "./declare-widened.ts";
import { gaussianPowerModList } from "./gaussian-roots.ts";
import { type Gaussian, powerMod as gaussianPowerMod } from "./gaussian.ts";
import { hermiteDecomposition } from "./hermite.ts";
import { rationalReconstruction } from "./reconstruct.ts";

// Number theory past ℤ/m, on top of @enumeratio/residues (declare that first): PowerMod and
// PowerModList reach ℤ[i], plus rational reconstruction, integer valuations and Hermite
// normal form. Every head stays unevaluated — never approximate — when it cannot answer.

export function declareNumberTheory(ce: ComputeEngine): void {
  declareGaussian(ce);
  declareWidened(ce);
  declareBacklog(ce);

  // compute-engine's integer functions reject a list argument with a type error (or leave
  // the call unevaluated); Wolfram's thread over it: Totient([2, 4, 6]) is [1, 2, 2].
  threadOverLists(ce, [
    "Totient",
    "NextPrime",
    "NthPrime",
    "PrimePi",
    "FactorInteger",
    "Divisors",
    "PrimeNu",
    "PrimeOmega",
    "MoebiusMu",
    "IsSquareFree",
    "JacobiSymbol",
    "KroneckerSymbol",
    "Multinomial",
    "CatalanNumber",
    "Subfactorial",
    "StirlingS1",
    "BellNumber",
    "Fibonacci",
    "LucasL",
    "CarmichaelLambda",
    "IsPerfect",
  ]);

  const list = (xs: readonly bigint[]): BoxedExpression =>
    ce.function(
      "List",
      xs.map((x) => ce.number(x)),
    );

  /** A call reaches into ℤ[i] when its base or modulus is a Gaussian integer off the real line. */
  const inGaussian = (ops: readonly BoxedExpression[]): boolean =>
    isComplexGaussian(ops[0]) || isComplexGaussian(ops[2]);

  /** The same list over ℤ[i] — beyond Wolfram, whose PowerModList stops at the integers. */
  const gaussianRoots = (ops: readonly BoxedExpression[]): Gaussian[] | undefined => {
    const [a, m] = [gaussianAt(ops[0]), gaussianAt(ops[2])];
    const exponent = bigRationalAt(ops[1]);
    if (a === undefined || m === undefined || exponent === undefined) return undefined;
    return gaussianPowerModList(a, exponent[0], exponent[1], m);
  };

  wrapOperator(ce, ["PowerModList", "a", "b", "m"], inGaussian, () => (ops) => {
    const found = gaussianRoots(ops);
    return found === undefined
      ? undefined
      : ce.function(
          "List",
          found.map((z) => gaussianExpression(ce, z)),
        );
  });

  wrapOperator(ce, ["PowerMod", "a", "b", "m"], inGaussian, () => (ops) => {
    const [z, m] = [gaussianAt(ops[0]), gaussianAt(ops[2])];
    const exponent = bigRationalAt(ops[1]);
    if (z === undefined || m === undefined || exponent === undefined) return undefined;
    if (exponent[1] === 1n) {
      const value = gaussianPowerMod(z, exponent[0], m);
      return value === undefined ? undefined : gaussianExpression(ce, value);
    }
    const found = gaussianRoots(ops);
    return found === undefined || found.length === 0
      ? undefined
      : gaussianExpression(ce, found[0]!);
  });

  ce.declare("RationalReconstruction", {
    description:
      "The fraction n/d with n ≡ a·d (mod m), |n| ≤ N and 0 < d ≤ D; by default the bounds with 2·N·D < m, where the answer is unique.",
    signature: "(integer, integer, integer?, integer?) -> rational",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [a, m, n, d] = [0, 1, 2, 3].map((i) => bigIntegerAt(ops[i]));
      if (a === undefined || m === undefined) return undefined;
      if ((ops[2] !== undefined && n === undefined) || (ops[3] !== undefined && d === undefined))
        return undefined;
      const found = rationalReconstruction(a, m, n, d);
      return found === undefined ? undefined : ce.number([found[0], found[1]]);
    },
  });

  // Wolfram's IntegerExponent[n, b]: the largest k with bᵏ | n; b defaults to 10, n = 0 gives
  // ∞. Integers only, as in Wolfram — a p-adic valuation of a rational is AdicValuation's.
  ce.declare("IntegerExponent", {
    description: "The largest k with bᵏ dividing n (b defaults to 10); ∞ for n = 0.",
    signature: "(integer, integer?) -> integer | number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const b = ops[1] === undefined ? 10n : bigIntegerAt(ops[1]);
      if (n === undefined || b === undefined || b < 2n) return undefined;
      if (n === 0n) return ce.symbol("PositiveInfinity");
      return ce.number(valuation(n, b)[0]);
    },
  });

  // Wolfram's HermiteDecomposition[m] = {u, h}: u unimodular, u·m = h in Hermite normal form.
  ce.declare("HermiteDecomposition", {
    description:
      "{u, h} with u unimodular and u·m = h upper triangular: positive pivots, entries above each pivot reduced into [0, pivot).",
    signature: "(list<list<integer>>) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const rows = operandsOf(ops[0]).map((row) => operandsOf(row).map(bigIntegerAt));
      const width = rows[0]?.length ?? 0;
      if (
        rows.length === 0 ||
        rows.some((row) => row.length !== width || row.some((x) => x === undefined))
      )
        return undefined;
      const { u, h } = hermiteDecomposition(rows as bigint[][]);
      const matrix = (x: bigint[][]): BoxedExpression =>
        ce.function(
          "List",
          x.map((row) => list(row)),
        );
      return ce.function("List", [matrix(u), matrix(h)]);
    },
  });
}
