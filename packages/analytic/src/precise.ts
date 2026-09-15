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
// definitions.ts for the definition. N and M are chosen from the requested precision; the
// pair below holds every digit the engine asks for at 21, 40 and 80 (tests/definitions.test.ts).

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

  const expr = hurwitzZetaExpr(
    s.json as unknown as Json,
    a.json as unknown as Json,
    Math.abs(s.re),
    ce.precision,
  );
  return atEnginePrecision(ce, ce.box(expr as unknown as BoxInput).N());
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
