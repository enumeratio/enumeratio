import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, wrapOperator } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// A few elementary special values Wolfram folds and compute-engine's native handlers
// leave symbolic: the hyperbolic functions at a purely imaginary argument (rewritten
// through the matching circular function), Ln(i), Arccot's special-angle table (it has
// none, unlike Arctan), and the two poles Arccsc(0)/Arcsec(0). Declared by
// `declareAnalytic`.
//
// Every handler below builds an exact symbolic expression and finishes with
// `options.numericApproximation ? expr.N() : expr.evaluate()` -- plain evaluate() would
// leave a Pi or a Sinh(rational) inside untouched, so N(Ln(i)) would come back as the
// exact ½iπ instead of a decimal (issue #107's bug, recurring here).

/** Build then finish an expression the way the caller asked: N() for N(...), else evaluate(). */
const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

// A Multiply with a real coefficient folds straight into the ImaginaryUnit literal --
// Multiply(ImaginaryUnit, Divide(Pi, 2)) boxes to Multiply(Complex(0, 1/2), Pi), not
// Multiply(Complex(0, 1), Multiply(1/2, Pi)) -- so "is this Multiply(i, t)" has to allow
// any nonzero purely-imaginary numeric factor, not just literal i.
const isImaginaryLiteral = (op: BoxedExpression): boolean => op.operator === "Complex" && op.re === 0 && op.im !== 0;

/** Cheap (O(operands), no allocation): does this Multiply carry a purely-imaginary factor? */
const hasImaginaryFactor = (op: BoxedExpression): boolean =>
  op.operator === "Multiply" && operandsOf(op).some(isImaginaryLiteral);

/** t, given op = i*t: dividing the whole product back out by i is exact and lets
 * compute-engine's own arithmetic re-fold the real coefficient, rather than this code
 * trying to reconstruct it. Only called after `hasImaginaryFactor` has said yes. */
const realPartOf = (ce: ComputeEngine, op: BoxedExpression): BoxedExpression =>
  ce.function("Divide", [op, "ImaginaryUnit"]).evaluate();

/** Sinh(i*t) = i*sin(t), Cosh(i*t) = cos(t), Tanh(i*t) = i*tan(t). */
function declareHyperbolicAtImaginary(ce: ComputeEngine): void {
  const rewrites: Record<string, (t: BoxedExpression) => BoxedExpression> = {
    Sinh: (t) => ce.function("Multiply", ["ImaginaryUnit", ce.function("Sin", [t])]),
    Cosh: (t) => ce.function("Cos", [t]),
    Tanh: (t) => ce.function("Multiply", ["ImaginaryUnit", ce.function("Tan", [t])]),
  };
  for (const [head, rewrite] of Object.entries(rewrites)) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => ops[0] !== undefined && hasImaginaryFactor(ops[0]),
      () => (ops, options) => finish(rewrite(realPartOf(ce, ops[0]!)), options),
      1,
    );
  }
}

/** Ln(i) = i*pi/2, the principal value. */
function declareLnImaginaryUnit(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Ln", 1],
    (ops) => ops[0] !== undefined && ops[0].operator === "Complex" && ops[0].re === 0 && ops[0].im === 1,
    () => (_ops, options) =>
      finish(ce.function("Multiply", [ce.function("Complex", [0, ce.number([1, 2])]), "Pi"]), options),
    1,
  );
}

/**
 * Arccot's special-value table: compute-engine's own N(Arccot(x)) already answers on the
 * range (0, pi) -- continuous, Arccot(0) = pi/2 -- via Arccot(x) = pi/2 - Arctan(x). That
 * is also what our Wolfram mapping (PR #88) assumes when it emits `Pi/2 - ArcTan[x]` for
 * ArcCot. The exact table has to follow the same formula, or evaluate() and N() would
 * disagree on the very call that this table exists to fold (Wolfram's own convention,
 * ArcCot(x) = ArcTan(1/x) on (-pi/2, pi/2], is a real difference at a negative x -- see
 * the `divergence` notes on the negative-argument reference examples).
 *
 * Falls through to native first, so nothing native already answers (a float argument,
 * PositiveInfinity, ...) changes; only tried, and only kept, when Arctan's own table
 * gives an exact fold -- otherwise this declines exactly as native does.
 */
function declareArccotTable(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Arccot", 1],
    () => true,
    (native) => (ops, options) => {
      const nativeResult = native?.(ops, options);
      if (nativeResult !== undefined && nativeResult.operator !== "Arccot") return nativeResult;
      const arctanValue = ce.function("Arctan", [ops[0]!]).evaluate();
      if (arctanValue.operator === "Arctan") return nativeResult; // Arctan didn't fold either
      return finish(ce.function("Subtract", [ce.function("Divide", ["Pi", 2]), arctanValue]), options);
    },
    1,
  );
}

/** Arccsc(0) and Arcsec(0): a pole, ComplexInfinity -- both are reciprocal-of-Arcsin /
 * reciprocal-of-Arccos style inverses, undefined at their reciprocal's own 0. Infinity
 * has no separate decimal form, so N() and evaluate() agree without branching. */
function declareReciprocalInversePoles(ce: ComputeEngine): void {
  for (const head of ["Arccsc", "Arcsec"] as const) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => ops[0]?.is(0) === true,
      () => () => ce.symbol("ComplexInfinity"),
      1,
    );
  }
}

export function declareElementarySpecialValues(ce: ComputeEngine): void {
  declareHyperbolicAtImaginary(ce);
  declareLnImaginaryUnit(ce);
  declareArccotTable(ce);
  declareReciprocalInversePoles(ce);
}
