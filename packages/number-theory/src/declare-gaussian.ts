import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  mayBeInteger,
  operandsOf,
  optionsOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { invMod } from "./arith.ts";
import { gaussianAt, gaussianExpression, isComplexGaussian } from "./boxed-gaussian.ts";
import {
  divisorsGaussian,
  extendedGcd,
  factorGaussian,
  type Gaussian,
  gcd,
  inverseMod,
  isGaussianPrime,
  isReal,
  lcm,
  mod,
  quotient,
} from "./gaussian.ts";

// compute-engine's integer heads, carried into ℤ[i] the way Wolfram carries them: a Gaussian
// argument switches Mod, Quotient, GCD, LCM, ExtendedGCD and ModularInverse over on its own,
// and `GaussianIntegers -> True` asks IsPrime, FactorInteger and Divisors to read a rational
// integer in ℤ[i] (5 = (2 + i)(2 − i) is no longer prime). Each native head keeps its own
// handler for everything else: the signature is widened in place and the Gaussian case is
// attached in front.

type Ops = readonly BoxedExpression[];

/** Every operand a Gaussian integer, and at least one of them off the real line. */
const gaussianCall = (ops: Ops): Gaussian[] | undefined => {
  const values = ops.map(gaussianAt);
  if (values.some((z) => z === undefined) || !ops.some(isComplexGaussian)) return undefined;
  return values as Gaussian[];
};

/**
 * The `GaussianIntegers` option among the trailing rules: true, false, or undefined when absent.
 * Any other option leaves the call alone.
 */
function gaussianOption(head: string, ops: Ops): { positional: number; value?: boolean } | "other" {
  const split = optionsOf([head, ...ops.map((op) => op.json)] as never);
  const names = Object.keys(split.options);
  if (names.some((name) => name !== "GaussianIntegers")) return "other";
  const setting = split.options.GaussianIntegers;
  return {
    positional: split.ops.length,
    value: setting === undefined ? undefined : setting === "True",
  };
}

export function declareGaussian(ce: ComputeEngine): void {
  const list = (items: readonly BoxedExpression[]): BoxedExpression => ce.function("List", items);
  const g = (z: Gaussian | undefined): BoxedExpression | undefined =>
    z === undefined ? undefined : gaussianExpression(ce, z);

  widenSignature(ce, "Mod", "(number, number) -> number");
  wrapOperator(
    ce,
    ["Mod", 1, 1],
    (ops) => gaussianCall(ops) !== undefined,
    () => (ops) => {
      const [z, m] = gaussianCall(ops)!;
      return g(mod(z!, m!));
    },
  );

  // Wolfram's Quotient: ⌊m/n⌋ for integers, z/m rounded half-even for Gaussian integers.
  ce.declare("Quotient", {
    description:
      "The integer quotient of m by n: ⌊m/n⌋ for integers; for Gaussian integers, m/n rounded to the nearest lattice point, ties to even.",
    signature: "(number, number) -> number",
    evaluate: (ops: Ops) => {
      const gaussian = gaussianCall(ops);
      if (gaussian !== undefined) return g(quotient(gaussian[0]!, gaussian[1]!));
      const [m, n] = ops.map(gaussianAt);
      if (m === undefined || n === undefined || n[0] === 0n) return undefined;
      const [a, b] = [m[0], n[0]];
      const q = a / b;
      return ce.number(q * b !== a && a < 0n !== b < 0n ? q - 1n : q);
    },
  });

  for (const [head, fold] of [
    ["GCD", gcd],
    ["LCM", lcm],
  ] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => gaussianCall(ops) !== undefined,
      () => (ops) => g(gaussianCall(ops)!.reduce((acc, z) => fold(acc, z))),
    );
  }

  widenSignature(
    ce,
    "ExtendedGCD",
    "(number, number) -> tuple<number, number, number>",
    mayBeInteger,
  );
  wrapOperator(
    ce,
    ["ExtendedGCD", 1, 1],
    (ops) => gaussianCall(ops) !== undefined,
    () => (ops) => {
      const [a, b] = gaussianCall(ops)!;
      return ce.function(
        "Tuple",
        extendedGcd(a!, b!).map((z) => gaussianExpression(ce, z)),
      );
    },
  );

  // Two arguments are the integer/Gaussian inverse, answered here outright: @enumeratio/modular
  // re-declares ModularInverse for PSL(2, ℤ) matrices (one argument), which drops the native
  // integer handler — so the one-argument form keeps whatever handler is current.
  widenSignature(ce, "ModularInverse", "(value, value?) -> value");
  wrapOperator(
    ce,
    ["ModularInverse", 1, 1],
    (ops) => ops.length === 2 && ops.every((op) => gaussianAt(op) !== undefined),
    () => (ops) => {
      const [a, m] = ops.map(gaussianAt) as [Gaussian, Gaussian];
      if (!isReal(a) || !isReal(m)) return g(inverseMod(a, m));
      if (m[0] === 0n) return undefined;
      const n = m[0] < 0n ? -m[0] : m[0];
      const inverse = invMod(a[0], n);
      // Wolfram's sign convention: the inverse takes the sign of the modulus.
      return inverse === undefined
        ? undefined
        : ce.number(m[0] < 0n && inverse !== 0n ? inverse - n : inverse);
    },
  );

  // The option heads. A complex argument is read in ℤ[i] as it stands; a rational integer
  // only when asked. `GaussianIntegers -> False` (or no option) is the native call.
  const optionHead = (
    head: string,
    signature: string,
    native: ((op: BoxedExpression) => boolean) | undefined,
    answer: (z: Gaussian) => BoxedExpression | undefined,
  ): void => {
    widenSignature(ce, head, signature, native);
    const definition = ce.lookupDefinition(head);
    const operator =
      definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator === undefined) return;
    // A rule canonicalises to a Tuple, which a broadcastable head would thread over.
    const flags = operator as { broadcastExemptions: readonly string[] };
    if (!flags.broadcastExemptions.includes("tuples")) {
      flags.broadcastExemptions = [...flags.broadcastExemptions, "tuples"];
    }
    const nativeEvaluate = operator.evaluate;
    const evaluate: typeof operator.evaluate = (ops, options) => {
      const option = gaussianOption(head, ops);
      if (option === "other" || option.positional !== 1) return undefined;
      // With the tuple exemption the engine no longer threads a list for us.
      if (ops[0]?.operator === "List") {
        return list(operandsOf(ops[0]).map((item) => evaluate!([item, ...ops.slice(1)], options)!));
      }
      const z = gaussianAt(ops[0]);
      if (z !== undefined && (z[1] !== 0n || option.value === true)) return answer(z);
      return nativeEvaluate?.(ops.slice(0, 1), options);
    };
    operator.evaluate = evaluate;
  };

  optionHead("IsPrime", "(number, any*) -> boolean", undefined, (z) =>
    ce.symbol(isGaussianPrime(z) ? "True" : "False"),
  );
  optionHead("FactorInteger", "(number, any*) -> list", mayBeInteger, (z) => {
    const factors = factorGaussian(z);
    return factors === undefined
      ? undefined
      : list(
          factors.map(([p, e]) => ce.function("Tuple", [gaussianExpression(ce, p), ce.number(e)])),
        );
  });
  optionHead("Divisors", "(number, any*) -> list", mayBeInteger, (z) => {
    const divisors = divisorsGaussian(z);
    return divisors === undefined
      ? undefined
      : list(divisors.map((d) => gaussianExpression(ce, d)));
  });
}
