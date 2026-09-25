import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, widenSignature, wrapOperator } from "@enumeratio/boxed";

// compute-engine's integer functions, widened to the arguments Wolfram also answers and the
// native handler leaves unevaluated or rejects: φ(0), σ of a negative order, the GCD and LCM
// of rationals, and Mod's offset. Each wrapper applies only to what the native handler does
// not answer, so no result compute-engine already gives changes.

type Ops = readonly BoxedExpression[];

const abs = (n: bigint): bigint => (n < 0n ? -n : n);
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? abs(a) : gcd(b, a % b));
const lcm = (a: bigint, b: bigint): bigint => (a === 0n || b === 0n ? 0n : abs(a * b) / gcd(a, b));

/** Every operand as a rational, when all are and at least one is not an integer. */
const properRationals = (ops: Ops): (readonly [bigint, bigint])[] | undefined => {
  const values = ops.map(bigRationalAt);
  if (values.some((q) => q === undefined)) return undefined;
  const rationals = values as (readonly [bigint, bigint])[];
  return rationals.some(([, den]) => den !== 1n) ? rationals : undefined;
};

export function declareWidened(ce: ComputeEngine): void {
  // Wolfram's EulerPhi[0] is 0; compute-engine asks for a positive integer.
  wrapOperator(
    ce,
    ["Totient", 1],
    (ops) => bigIntegerAt(ops[0]) === 0n,
    () => () => ce.Zero,
  );

  // σₖ(n) for k < 0 is σ₋ₖ(n) / n⁻ᵏ — the sum of 1/dᵏ over the divisors d of n.
  wrapOperator(
    ce,
    ["DivisorSigma", 1, 1],
    (ops) => {
      const [k, n] = ops.map(bigIntegerAt);
      return k !== undefined && k < 0n && n !== undefined && n > 0n;
    },
    () => (ops) => {
      const [k, n] = ops;
      return ce
        .function("Divide", [
          ce.function("DivisorSigma", [k!.neg(), n!]),
          ce.function("Power", [n!, k!.neg()]),
        ])
        .evaluate();
    },
  );

  // Over the rationals: gcd(p/q, …) = gcd(p, …)/lcm(q, …), and lcm(p/q, …) = lcm(p, …)/gcd(q, …) —
  // the largest rational whose integer multiples include all of them, and the smallest
  // positive one that is an integer multiple of each.
  for (const [head, onNumerators, onDenominators] of [
    ["GCD", gcd, lcm],
    ["LCM", lcm, gcd],
  ] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => properRationals(ops) !== undefined,
      () => (ops) => {
        const rationals = properRationals(ops)!;
        const num = rationals.map(([p]) => p).reduce(onNumerators);
        const den = rationals.map(([, q]) => q).reduce(onDenominators);
        return ce.number([num, den]);
      },
    );
  }

  // Wolfram's Mod[m, n, d]: the x ≡ m (mod n) with d ≤ x < d + n. The operand types stay
  // `number` so the Gaussian Mod (declare-gaussian.ts) still reaches its handler.
  widenSignature(ce, "Mod", "(number, number, number?) -> number");
  wrapOperator(
    ce,
    ["Mod", 1, 1],
    (ops) => ops.length === 3,
    () => (ops) => {
      const [m, n, d] = ops.map(bigIntegerAt);
      if (m === undefined || n === undefined || d === undefined || n === 0n) return undefined;
      const r = (m - d) % n;
      return ce.number(d + (r !== 0n && r < 0n !== n < 0n ? r + n : r));
    },
  );
}
