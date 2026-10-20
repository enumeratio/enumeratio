import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { evaluateLerch, principalAtZero } from "../compute-engine/library/special-functions.ts";
import type { BoxedExpression } from "@cortex-js/compute-engine";
import { isFiniteNum, wantsNumber } from "../support/box.ts";

// compute-engine evaluates LerchPhi natively, exactly for rational arguments and to the engine's
// precision at real ones, but declines a result it can't vouch for relative digits of, which
// leaves the exact zeros on the unit circle unevaluated at a float argument (Φ(−1, −1, 0.5) = 0).
// The native handler answers first and this answers where it declines, except Φ(0, s, a) at a
// negative or complex a and a non-integer s: native reads that as a real root, so this answers
// first, with the principal branch.
/** The engine's default `precision`, which a double-based kernel is allowed to answer at. */
let defaultPrecision: number | undefined;
const defaultDigits = (): number => (defaultPrecision ??= new ComputeEngine().precision);

/**
 * Native's double kernel answers a real z < −1 at a negative a with an imaginary part that is
 * rounding noise of the real part (observed to ~4e-14 of the modulus, e.g. Φ(−900000, −1e−12, −3)
 * gives −29054i against a true +2.5i). Φ(z, s, a) = Σ_{n<−a} zⁿ(n+a)^−s + z^N·Φ(z, s, a+N), and the
 * tail is real for z < 1, so for real z, s, a the imaginary part is exactly
 * −sin(πs)·Σ_{n<−a} zⁿ(−a−n)^−s. When that sum is below the noise floor (or too cancelled to
 * resolve) native's complex answer can't be trusted.
 */
const noiseFloor = 1e-13;
const unresolvableImaginary = (ops: readonly BoxedExpression[], answer: BoxedExpression): boolean => {
  const [z, s, a] = ops;
  if (z === undefined || s === undefined || a === undefined) return false;
  if (![z, s, a].every((x) => isFiniteNum(x) && x.im === 0)) return false;
  if (!(z.re < -1 && a.re < 0 && Math.ceil(-a.re) <= 1000)) return false;
  const sinPiS = Math.sin(Math.PI * s.re);
  if (Number.isInteger(s.re) || !Number.isFinite(answer.re) || !Number.isFinite(answer.im)) return false;
  let sum = 0;
  let largest = 0;
  for (let n = 0; n < -a.re; n++) {
    const term = z.re ** n * (-a.re - n) ** -s.re;
    if (!Number.isFinite(term)) return false;
    sum += term;
    largest = Math.max(largest, Math.abs(term));
  }
  // Too cancelled for the double sum to resolve its own value.
  if (Math.abs(sum) < 1e-6 * largest) return true;
  return Math.abs(sinPiS * sum) < noiseFloor * Math.hypot(answer.re, answer.im);
};

export const lerchPhiPatch: Patch = {
  id: "lerch-phi",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands:
    "LerchPhi(z, s, a) on the unit circle where it is exactly 0, and Φ(0, s, a) at a negative a on the principal branch",
  files: ["src/compute-engine/numerics/lerch-phi-big.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["LerchPhi"],

  fixed: (ce) =>
    ce
      .box(["LerchPhi", -1, -1, ["Rational", 1, 2]])
      .N()
      .is(0) &&
    ce.box(["LerchPhi", -1, -1, 0.5]).N().is(0) &&
    ce.box(["LerchPhi", 0, 2.976, -2.664]).N().im !== 0,

  // No compile stance: at those zeros this gives 0 where the built-in lowering gives its own limit.
  apply: (ce) =>
    wrapOperator(
      ce,
      ["LerchPhi"],
      () => true,
      (native) => (ops, options) => {
        // Native reads a negative base to a float power as a real root.
        if (principalAtZero(ops, wantsNumber(ops, options)))
          // The kernel is a double's worth: past the engine's default digits, stay unevaluated.
          return ce.precision > defaultDigits() ? undefined : evaluateLerch(ce, ops, true);
        const answer = native?.(ops, options);
        if (answer !== undefined && answer.operator !== "LerchPhi")
          // Decline rather than answer an imaginary part that is rounding noise.
          return unresolvableImaginary(ops, answer) ? undefined : answer;
        return evaluateLerch(ce, ops, wantsNumber(ops, options)) ?? answer;
      },
    ),
};

export {
  evaluateLerch,
  lerchPhi,
  lerchPhiReal,
  lerchContinued,
  lerchPhiBig,
  lerchPhiBall,
} from "../compute-engine/library/special-functions.ts";
