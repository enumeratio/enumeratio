import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, widenSignature, wrapOperator } from "@enumeratio/boxed";

// #113 arithmetic-head extensions that don't belong to any single family, and are kept
// OUT of packages/analytic on purpose:
//
//  - Rationalize(x, 0): the simplest rational exactly equal to a machine double. This is
//    a SEPARATE call form from packages/analytic/src/precision-113.ts' `Rationalize(x,
//    dx)` (PR #146), which is guarded on a concrete POSITIVE dx and explicitly declines a
//    non-positive tolerance ("leave to native"). Ours picks up exactly there: 2 operands,
//    dx === 0. The two wrappers chain by `wrapOperator`'s capture-order composition --
//    whichever of this file and precision-113.ts attaches second sees the other as its
//    `native` fallback -- and since their `applies` gates are disjoint (dx > 0 vs dx ===
//    0), which one is declared first doesn't matter; each only ever answers its own case.
//
//  - Floor/Ceil/Round of a Complex number: round the real and imaginary parts
//    separately. Disjoint from packages/analytic/src/constant-rounding.ts' wrappers on
//    the same three heads, which are guarded on `ops.length === 1` with a REAL exact
//    constant (Pi, a Sqrt, …) -- `looksConstant` there never matches a `Complex` node, so
//    the two never compete for the same call.
//
//  - Sign of an exact real numeric expression (a Sqrt/rational tree with no free
//    variable) that compute-engine's native Sign leaves unevaluated: certified by
//    bumping `ce.precision` and re-evaluating in bignum, never by trusting a single
//    double-precision `.N()`.

/** Operators an exact, symbol-free numeric expression is built from -- the same shape
 *  `looksConstant` in constant-rounding.ts checks, but this module can't import that
 *  package (boundary), so it keeps its own copy local to what it needs. */
const NUMERIC_HEADS = new Set(["Negate", "Add", "Subtract", "Multiply", "Divide", "Power", "Sqrt"]);

// ─── Rationalize(x, 0) ────────────────────────────────────────────────────────────────

/**
 * The exact `[numerator, denominator]` a finite JS double denotes. Every finite double is
 * a dyadic rational (significand × 2^e); repeatedly doubling `m` until it lands on an
 * integer finds that exact `e` without ever rounding -- doubling a double is exact until
 * overflow, unlike scaling by a decimal power of ten would be. Bounded at 1075 doublings
 * (the smallest subnormal's exponent, -1074), so it always terminates for a finite input.
 */
function exactRationalOfDouble(x: number): [bigint, bigint] {
  if (x === 0) return [0n, 1n];
  const negative = x < 0;
  let m = Math.abs(x);
  let shifts = 0;
  while (!Number.isInteger(m) && shifts < 1100) {
    m *= 2;
    shifts++;
  }
  let numerator = BigInt(m);
  let denominator = 1n << BigInt(shifts);
  while (numerator % 2n === 0n && denominator > 1n) {
    numerator /= 2n;
    denominator /= 2n;
  }
  return [negative ? -numerator : numerator, denominator];
}

function declareExactRationalize(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Rationalize", 2],
    (ops) => {
      if (ops.length !== 2) return false;
      const [x, tol] = ops;
      if (x === undefined || tol === undefined) return false;
      if (tol.im !== 0 || tol.re !== 0) return false; // dx must be EXACTLY 0
      return bigRationalAt(x) === undefined; // an already-exact x is returned unchanged
    },
    () => (ops, options) => {
      const x = ops[0]!.N().re;
      if (x === undefined || !Number.isFinite(x)) return undefined;
      const [p, q] = exactRationalOfDouble(x);
      const expr = q === 1n ? ce.number(p) : ce.function("Rational", [ce.number(p), ce.number(q)]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
  );
}

// ─── Floor/Ceil/Round of a Complex number ──────────────────────────────────────────────

function declareComplexRounding(ce: ComputeEngine): void {
  // Floor/Ceil already accept `any` (packages/collections/src/rounding-heads.ts widens
  // them for the (x, step) call form); Round's native signature stays real-only until
  // widened here too, or boxing a Complex operand fails before `evaluate` ever runs.
  widenSignature(ce, "Round", "(any, any?) -> any");
  for (const [name, round] of [
    ["Floor", Math.floor],
    ["Ceil", Math.ceil],
    ["Round", (v: number) => (v >= 0 ? Math.floor(v + 0.5) : Math.ceil(v - 0.5))],
  ] as const) {
    wrapOperator(
      ce,
      [name, 1],
      (ops) => ops.length === 1 && ops[0]?.operator === "Complex",
      () => (ops) => {
        const z = ops[0]!.N();
        if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return undefined;
        const re = round(z.re);
        const im = round(z.im ?? 0);
        return im === 0 ? ce.number(re) : ce.function("Complex", [re, im]).evaluate();
      },
    );
  }
}

// ─── Sign of an exact numeric expression ───────────────────────────────────────────────

/**
 * The sign of a real, symbol-free numeric expression, certified rather than guessed: bump
 * `ce.precision` and re-evaluate in bignum, and only trust the sign once it reproduces
 * unchanged at double the precision. A single-precision `.N()` can't tell a genuinely
 * negative value like $\sqrt2-2$ from rounding noise around zero; two independent bignum
 * evaluations agreeing is what "certified" means here. Returns `undefined` (declines,
 * falling through to native) rather than a wrong answer when it can't confirm.
 */
function certifiedSign(ce: ComputeEngine, x: BoxedExpression): -1 | 0 | 1 | undefined {
  const saved = ce.precision;
  try {
    let digits = Math.max(saved, 30);
    for (let round = 0; round < 6; round++) {
      ce.precision = digits;
      const re1 = x.N().re;
      ce.precision = digits * 2;
      const re2 = x.N().re;
      if (re1 !== undefined && re2 !== undefined && re1 === 0 && re2 === 0) return 0;
      if (
        re1 !== undefined &&
        re2 !== undefined &&
        Number.isFinite(re1) &&
        Number.isFinite(re2) &&
        re1 !== 0 &&
        re2 !== 0 &&
        Math.sign(re1) === Math.sign(re2)
      ) {
        return Math.sign(re1) as -1 | 1;
      }
      digits *= 4;
    }
    return undefined;
  } finally {
    ce.precision = saved;
  }
}

function declareExactSign(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Sign", 1],
    (ops) => {
      if (ops.length !== 1 || ops[0] === undefined) return false;
      const op = ops[0];
      if (!NUMERIC_HEADS.has(op.operator ?? "")) return false;
      // `.re`/`.im` on an un-evaluated exact expression like Subtract(Sqrt(2), 2) read
      // as NaN -- compute-engine only fills them in once something forces a numeric
      // approximation. `.N()` is that force; a real result here is what "no free
      // variable, no imaginary part" actually means for a call this shape hasn't
      // resolved on its own.
      const n = op.N();
      return n.im === 0 && Number.isFinite(n.re);
    },
    () => (ops, options) => {
      const sign = certifiedSign(ce, ops[0]!);
      if (sign === undefined) return undefined;
      const result = ce.number(sign);
      return options.numericApproximation ? result.N() : result;
    },
  );
}

export function declareArithHeads(ce: ComputeEngine): void {
  declareExactRationalize(ce);
  declareComplexRounding(ce);
  declareExactSign(ce);
}
