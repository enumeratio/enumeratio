import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, operandsOf, type EvaluateOptions } from "@enumeratio/boxed";
import { gaussianAt, gaussianExpression, isComplexGaussian } from "./boxed-gaussian.ts";
import { declareGaussian } from "./declare-gaussian.ts";
import { gaussianPowerModList } from "./gaussian-roots.ts";
import { type Gaussian, powerMod as gaussianPowerMod } from "./gaussian.ts";
import { valuation } from "./arith.ts";
import { hermiteDecomposition } from "./hermite.ts";
import { discreteLog, multiplicativeOrder, primitiveRootList } from "./logs.ts";
import { rationalReconstruction } from "./reconstruct.ts";
import { powerModList } from "./roots.ts";

// Wiring ℤ/m to compute-engine. Every head answers over bigints and stays unevaluated —
// never approximate — when it cannot answer: no such residue, an unfactorable modulus, or
// more roots than it will list.
//
// PowerMod and MultiplicativeOrder are compute-engine's own heads, re-declared here for the
// forms Wolfram gives them and compute-engine lacks (a rational exponent; the list of
// targets). The native handler is captured first and still answers everything else.

type Native = ((ops: readonly BoxedExpression[], options: EvaluateOptions) => unknown) | undefined;

const nativeEvaluate = (ce: ComputeEngine, name: string): Native => {
  const definition = ce.lookupDefinition(name);
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  return operator?.evaluate as Native;
};

export function declareNumberTheory(ce: ComputeEngine): void {
  declareGaussian(ce);

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
  const gaussianList = (zs: readonly Gaussian[]): BoxedExpression =>
    ce.function(
      "List",
      zs.map((z) => gaussianExpression(ce, z)),
    );

  /** a^(s/r) mod m, as the list of every x with xʳ ≡ aˢ — the heart of both heads below. */
  const roots = (ops: readonly BoxedExpression[]): bigint[] | undefined => {
    const a = bigRationalAt(ops[0]);
    const exponent = bigRationalAt(ops[1]);
    const m = bigIntegerAt(ops[2]);
    if (a === undefined || exponent === undefined || m === undefined) return undefined;
    return powerModList(a, exponent[0], exponent[1], m);
  };

  // Wolfram's PowerModList[a, s/r, m]. Threads over lists, as Wolfram's does.
  ce.declare("PowerModList", {
    description:
      "Every x in [0, m) with x^r ≡ a^s (mod m), for an exponent s/r; a rational a = u/v reads as u·v⁻¹.",
    signature: "(number, number, number) -> list<number>",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (inGaussian(ops)) {
        const found = gaussianRoots(ops);
        return found === undefined ? undefined : gaussianList(found);
      }
      const found = roots(ops);
      return found === undefined ? undefined : list(found);
    },
  });

  // PowerMod with Wolfram's rational exponent — `PowerMod(a, 1/r, m)` is the least r-th
  // root — and a rational base. Integer forms go to the native handler unchanged.
  const nativePowerMod = nativeEvaluate(ce, "PowerMod");
  ce.declare("PowerMod", {
    description:
      "a^b mod m. A negative b inverts a; a rational b = s/r gives the least x with x^r ≡ a^s; a rational a = u/v reads as u·v⁻¹.",
    signature: "(number, number, number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      if (inGaussian(ops)) {
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
      }
      if (ops.every((op) => op.isInteger === true) && nativePowerMod !== undefined) {
        return nativePowerMod(ops, options) as BoxedExpression | undefined;
      }
      const found = roots(ops);
      return found === undefined || found.length === 0 ? undefined : ce.number(found[0]!);
    },
  });

  // MultiplicativeOrder[k, n, {r₁, …}]: the least m > 0 with kᵐ ≡ some rᵢ — a discrete log.
  ce.declare("MultiplicativeOrder", {
    description:
      "The least m > 0 with k^m ≡ 1 (mod n); with a list of targets, the least m with k^m ≡ any of them — a discrete logarithm.",
    signature: "(integer, integer, list<integer>?) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const k = bigIntegerAt(ops[0]);
      const n = bigIntegerAt(ops[1]);
      if (k === undefined || n === undefined) return undefined;
      if (ops[2] === undefined) {
        const order = multiplicativeOrder(k, n);
        return order === undefined ? undefined : ce.number(order);
      }
      const targets = operandsOf(ops[2]).map(bigIntegerAt);
      if (targets.some((t) => t === undefined)) return undefined;
      const log = discreteLog(k, n, targets as bigint[]);
      return log === undefined ? undefined : ce.number(log);
    },
  });

  ce.declare("PrimitiveRootList", {
    description: "Every primitive root of n, ascending — empty unless (ℤ/n)* is cyclic.",
    signature: "(integer) -> list<integer>",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const found = n === undefined ? undefined : primitiveRootList(n);
      return found === undefined ? undefined : list(found);
    },
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
