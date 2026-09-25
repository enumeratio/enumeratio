import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf, widenSignature, wrapOperator } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// Issue #113's remaining elementary backlog (excluding every Interval/CenteredInterval/Around
// example, owned by another lane): parity and reflection identities for Cos/Tan/Cot/Sec/Csc/
// Arcsin/Arccos/Arctan/Sinh/Cosh/Tanh/Arcoth/Arcsch, the inverse-composition identities
// (Sin(Arcsin(x)) = x and friends), an imaginary argument for Cos/Tan (mirroring Sin(ix) =
// i*sinh(x) in trig-normalisation.ts), Arccos(Cos(y))'s range reduction over one period,
// TrigToExp's logarithmic forms for Arcsin/Arctan/Arcoth/Arcsch, Tanh(ComplexInfinity) = NaN,
// Arsech at 1 and past its branch point, Ln/Log2/Log10/Lb at ComplexInfinity, Ln of an exact
// unit fraction, and Log2/Log10/Lb (and two-argument Log) of an exact rational power of their
// base below 1. Declared by `declareAnalytic`.
//
// Attaches to heads other files in this package already touch (Sin, Sinh, Cosh, Tanh) via a
// separate `wrapOperator` call each -- `wrapOperator` chains by capturing whatever `evaluate`
// is current, so a second attach here layers on top without editing trig-normalisation.ts or
// elementary-special-values.ts, and the two files' predicates never overlap (each only claims
// the argument shape it was written for).

/** Build then finish an expression the way the caller asked: N() for N(...), else evaluate(). */
const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

const neg = (ce: ComputeEngine, e: BoxedExpression | number | string) => ce.function("Negate", [e]);
const sqrt = (ce: ComputeEngine, e: BoxedExpression | number | string) => ce.function("Sqrt", [e]);
const oneMinusSquare = (ce: ComputeEngine, x: BoxedExpression) =>
  ce.function("Add", [1, neg(ce, ce.function("Power", [x, 2]))]);
const onePlusSquare = (ce: ComputeEngine, x: BoxedExpression) =>
  ce.function("Add", [ce.function("Power", [x, 2]), 1]);

/** A Multiply with a purely-imaginary numeric factor -- compute-engine folds a literal `i`
 * factor into a concrete `Complex(0, k)` coefficient rather than keeping `ImaginaryUnit`
 * itself as an operand, so this looks for that, same as trig-normalisation.ts. */
const isImaginaryLiteral = (op: BoxedExpression): boolean =>
  op.operator === "Complex" && op.re === 0 && op.im !== 0;

const hasImaginaryFactor = (op: BoxedExpression): boolean =>
  op.operator === "Multiply" && operandsOf(op).some(isImaginaryLiteral);

/** ComplexInfinity is a numeric value (its own `.symbol` is undefined -- it is not boxed as
 * a plain Symbol node), unlike the signed `PositiveInfinity`/`NegativeInfinity`: all three
 * have `isInfinity === true`, but only complex infinity's imaginary part is itself infinite. */
const isComplexInfinity = (op: BoxedExpression): boolean =>
  op.isInfinity === true && !Number.isFinite(op.im);

/** t, given op = i*t: dividing back out by i is exact, letting compute-engine's own
 * arithmetic re-fold the real coefficient. Only called once `hasImaginaryFactor` says yes. */
const imaginaryFactor = (ce: ComputeEngine, op: BoxedExpression): BoxedExpression =>
  ce.function("Divide", [op, "ImaginaryUnit"]).evaluate();

/**
 * Negate/parity table: `op(-x) = sign * op(x)`, or (for Arccos) the reflection
 * `Arccos(-x) = Pi - Arccos(x)`. Every one of these is an identity by construction (the
 * defining series/branch of each head is odd or even), so it holds for every complex x, not
 * only the reals the caption talks about.
 */
function declareParity(ce: ComputeEngine): void {
  const odd = ["Tan", "Cot", "Csc", "Arcsin", "Arctan", "Sinh", "Tanh", "Arcoth", "Arcsch"];
  const even = ["Cos", "Sec", "Cosh"];
  for (const head of odd) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => ops.length === 1 && ops[0]?.operator === "Negate",
      () => (ops, options) =>
        finish(neg(ce, ce.function(head, [operandsOf(ops[0]!)[0]!])), options),
    );
  }
  for (const head of even) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => ops.length === 1 && ops[0]?.operator === "Negate",
      () => (ops, options) => finish(ce.function(head, [operandsOf(ops[0]!)[0]!]), options),
    );
  }
  wrapOperator(
    ce,
    ["Arccos", 1],
    (ops) => ops.length === 1 && ops[0]?.operator === "Negate",
    () => (ops, options) => {
      const x = operandsOf(ops[0]!)[0]!;
      return finish(ce.function("Subtract", ["Pi", ce.function("Arccos", [x])]), options);
    },
  );
}

/** `f(f^{-1}(x)) = x`: exact for every x by construction (each inverse is defined as the
 * function whose composition with its forward partner is the identity), not only where the
 * caption's "for every x" happens to be visibly true on the reals. */
function declareInverseComposition(ce: ComputeEngine): void {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ["Sin", "Arcsin"],
    ["Cos", "Arccos"],
    ["Tan", "Arctan"],
    ["Sinh", "Arsinh"],
  ];
  for (const [outer, inner] of pairs) {
    wrapOperator(
      ce,
      [outer, 1],
      (ops) => ops.length === 1 && ops[0]?.operator === inner,
      () => (ops, options) => finish(operandsOf(ops[0]!)[0]!, options),
    );
  }
}

/** Cross compositions of a circular/hyperbolic function with the OTHER inverse: the
 * Pythagorean-identity shapes. `Sin(Arccos(x)) = sqrt(1 - x^2)` already lives in
 * trig-normalisation.ts; these are its remaining siblings. */
function declareCrossComposition(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Cos", 1],
    (ops) => ops.length === 1 && ops[0]?.operator === "Arcsin",
    () => (ops, options) => finish(sqrt(ce, oneMinusSquare(ce, operandsOf(ops[0]!)[0]!)), options),
  );
  wrapOperator(
    ce,
    ["Cos", 1],
    (ops) => ops.length === 1 && ops[0]?.operator === "Arctan",
    () => (ops, options) =>
      finish(
        ce.function("Divide", [1, sqrt(ce, onePlusSquare(ce, operandsOf(ops[0]!)[0]!))]),
        options,
      ),
  );
  wrapOperator(
    ce,
    ["Sin", 1],
    (ops) => ops.length === 1 && ops[0]?.operator === "Arctan",
    () => (ops, options) => {
      const x = operandsOf(ops[0]!)[0]!;
      return finish(ce.function("Divide", [x, sqrt(ce, onePlusSquare(ce, x))]), options);
    },
  );
  wrapOperator(
    ce,
    ["Tan", 1],
    (ops) => ops.length === 1 && ops[0]?.operator === "Arcsin",
    () => (ops, options) => {
      const x = operandsOf(ops[0]!)[0]!;
      return finish(ce.function("Divide", [x, sqrt(ce, oneMinusSquare(ce, x))]), options);
    },
  );
}

/** Cos(i*t) = cosh(t), Tan(i*t) = i*tanh(t) -- mirrors Sin(i*t) = i*sinh(t) in
 * trig-normalisation.ts and Sinh/Cosh/Tanh(i*t) in elementary-special-values.ts. */
function declareImaginaryArgument(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Cos", 1],
    (ops) => ops.length === 1 && ops[0] !== undefined && hasImaginaryFactor(ops[0]),
    () => (ops, options) => finish(ce.function("Cosh", [imaginaryFactor(ce, ops[0]!)]), options),
  );
  wrapOperator(
    ce,
    ["Tan", 1],
    (ops) => ops.length === 1 && ops[0] !== undefined && hasImaginaryFactor(ops[0]),
    () => (ops, options) =>
      finish(
        ce.function("Multiply", [
          "ImaginaryUnit",
          ce.function("Tanh", [imaginaryFactor(ce, ops[0]!)]),
        ]),
        options,
      ),
  );
}

/**
 * Arccos(Cos(y)), for a real finite y in one period [-pi, 3*pi]: the triangle-wave range
 * reduction, mirroring Arcsin(Sin(y))'s own one-period restriction in trig-normalisation.ts.
 * Kept to a single explicit window (rather than a general y mod 2*pi) so the rewrite stays an
 * exact identity check away from floating-point period-counting for an enormous y, the same
 * caution as the existing Arcsin(Sin(y)) rule.
 */
function declareArccosCosReduction(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Arccos", 1],
    (ops) => ops.length === 1 && ops[0]?.operator === "Cos",
    () => (ops, options) => {
      const y = operandsOf(ops[0]!)[0];
      if (y === undefined || y.im !== 0 || !Number.isFinite(y.re)) return undefined;
      const value = y.re;
      const pi = Math.PI;
      if (value < -pi || value > 3 * pi) return undefined;
      if (value >= 0 && value <= pi) return finish(y, options);
      if (value > pi && value <= 3 * pi) {
        const twoPi = ce.function("Multiply", [2, "Pi"]);
        return finish(ce.function("Subtract", [twoPi, y]), options);
      }
      // value in [-pi, 0): cos(y) = cos(-y), and -y is in (0, pi].
      return finish(ce.function("Negate", [y]), options);
    },
  );
}

/** TrigToExp's own logarithmic forms for the inverse hyperbolic/circular functions it
 * currently leaves untouched (per the existing captions on TrigToExp(Sin|Cos|Tan|Sinh|Cosh|
 * Tanh(x)), "TrigToExp leaves inverse functions alone" was true only because nothing here
 * extended it). Each is the standard closed form; only the top-level call is rewritten, not
 * an inverse function buried inside a larger expression. */
function declareTrigToExpInverses(ce: ComputeEngine): void {
  const rewrites: Record<string, (x: BoxedExpression) => BoxedExpression> = {
    // arcsin(x) = -i*ln(i*x + sqrt(1 - x^2))
    Arcsin: (x) =>
      ce.function("Multiply", [
        ce.function("Complex", [0, -1]),
        ce.function("Ln", [
          ce.function("Add", [
            ce.function("Multiply", [ce.function("Complex", [0, 1]), x]),
            sqrt(ce, oneMinusSquare(ce, x)),
          ]),
        ]),
      ]),
    // arctan(x) = (i/2)*ln(1 - i*x) - (i/2)*ln(1 + i*x)
    Arctan: (x) =>
      ce.function("Add", [
        ce.function("Multiply", [
          ce.function("Complex", [0, ce.number([1, 2])]),
          ce.function("Ln", [
            ce.function("Add", [ce.function("Multiply", [ce.function("Complex", [0, -1]), x]), 1]),
          ]),
        ]),
        ce.function("Multiply", [
          ce.function("Complex", [0, ce.number([-1, 2])]),
          ce.function("Ln", [
            ce.function("Add", [ce.function("Multiply", [ce.function("Complex", [0, 1]), x]), 1]),
          ]),
        ]),
      ]),
    // arcoth(x) = (1/2)*ln((x+1)/(x-1))
    Arcoth: (x) =>
      ce.function("Multiply", [
        ce.number([1, 2]),
        ce.function("Ln", [
          ce.function("Divide", [ce.function("Add", [x, 1]), ce.function("Add", [x, -1])]),
        ]),
      ]),
    // arcsch(x) = ln(1/x + sqrt(1/x^2 + 1))
    Arcsch: (x) =>
      ce.function("Ln", [
        ce.function("Add", [
          ce.function("Divide", [1, x]),
          sqrt(
            ce,
            ce.function("Add", [ce.function("Divide", [1, ce.function("Power", [x, 2])]), 1]),
          ),
        ]),
      ]),
  };
  wrapOperator(
    ce,
    ["TrigToExp", 1],
    (ops) => ops.length === 1 && ops[0] !== undefined && ops[0].operator in rewrites,
    () => (ops, options) => {
      const arg = ops[0]!;
      const rewrite = rewrites[arg.operator!]!;
      return finish(rewrite(operandsOf(arg)[0]!), options);
    },
  );
}

/** Tanh(ComplexInfinity) = NaN: unlike PositiveInfinity/NegativeInfinity (a real limit),
 * complex infinity has no direction to take a limit along, so Tanh's own signature excludes
 * it (`complex | signed_infinity`, not the direction-agnostic `infinity`). Widened to accept
 * it so this can answer NaN explicitly instead of erroring at the boxing stage. */
function declareTanhComplexInfinity(ce: ComputeEngine): void {
  widenSignature(ce, "Tanh", "(complex | infinity) -> number", (op) => !isComplexInfinity(op));
  wrapOperator(
    ce,
    ["Tanh", 1],
    (ops) => ops.length === 1 && ops[0] !== undefined && isComplexInfinity(ops[0]),
    () => () => ce.symbol("NaN"),
  );
}

/** Arsech(1) = 0 (an exact fold at the branch point, same shape as Arccosh(1) = 0) and
 * Arsech(x) for exact x > 1: past the real branch point, complex-valued. Arsech(x) =
 * Arccosh(1/x) by definition, and Arccosh(z) = i*Arccos(z) for |z| <= 1 -- here 1/x is a
 * real number already inside [0, 1), so Arccos(1/x) is the ordinary real-valued arccosine
 * (e.g. Arccos(1/2) = pi/3), not a further complex branch. */
function declareArsech(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Arsech", 1],
    (ops) => ops.length === 1 && ops[0]?.is(1) === true,
    () => (_ops, options) => finish(ce.Zero, options),
  );
  wrapOperator(
    ce,
    ["Arsech", 1],
    (ops) => {
      const r = ops.length === 1 ? bigRationalAt(ops[0]) : undefined;
      return r !== undefined && r[0] > r[1];
    },
    () => (ops, options) =>
      finish(
        ce.function("Multiply", [
          ce.symbol("ImaginaryUnit"),
          ce.function("Arccos", [ce.function("Divide", [1, ops[0]!])]),
        ]),
        options,
      ),
  );
}

/** Ln at ComplexInfinity: +Infinity, same convention as the real +Infinity case Ln already
 * has (`Ln(PositiveInfinity) = PositiveInfinity`) -- the magnitude alone diverges regardless
 * of an undefined direction. `Log2`/`Log10`/`Lb` canonicalize to `Log` at box time (`Log2(z)`
 * boxes straight to `Log(z, 2)`, `Log10(z)` to the default-base `Log(z)`), so their own
 * ComplexInfinity case is covered by `declareLogComplexInfinityAndReciprocalPower` below --
 * there is no separate `Log2`/`Log10`/`Lb` operator left by the time `evaluate` runs. */
function declareLnComplexInfinity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Ln", 1],
    (ops) => ops.length === 1 && ops[0] !== undefined && isComplexInfinity(ops[0]),
    () => () => ce.symbol("PositiveInfinity"),
  );
}

/** Ln(1/n) = -Ln(n), for an exact positive-integer n > 1: compute-engine's own integer-power
 * pull-out (Ln(1000) = 3*Ln(10)) already reduces an integer argument; this is its reciprocal. */
function declareLnUnitFraction(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Ln", 1],
    (ops) => {
      const r = ops.length === 1 ? bigRationalAt(ops[0]) : undefined;
      return r !== undefined && r[0] === 1n && r[1] > 1n;
    },
    () => (ops, options) => {
      const [, den] = bigRationalAt(ops[0]!)!;
      return finish(neg(ce, ce.function("Ln", [ce.number(den)])), options);
    },
  );
}

/** k with n = base^k exactly, for positive integers base > 1, n >= 1, k >= 0. */
function exactLogInteger(base: bigint, n: bigint): bigint | undefined {
  if (n === 1n) return 0n;
  let k = 0n;
  let power = 1n;
  while (power < n) {
    power *= base;
    k += 1n;
  }
  return power === n ? k : undefined;
}

/**
 * `Log`, in both its call forms -- `Log2`, `Log10` and `Lb` all canonicalize to this
 * operator at box time (`Log2(z)` to `Log(z, 2)`, `Lb(z)` the same, `Log10(z)` to the
 * default-base one-argument `Log(z)`), so this is the only operator left to attach to for
 * any of them.
 *
 * Two folds:
 *   - `Log(ComplexInfinity[, base])` = +Infinity, the same "magnitude alone diverges"
 *     convention as `Ln`'s.
 *   - an exact rational argument `1/q` with `q` an exact power of the base: `Log(1/8, 2)`,
 *     `Log2(1/8)`, `Log10(1/100)` = the negative integer exponent. Compute-engine already
 *     folds a positive integer power of the base (`Log2(1024) = 10`); this is that fold's
 *     reciprocal side. Restricted to numerator 1 (rather than every rational whose num/den
 *     are both base powers) to keep the rule mechanical: a `bigRationalAt` read and one
 *     integer-power search, no general factorization.
 */
function declareLogComplexInfinityAndReciprocalPower(ce: ComputeEngine): void {
  /** The base Log(z, base) uses: 2 the explicit second operand, or 10 (compute-engine's own
   * default, matching Log10(x) -> Log(x)) when there is none. */
  const baseOf = (ops: readonly BoxedExpression[]): bigint | undefined => {
    if (ops.length === 1) return 10n;
    if (ops.length !== 2) return undefined;
    const b = bigRationalAt(ops[1]);
    return b !== undefined && b[1] === 1n && b[0] > 1n ? b[0] : undefined;
  };
  const reciprocalExponent = (ops: readonly BoxedExpression[]): bigint | undefined => {
    const base = baseOf(ops);
    if (base === undefined) return undefined;
    const r = bigRationalAt(ops[0]);
    if (r === undefined || r[0] !== 1n || r[1] <= 1n) return undefined;
    return exactLogInteger(base, r[1]);
  };
  wrapOperator(
    ce,
    ["Log", 1],
    (ops) =>
      (ops.length === 1 || ops.length === 2) && ops[0] !== undefined && isComplexInfinity(ops[0]),
    () => () => ce.symbol("PositiveInfinity"),
  );
  wrapOperator(
    ce,
    ["Log", 1],
    (ops) => (ops.length === 1 || ops.length === 2) && reciprocalExponent(ops) !== undefined,
    () => (ops, options) => finish(ce.number(-reciprocalExponent(ops)!), options),
  );
}

export function declareElementaryRemaining(ce: ComputeEngine): void {
  declareParity(ce);
  declareInverseComposition(ce);
  declareCrossComposition(ce);
  declareImaginaryArgument(ce);
  declareArccosCosReduction(ce);
  declareTrigToExpInverses(ce);
  declareTanhComplexInfinity(ce);
  declareArsech(ce);
  declareLnComplexInfinity(ce);
  declareLnUnitFraction(ce);
  declareLogComplexInfinityAndReciprocalPower(ce);
}
