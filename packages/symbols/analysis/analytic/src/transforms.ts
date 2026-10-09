import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/engine";

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
// Beyond the table: L{g(t)/t} for a combination of 1, e^{at}, cos/cosh and sin/sinh (the
// transform integrated from s: logarithms and arctangents), L{t^n ln t}, the inverse of
// logarithms of linear/quadratic factors (-e^{at}/t, -2cos(at)/t), and the inverse of a
// rational function whose denominator is a product of quadratics s² ± a² (partial fractions
// in s²; a squared quadratic by its table entries), |sin at| and |cos at|, Γ(ν, a/t), the
// separable multivariate transform, and for the inverse a product of fractional powers of s
// with logarithms, shifts, error functions and incomplete gammas (`inverseFactored`) and the
// elliptic pairs. Each rule cites its source where it sits.
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
function pureLinearCoeff(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
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
  if (expr.operator === "Divide" && !hasVar(opAt(expr, 1), name)) {
    const inner = pureLinearCoeff(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Divide", [inner, opAt(expr, 1)]);
  }
  return undefined;
}

/** exponent = i·a·t: Fourier's modulation theorem needs a purely imaginary linear exponent. */
function imaginaryLinearCoeff(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
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
function unitShiftAmount(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
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
function negAbsCoeff(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
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
function negSquareCoeff(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  if (expr.operator !== "Negate") return undefined;
  const inner = opAt(expr, 0);
  const isSq = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), name) && opAt(o, 1).re === 2;
  if (isSq(inner)) return ce.One;
  if (inner.operator !== "Multiply") return undefined;
  const ops = operandsOf(inner);
  const sqFactors = ops.filter(isSq);
  const rest = ops.filter((o) => !isSq(o));
  if (sqFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
  return rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
}

/** A concrete real number strictly greater than -1 (where ∫t^n e^{-st}dt converges). */
const isRealAboveNegOne = (x: BoxedExpression): boolean => x.im === 0 && Number.isFinite(x.re) && x.re > -1;

type Kernel = "laplace" | "fourier";

// --- Laplace -----------------------------------------------------------------

function atomicLaplace(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  if (isSym(expr, tName)) return ce.function("Power", [s, -2]).evaluate();
  if (expr.operator === "Ln") return laplaceLog(ce, [expr], s, tName);
  const { base, exp: n } = powerParts(ce, expr); // t^n through Sqrt, Root and 1/t^m
  if (isSym(base, tName) && !isSym(expr, tName)) {
    if (hasVar(n, tName) || !isRealAboveNegOne(n)) return undefined;
    const np1 = ce.function("Add", [n, ce.One]).evaluate();
    return ce.function("Divide", [ce.function("Gamma", [np1]), ce.function("Power", [s, np1])]).evaluate();
  }
  if (expr.operator === "Sin" || expr.operator === "Cos" || expr.operator === "Sinh" || expr.operator === "Cosh") {
    const a = pureLinearCoeff(ce, opAt(expr, 0), tName);
    if (a === undefined) return expr.operator === "Sin" ? sineOfSqrt(ce, expr, s, tName) : undefined;
    const s2 = ce.function("Power", [s, 2]);
    const a2 = ce.function("Power", [a, 2]);
    const hyperbolic = expr.operator === "Sinh" || expr.operator === "Cosh";
    const signedA2 = hyperbolic ? ce.function("Negate", [a2]) : a2;
    const denom = ce.function("Add", [s2, signedA2]);
    const numer = expr.operator === "Sin" || expr.operator === "Sinh" ? a : s;
    return ce.function("Divide", [numer, denom]).evaluate();
  }
  if (expr.operator === "Abs" && (opAt(expr, 0).operator === "Sin" || opAt(expr, 0).operator === "Cos")) {
    return rectifiedWave(ce, opAt(expr, 0), s, tName);
  }
  if (expr.operator === "Gamma" && operandsOf(expr).length === 2)
    return incompleteGammaOfReciprocal(ce, expr, s, tName);
  if (expr.operator === "FresnelC" || expr.operator === "FresnelS") return fresnelOfSqrt(ce, expr, s, tName);
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
    return ce.function("Exp", [ce.function("Negate", [ce.function("Multiply", [a, s])])]).evaluate();
  }
  return undefined;
}

/**
 * The full-wave rectified sine and cosine, periodic with period π/a (A&S Table 29.3, the
 * periodic-function theorem ∫_0^T f e^{-st} / (1 - e^{-sT}) worked out):
 *   L{|sin at|} = a·coth(πs/2a)/(s²+a²),   L{|cos at|} = (s + a·csch(πs/2a))/(s²+a²).
 * Even in a, so `a` needs no sign, only to be nonzero.
 */
function rectifiedWave(
  ce: ComputeEngine,
  trig: BoxedExpression,
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  const a = pureLinearCoeff(ce, opAt(trig, 0), tName);
  if (a === undefined || (a.im === 0 && a.re === 0)) return undefined;
  const halfPeriodArg = ce.function("Divide", [ce.function("Multiply", [ce.Pi, s]), ce.function("Multiply", [2, a])]);
  const denom = ce.function("Add", [ce.function("Power", [s, 2]), ce.function("Power", [a, 2])]);
  const numer =
    trig.operator === "Sin"
      ? ce.function("Multiply", [a, ce.function("Coth", [halfPeriodArg])])
      : ce.function("Add", [s, ce.function("Multiply", [a, ce.function("Csch", [halfPeriodArg])])]);
  return ce.function("Divide", [numer, denom]).evaluate();
}

/** L{Γ(ν, a/t)} = 2(as)^{ν/2} K_ν(2√(as))/s for a > 0 (confirmed against wolframscript and a numerical integral). */
function incompleteGammaOfReciprocal(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  const [nu, arg] = operandsOf(expr) as [BoxedExpression, BoxedExpression];
  if (hasVar(nu, tName)) return undefined;
  const { numer, denom } = fractionFactors(arg);
  if (denom.length !== 1 || !isSym(denom[0]!.base, tName) || denom[0]!.power !== 1) return undefined;
  if (numer.some((f) => hasVar(f.base, tName))) return undefined;
  const a =
    numer.length === 0
      ? ce.One
      : ce.function(
          "Multiply",
          numer.map((f) => ce.function("Power", [f.base, f.power])),
        );
  if (a.isPositive !== true) return undefined;
  const as = ce.function("Multiply", [a, s]);
  const bessel = ce.function("BesselK", [nu, ce.function("Multiply", [2, ce.function("Sqrt", [as])])]);
  const scale = ce.function("Power", [as, ce.function("Divide", [nu, 2])]);
  return ce.function("Divide", [ce.function("Multiply", [2, scale, bessel]), s]).evaluate();
}

/** `base` as `k·t` with `k` free of t (1 for a bare `t`), or undefined. */
function scaledByT(ce: ComputeEngine, base: BoxedExpression, tName: string): BoxedExpression | undefined {
  const parts = productFactors(ce, base);
  const rest = parts.filter((p) => hasVar(p, tName));
  if (rest.length !== 1 || !isSym(rest[0], tName)) return undefined;
  return ce
    .function(
      "Multiply",
      parts.filter((p) => !hasVar(p, tName)),
    )
    .evaluate();
}

/** `arg` as `c·√t` with `c` free of t (`√(a t)` splits as `√a √t`, t > 0), or undefined. */
function sqrtTCoefficient(ce: ComputeEngine, arg: BoxedExpression, tName: string): BoxedExpression | undefined {
  const c: BoxedExpression[] = [];
  let found = false;
  for (const f of productFactors(ce, arg)) {
    if (!hasVar(f, tName)) {
      c.push(f);
      continue;
    }
    const { base, exp } = powerParts(ce, f);
    const k = scaledByT(ce, base, tName);
    if (found || realOf(exp) !== 0.5 || k === undefined) return undefined;
    found = true;
    c.push(ce.function("Sqrt", [k]));
  }
  return found ? ce.function("Multiply", c).evaluate() : undefined;
}

const expOfSqrt = (ce: ComputeEngine, c: BoxedExpression, s: BoxedExpression): BoxedExpression =>
  ce.function("Exp", [
    ce.function("Negate", [ce.function("Divide", [ce.function("Power", [c, 2]), ce.function("Multiply", [4, s])])]),
  ]);

/** L{sin(c√t)} = c√π e^{-c²/4s} / (2 s^{3/2}) (checked against a numerical integral). */
function sineOfSqrt(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  const c = sqrtTCoefficient(ce, opAt(expr, 0), tName);
  if (c === undefined) return undefined;
  const scale = ce.function("Divide", [
    ce.function("Multiply", [c, ce.function("Sqrt", [ce.Pi])]),
    ce.function("Multiply", [2, ce.function("Power", [s, ce.number([3, 2])])]),
  ]);
  return ce.function("Multiply", [scale, expOfSqrt(ce, c, s)]).evaluate();
}

/** L{cos(c√t)/√t} = √(π/s) e^{-c²/4s} (checked against a numerical integral); `factors` are t^{-1/2} and cos(c√t). */
function cosineOfSqrtOverSqrt(
  ce: ComputeEngine,
  factors: readonly BoxedExpression[],
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  if (factors.length !== 2) return undefined;
  const cos = factors.find((f) => f.operator === "Cos");
  const root = factors.find((f) => f !== cos);
  if (cos === undefined || root === undefined) return undefined;
  const { base, exp } = powerParts(ce, root);
  const k = scaledByT(ce, base, tName);
  const c = sqrtTCoefficient(ce, opAt(cos, 0), tName);
  if (k === undefined || c === undefined || realOf(exp) !== -0.5) return undefined;
  // √π s^(-1/2) rather than √(π/s): the same where s > 0, and the principal branch Wolfram's closed forms use elsewhere
  const image = ce.function("Multiply", [
    ce.function("Sqrt", [ce.Pi]),
    ce.function("Power", [s, ce.number([-1, 2])]),
    expOfSqrt(ce, c, s),
  ]);
  return ce.function("Divide", [image, ce.function("Sqrt", [k])]).evaluate();
}

/**
 * L{C(c√t)} =√a·√(ρ+s)/(2sρ) and L{S(c√t)} = √a·√(ρ-s)/(2sρ), a = πc²/2, ρ = √(a²+s²): from
 * C' = c·cos(at)/(2√t) (a = πc²/2) and L{e^{iat}/√t} = √π (s-ia)^{-1/2}, taking the real and
 * imaginary parts; C(0) = S(0) = 0, so the transform of the derivative divides by s.
 */
function fresnelOfSqrt(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  const c = sqrtTCoefficient(ce, opAt(expr, 0), tName);
  if (c === undefined) return undefined;
  const a = ce.function("Multiply", [ce.number([1, 2]), ce.Pi, ce.function("Power", [c, 2])]);
  const rootA = ce.function("Multiply", [c, ce.function("Sqrt", [ce.function("Divide", [ce.Pi, 2])])]);
  const rho = ce.function("Sqrt", [ce.function("Add", [ce.function("Power", [a, 2]), ce.function("Power", [s, 2])])]);
  const shifted = ce.function(expr.operator === "FresnelC" ? "Add" : "Subtract", [rho, s]);
  return ce
    .function("Divide", [
      ce.function("Multiply", [rootA, ce.function("Sqrt", [shifted])]),
      ce.function("Multiply", [2, s, rho]),
    ])
    .evaluate();
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
    const a = kernel === "laplace" ? pureLinearCoeff(ce, exponent, tName) : imaginaryLinearCoeff(ce, exponent, tName);
    if (a === undefined) continue;
    const rest = factors.filter((_, j) => j !== i);
    const g = rest.length === 0 ? ce.One : rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
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

const isConstOf = (name: string) => (o: BoxedExpression) => !hasVar(o, name);

/** `g` when `expr` is `g/t`, in whichever shape it took (`Divide[g, t]`, or a `1/t` or `t^-1` factor). */
export function dividedByT(ce: ComputeEngine, expr: BoxedExpression, tName: string): BoxedExpression | undefined {
  if (expr.operator === "Divide" && isSym(opAt(expr, 1), tName)) return opAt(expr, 0);
  if (expr.operator !== "Multiply") return undefined;
  const isReciprocal = (o: BoxedExpression) =>
    (o.operator === "Power" && isSym(opAt(o, 0), tName) && opAt(o, 1).re === -1 && opAt(o, 1).im === 0) ||
    (o.operator === "Divide" && opAt(o, 0).re === 1 && isSym(opAt(o, 1), tName));
  const ops = operandsOf(expr);
  const idx = ops.findIndex(isReciprocal);
  if (idx === -1) return undefined;
  const rest = ops.filter((_, j) => j !== idx);
  return rest.length === 1 ? rest[0] : ce.function("Multiply", rest);
}

/** `term` as `c·core` with `c` free of the variable and `core` the one factor that isn't (none for a constant). */
function constantAndCore(
  ce: ComputeEngine,
  term: BoxedExpression,
  name: string,
): { c: BoxedExpression; core: BoxedExpression | undefined } | undefined {
  if (!hasVar(term, name)) return { c: term, core: undefined };
  if (term.operator === "Negate") {
    const inner = constantAndCore(ce, opAt(term, 0), name);
    return inner === undefined ? undefined : { c: ce.function("Negate", [inner.c]).evaluate(), core: inner.core };
  }
  if (term.operator === "Multiply") {
    const ops = operandsOf(term);
    const consts = ops.filter(isConstOf(name));
    const rest = ops.filter((o) => hasVar(o, name));
    if (rest.length !== 1) return undefined;
    return { c: consts.length === 0 ? ce.One : ce.function("Multiply", consts).evaluate(), core: rest[0] };
  }
  return { c: ce.One, core: term };
}

/**
 * L{g(t)/t}(s) = ∫_s^∞ L{g}(u) du (division by t; Abramowitz & Stegun §29.2 and Table 29.3),
 * for `g` a combination of 1, e^{at}, cos(at), cosh(at), sin(at), sinh(at). Termwise the
 * antiderivatives are
 *   c       -> -c·ln s              cos(at)  -> -(c/2)·ln(s²+a²)      sin(at)  -> c·arctan(a/s)
 *   c·e^{at} -> -c·ln(s-a)          cosh(at) -> -(c/2)·ln(s²-a²)      sinh(at) -> (c/2)·ln((s+a)/(s-a))
 * (so L{sin(at)/t} = arctan(a/s) and L{(e^{at}-e^{bt})/t} = ln((s-b)/(s-a)), for s>0 and
 * s>max(a, b, |a|) respectively). Every logarithmic term grows like c·ln u, so the integral
 * converges only when those c sum to zero — exactly g(0) = 0 — and anything else declines.
 */
function laplaceOverT(
  ce: ComputeEngine,
  g: BoxedExpression,
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  const weights: BoxedExpression[] = [];
  const logFactors: BoxedExpression[] = [];
  const closed: BoxedExpression[] = [];
  const logTerm = (base: BoxedExpression, exponent: BoxedExpression) =>
    logFactors.push(ce.function("Power", [base, exponent]));
  const sq = (x: BoxedExpression) => ce.function("Power", [x, 2]);
  for (const term of g.operator === "Add" ? operandsOf(g) : [g]) {
    const split = constantAndCore(ce, term, tName);
    if (split === undefined) return undefined;
    const { c, core } = split;
    const negC = ce.function("Negate", [c]);
    const halfNegC = ce.function("Multiply", [ce.number([-1, 2]), c]);
    if (core === undefined) {
      weights.push(c);
      logTerm(s, negC);
    } else if (core.operator === "Power" && isE(opAt(core, 0))) {
      const a = pureLinearCoeff(ce, opAt(core, 1), tName);
      if (a === undefined) return undefined;
      weights.push(c);
      logTerm(ce.function("Add", [s, ce.function("Negate", [a])]), negC);
    } else if (core.operator === "Cos" || core.operator === "Cosh") {
      const a = pureLinearCoeff(ce, opAt(core, 0), tName);
      if (a === undefined) return undefined;
      weights.push(c);
      const a2 = core.operator === "Cos" ? sq(a) : ce.function("Negate", [sq(a)]);
      logTerm(ce.function("Add", [sq(s), a2]), halfNegC);
    } else if (core.operator === "Sin") {
      const a = pureLinearCoeff(ce, opAt(core, 0), tName);
      if (a === undefined) return undefined;
      closed.push(ce.function("Multiply", [c, ce.function("Arctan", [ce.function("Divide", [a, s])])]));
    } else if (core.operator === "Sinh") {
      const a = pureLinearCoeff(ce, opAt(core, 0), tName);
      if (a === undefined) return undefined;
      const ratio = ce.function("Divide", [
        ce.function("Add", [s, a]),
        ce.function("Add", [s, ce.function("Negate", [a])]),
      ]);
      closed.push(ce.function("Multiply", [ce.number([1, 2]), c, ce.function("Ln", [ratio])]));
    } else {
      return undefined;
    }
  }
  if (logFactors.length > 0) {
    const total = ce.function("Add", weights).evaluate();
    if (total.re !== 0 || total.im !== 0) return undefined; // diverges at t = 0
    closed.push(ce.function("Ln", [ce.function("Multiply", logFactors)]));
  }
  return ce.function("Add", closed).evaluate();
}

/**
 * L{t^n·ln t}(s) = Γ(n+1)·(ψ(n+1) - ln s)/s^{n+1}, n > -1: the derivative in n of
 * L{t^n} = Γ(n+1)/s^{n+1} (A&S Table 29.3, with ψ = Γ'/Γ as in DLMF 5.2.2). n = 0 is
 * L{ln t} = -(γ + ln s)/s.
 */
function laplaceLog(
  ce: ComputeEngine,
  factors: readonly BoxedExpression[],
  s: BoxedExpression,
  tName: string,
): BoxedExpression | undefined {
  const isLogT = (o: BoxedExpression) => o.operator === "Ln" && isSym(opAt(o, 0), tName);
  const logs = factors.filter(isLogT);
  const others = factors.filter((o) => !isLogT(o));
  if (logs.length !== 1 || others.length > 1) return undefined;
  let n: BoxedExpression = ce.Zero;
  if (others.length === 1) {
    const p = others[0];
    if (isSym(p, tName)) n = ce.One;
    else if (p.operator === "Power" && isSym(opAt(p, 0), tName) && isRealAboveNegOne(opAt(p, 1))) n = opAt(p, 1);
    else return undefined;
  }
  const np1 = ce.function("Add", [n, ce.One]).evaluate();
  const bracket = ce.function("Add", [ce.function("Digamma", [np1]), ce.function("Negate", [ce.function("Ln", [s])])]);
  return ce
    .function("Multiply", [
      ce.function("Gamma", [np1]),
      bracket,
      ce.function("Power", [s, ce.function("Negate", [np1])]),
    ])
    .evaluate();
}

/**
 * The multivariate transform of a separable `f` (a sum of products whose every factor is in one
 * variable): the product of the one-variable transforms, as Wolfram's `LaplaceTransform[f, {t1, t2}, {s1, s2}]`.
 * A factor in two variables declines.
 */
function matchLaplaceSeparable(
  ce: ComputeEngine,
  f: BoxedExpression,
  ts: readonly BoxedExpression[],
  ss: readonly BoxedExpression[],
): BoxedExpression | undefined {
  if (f.operator === "Add") {
    const parts = operandsOf(f).map((o) => matchLaplaceSeparable(ce, o, ts, ss));
    return parts.some((p) => p === undefined) ? undefined : ce.function("Add", parts as BoxedExpression[]).evaluate();
  }
  const names = ts.map((t) => symbolNameOf(t));
  if (names.some((n) => n === undefined)) return undefined;
  const groups: BoxedExpression[][] = names.map(() => []);
  const constants: BoxedExpression[] = [];
  for (const factor of productFactors(ce, f)) {
    const dependent = names.flatMap((n, i) => (hasVar(factor, n as string) ? [i] : []));
    if (dependent.length > 1) return undefined;
    (dependent.length === 0 ? constants : groups[dependent[0] as number]!).push(factor);
  }
  const images = groups.map((g, i) =>
    matchLaplace(ce, g.length === 0 ? ce.One : ce.function("Multiply", g), ts[i]!, ss[i]!),
  );
  return images.some((x) => x === undefined)
    ? undefined
    : ce.function("Multiply", [...constants, ...(images as BoxedExpression[])]).evaluate();
}

/**
 * The multivariate transform of an `f` that is not separable, one variable at a time with the
 * others as parameters (the transform is an iterated integral); each step is the one-variable
 * rule table, which reads a root of `c·t` as `√c √t` (positive on the transform's domain).
 */
function matchLaplaceIterated(
  ce: ComputeEngine,
  f: BoxedExpression,
  ts: readonly BoxedExpression[],
  ss: readonly BoxedExpression[],
): BoxedExpression | undefined {
  let image: BoxedExpression | undefined = f;
  for (let i = 0; i < ts.length && image !== undefined; i++) image = matchLaplace(ce, image, ts[i]!, ss[i]!);
  return image;
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
  const g = dividedByT(ce, expr, tName);
  if (g !== undefined) {
    const over = laplaceOverT(ce, g, s, tName);
    if (over !== undefined) return over;
  }
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
  const ofFactors = (ops: readonly BoxedExpression[]) => {
    const consts = ops.filter((o) => !hasVar(o, tName));
    const rest = ops.filter((o) => hasVar(o, tName));
    const core =
      rest.length === 1
        ? (atomicLaplace(ce, rest[0], s, tName) ?? shiftFactor(ce, rest, s, tName, "laplace", recur))
        : (laplaceLog(ce, rest, s, tName) ??
          cosineOfSqrtOverSqrt(ce, rest, s, tName) ??
          shiftFactor(ce, rest, s, tName, "laplace", recur));
    if (core === undefined) return undefined;
    return consts.length === 0 ? core : ce.function("Multiply", [...consts, core]).evaluate();
  };
  if (expr.operator === "Multiply") return ofFactors(operandsOf(expr));
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    return shiftFactor(ce, [expr], s, tName, "laplace", recur);
  }
  // A quotient the table has no entry for as a whole is its factors, numerator and reciprocal denominators
  return (
    atomicLaplace(ce, expr, s, tName) ?? (expr.operator === "Divide" ? ofFactors(productFactors(ce, expr)) : undefined)
  );
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
  if (expr.operator === "UnitStep" && operandsOf(expr).length === 1 && isSym(opAt(expr, 0), tName)) {
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
    return ce.function("Multiply", [ce.I, pref, ce.function("Add", [plus, ce.function("Negate", [minus])])]).evaluate();
  }
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    const exponent = opAt(expr, 1);
    const negA = negSquareCoeff(ce, exponent, tName); // Exp(-a t²), Re(a) > 0
    if (negA !== undefined && negA.isPositive === true) {
      const denom = ce.function("Power", [ce.function("Multiply", [4, negA]), -1]);
      const gaussExp = ce.function("Negate", [ce.function("Multiply", [ce.function("Power", [w, 2]), denom])]);
      const pref = ce.function("Power", [ce.function("Multiply", [2, negA]), ce.number([-1, 2])]);
      return ce.function("Multiply", [pref, ce.function("Exp", [gaussExp])]).evaluate();
    }
    const absA = negAbsCoeff(ce, exponent, tName); // Exp(-a|t|), a > 0
    if (absA !== undefined && absA.isPositive === true) {
      const numer = ce.function("Multiply", [
        absA,
        ce.function("Power", [ce.function("Divide", [2, ce.Pi]), ce.number([1, 2])]),
      ]);
      const denom = ce.function("Add", [ce.function("Power", [absA, 2]), ce.function("Power", [w, 2])]);
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
        ? (atomicFourier(ce, rest[0], w, tName) ?? shiftFactor(ce, rest, w, tName, "fourier", recur))
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

/** The quadratic factor `s² + k` of a denominator: `k = a²` (trigonometric) or `-a²`
 * (hyperbolic), with `a` read off directly as in `asQuadraticRatio`, or a numeric `k` either way. */
interface Quadratic {
  readonly a: BoxedExpression;
  readonly trig: boolean;
  readonly k: BoxedExpression;
}

function asQuadraticFactor(ce: ComputeEngine, base: BoxedExpression, sName: string): Quadratic | undefined {
  if (base.operator !== "Add" || operandsOf(base).length !== 2) return undefined;
  const [d1, d2] = operandsOf(base);
  const isS2 = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), sName) && opAt(o, 1).re === 2;
  const k = isS2(d1) ? d2 : isS2(d2) ? d1 : undefined;
  if (k === undefined || hasVar(k, sName)) return undefined;
  const squareRoot = (x: BoxedExpression) => (x.operator === "Power" && opAt(x, 1).re === 2 ? opAt(x, 0) : undefined);
  if (k.operator === "Negate") {
    const a = squareRoot(opAt(k, 0));
    return a === undefined ? undefined : { a, trig: false, k };
  }
  const a = squareRoot(k);
  if (a !== undefined) return { a, trig: true, k };
  if (k.im === 0 && Number.isFinite(k.re) && k.re !== 0) {
    const root = ce.function("Sqrt", [k.re > 0 ? k : ce.function("Negate", [k])]).evaluate();
    return { a: root, trig: k.re > 0, k };
  }
  return undefined;
}

export interface Factor {
  readonly base: BoxedExpression;
  readonly power: number;
}

/** `expr` as `numer` over `denom`, each a product of integer powers, through any mix of
 * Multiply, Divide and negative powers. */
export function fractionFactors(expr: BoxedExpression): { numer: Factor[]; denom: Factor[] } {
  const numer: Factor[] = [];
  const denom: Factor[] = [];
  const walk = (e: BoxedExpression, inverted: boolean): void => {
    if (e.operator === "Multiply") return operandsOf(e).forEach((o) => walk(o, inverted));
    if (e.operator === "Divide") {
      walk(opAt(e, 0), inverted);
      return walk(opAt(e, 1), !inverted);
    }
    const exponent = e.operator === "Power" ? opAt(e, 1) : undefined;
    if (exponent !== undefined && exponent.im === 0 && Number.isInteger(exponent.re)) {
      const flipped = exponent.re < 0 !== inverted;
      return void (flipped ? denom : numer).push({ base: opAt(e, 0), power: Math.abs(exponent.re) });
    }
    (inverted ? denom : numer).push({ base: e, power: 1 });
  };
  walk(expr, false);
  return { numer, denom };
}

/**
 * c·sˡ over a product of distinct quadratics `s² + kᵢ`, or over one of them squared, as
 * sines and cosines (hyperbolic for k < 0). Distinct factors split in partial fractions in
 * u = s²: with l = 2m or 2m+1, c·sˡ/∏(u+kᵢ) = c·sˡ⁻²ᵐ·ΣAᵢ/(u+kᵢ), Aᵢ = (-kᵢ)ᵐ/∏_{j≠i}(kⱼ-kᵢ),
 * and 1/(s²+k) ↦ sin(√k t)/√k, s/(s²+k) ↦ cos(√k t) (A&S Table 29.3). The squared factor is
 * that table's own (s²+a²)⁻² entries, for l = 0..3:
 *   (sin at - at cos at)/(2a³),  t sin(at)/(2a),  (sin at + at cos at)/(2a),  cos at - (at/2) sin at
 * and the hyperbolic ones follow under a ↦ ia. A single quadratic to the first power is the
 * existing entry, so this declines it.
 */
function inverseQuadraticRational(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
  t: BoxedExpression,
): BoxedExpression | undefined {
  const { numer, denom } = fractionFactors(expr);
  let degree = 0;
  const coefficient: BoxedExpression[] = [];
  for (const f of numer) {
    if (!hasVar(f.base, sName)) coefficient.push(ce.function("Power", [f.base, f.power]));
    else if (isSym(f.base, sName)) degree += f.power;
    else return undefined;
  }
  const quadratics: { q: Quadratic; multiplicity: number }[] = [];
  for (const f of denom) {
    if (!hasVar(f.base, sName)) {
      coefficient.push(ce.function("Power", [f.base, -f.power]));
      continue;
    }
    const q = asQuadraticFactor(ce, f.base, sName);
    if (q === undefined) return undefined;
    const same = quadratics.find((entry) => JSON.stringify(entry.q.k.json) === JSON.stringify(q.k.json));
    if (same === undefined) quadratics.push({ q, multiplicity: f.power });
    else same.multiplicity += f.power;
  }
  const order = quadratics.reduce((sum, entry) => sum + entry.multiplicity, 0);
  if (quadratics.length === 0 || order < 2 || degree >= 2 * order) return undefined;
  const c = coefficient.length === 0 ? ce.One : ce.function("Multiply", coefficient);
  const times = (...ops: (BoxedExpression | number)[]) => ce.function("Multiply", ops);
  const plus = (...ops: (BoxedExpression | number)[]) => ce.function("Add", ops);
  const neg = (x: BoxedExpression) => ce.function("Negate", [x]);
  const pair = (q: Quadratic) => {
    const at = times(q.a, t);
    return { at, sin: ce.function(q.trig ? "Sin" : "Sinh", [at]), cos: ce.function(q.trig ? "Cos" : "Cosh", [at]) };
  };

  if (quadratics.length === 1) {
    const { q, multiplicity } = quadratics[0];
    if (multiplicity !== 2) return undefined;
    const { at, sin, cos } = pair(q);
    const twoA = times(2, q.a);
    const sign = q.trig ? 1 : -1; // the a ↦ ia flip of the two odd-in-a² entries
    const image = [
      ce.function("Divide", [times(sign, plus(sin, neg(times(at, cos)))), times(2, ce.function("Power", [q.a, 3]))]),
      ce.function("Divide", [times(t, sin), twoA]),
      ce.function("Divide", [plus(sin, times(at, cos)), twoA]),
      plus(cos, times(-sign, ce.number([1, 2]), at, sin)),
    ][degree];
    return times(c, image).evaluate();
  }

  if (quadratics.some((entry) => entry.multiplicity !== 1)) return undefined;
  const m = Math.floor(degree / 2);
  const parts = quadratics.map(({ q }, i) => {
    const gaps = quadratics.filter((_, j) => j !== i).map((other) => plus(other.q.k, neg(q.k)));
    const { sin, cos } = pair(q);
    // (-k)^m is (±1)^m a^(2m), which keeps the 1/a of the sine image from surviving as a quotient
    const sign = q.trig ? (-1) ** m : 1;
    const odd = degree % 2 === 1;
    const power = ce.function("Power", [q.a, odd ? 2 * m : 2 * m - 1]);
    return ce.function("Divide", [times(sign, power, odd ? cos : sin), times(...gaps)]);
  });
  return times(c, plus(...parts)).evaluate();
}

/**
 * Σ cᵢ·ln(s - aᵢ) + Σ dⱼ·ln(s² + kⱼ), from Ln of a quotient of such factors or a sum of them, with
 * integer cᵢ, dⱼ: the images of -e^{at}/t and -2cos(√k t)/t (the transform of 1/t integrated
 * from s, run backwards; A&S Table 29.3's ln((s+a)/(s+b)) and ln((s²+a²)/(s²+b²)) entries), so
 *   Σ cᵢ ln(s - aᵢ) + Σ dⱼ ln(s² + kⱼ)  ↦  -(Σ cᵢ e^{aᵢ t} + 2 Σ dⱼ cos(√kⱼ t))/t,
 * hyperbolic for kⱼ < 0. Every logarithm grows like ln s, so a convergent image needs
 * Σ cᵢ + 2 Σ dⱼ = 0 (the same g(0) = 0 as the forward rule), and anything else declines.
 */
function inverseLogarithms(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
  t: BoxedExpression,
): BoxedExpression | undefined {
  const linear: { a: BoxedExpression; c: number }[] = [];
  const quadratic: { q: Quadratic; d: number }[] = [];
  const addBase = (base: BoxedExpression, weight: number): boolean => {
    const a = unitShiftAmount(ce, base, sName);
    if (a !== undefined && !hasVar(a, sName)) {
      linear.push({ a, c: weight });
      return true;
    }
    const q = asQuadraticFactor(ce, base, sName);
    if (q === undefined) return false;
    quadratic.push({ q, d: weight });
    return true;
  };
  const addLog = (e: BoxedExpression, weight: number): boolean => {
    if (e.operator === "Add") return operandsOf(e).every((o) => addLog(o, weight));
    if (e.operator === "Negate") return addLog(opAt(e, 0), -weight);
    if (e.operator === "Multiply") {
      const ops = operandsOf(e);
      const numbers = ops.filter((o) => o.im === 0 && Number.isInteger(o.re));
      const rest = ops.filter((o) => !numbers.includes(o));
      if (rest.length !== 1) return false;
      return addLog(rest[0], weight * numbers.reduce((product, o) => product * o.re, 1));
    }
    if (e.operator !== "Ln") return false;
    const { numer, denom } = fractionFactors(opAt(e, 0));
    return [...numer.map((f) => [f, 1] as const), ...denom.map((f) => [f, -1] as const)].every(
      ([f, side]) => hasVar(f.base, sName) && addBase(f.base, weight * side * f.power),
    );
  };
  if (!addLog(expr, 1)) return undefined;
  const total = linear.reduce((sum, e) => sum + e.c, 0) + 2 * quadratic.reduce((sum, e) => sum + e.d, 0);
  if (total !== 0) return undefined;
  const parts = [
    ...linear.map(({ a, c }) => ce.function("Multiply", [c, ce.function("Exp", [ce.function("Multiply", [a, t])])])),
    ...quadratic.map(({ q, d }) =>
      ce.function("Multiply", [2 * d, ce.function(q.trig ? "Cos" : "Cosh", [ce.function("Multiply", [q.a, t])])]),
    ),
  ];
  return ce.function("Divide", [ce.function("Negate", [ce.function("Add", parts)]), t]).evaluate();
}

// --- Inverses of a product of fractional powers, shifts and a few special-function factors ---

const realOf = (x: BoxedExpression): number | undefined => (x.im === 0 && Number.isFinite(x.re) ? x.re : undefined);

/** `f` as `base^exp`, through Sqrt, Root and nested powers (`Root(s, 3)^-1` is `s^(-1/3)`); `e^x` stays whole. */
function powerParts(ce: ComputeEngine, f: BoxedExpression): { base: BoxedExpression; exp: BoxedExpression } {
  const nest = (base: BoxedExpression, q: BoxedExpression) => {
    const inner = powerParts(ce, base);
    return { base: inner.base, exp: inner.exp.isSame(ce.One) ? q : ce.function("Multiply", [inner.exp, q]).evaluate() };
  };
  if (f.operator === "Sqrt") return nest(opAt(f, 0), ce.number([1, 2]));
  if (f.operator === "Divide" && opAt(f, 0).isSame(ce.One)) return nest(opAt(f, 1), ce.NegativeOne);
  if (f.operator === "Root") return nest(opAt(f, 0), ce.function("Divide", [1, opAt(f, 1)]).evaluate());
  if (f.operator === "Power" && !isE(opAt(f, 0))) return nest(opAt(f, 0), opAt(f, 1));
  return { base: f, exp: ce.One };
}

/** The factors of a product, through Multiply, Divide and Negate (a divisor's factors as reciprocals). */
function productFactors(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression[] {
  if (expr.operator === "Multiply") return operandsOf(expr).flatMap((o) => productFactors(ce, o));
  if (expr.operator === "Negate") return [ce.NegativeOne, ...productFactors(ce, opAt(expr, 0))];
  if (expr.operator === "Divide") {
    const divisor = productFactors(ce, opAt(expr, 1)).map((f) => ce.function("Power", [f, -1]));
    return [...productFactors(ce, opAt(expr, 0)), ...divisor];
  }
  return [expr];
}

interface FactorSet {
  /** Factors free of s. */
  readonly coeff: BoxedExpression[];
  /** Every factor that depends on s, as written, but for the exponential (what a shift or a step rebuilds F from). */
  readonly rest: BoxedExpression[];
  /** Total exponent of s. */
  sExp: BoxedExpression;
  /** k in a factor e^{ks}. */
  decay: BoxedExpression;
  /** (s - a)^m, m a whole number. */
  readonly poles: { a: BoxedExpression; m: number }[];
  /** (s - a)^m, m not whole: the factor a shift moves to a bare power of s. */
  readonly shifted: { a: BoxedExpression }[];
  /** ln(c s)^k, c > 0. */
  readonly logs: { c: BoxedExpression; k: number }[];
  /** Γ(ν, s). */
  readonly gammas: BoxedExpression[];
  /** erf(√(a s)). */
  readonly erfs: BoxedExpression[];
  /** K_ν(b √s). */
  readonly bessels: { order: BoxedExpression; b: BoxedExpression }[];
}

/** `arg` as `b·√s` with `b` free of s, or undefined. */
function sqrtOfS(ce: ComputeEngine, arg: BoxedExpression, sName: string): BoxedExpression | undefined {
  const b: BoxedExpression[] = [];
  let roots = 0;
  for (const f of productFactors(ce, arg)) {
    if (!hasVar(f, sName)) b.push(f);
    else {
      const { base, exp } = powerParts(ce, f);
      if (!isSym(base, sName) || realOf(exp) !== 0.5) return undefined;
      roots++;
    }
  }
  return roots === 1 ? ce.function("Multiply", b).evaluate() : undefined;
}

/** F as a `FactorSet`, undefined when some factor of it is none of those. */
function classifyFactors(ce: ComputeEngine, expr: BoxedExpression, sName: string): FactorSet | undefined {
  const set: FactorSet = {
    coeff: [],
    rest: [],
    sExp: ce.Zero,
    decay: ce.Zero,
    poles: [],
    shifted: [],
    logs: [],
    gammas: [],
    erfs: [],
    bessels: [],
  };
  for (const f of productFactors(ce, expr)) {
    if (!hasVar(f, sName)) {
      set.coeff.push(f);
      continue;
    }
    const { base, exp } = powerParts(ce, f);
    const n = realOf(exp);
    const exponential = base.operator === "Power" && isE(opAt(base, 0));
    if (!exponential) set.rest.push(f);
    if (isSym(base, sName)) {
      if (n === undefined) return undefined;
      set.sExp = ce.function("Add", [set.sExp, exp]).evaluate();
    } else if (exponential) {
      const k = pureLinearCoeff(ce, opAt(base, 1), sName);
      if (k === undefined) return undefined;
      set.decay = ce.function("Add", [set.decay, ce.function("Multiply", [k, exp])]).evaluate();
    } else if (base.operator === "Add") {
      const a = unitShiftAmount(ce, base, sName);
      if (a === undefined || hasVar(a, sName) || n === undefined) return undefined;
      if (Number.isInteger(n)) set.poles.push({ a, m: n });
      else set.shifted.push({ a });
    } else if (base.operator === "Ln" && n !== undefined && Number.isInteger(n) && n > 0) {
      const c = pureLinearCoeff(ce, opAt(base, 0), sName);
      if (c === undefined || c.isPositive !== true) return undefined;
      set.logs.push({ c, k: n });
    } else if (base.operator === "Gamma" && operandsOf(base).length === 2 && n === 1) {
      if (!isSym(opAt(base, 1), sName) || hasVar(opAt(base, 0), sName)) return undefined;
      set.gammas.push(opAt(base, 0));
    } else if (base.operator === "Erf" && n === 1 && opAt(base, 0).operator === "Sqrt") {
      const a = pureLinearCoeff(ce, opAt(opAt(base, 0), 0), sName);
      if (a === undefined) return undefined;
      set.erfs.push(a);
    } else if (base.operator === "BesselK" && n === 1 && !hasVar(opAt(base, 0), sName)) {
      const b = sqrtOfS(ce, opAt(base, 1), sName);
      if (b === undefined) return undefined;
      set.bessels.push({ order: opAt(base, 0), b });
    } else {
      return undefined;
    }
  }
  return set;
}

/**
 * The inverse of a product of the factors `classifyFactors` knows, by rules from the usual
 * tables (A&S ch. 29, Erdélyi's Tables of Integral Transforms), each confirmed against wolframscript:
 *   - e^{-cs}·F: the second shifting theorem, f(t-c)·θ(t-c), c > 0;
 *   - F(s-a) with a √(s-a) in it: the first shifting theorem, e^{at}·f(t), the shift taking
 *     that factor to √s (once, so a second shift cannot loop);
 *   - s^{-ν}, non-whole ν > 0: t^{ν-1}/Γ(ν), and with ln(cs)^k, k ≤ 2, its first two derivatives
 *     in ν (s^{-ν} ln s = L{t^{ν-1}(ψ(ν) - ln t)/Γ(ν)}, DLMF 5.2.2);
 *   - Γ(ν, s)/s^ν: t^{ν-1}·θ(t-1) (Γ(ν, s) = s^ν L{t^{ν-1}θ(t-1)});
 *   - erf(√(as))/√s: θ(a-t)/√(πt);
 *   - 1/((s-a)√s): e^{at}·erf(√(at))/√a, and √s/(s-a) = 1/√s + a/((s-a)√s);
 *   - ln s/(s-a), a > 0: e^{at}(ln a - Ei(-at)).
 */
function inverseFactored(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
  t: BoxedExpression,
  allowShift = true,
): BoxedExpression | undefined {
  const parts = classifyFactors(ce, expr, sName);
  const tName = symbolNameOf(t);
  if (parts === undefined || tName === undefined) return undefined;
  const times = (...ops: BoxedExpression[]) => ce.function("Multiply", [...parts.coeff, ...ops]).evaluate();
  const rebuilt = ce.function("Multiply", parts.rest);

  if (!(parts.decay.re === 0 && parts.decay.im === 0)) {
    const c = ce.function("Negate", [parts.decay]).evaluate();
    if (c.isPositive !== true || c.operator === "Negate") return undefined;
    const g = inverseFactored(ce, rebuilt, sName, t, allowShift);
    if (g === undefined) return undefined;
    const later = ce.function("Add", [t, ce.function("Negate", [c])]);
    return times(g.subs({ [tName]: later }), ce.function("HeavisideTheta", [later]));
  }
  if (allowShift && parts.shifted.length === 1) {
    const { a } = parts.shifted[0];
    const moved = rebuilt.subs({ [sName]: ce.function("Add", [ce.symbol(sName), a]) }).evaluate();
    const g = inverseFactored(ce, moved, sName, t, false);
    return g === undefined ? undefined : times(ce.function("Exp", [ce.function("Multiply", [a, t])]), g);
  }
  if (parts.shifted.length > 0) return undefined;

  const nu = ce.function("Negate", [parts.sExp]).evaluate();
  const n = realOf(nu);
  const power = (v: BoxedExpression) =>
    ce.function("Divide", [ce.function("Power", [t, ce.function("Add", [v, -1])]), ce.function("Gamma", [v])]);
  const { poles, logs, gammas, erfs, bessels } = parts;
  if (bessels.length > 0) {
    // s^{-ν/2} K_ν(b√s) ↦ 2^{ν-1} b^{-ν} t^{ν-1} e^{-b²/4t} (b > 0): L{t^{ν-1} e^{-a/t}} = 2(a/s)^{ν/2} K_ν(2√(as)), a = b²/4
    const { order, b } = bessels[0];
    if (bessels.length > 1 || poles.length + logs.length + gammas.length + erfs.length > 0) return undefined;
    const v = ce.function("Multiply", [2, nu]).evaluate();
    if (n === undefined || b.isPositive !== true) return undefined;
    if (![v, ce.function("Negate", [v]).evaluate()].some((o) => order.isSame(o))) return undefined;
    const decay = ce.function("Divide", [ce.function("Power", [b, 2]), ce.function("Multiply", [4, t])]);
    return times(
      ce.function("Power", [2, ce.function("Add", [v, -1])]),
      ce.function("Power", [b, ce.function("Negate", [v])]),
      ce.function("Power", [t, ce.function("Add", [v, -1])]),
      ce.function("Exp", [ce.function("Negate", [decay])]),
    );
  }
  const bare = poles.length === 0 && logs.length === 0 && gammas.length === 0 && erfs.length === 0;

  if (bare) {
    if (n === undefined || n <= 0 || Number.isInteger(n)) return undefined; // whole powers: the table's own
    return times(power(nu));
  }
  if (logs.length === 1 && poles.length === 0 && gammas.length === 0 && erfs.length === 0) {
    const { c, k } = logs[0];
    if (k > 2 || n === undefined || n <= 0) return undefined;
    // ln(cs)^k = (ln c + ln s)^k, so with A = ln c + ψ(ν) - ln t: k = 1 gives A, k = 2 gives A² - ψ'(ν)
    const a = ce.function("Add", [
      ce.function("Ln", [c]),
      ce.function("Digamma", [nu]),
      ce.function("Negate", [ce.function("Ln", [t])]),
    ]);
    if (k === 1) return times(power(nu), a);
    const trigamma =
      n === 1 ? ce.function("Divide", [ce.function("Power", [ce.Pi, 2]), 6]) : ce.function("PolyGamma", [1, nu]);
    return times(power(nu), ce.function("Add", [ce.function("Power", [a, 2]), ce.function("Negate", [trigamma])]));
  }
  if (gammas.length === 1 && poles.length === 0 && logs.length === 0 && erfs.length === 0) {
    if (
      n === undefined ||
      !ce
        .function("Add", [gammas[0], ce.function("Negate", [nu])])
        .evaluate()
        .isSame(ce.Zero)
    )
      return undefined;
    return times(
      ce.function("Power", [t, ce.function("Add", [nu, -1])]),
      ce.function("HeavisideTheta", [ce.function("Add", [t, -1])]),
    );
  }
  if (erfs.length === 1 && poles.length === 0 && logs.length === 0 && gammas.length === 0) {
    const a = erfs[0];
    if (n !== 0.5 || a.isPositive !== true) return undefined;
    const root = ce.function("Sqrt", [ce.function("Multiply", [ce.Pi, t])]);
    return times(
      ce.function("Divide", [
        ce.function("HeavisideTheta", [ce.function("Add", [a, ce.function("Negate", [t])])]),
        root,
      ]),
    );
  }
  if (poles.length === 1 && poles[0].m === -1 && gammas.length === 0 && erfs.length === 0) {
    const { a } = poles[0];
    const eat = ce.function("Exp", [ce.function("Multiply", [a, t])]);
    const erfPart = ce.function("Multiply", [
      eat,
      ce.function("Erf", [ce.function("Sqrt", [ce.function("Multiply", [a, t])])]),
    ]);
    if (logs.length === 0 && n === 0.5) return times(ce.function("Divide", [erfPart, ce.function("Sqrt", [a])]));
    if (logs.length === 0 && n === -0.5) {
      const head = ce.function("Divide", [1, ce.function("Sqrt", [ce.function("Multiply", [ce.Pi, t])])]);
      return times(ce.function("Add", [head, ce.function("Multiply", [ce.function("Sqrt", [a]), erfPart])]));
    }
    const an = realOf(a);
    if (logs.length === 1 && logs[0].k === 1 && logs[0].c.isSame(ce.One) && n === 0 && an !== undefined && an > 0) {
      const ei = ce.function("ExpIntegralEi", [ce.function("Negate", [ce.function("Multiply", [a, t])])]);
      return times(eat, ce.function("Add", [ce.function("Ln", [a]), ce.function("Negate", [ei])]));
    }
  }
  return undefined;
}

/**
 * The elliptic-integral images (Erdélyi's tables): with m = a²/s²,
 *   K(m) - π/2 ↦ (aπ/2)·I₀(at/2)·I₁(at/2),   s(π/2 - E(m)) ↦ (aπ/2t)·I₀(at/2)·I₁(at/2),
 * from the series K = (π/2)Σ((½)ₙ/n!)² mⁿ, E = (π/2)(1 - Σ((½)ₙ/n!)² mⁿ/(2n-1)) inverted termwise.
 */
function inverseElliptic(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
  t: BoxedExpression,
): BoxedExpression | undefined {
  const outer: BoxedExpression[] = [];
  let sDegree = 0;
  let sum: BoxedExpression | undefined;
  for (const f of productFactors(ce, expr)) {
    const { base, exp } = powerParts(ce, f);
    if (!hasVar(f, sName)) outer.push(f);
    else if (isSym(base, sName) && realOf(exp) !== undefined) sDegree += realOf(exp) as number;
    else if (f.operator === "Add" && sum === undefined) sum = f;
    else return undefined;
  }
  if (sum === undefined) return undefined;
  let kind: "EllipticK" | "EllipticE" | undefined;
  let kappa: BoxedExpression = ce.Zero;
  let arg: BoxedExpression | undefined;
  const constants: BoxedExpression[] = [];
  for (const term of operandsOf(sum)) {
    const split = constantAndCore(ce, term, sName);
    if (split === undefined) return undefined;
    if (split.core === undefined) {
      constants.push(split.c);
    } else if ((split.core.operator === "EllipticK" || split.core.operator === "EllipticE") && kind === undefined) {
      kind = split.core.operator;
      kappa = split.c;
      arg = opAt(split.core, 0);
    } else return undefined;
  }
  if (kind === undefined || arg === undefined) return undefined;
  const balance = ce
    .function("Add", [...constants, ce.function("Multiply", [kappa, ce.number([1, 2]), ce.Pi])])
    .evaluate();
  if (!balance.isSame(ce.Zero)) return undefined;
  const scale: BoxedExpression[] = [];
  let argDegree = 0;
  for (const f of productFactors(ce, arg)) {
    const { base, exp } = powerParts(ce, f);
    if (!hasVar(f, sName)) scale.push(f);
    else if (isSym(base, sName) && realOf(exp) !== undefined) argDegree += realOf(exp) as number;
    else return undefined;
  }
  if (argDegree !== -2 || scale.length === 0) return undefined;
  const squared = ce.function("Multiply", scale).evaluate();
  const a =
    squared.operator === "Power" && opAt(squared, 1).re === 2 ? opAt(squared, 0) : ce.function("Sqrt", [squared]);
  if (kind === "EllipticK" ? sDegree !== 0 : sDegree !== 1) return undefined;
  const halfAt = ce.function("Multiply", [ce.number([1, 2]), a, t]);
  const product = ce.function("Multiply", [
    a,
    ce.number([1, 2]),
    ce.Pi,
    ce.function("BesselI", [0, halfAt]),
    ce.function("BesselI", [1, halfAt]),
  ]);
  const image = kind === "EllipticK" ? product : ce.function("Divide", [ce.function("Negate", [product]), t]);
  return ce.function("Multiply", [...outer, kappa, image]).evaluate();
}

function matchInverseLaplace(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  t: BoxedExpression,
): BoxedExpression | undefined {
  const sName = symbolNameOf(s);
  if (sName === undefined || !hasVar(expr, sName)) return undefined;
  const logarithmic = inverseLogarithms(ce, expr, sName, t);
  if (logarithmic !== undefined) return logarithmic;
  const special = inverseElliptic(ce, expr, sName, t) ?? inverseFactored(ce, expr, sName, t);
  if (special !== undefined) return special;
  if (expr.operator === "Add") {
    const parts = operandsOf(expr).map((o) => matchInverseLaplace(ce, o, s, t));
    if (parts.some((p) => p === undefined)) return undefined;
    return ce.function("Add", parts as BoxedExpression[]).evaluate();
  }
  if (expr.operator === "Negate") {
    const inner = matchInverseLaplace(ce, opAt(expr, 0), s, t);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  const rational = inverseQuadraticRational(ce, expr, sName, t);
  if (rational !== undefined) return rational;
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
    return ce.function("Divide", [ce.function("Power", [t, k - 1]), ce.function("Gamma", [k])]).evaluate();
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
function asReciprocalLinear(ce: ComputeEngine, expr: BoxedExpression, sName: string): BoxedExpression | undefined {
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
  const isS2 = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), sName) && opAt(o, 1).re === 2;
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
  t: BoxedExpression,
): BoxedExpression | undefined {
  const wName = symbolNameOf(w);
  if (wName === undefined) return undefined;
  if (expr.operator === "DiracDelta" && operandsOf(expr).length === 1 && isSym(opAt(expr, 0), wName)) {
    return ce.function("Divide", [ce.One, sqrt2pi(ce)]).evaluate();
  }
  // A w-free F is the transform of an impulse: matches matchFourier's constant case,
  // mirrored (w ↔ t) -- confirmed against wolframscript.
  if (!hasVar(expr, wName)) {
    return ce.function("Multiply", [expr, sqrt2pi(ce), ce.function("DiracDelta", [t])]).evaluate();
  }
  return undefined;
}

export function declareTransforms(ce: ComputeEngine): void {
  ce.declare("LaplaceTransform", {
    signature: "(expression, expression, expression) -> expression",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, t, s] = ops;
      if (f === undefined || t === undefined || s === undefined) return undefined;
      if (t.operator === "List" || s.operator === "List") {
        const [ts, ss] = [operandsOf(t), operandsOf(s)];
        if (t.operator !== s.operator || ts.length !== ss.length) return undefined;
        return matchLaplaceSeparable(ce, f, ts, ss) ?? matchLaplaceIterated(ce, f, ts, ss);
      }
      return matchLaplace(ce, f, t, s);
    },
  });
  ce.declare("InverseLaplaceTransform", {
    signature: "(expression, expression, expression) -> expression",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [F, s, t] = ops;
      if (F === undefined || s === undefined || t === undefined) return undefined;
      return matchInverseLaplace(ce, F, s, t);
    },
  });
  ce.declare("FourierTransform", {
    signature: "(expression, expression, expression) -> expression",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, t, w] = ops;
      if (f === undefined || t === undefined || w === undefined || ops.length > 3) return undefined;
      return matchFourier(ce, f, t, w);
    },
  });
  ce.declare("InverseFourierTransform", {
    signature: "(expression, expression, expression) -> expression",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [F, w, t] = ops;
      if (F === undefined || w === undefined || t === undefined || ops.length > 3) return undefined;
      return matchInverseFourier(ce, F, w, t);
    },
  });
}
