import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// A handful of symbolic Sin normalisations Wolfram applies automatically and
// compute-engine's native Sin leaves as is: parity, a shift by an integer multiple of
// pi, an imaginary argument (rewritten through Sinh) and one inverse composition
// (Sin(Arccos(x))). Also Arcsin's principal-branch reduction of Sin(y) for a real y
// already within (-pi, pi]. Declared by `declareAnalytic`.
//
// Each check below is a structural read of `operator` (and, for a symbol, its name) --
// no evaluation -- so a Sin call whose argument isn't one of these shapes falls straight
// through to the native handler.
//
// Every branch below finishes with `finish`, not a bare evaluate() -- N(Sin(i*(pi/2)))
// has to come back as a decimal, not the exact i*Sinh(pi/2) evaluate() alone would give
// (issue #107's bug: a wrapper that ignores `options.numericApproximation`).

/** Build then finish an expression the way the caller asked: N() for N(...), else evaluate(). */
const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

/** The integer k with op = k*Pi (as bare Pi, Negate(Pi), or Multiply(k, Pi)), if any. */
function piMultiple(op: BoxedExpression): bigint | undefined {
  if (op.operator === "Symbol") return symbolNameOf(op) === "Pi" ? 1n : undefined;
  if (op.operator === "Negate") {
    const inner = operandsOf(op)[0];
    const k = inner !== undefined ? piMultiple(inner) : undefined;
    return k === undefined ? undefined : -k;
  }
  if (op.operator === "Multiply") {
    const ops = operandsOf(op);
    if (ops.length !== 2) return undefined;
    const [a, b] = ops;
    const pi = symbolNameOf(a) === "Pi" ? a : symbolNameOf(b) === "Pi" ? b : undefined;
    const coeff = pi === a ? b : pi === b ? a : undefined;
    return pi === undefined || coeff === undefined ? undefined : bigIntegerAt(coeff);
  }
  return undefined;
}

// A Multiply with a real coefficient folds straight into the ImaginaryUnit literal --
// Multiply(ImaginaryUnit, Divide(Pi, 2)) boxes to Multiply(Complex(0, 1/2), Pi), not
// Multiply(Complex(0, 1), Multiply(1/2, Pi)) -- so "is this Multiply(i, t)" has to allow
// any nonzero purely-imaginary numeric factor, not just literal i.
const isImaginaryLiteral = (op: BoxedExpression): boolean => op.operator === "Complex" && op.re === 0 && op.im !== 0;

/** Cheap (O(operands), no allocation): does this Multiply carry a purely-imaginary factor? */
const hasImaginaryFactor = (op: BoxedExpression): boolean =>
  op.operator === "Multiply" && operandsOf(op).some(isImaginaryLiteral);

/** t, given op = i*t (only called once `hasImaginaryFactor` has said yes): dividing the
 * whole product back out by i is exact and lets compute-engine's own arithmetic re-fold
 * the real coefficient, rather than this code trying to reconstruct it. */
function imaginaryFactor(ce: ComputeEngine, op: BoxedExpression): BoxedExpression {
  return ce.function("Divide", [op, "ImaginaryUnit"]).evaluate();
}

function evaluateSin(ce: ComputeEngine, op: BoxedExpression, options: EvalOptions): BoxedExpression | undefined {
  const k = piMultiple(op);
  if (k !== undefined) return ce.Zero; // sin(k*pi) = 0 for any integer k

  if (op.operator === "Add") {
    const ops = operandsOf(op);
    if (ops.length === 2) {
      for (let i = 0; i < 2; i++) {
        const shift = piMultiple(ops[i]!);
        if (shift === undefined || shift === 0n) continue;
        const rest = ops[1 - i]!;
        // sin(x + k*pi) = (-1)^k * sin(x)
        const sinRest = ce.function("Sin", [rest]);
        return finish(shift % 2n === 0n ? sinRest : ce.function("Negate", [sinRest]), options);
      }
    }
  }

  if (op.operator === "Negate") {
    const inner = operandsOf(op)[0];
    if (inner === undefined) return undefined;
    return finish(ce.function("Negate", [ce.function("Sin", [inner])]), options);
  }

  if (hasImaginaryFactor(op)) {
    // sin(i*t) = i*sinh(t)
    const t = imaginaryFactor(ce, op);
    return finish(ce.function("Multiply", ["ImaginaryUnit", ce.function("Sinh", [t])]), options);
  }

  if (op.operator === "Arccos") {
    const x = operandsOf(op)[0];
    if (x === undefined) return undefined;
    // sin(arccos(x)) = sqrt(1 - x^2)
    return finish(
      ce.function("Sqrt", [ce.function("Add", [1, ce.function("Negate", [ce.function("Power", [x, 2])])])]),
      options,
    );
  }

  return undefined;
}

/** True for the argument shapes `evaluateSin` handles, so it always returns a defined
 * result when this says yes -- an unrelated Add or Multiply (the common case for either,
 * e.g. a plain sum or product of symbols) must fall through to native undisturbed. Cheap:
 * a couple of structural reads, no evaluation, no recursion past one level of Negate. */
function looksNormalisable(op: BoxedExpression): boolean {
  switch (op.operator) {
    case "Symbol":
      return symbolNameOf(op) === "Pi";
    case "Negate":
    case "Arccos":
      return true;
    case "Multiply":
      return piMultiple(op) !== undefined || hasImaginaryFactor(op);
    case "Add": {
      const ops = operandsOf(op);
      return ops.length === 2 && ops.some((o) => (piMultiple(o) ?? 0n) !== 0n);
    }
    default:
      return false;
  }
}

export function declareTrigNormalisation(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Sin", 1],
    (ops) => ops[0] !== undefined && looksNormalisable(ops[0]),
    () => (ops, options) => evaluateSin(ce, ops[0]!, options),
    1,
  );

  // Arcsin(Sin(y)), for a real number literal y already in (-pi, pi]: Wolfram's
  // principal-branch reduction folds y back into [-pi/2, pi/2] by reflecting around
  // the nearer of +-pi/2. Restricted to that range (no 2*pi wraparound) to keep the
  // rewrite an exact identity rather than an approximation.
  wrapOperator(
    ce,
    ["Arcsin", 1],
    (ops) => ops[0]?.operator === "Sin",
    () => (ops, options) => {
      const y = operandsOf(ops[0]!)[0];
      // A free variable's re/im are both NaN, so this also excludes a symbolic argument.
      if (y === undefined || y.im !== 0 || !Number.isFinite(y.re)) return undefined;
      const value = y.re;
      const pi = Math.PI;
      if (value < -pi || value > pi) return undefined;
      if (value >= -pi / 2 && value <= pi / 2) return finish(y, options);
      if (value > pi / 2) return finish(ce.function("Subtract", ["Pi", y]), options);
      return finish(ce.function("Subtract", [ce.function("Negate", ["Pi"]), y]), options);
    },
    1,
  );
}
