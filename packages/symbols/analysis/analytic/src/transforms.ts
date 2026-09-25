import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// LaplaceTransform(f, t, s) / InverseLaplaceTransform(F, s, t) and
// FourierTransform(f, t, w) / InverseFourierTransform(F, w, t): a rule table over the
// standard transform pairs (powers, exponentials, trig/hyperbolic, the Gaussian, the
// one-sided step and impulse), plus linearity and the first shifting theorem (an
// exponential factor moves the transform variable). FourierTransform matches
// Wolfram's default `FourierParameters -> {0, 1}`: kernel e^{iwt}, prefactor 1/√(2π)
// (confirmed against wolframscript). Anything outside the table — an opaque function,
// a shift of one, a product of two independently-transformable pieces, a symbolic
// exponent whose sign is unknown — is declined (evaluate returns undefined) rather
// than guessed.
//
// Not covered: the derivative/integration theorems and the second shifting theorem for
// an opaque f — Wolfram itself only expands these symbolically by leaving
// LaplaceTransform[f[t],t,s] itself in the answer, which would mean synthesizing that
// self-reference (and, for the derivative theorem, f(0) for an arbitrary f) here; and
// any FourierParameters other than the default.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isSym = (x: BoxedExpression, name: string): boolean => symbolNameOf(x) === name;
const isE = (x: BoxedExpression): boolean => isSym(x, "ExponentialE");
const hasVar = (expr: BoxedExpression, name: string): boolean => expr.has(name);
const isLiteralI = (x: BoxedExpression): boolean => x.re === 0 && x.im === 1;

const sqrt2pi = (ce: ComputeEngine) => ce.function("Sqrt", [ce.function("Multiply", [2, ce.Pi])]);
const sqrtPiOver2 = (ce: ComputeEngine) => ce.function("Sqrt", [ce.function("Divide", [ce.Pi, 2])]);

/**
 * `expr` as `coeff * t` with no additive offset — Sin/Cos/Sinh/Cosh's argument. `coeff`
 * may itself be a boxed expression (a parameter). Undefined if not that shape.
 */
function pureLinearCoeff(
  ce: ComputeEngine,
  expr: BoxedExpression,
  name: string,
): BoxedExpression | undefined {
  if (isSym(expr, name)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = pureLinearCoeff(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]);
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const tFactors = ops.filter((o) => isSym(o, name));
    const rest = ops.filter((o) => !isSym(o, name));
    if (tFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
  }
  return undefined;
}

/** exponent = i·a·t: Fourier's modulation theorem needs a purely imaginary linear exponent. */
function imaginaryLinearCoeff(
  ce: ComputeEngine,
  expr: BoxedExpression,
  name: string,
): BoxedExpression | undefined {
  if (expr.operator === "Negate") {
    const inner = imaginaryLinearCoeff(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]);
  }
  if (expr.operator !== "Multiply") return undefined;
  const ops = operandsOf(expr);
  const tFactors = ops.filter((o) => isSym(o, name));
  const iFactors = ops.filter(isLiteralI);
  const rest = ops.filter((o) => !isSym(o, name) && !isLiteralI(o));
  if (tFactors.length !== 1 || iFactors.length !== 1 || rest.some((o) => hasVar(o, name))) {
    return undefined;
  }
  return rest.length === 0 ? ce.One : rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
}

/** `expr` as `t - a` at unit coefficient — UnitStep/DiracDelta's shift argument, and the
 * denominator shape `s - a`. Returns `a`, or undefined. */
function unitShiftAmount(
  ce: ComputeEngine,
  expr: BoxedExpression,
  name: string,
): BoxedExpression | undefined {
  if (isSym(expr, name)) return ce.Zero;
  if (expr.operator === "Add") {
    const ops = operandsOf(expr);
    const tOps = ops.filter((o) => isSym(o, name));
    const rest = ops.filter((o) => !isSym(o, name));
    if (tOps.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    const offset = rest.length === 1 ? rest[0] : ce.function("Add", rest);
    return ce.function("Negate", [offset]).evaluate();
  }
  return undefined;
}

/** `-a·Abs(t)`: the exponent shape of `Exp(-a|t|)`. Returns `a`, or undefined. */
function negAbsCoeff(
  ce: ComputeEngine,
  expr: BoxedExpression,
  name: string,
): BoxedExpression | undefined {
  if (expr.operator !== "Negate") return undefined;
  const inner = opAt(expr, 0);
  const isAbsT = (o: BoxedExpression) => o.operator === "Abs" && isSym(opAt(o, 0), name);
  if (isAbsT(inner)) return ce.One;
  if (inner.operator !== "Multiply") return undefined;
  const ops = operandsOf(inner);
  const absFactors = ops.filter(isAbsT);
  const rest = ops.filter((o) => !isAbsT(o));
  if (absFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
  return rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
}

/** `-a·t²`: the exponent shape of the Gaussian `Exp(-a t²)`. Returns `a`, or undefined. */
function negSquareCoeff(
  ce: ComputeEngine,
  expr: BoxedExpression,
  name: string,
): BoxedExpression | undefined {
  if (expr.operator !== "Negate") return undefined;
  const inner = opAt(expr, 0);
  const isSq = (o: BoxedExpression) =>
    o.operator === "Power" && isSym(opAt(o, 0), name) && opAt(o, 1).re === 2;
  if (isSq(inner)) return ce.One;
  if (inner.operator !== "Multiply") return undefined;
  const ops = operandsOf(inner);
  const sqFactors = ops.filter(isSq);
  const rest = ops.filter((o) => !isSq(o));
  if (sqFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
  return rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
}

/** A concrete real number strictly greater than -1 (where ∫t^n e^{-st}dt converges). */
const isRealAboveNegOne = (x: BoxedExpression): boolean =>
  x.im === 0 && Number.isFinite(x.re) && x.re > -1;

type Kernel = "laplace" | "fourier";

// --- Laplace -----------------------------------------------------------------

function atomicLaplace(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  if (isSym(expr, tName)) return ce.function("Power", [s, -2]).evaluate();
  if (expr.operator === "Power" && isSym(opAt(expr, 0), tName)) {
    const n = opAt(expr, 1);
    if (hasVar(n, tName) || !isRealAboveNegOne(n)) return undefined;
    const np1 = ce.function("Add", [n, ce.One]).evaluate();
    return ce
      .function("Divide", [ce.function("Gamma", [np1]), ce.function("Power", [s, np1])])
      .evaluate();
  }
  if (
    expr.operator === "Sin" ||
    expr.operator === "Cos" ||
    expr.operator === "Sinh" ||
    expr.operator === "Cosh"
  ) {
    const a = pureLinearCoeff(ce, opAt(expr, 0), tName);
    if (a === undefined) return undefined;
    const s2 = ce.function("Power", [s, 2]);
    const a2 = ce.function("Power", [a, 2]);
    const hyperbolic = expr.operator === "Sinh" || expr.operator === "Cosh";
    const signedA2 = hyperbolic ? ce.function("Negate", [a2]) : a2;
    const denom = ce.function("Add", [s2, signedA2]);
    const numer = expr.operator === "Sin" || expr.operator === "Sinh" ? a : s;
    return ce.function("Divide", [numer, denom]).evaluate();
  }
  if (expr.operator === "UnitStep" && operandsOf(expr).length === 1) {
    const a = unitShiftAmount(ce, opAt(expr, 0), tName);
    if (a === undefined || hasVar(a, tName)) return undefined;
    if (a.isNegative === true) return ce.function("Power", [s, -1]).evaluate();
    if (a.isPositive !== true) return undefined; // a = 0 or sign unknown: decline
    const decay = ce.function("Exp", [ce.function("Negate", [ce.function("Multiply", [a, s])])]);
    return ce.function("Divide", [decay, s]).evaluate();
  }
  if (expr.operator === "DiracDelta" && operandsOf(expr).length === 1) {
    const a = unitShiftAmount(ce, opAt(expr, 0), tName);
    if (a === undefined || hasVar(a, tName)) return undefined;
    if (a.isNegative === true) return ce.Zero;
    if (a.isNonNegative !== true) return undefined; // a = 0 or sign unknown: decline
    return ce
      .function("Exp", [ce.function("Negate", [ce.function("Multiply", [a, s])])])
      .evaluate();
  }
  return undefined;
}

/** The first shifting theorem: pull an `Exp(±·t)` factor out of a product, transform
 * what's left, and substitute the shift into the result's transform variable. Shared
 * by Laplace (`s → s - a`) and Fourier (`w → w + a`, `a` = the exponent's imaginary
 * coefficient) — `kernel` picks which. */
function shiftFactor(
  ce: ComputeEngine,
  factors: readonly BoxedExpression[],
  s: BoxedExpression,
  tName: string,
  kernel: Kernel,
  transform: (e: BoxedExpression) => BoxedExpression | undefined,
): BoxedExpression | undefined {
  for (let i = 0; i < factors.length; i++) {
    const f = factors[i];
    if (f.operator !== "Power" || !isE(opAt(f, 0))) continue;
    const exponent = opAt(f, 1);
    const a =
      kernel === "laplace"
        ? pureLinearCoeff(ce, exponent, tName)
        : imaginaryLinearCoeff(ce, exponent, tName);
    if (a === undefined) continue;
    const rest = factors.filter((_, j) => j !== i);
    const g =
      rest.length === 0 ? ce.One : rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
    const G = transform(g);
    if (G === undefined) return undefined;
    const replacement =
      kernel === "laplace"
        ? ce.function("Add", [s, ce.function("Negate", [a])]).evaluate()
        : ce.function("Add", [s, a]).evaluate();
    const sName = symbolNameOf(s);
    if (sName === undefined) return undefined;
    return G.subs({ [sName]: replacement }).evaluate();
  }
  return undefined;
}

export function matchLaplace(
  ce: ComputeEngine,
  expr: BoxedExpression,
  t: BoxedExpression,
  s: BoxedExpression,
): BoxedExpression | undefined {
  const tName = symbolNameOf(t);
  if (tName === undefined) return undefined;
  if (!hasVar(expr, tName)) return ce.function("Divide", [expr, s]).evaluate();
  if (expr.operator === "Add") {
    const parts = operandsOf(expr).map((o) => matchLaplace(ce, o, t, s));
    if (parts.some((p) => p === undefined)) return undefined;
    return ce.function("Add", parts as BoxedExpression[]).evaluate();
  }
  if (expr.operator === "Negate") {
    const inner = matchLaplace(ce, opAt(expr, 0), t, s);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  const recur = (g: BoxedExpression) => matchLaplace(ce, g, t, s);
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const consts = ops.filter((o) => !hasVar(o, tName));
    const rest = ops.filter((o) => hasVar(o, tName));
    const core =
      rest.length === 1
        ? (atomicLaplace(ce, rest[0], s, tName) ??
          shiftFactor(ce, rest, s, tName, "laplace", recur))
        : shiftFactor(ce, rest, s, tName, "laplace", recur);
    if (core === undefined) return undefined;
    return consts.length === 0 ? core : ce.function("Multiply", [...consts, core]).evaluate();
  }
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    return shiftFactor(ce, [expr], s, tName, "laplace", recur);
  }
  return atomicLaplace(ce, expr, s, tName);
}

// --- Fourier -------------------------------------------------------------------

function atomicFourier(
  ce: ComputeEngine,
  expr: BoxedExpression,
  w: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  if (expr.operator === "DiracDelta" && operandsOf(expr).length === 1) {
    const a = unitShiftAmount(ce, opAt(expr, 0), tName);
    if (a === undefined || hasVar(a, tName)) return undefined;
    const phase = ce.function("Exp", [ce.function("Multiply", [ce.I, a, w])]);
    return ce.function("Divide", [phase, sqrt2pi(ce)]).evaluate();
  }
  if (
    expr.operator === "UnitStep" &&
    operandsOf(expr).length === 1 &&
    isSym(opAt(expr, 0), tName)
  ) {
    const term1 = ce.function("Divide", [ce.I, ce.function("Multiply", [sqrt2pi(ce), w])]);
    const term2 = ce.function("Multiply", [sqrtPiOver2(ce), ce.function("DiracDelta", [w])]);
    return ce.function("Add", [term1, term2]).evaluate();
  }
  if (expr.operator === "Sin" || expr.operator === "Cos") {
    const a = pureLinearCoeff(ce, opAt(expr, 0), tName);
    if (a === undefined) return undefined;
    const plus = ce.function("DiracDelta", [ce.function("Add", [w, ce.function("Negate", [a])])]);
    const minus = ce.function("DiracDelta", [ce.function("Add", [w, a])]);
    const pref = sqrtPiOver2(ce);
    if (expr.operator === "Cos") {
      return ce.function("Multiply", [pref, ce.function("Add", [plus, minus])]).evaluate();
    }
    return ce
      .function("Multiply", [
        ce.I,
        pref,
        ce.function("Add", [plus, ce.function("Negate", [minus])]),
      ])
      .evaluate();
  }
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    const exponent = opAt(expr, 1);
    const negA = negSquareCoeff(ce, exponent, tName); // Exp(-a t²), Re(a) > 0
    if (negA !== undefined && negA.isPositive === true) {
      const denom = ce.function("Power", [ce.function("Multiply", [4, negA]), -1]);
      const gaussExp = ce.function("Negate", [
        ce.function("Multiply", [ce.function("Power", [w, 2]), denom]),
      ]);
      const pref = ce.function("Power", [ce.function("Multiply", [2, negA]), ce.number([-1, 2])]);
      return ce.function("Multiply", [pref, ce.function("Exp", [gaussExp])]).evaluate();
    }
    const absA = negAbsCoeff(ce, exponent, tName); // Exp(-a|t|), a > 0
    if (absA !== undefined && absA.isPositive === true) {
      const numer = ce.function("Multiply", [
        absA,
        ce.function("Power", [ce.function("Divide", [2, ce.Pi]), ce.number([1, 2])]),
      ]);
      const denom = ce.function("Add", [
        ce.function("Power", [absA, 2]),
        ce.function("Power", [w, 2]),
      ]);
      return ce.function("Divide", [numer, denom]).evaluate();
    }
  }
  return undefined;
}

export function matchFourier(
  ce: ComputeEngine,
  expr: BoxedExpression,
  t: BoxedExpression,
  w: BoxedExpression,
): BoxedExpression | undefined {
  const tName = symbolNameOf(t);
  if (tName === undefined) return undefined;
  if (!hasVar(expr, tName)) {
    return ce.function("Multiply", [expr, sqrt2pi(ce), ce.function("DiracDelta", [w])]).evaluate();
  }
  if (expr.operator === "Add") {
    const parts = operandsOf(expr).map((o) => matchFourier(ce, o, t, w));
    if (parts.some((p) => p === undefined)) return undefined;
    return ce.function("Add", parts as BoxedExpression[]).evaluate();
  }
  if (expr.operator === "Negate") {
    const inner = matchFourier(ce, opAt(expr, 0), t, w);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  const recur = (g: BoxedExpression) => matchFourier(ce, g, t, w);
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const consts = ops.filter((o) => !hasVar(o, tName));
    const rest = ops.filter((o) => hasVar(o, tName));
    const core =
      rest.length === 1
        ? (atomicFourier(ce, rest[0], w, tName) ??
          shiftFactor(ce, rest, w, tName, "fourier", recur))
        : shiftFactor(ce, rest, w, tName, "fourier", recur);
    if (core === undefined) return undefined;
    return consts.length === 0 ? core : ce.function("Multiply", [...consts, core]).evaluate();
  }
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    return atomicFourier(ce, expr, w, tName) ?? shiftFactor(ce, [expr], w, tName, "fourier", recur);
  }
  return atomicFourier(ce, expr, w, tName);
}

// --- Inverses: a small dictionary of common images, not a general residue calculus. ----

function matchInverseLaplace(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  t: BoxedExpression,
): BoxedExpression | undefined {
  const sName = symbolNameOf(s);
  if (sName === undefined || !hasVar(expr, sName)) return undefined;
  if (expr.operator === "Add") {
    const parts = operandsOf(expr).map((o) => matchInverseLaplace(ce, o, s, t));
    if (parts.some((p) => p === undefined)) return undefined;
    return ce.function("Add", parts as BoxedExpression[]).evaluate();
  }
  if (expr.operator === "Negate") {
    const inner = matchInverseLaplace(ce, opAt(expr, 0), s, t);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const consts = ops.filter((o) => !hasVar(o, sName));
    const rest = ops.filter((o) => hasVar(o, sName));
    if (rest.length !== 1) return undefined;
    const core = matchInverseLaplace(ce, rest[0], s, t);
    if (core === undefined) return undefined;
    return consts.length === 0 ? core : ce.function("Multiply", [...consts, core]).evaluate();
  }
  if (expr.operator === "Power" && isSym(opAt(expr, 0), sName)) {
    const n = opAt(expr, 1);
    if (hasVar(n, sName) || n.im !== 0 || !Number.isInteger(n.re) || n.re >= 0) return undefined;
    const k = -n.re; // s^{-k}, k a positive integer
    return ce
      .function("Divide", [ce.function("Power", [t, k - 1]), ce.function("Gamma", [k])])
      .evaluate();
  }
  const reciprocal = asReciprocalLinear(ce, expr, sName);
  if (reciprocal !== undefined) {
    return ce.function("Exp", [ce.function("Multiply", [reciprocal, t])]).evaluate();
  }
  const trig = asQuadraticRatio(ce, expr, sName);
  if (trig !== undefined) {
    const { numerIsS, a, sign } = trig;
    const at = ce.function("Multiply", [a, t]);
    if (sign > 0) return ce.function(numerIsS ? "Cos" : "Sin", [at]).evaluate();
    return ce.function(numerIsS ? "Cosh" : "Sinh", [at]).evaluate();
  }
  return undefined;
}

/** `1/(s - a)`, in whichever of `Power[Add[s,-a],-1]` / `Divide[1, Add[s,-a]]` shape it took. */
function asReciprocalLinear(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
): BoxedExpression | undefined {
  let denom: BoxedExpression | undefined;
  if (expr.operator === "Power" && opAt(expr, 1).re === -1) denom = opAt(expr, 0);
  else if (expr.operator === "Divide" && opAt(expr, 0).re === 1) denom = opAt(expr, 1);
  if (denom === undefined) return undefined;
  const a = unitShiftAmount(ce, denom, sName);
  return a === undefined || hasVar(a, sName) ? undefined : a;
}

/** `s/(s²±a²)` or `a/(s²±a²)`: which numerator it was, and the sign of a². */
function asQuadraticRatio(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
): { numerIsS: boolean; a: BoxedExpression; sign: 1 | -1 } | undefined {
  if (expr.operator !== "Divide") return undefined;
  const numer = opAt(expr, 0);
  const denom = opAt(expr, 1);
  const denomOps = operandsOf(denom);
  if (denom.operator !== "Add" || denomOps.length !== 2) return undefined;
  const [d1, d2] = denomOps;
  const isS2 = (o: BoxedExpression) =>
    o.operator === "Power" && isSym(opAt(o, 0), sName) && opAt(o, 1).re === 2;
  let other: BoxedExpression | undefined;
  if (isS2(d1)) other = d2;
  else if (isS2(d2)) other = d1;
  if (other === undefined) return undefined;
  let sign: 1 | -1 = 1;
  let a2 = other;
  if (other.operator === "Negate") {
    sign = -1;
    a2 = opAt(other, 0);
  } else if (other.isNegative === true) {
    sign = -1;
    a2 = ce.function("Negate", [other]).evaluate();
  }
  // a2 written as an explicit square (the common case, `Power[a, 2]`) reads `a` off
  // directly rather than round-tripping through `Sqrt`, which would leave a symbolic
  // `a` as `Sqrt[a^2]` instead of simplifying back to `a`.
  const a =
    a2.operator === "Power" && opAt(a2, 1).re === 2
      ? opAt(a2, 0)
      : ce.function("Power", [a2, ce.number([1, 2])]).evaluate();
  if (hasVar(a, sName)) return undefined;
  if (isSym(numer, sName)) return { numerIsS: true, a, sign };
  if (!hasVar(numer, sName)) {
    const diff = ce.function("Add", [numer, ce.function("Negate", [a])]).evaluate();
    if (diff.re === 0 && diff.im === 0) return { numerIsS: false, a, sign };
  }
  return undefined;
}

function matchInverseFourier(
  ce: ComputeEngine,
  expr: BoxedExpression,
  w: BoxedExpression,
  _t: BoxedExpression,
): BoxedExpression | undefined {
  const wName = symbolNameOf(w);
  if (wName === undefined) return undefined;
  if (
    expr.operator === "DiracDelta" &&
    operandsOf(expr).length === 1 &&
    isSym(opAt(expr, 0), wName)
  ) {
    return ce.function("Divide", [ce.One, sqrt2pi(ce)]).evaluate();
  }
  if (!hasVar(expr, wName)) return ce.function("Multiply", [expr, sqrt2pi(ce)]).evaluate();
  return undefined;
}

export function declareTransforms(ce: ComputeEngine): void {
  ce.declare("LaplaceTransform", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, t, s] = ops;
      if (f === undefined || t === undefined || s === undefined) return undefined;
      return matchLaplace(ce, f, t, s);
    },
  });
  ce.declare("InverseLaplaceTransform", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [F, s, t] = ops;
      if (F === undefined || s === undefined || t === undefined) return undefined;
      return matchInverseLaplace(ce, F, s, t);
    },
  });
  ce.declare("FourierTransform", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, t, w] = ops;
      if (f === undefined || t === undefined || w === undefined || ops.length > 3) return undefined;
      return matchFourier(ce, f, t, w);
    },
  });
  ce.declare("InverseFourierTransform", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [F, w, t] = ops;
      if (F === undefined || w === undefined || t === undefined || ops.length > 3) return undefined;
      return matchInverseFourier(ce, F, w, t);
    },
  });
}
