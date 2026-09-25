import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, wrapOperator } from "@enumeratio/boxed";

// A few elementary special values Wolfram folds and compute-engine's native handlers
// leave symbolic: the hyperbolic functions at a purely imaginary argument (rewritten
// through the matching circular function), Ln(i), Arccot's special-angle table (it has
// none, unlike Arctan), and the two poles Arccsc(0)/Arcsec(0). Declared by
// `declareAnalytic`.

// A Multiply with a real coefficient folds straight into the ImaginaryUnit literal --
// Multiply(ImaginaryUnit, Divide(Pi, 2)) boxes to Multiply(Complex(0, 1/2), Pi), not
// Multiply(Complex(0, 1), Multiply(1/2, Pi)) -- so "is this Multiply(i, t)" has to allow
// any nonzero purely-imaginary numeric factor, not just literal i.
const isImaginaryLiteral = (op: BoxedExpression): boolean =>
  op.operator === "Complex" && op.re === 0 && op.im !== 0;

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
      (ops) => ops.length === 1 && ops[0] !== undefined && hasImaginaryFactor(ops[0]),
      () => (ops) => rewrite(realPartOf(ce, ops[0]!)).evaluate(),
    );
  }
}

/** Ln(i) = i*pi/2, the principal value. */
function declareLnImaginaryUnit(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Ln", 1],
    (ops) =>
      ops.length === 1 &&
      ops[0] !== undefined &&
      ops[0].operator === "Complex" &&
      ops[0].re === 0 &&
      ops[0].im === 1,
    () => () =>
      ce.function("Multiply", [ce.function("Complex", [0, ce.number([1, 2])]), "Pi"]).evaluate(),
  );
}

/**
 * Arccot's special-value table: Wolfram's convention is Arccot(x) = Arctan(1/x) for
 * x != 0, and Arccot(0) = pi/2 by definition (the reciprocal identity is discontinuous
 * there). Falls through to native first, so nothing native already answers (a float
 * argument, PositiveInfinity, ...) changes; only tried, and only kept, when Arctan's
 * own table gives an exact fold at the reciprocal -- otherwise this declines exactly
 * as native does.
 */
function declareArccotTable(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Arccot", 1],
    (ops) => ops.length === 1,
    (native) => (ops, options) => {
      const nativeResult = native?.(ops, options);
      if (nativeResult !== undefined && nativeResult.operator !== "Arccot") return nativeResult;
      const x = ops[0]!;
      if (x.is(0)) return ce.function("Divide", ["Pi", 2]).evaluate();
      const folded = ce.function("Arctan", [ce.function("Divide", [1, x])]).evaluate();
      return folded.operator === "Arctan" ? nativeResult : folded;
    },
  );
}

/** Arccsc(0) and Arcsec(0): a pole, ComplexInfinity -- both are reciprocal-of-Arcsin /
 * reciprocal-of-Arccos style inverses, undefined at their reciprocal's own 0. */
function declareReciprocalInversePoles(ce: ComputeEngine): void {
  for (const head of ["Arccsc", "Arcsec"] as const) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => ops.length === 1 && ops[0]?.is(0) === true,
      () => () => ce.symbol("ComplexInfinity"),
    );
  }
}

export function declareElementarySpecialValues(ce: ComputeEngine): void {
  declareHyperbolicAtImaginary(ce);
  declareLnImaginaryUnit(ce);
  declareArccotTable(ce);
  declareReciprocalInversePoles(ce);
}
