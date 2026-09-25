import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import type { Json } from "./bernoulli.ts";
import type { BoxInput } from "./box.ts";

// Arbitrary-precision ζ(s, a), as an EXPRESSION rather than as a second kernel.
//
// The double-precision Euler–Maclaurin in hurwitz-zeta.ts stops at ~1e-15, which is all a
// double holds. The same Euler–Maclaurin written in MathJSON does not: every piece of it is
// a compute-engine head that already carries bignums — a finite `Sum`, `Power`, `Pochhammer`,
// exact-rational `BernoulliB`, `Factorial` — so the engine evaluates it to whatever precision
// was asked for. Slower by a factor of tens, and only reached when someone has asked for more
// than a double can carry.
//
//   ζ(s, a) = Σ_{k<N} (k+a)^{-s} + (N+a)^{1-s}/(s-1) + ½(N+a)^{-s}
//             + Σ_{j=1}^{M} B_{2j}/(2j)! · (s)_{2j-1} · (N+a)^{-s-2j+1}
//
// The truncation is what makes it an approximation rather than the definition — see
// definitions.ts for the definition. N and M are chosen from the working precision; the
// pair below holds every digit the engine asks for at 21, 40 and 80 (tests/definitions.test.ts).
//
// Left of Re(s) = 1 the direct sum and the integral term grow like (N+a)^(1−s) and cancel
// down to the answer — for Re(s) ≪ 0 most of the digits. So the series is carried at the
// requested precision plus that loss, measured against the result it came out to.

/** Above this many digits a double is no longer the limiting factor — and neither should we be. */
export const DOUBLE_DIGITS = 15;

/** How far to take the direct sum and the Bernoulli tail for `digits` correct digits. */
function truncation(digits: number, magnitudeOfS: number): { terms: number; pairs: number } {
  return {
    terms: Math.max(10, Math.ceil(digits * 1.2) + Math.ceil(magnitudeOfS) + 5),
    pairs: Math.ceil(digits / 3) + 4,
  };
}

/** ζ(s, a) as Euler–Maclaurin in MathJSON, truncated for `digits` digits. */
export function hurwitzZetaExpr(s: Json, a: Json, magnitudeOfS: number, digits: number): Json {
  const { terms, pairs } = truncation(digits, magnitudeOfS);
  const edge: Json = ["Add", terms, a];
  const twoJ: Json = ["Multiply", 2, "j"];
  return [
    "Add",
    ["Sum", ["Power", ["Add", "k", a], ["Negate", s]], ["Triple", "k", 0, terms - 1]],
    ["Divide", ["Power", edge, ["Subtract", 1, s]], ["Subtract", s, 1]],
    ["Divide", ["Power", edge, ["Negate", s]], 2],
    [
      "Sum",
      [
        "Multiply",
        ["Divide", ["BernoulliB", twoJ], ["Factorial", twoJ]],
        ["Pochhammer", s, ["Subtract", twoJ, 1]],
        ["Power", edge, ["Subtract", ["Negate", s], ["Subtract", twoJ, 1]]],
      ],
      ["Triple", "j", 1, pairs],
    ],
  ];
}

/**
 * ζ(s, a) to the engine's precision, or undefined when this route does not apply — the
 * engine is working within a double, an operand is complex, a ≤ 0 (the direct terms would
 * cross the branch cut), or the sum did not come out a number.
 *
 * Real operands only: a compute-engine complex number is a pair of doubles, so there is no
 * precision to win there.
 */
export function preciseHurwitzZeta(
  ce: ComputeEngine,
  s: BoxedExpression,
  a: BoxedExpression,
): BoxedExpression | undefined {
  if (ce.precision <= DOUBLE_DIGITS) return undefined;
  if (s.im !== 0 || a.im !== 0 || !Number.isFinite(s.re) || !Number.isFinite(a.re))
    return undefined;
  if (a.re <= 0 || s.re === 1) return undefined;

  const target = ce.precision;
  const magnitudeOfS = Math.abs(s.re);
  const sJson = s.json as unknown as Json;
  const aJson = a.json as unknown as Json;
  // Carry the digits cancellation will take from an O(1) result, then check against the size
  // the result actually came out; short of them, carry more and go again.
  let working = digitsNeeded(target, s.re, magnitudeOfS, a.re, 1);
  for (let attempt = 0; attempt < 4; attempt++) {
    const expr = hurwitzZetaExpr(sJson, aJson, magnitudeOfS, working);
    const value = withPrecision(ce, working, () => ce.box(expr as unknown as BoxInput).N());
    if (!isNumber(value)) return undefined;
    const needed = digitsNeeded(target, s.re, magnitudeOfS, a.re, value.re);
    if (needed <= working) return atEnginePrecision(ce, value);
    working = needed;
  }
  return undefined;
}

/**
 * Working digits for `target` correct ones, given a result of size `result`. More digits
 * lengthen the direct sum, which loses a little more, so this settles on a fixed point.
 */
function digitsNeeded(
  target: number,
  sigma: number,
  magnitudeOfS: number,
  a: number,
  result: number,
): number {
  let working = target;
  for (let i = 0; i < 8; i++) {
    const { terms } = truncation(working, magnitudeOfS);
    const next = target + cancellation(sigma, terms + a, result) + GUARD_DIGITS;
    if (next <= working) break;
    working = next;
  }
  return working;
}

/** Digits kept past the predicted loss, for the estimate being one. */
const GUARD_DIGITS = 5;

/**
 * Digits lost to cancellation: the largest piece of the sum against the result. Right of
 * Re(s) = 1 nothing cancels; left of it the direct sum and the (N+a)^(1−s)/(s−1) tail grow
 * like (N+a)^(1−σ) to meet in an O(1) answer, and far left that is most of the digits.
 */
function cancellation(sigma: number, edge: number, result: number): number {
  if (sigma >= 1) return 0;
  const largest = (1 - sigma) * Math.log10(edge) - Math.log10(Math.abs(sigma - 1));
  const size = Math.log10(Math.abs(result));
  if (size === Number.POSITIVE_INFINITY) return 0;
  // An exact 0 (or NaN) can't be sized: carry every digit the largest piece has, and some.
  if (!Number.isFinite(size)) return Math.ceil(largest) + 2 * GUARD_DIGITS;
  return Math.max(0, Math.ceil(largest - size));
}

/** `run()` with the engine carrying `digits`, restored after. Each change purges its caches. */
function withPrecision<T>(ce: ComputeEngine, digits: number, run: () => T): T {
  const was = ce.precision;
  if (digits === was) return run();
  ce.precision = digits;
  try {
    return run();
  } finally {
    ce.precision = was;
  }
}

/**
 * `value` rounded to the digits the engine was actually asked for, or undefined if it is not
 * a number at all.
 *
 * compute-engine lets a bignum product carry more digits than its operands had — real for
 * `Sin(1)·Cos(1)`, and worse for anything we assemble out of natives, where the tail is the
 * truncation error rather than merely unwarranted. A head should hand back the precision it
 * claims and no more, so every routed result goes through here.
 */
export function atEnginePrecision(
  ce: ComputeEngine,
  value: BoxedExpression,
): BoxedExpression | undefined {
  if (!isNumber(value)) return undefined;
  const big = value.bignumRe;
  return big === undefined ? value : ce.number(big.toPrecision(ce.precision));
}
