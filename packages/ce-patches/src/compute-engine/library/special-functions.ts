// The special-function heads offered upstream (https://github.com/enumeratio/enumeratio/wiki/Upstreaming §10): BarnesG,
// LogBarnesG, LogGamma, ClausenCl, StieltjesGamma and LerchPhi. A pull request for a plain
// record below adds it to compute-engine's own library/special-functions.ts.
//
// EllipticE's complex-modulus fix (#346) landed in compute-engine 0.139 and was retired
// from here; HurwitzZeta/Zeta (#340, arbitrary-precision N(x, d)), PolyGamma (complex z)
// and PolyLog (non-integer/complex order) landed in compute-engine 0.141 and were retired
// too. `evaluateHurwitz`/`evaluateZeta`/`evaluatePolygamma` and the arbitrary-precision
// kernels below stay: @enumeratio/analytic still calls them directly for certified-
// precision evaluation, and DirichletBeta/DirichletL still need HurwitzZeta/Zeta correct
// beyond a double's digits.
import { BigDecimal, type BoxedExpression, type ComputeEngine, isNumber, isSymbol } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import type { LibraryRecord } from "../../patch.ts";
import { atEnginePrecision, bigRealOperand, bigResult, DOUBLE_DIGITS } from "../../support/precise.ts";
import {
  declined,
  isFiniteNum,
  isRealInt,
  numberResult,
  realCompile,
  wantsNumber,
  type EvalOptions,
  type NativeEval,
} from "../../support/box.ts";
import { cx, type Cx } from "../numerics/complex-arithmetic.ts";
import { barnesG, logBarnesG } from "../numerics/barnes-g.ts";
import { barnesGBig } from "../numerics/barnes-g-big.ts";
import { clausen } from "../numerics/clausen.ts";
import { logGamma } from "../numerics/log-gamma.ts";
import { lerchPhi } from "../numerics/lerch-phi.ts";
import { lerchContinued } from "../numerics/lerch-phi-continuation.ts";
import { lerchPhiBig } from "../numerics/lerch-phi-big.ts";
import { stieltjesGamma, STIELTJES_MAX_ORDER } from "../numerics/stieltjes.ts";
import { stieltjesGammaBig } from "../numerics/stieltjes-big.ts";
import { hurwitzZeta, zetaGeneralized } from "../numerics/hurwitz-zeta.ts";
import { hurwitzZetaBig, zetaGeneralizedBig, type BigCx, bigCx } from "../numerics/hurwitz-zeta-big.ts";
import { digamma, polygamma, polygammaCoefficient } from "../numerics/polygamma.ts";
import { bernoulliPolyExpr } from "../numerics/bernoulli-rational.ts";

type Json = number | string | { num: string } | Json[];

// --- BarnesG / LogBarnesG ------------------------------------------------------------
// cortex-js/compute-engine#340: the Barnes G-function BarnesG(z) and its logarithm
// LogBarnesG(z). Wolfram has both; compute-engine has neither.

const isNonPosInt = (x: BoxedExpression): boolean => isRealInt(x) && x.re <= 0;
const finish = (expr: BoxedExpression, numeric: boolean): BoxedExpression => (numeric ? expr.N() : expr.evaluate());

/** Superfactorial Π_{k=0}^{n−2} k! = G(n) for a positive integer n, exact. */
function superfactorial(n: number): bigint {
  let g = 1n;
  let f = 1n;
  for (let k = 1; k <= n - 2; k++) {
    f *= BigInt(k);
    g *= f;
  }
  return g;
}

const bigint = (v: bigint): Json => ({ num: v.toString() });

export function evaluateBarnesG(
  ce: ComputeEngine,
  z: BoxedExpression,
  numeric: boolean,
  log: boolean,
): BoxedExpression | undefined {
  if (isNonPosInt(z)) return log ? ce.symbol("NegativeInfinity") : ce.number(0);
  if (isRealInt(z)) {
    const g = bigint(superfactorial(z.re));
    return finish(ce.box((log ? ["Ln", g] : g) as never), numeric);
  }
  if (numeric) {
    // A real z past a double's digits: the arbitrary-precision kernel (barnes-g-big.ts). Its
    // logarithm only for z > 0: on the negative axis Wolfram's LogBarnesG continuation carries
    // an imaginary part of 2πk that ln G alone does not.
    const x = bigRealOperand(ce, z);
    const g = x === undefined || (log && !x.isPositive()) ? undefined : barnesGBig(x, ce.precision);
    if (g !== undefined) return bigResult(ce, log ? g.ln() : g);
  }
  if (numeric && Number.isFinite(z.re) && Number.isFinite(z.im)) {
    const v = cx(z.re, z.im);
    return numberResult(ce, log ? logBarnesG(v) : barnesG(v));
  }
  return undefined;
}

export const barnesGLibrary: LibraryRecord = {
  BarnesG: {
    description: "The Barnes G-function, the double gamma function satisfying G(z+1) = Γ(z)G(z).",
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      ops[0] === undefined ? undefined : evaluateBarnesG(options.engine, ops[0], wantsNumber(ops, options), false),
  },
  LogBarnesG: {
    description: "The logarithm of the Barnes G-function.",
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      ops[0] === undefined ? undefined : evaluateBarnesG(options.engine, ops[0], wantsNumber(ops, options), true),
  },
};

// --- LogGamma -------------------------------------------------------------------------
// cortex-js/compute-engine#340: LogGamma(z), the analytic continuation of ln Γ(z) (branch
// cut on (−∞, 0]). compute-engine has Gamma (complex) but no LogGamma head.

export function evaluateLogGamma(ce: ComputeEngine, z: BoxedExpression, numeric: boolean): BoxedExpression | undefined {
  if (isNonPosInt(z)) return ce.symbol("PositiveInfinity"); // Wolfram: Infinity at the poles
  if (isRealInt(z)) return finish(ce.box(["Ln", ["Factorial", z.re - 1]] as never), numeric);
  if (!numeric && z.im === 0 && z.re === 0.5) return ce.box(["Divide", ["Ln", "Pi"], 2] as never).evaluate();
  // z > 0: compute-engine's own GammaLn agrees with the continuation there, and carries
  // arbitrary precision where the double kernel below is stuck at ~1e-15. Left of the origin
  // the continuation is complex (GammaLn keeps the real part but drops the winding, which is
  // −iπ⌈−z⌉ there) — and a compute-engine complex number is a pair of doubles, so routing
  // gains nothing. The kernel keeps that side.
  if (numeric && isFiniteNum(z) && z.im === 0 && z.re > 0) {
    const native = atEnginePrecision(ce, ce.box(["GammaLn", z.json] as never).N());
    if (native !== undefined) return native;
  }
  if (numeric && isFiniteNum(z)) return numberResult(ce, logGamma(cx(z.re, z.im)));
  return undefined;
}

export const logGammaLibrary: LibraryRecord = {
  LogGamma: {
    description: "The analytic continuation of ln Γ(z), with branch cut on (−∞, 0].",
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      ops[0] === undefined ? undefined : evaluateLogGamma(options.engine, ops[0], wantsNumber(ops, options)),
  },
};

// --- ClausenCl ------------------------------------------------------------------------
// cortex-js/compute-engine#340: the Clausen functions ClausenCl(n, theta). Wolfram has no
// Clausen head either — it spells these as Im/Re PolyLog[n, E^(I theta)] — but mpmath does
// (clsin/clcos), and the family is common enough to be worth its own head.

const box = (ce: ComputeEngine, expr: Json): BoxedExpression => ce.box(expr as never);

/** Is this expression literally π/2 (as CE canonicalises it: Half·Pi or Pi/2)? */
const isHalfPi = (x: BoxedExpression): boolean => {
  const j = JSON.stringify(x.json);
  return (
    j === JSON.stringify(["Multiply", ["Rational", 1, 2], "Pi"]) ||
    j === JSON.stringify(["Divide", "Pi", 2]) ||
    j === JSON.stringify(["Multiply", "Half", "Pi"])
  );
};

export function evaluateClausen(
  ce: ComputeEngine,
  n: BoxedExpression,
  theta: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  if (!isRealInt(n) || n.re < 1) return undefined;
  const even = n.re % 2 === 0;
  // Cl_n(0): 0 for the sine series, ζ(n) for the cosine one (and Cl₁(0) = ∞).
  if (theta.im === 0 && theta.re === 0) {
    if (n.re === 1) return ce.symbol("PositiveInfinity");
    return finish(box(ce, even ? 0 : ["Zeta", n.re]), numeric);
  }
  // Cl_n(π) = 0 (even) or −η(n) (odd); Cl_n(π/2) = β(n) (even) or −2^{−n} η(n) (odd).
  if (isSymbol(theta) && theta.symbol === "Pi") {
    return finish(box(ce, even ? 0 : ["Negate", ["DirichletEta", n.re]]), numeric);
  }
  if (isHalfPi(theta)) {
    const r: Json = even
      ? ["DirichletBeta", n.re]
      : ["Negate", ["Multiply", ["Power", 2, -n.re], ["DirichletEta", n.re]]];
    return finish(box(ce, r), numeric);
  }
  if (numeric && Number.isFinite(theta.re) && Number.isFinite(theta.im) && theta.im === 0) {
    return numberResult(ce, cx(clausen(n.re, theta.re)));
  }
  return undefined;
}

export const clausenLibrary: LibraryRecord = {
  ClausenCl: {
    description: "The Clausen functions Cl_n(θ).",
    signature: "(integer, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateClausen(options.engine, ops[0], ops[1], wantsNumber(ops, options)),
  },
};

// --- StieltjesGamma --------------------------------------------------------------------
// cortex-js/compute-engine#340: the generalized Stieltjes constants StieltjesGamma(n, a).
// Wolfram has them; compute-engine does not.

export function evaluateStieltjes(
  ce: ComputeEngine,
  n: BoxedExpression,
  a: BoxedExpression | undefined,
  numeric: boolean,
): BoxedExpression | undefined {
  const done = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());
  if (!isRealInt(n) || n.re < 0) return undefined;
  if (a === undefined) {
    if (n.re === 0) return done(ce.symbol("EulerGamma"));
  } else {
    if (isNonPosInt(a)) return ce.symbol("ComplexInfinity");
    if (n.re === 0) {
      // γ₀(a) = −ψ(a); the native digamma is real-only, so a complex a that it leaves
      // unevaluated falls through to the kernel below.
      const r = done(ce.box(["Negate", ["PolyGamma", 0, a.json]] as unknown as never));
      if (!numeric || isNumber(r)) return r;
    }
  }
  if (n.re > STIELTJES_MAX_ORDER) return undefined;
  if (numeric) {
    // A real a past a double's digits: the arbitrary-precision kernel (stieltjes-big.ts).
    const x = bigRealOperand(ce, a ?? ce.One);
    const g = x === undefined ? undefined : stieltjesGammaBig(n.re, x, ce.precision);
    if (g !== undefined) return bigResult(ce, g);
  }
  const av = a === undefined ? cx(1) : cx(a.re, a.im);
  if (numeric && Number.isFinite(av.re) && Number.isFinite(av.im)) {
    return numberResult(ce, stieltjesGamma(n.re, av));
  }
  return undefined;
}

export const stieltjesLibrary: LibraryRecord = {
  StieltjesGamma: {
    description: "The generalized Stieltjes constants γₙ(a).",
    signature: "(integer, number?) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      ops[0] === undefined ? undefined : evaluateStieltjes(options.engine, ops[0], ops[1], wantsNumber(ops, options)),
  },
};

// --- LerchPhi ---------------------------------------------------------------------------
// cortex-js/compute-engine#340: the Lerch transcendent LerchPhi(z, s, a), which generalizes
// both HurwitzZeta (z = 1) and PolyLog (a = 1). Wolfram has it; compute-engine does not.

export function evaluateLerch(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const z = ops[0];
  const s = ops[1];
  const a = ops[2];
  if (z === undefined || s === undefined || a === undefined) return undefined;
  const boxed = (expr: unknown) => ce.box(expr as never);
  const done = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  // Φ(1, s, a) = ζ(s, a) — flows into the HurwitzZeta closed forms.
  if (z.im === 0 && z.re === 1) return done(boxed(["HurwitzZeta", s.json, a.json]));
  // Φ(0, s, a) = a^(−s): only the n = 0 term survives (0⁰ = 1).
  if (z.is(0)) return done(boxed(["Power", a.json, ["Negate", s.json]]));
  // Φ(z, 0, a) = 1/(1 − z), independent of a (the geometric series and its continuation).
  if (s.im === 0 && Number.isInteger(s.re) && s.re === 0) return done(boxed(["Divide", 1, ["Subtract", 1, z.json]]));
  // Past |z| = 1 the series stops converging: continue by the integral representation
  // (lerch-phi-continuation.ts), with compute-engine's own upper incomplete Γ. See
  // lerch-phi-continuation.ts for how the rim (|z| = 1) is handled the same way.
  const absZ = Math.hypot(z.re, z.im);
  const onRim = z.im !== 0 && Math.abs(absZ - 1) < 1e-9;
  if (numeric && isFiniteNum(z) && isFiniteNum(s) && isFiniteNum(a) && (absZ > 1 || onRim)) {
    const upperGamma = (sigma: Cx, x: Cx): Cx | undefined => {
      const v = ce.box(["Gamma", ["Complex", sigma.re, sigma.im], ["Complex", x.re, x.im]]).N();
      return isFiniteNum(v) ? { re: v.re, im: v.im } : undefined;
    };
    const continued = lerchContinued(
      { re: z.re, im: z.im },
      { re: s.re, im: s.im },
      { re: a.re, im: a.im },
      upperGamma,
    );
    return continued === undefined ? undefined : numberResult(ce, continued);
  }
  if (numeric) {
    // Real arguments past a double's digits: the arbitrary-precision series (lerch-phi-big.ts).
    const [zb, sb, ab] = [z, s, a].map((x) => bigRealOperand(ce, x));
    const phi = zb && sb && ab ? lerchPhiBig(zb, sb, ab, ce.precision) : undefined;
    if (phi !== undefined) return bigResult(ce, phi);
  }
  if (numeric && isFiniteNum(z) && isFiniteNum(s) && isFiniteNum(a)) {
    return numberResult(ce, lerchPhi({ re: z.re, im: z.im }, { re: s.re, im: s.im }, { re: a.re, im: a.im }));
  }
  return undefined; // stay symbolic
}

export const lerchPhiLibrary: LibraryRecord = {
  LerchPhi: {
    description: "The Lerch transcendent Φ(z, s, a) = Σ zⁿ(n+a)^(−s).",
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluateLerch(options.engine, ops, wantsNumber(ops, options)),
    compile: realCompile(3, { js: "__lp", wgsl: "lerchPhi" }),
  },
};

// --- PolyLog past a double's digits ------------------------------------
// compute-engine evaluates PolyLog natively, in doubles only. At real arguments inside the
// Lerch series' disk of convergence this answers to the engine's precision on the
// arbitrary-precision series (lerch-phi-big.ts); everything else is the native handler's.
// Upstream this is a branch at the top of the native `evaluate`.

/** Liₛ(z) = z·Φ(z, s, 1) to `ce.precision` digits for real s and z where the series
 * converges; `undefined` anywhere else. */
export function polyLogPrecise(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length !== 2) return undefined;
  const [sb, zb] = ops.map((x) => bigRealOperand(ce, x));
  const phi = sb && zb ? lerchPhiBig(zb, sb, BigDecimal.ONE, ce.precision) : undefined;
  return phi === undefined ? undefined : bigResult(ce, zb!.mul(phi));
}

// --- HurwitzZeta, and Zeta widened to complex s / two-argument form -------------------
// cortex-js/compute-engine#340, offered as PR #350: the complex Riemann zeta ζ(s), the
// two-argument generalized zeta Zeta(s, a), and the two-argument Hurwitz zeta
// HurwitzZeta(s, a) — Wolfram has all three; compute-engine's native `Zeta` is real,
// one-argument only.

export function evaluateHurwitz(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const s = ops[0];
  const a = ops[1];
  if (s === undefined || a === undefined) return undefined;

  const boxed = (expr: Json) => ce.box(expr as never);
  const done = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  // ζ(1, a): a simple pole for every a.
  if (isRealInt(s) && s.re === 1) return ce.symbol("ComplexInfinity");

  // ζ(−n, a) = −B_{n+1}(a)/(n+1). Exact and polynomial in a — works for symbolic a.
  if (isRealInt(s) && s.re <= 0) {
    const nn = -s.re;
    const poly = bernoulliPolyExpr(nn + 1, a.json as unknown as Json);
    return done(boxed(["Divide", ["Negate", poly], nn + 1]));
  }

  // ζ(s, a) for a a nonpositive integer: the (n+a) = 0 term is 0^{−s}. Re(s) > 0: a genuine
  // pole (0^{−s} diverges) — not the generalized-zeta convention (`Zeta(s, a)`, below) that
  // drops it and stays finite. Matches Wolfram, mpmath and SymPy, all of which diverge here.
  if (a.im === 0 && Number.isInteger(a.re) && a.re <= 0 && isFiniteNum(s) && s.re > 0) {
    return ce.symbol("ComplexInfinity");
  }
  // Re(s) = 0, s ≠ 0: 0^{−s} = 0^{−i·Im(s)} doesn't converge to any value (it winds the
  // unit circle) — neither the pole above nor the clean 0 that Re(s) < 0 gets. Wolfram calls
  // this Indeterminate; N() answers NaN, plain evaluate stays symbolic.
  if (numeric && a.im === 0 && Number.isInteger(a.re) && a.re <= 0 && isFiniteNum(s) && s.re === 0 && s.im !== 0) {
    return ce.symbol("NaN");
  }

  // ζ(s, m) for a positive integer m: ζ(s) − Σ_{k=1}^{m-1} k^{-s}. Skipped for a concretely
  // complex s, which ζ(s) can't evaluate numerically — those fall through to Euler–Maclaurin.
  const complexS = Number.isFinite(s.re) && Number.isFinite(s.im) && s.im !== 0;
  if (!complexS && a.im === 0 && Number.isInteger(a.re) && a.re >= 1) {
    const m = a.re;
    const sJson = s.json as unknown as Json;
    if (m === 1) return done(boxed(["Zeta", sJson]));
    const subtracted: Json[] = [];
    for (let k = 1; k < m; k++) subtracted.push(["Power", k, ["Negate", sJson]]);
    const tail: Json = subtracted.length === 1 ? subtracted[0] : ["Add", ...subtracted];
    return done(boxed(["Subtract", ["Zeta", sJson], tail]));
  }

  // ζ(n, a) = (−1)ⁿ ψ⁽ⁿ⁻¹⁾(a)/(n−1)! for an integer n ≥ 2 and real a > 0. Numeric path only.
  if (numeric && isRealInt(s) && s.re >= 2 && a.im === 0 && a.re > 0) {
    const n = s.re;
    const sign: Json = n % 2 === 0 ? 1 : -1;
    const viaPolygamma = atEnginePrecision(
      ce,
      boxed(["Divide", ["Multiply", sign, ["PolyGamma", n - 1, a.json as unknown as Json]], ["Factorial", n - 1]]).N(),
    );
    if (viaPolygamma !== undefined) return viaPolygamma;
  }

  // Numeric Euler–Maclaurin for everything else — only when a number is asked for.
  if (numeric && isFiniteNum(s) && isFiniteNum(a)) {
    return (
      bigZetaResult(ce, hurwitzZetaBig, s, a) ??
      numberResult(ce, hurwitzZeta({ re: s.re, im: s.im }, { re: a.re, im: a.im }))
    );
  }

  return undefined; // stay symbolic
}

export function evaluateZeta(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const s = ops[0];
  const a = ops[1];
  if (s === undefined || a === undefined) return undefined;

  if (isRealInt(s) && s.re === 1) return ce.symbol("ComplexInfinity"); // ζ(1, a) pole

  // Re(a) > 0, or a symbolic: identical to HurwitzZeta (exact reductions + EM).
  if (!isFiniteNum(a) || a.re > 0) return evaluateHurwitz(ce, ops, numeric);

  // Zeta(s, 0) = ζ(s): the (k+a)=0 term is dropped, leaving the Riemann sum. Exact.
  if (a.re === 0 && a.im === 0) {
    const expr = ce.box(["Zeta", s.json as unknown as never]);
    return numeric ? expr.N() : expr.evaluate();
  }

  // a concrete with Re(a) ≤ 0: generalized-zeta convention, numeric only.
  if (numeric && isFiniteNum(s)) {
    return (
      bigZetaResult(ce, zetaGeneralizedBig, s, a) ??
      numberResult(ce, zetaGeneralized({ re: s.re, im: s.im }, { re: a.re, im: a.im }))
    );
  }

  return undefined; // stay symbolic
}

/**
 * A numeric operand as BigDecimals. Above machine precision the real part is the engine's
 * bignum (1/3 to every digit asked for); at machine precision it is the double, which is
 * closer than the 15-digit bignum compute-engine would give.
 */
const bigOperand = (ce: ComputeEngine, x: BoxedExpression): BigCx =>
  bigCx(ce.precision > DOUBLE_DIGITS ? (x.bignumRe ?? x.re) : x.re, x.im);

/**
 * ζ on the bignum kernel, boxed; undefined to fall back to the double one. A real result
 * keeps the engine's precision. A complex one can't: compute-engine holds a complex number
 * as a pair of doubles, so each part is the double nearest the bignum value.
 */
function bigZetaResult(
  ce: ComputeEngine,
  kernel: (s: BigCx, a: BigCx, digits: number) => BigCx | undefined,
  s: BoxedExpression,
  a: BoxedExpression,
): BoxedExpression | undefined {
  if (zetaKernel !== "bignum") return undefined;
  const r = kernel(bigOperand(ce, s), bigOperand(ce, a), Math.max(ce.precision, 17));
  if (r === undefined) return undefined;
  if (!r.im.isZero()) return ce.number(ce.complex(r.re.toNumber(), r.im.toNumber()));
  return ce.number(ce.precision > DOUBLE_DIGITS ? r.re.toPrecision(ce.precision) : r.re.toNumber());
}

// --- PolyGamma widened to a complex z -------------------------------------------------
// cortex-js/compute-engine#340: PolyGamma(m, z) at a complex z. Native compute-engine
// already declares PolyGamma, but only evaluates it at a real z.

/**
 * ψ⁽ᵐ⁾(z) via the BigDecimal Hurwitz kernel (m ≥ 1), at enough working precision to clear
 * the Euler–Maclaurin cancellation `polygamma` (the double kernel) can decline on --
 * `hurwitzZetaBig`'s own `plan` sizes that precision from the cancellation itself, the
 * same way `bigZetaResult` gets HurwitzZeta/Zeta their precision. Undefined past
 * `MAX_WORKING_DIGITS`, or when the bignum route is switched off (`setZetaKernel`); the
 * caller falls back to `polygamma` and its cancellation guard.
 */
function bigPolygamma(ce: ComputeEngine, m: number, z: BoxedExpression): Cx | undefined {
  if (zetaKernel !== "bignum") return undefined;
  const r = hurwitzZetaBig(bigCx(m + 1), bigOperand(ce, z), Math.max(ce.precision, 17));
  if (r === undefined) return undefined;
  const k = polygammaCoefficient(m);
  return { re: k * r.re.toNumber(), im: k * r.im.toNumber() };
}

export function evaluatePolygamma(
  ce: ComputeEngine,
  native: NativeEval,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const r = native?.(ops, options);
  if (!declined(r, "PolyGamma")) return r;

  const m = ops[0];
  const z = ops[1];
  if (m === undefined || z === undefined) return r;
  if (!wantsNumber(ops, options)) return r;
  if (!isRealInt(m) || m.re < -1 || m.re > 170) return r;
  if (!isFiniteNum(z)) return r;

  const v =
    m.re === -1
      ? logGamma({ re: z.re, im: z.im })
      : m.re === 0
        ? digamma({ re: z.re, im: z.im })
        : (bigPolygamma(ce, m.re, z) ?? polygamma(m.re, { re: z.re, im: z.im }));
  // A NaN here off the real axis is the cancellation guard declining (`polygamma`'s
  // comment), not a pole -- poles sit on the real axis, where `native` already answered
  // before this ran. Stay symbolic there instead of reporting `ComplexInfinity` for what
  // is just a lost digit budget.
  if (Number.isNaN(v.re) && z.im !== 0) return r;
  return numberResult(ce, v);
}

// --- Gamma at infinities ----------------------------------------------------------------
// cortex-js/compute-engine#340: Gamma(z) at the infinities DLMF/Wolfram give exact answers
// for. Native compute-engine already gets three of the four right -- Gamma(+∞) = +∞,
// Gamma(−∞) and Gamma(ComplexInfinity) = Indeterminate -- it just doesn't recognize a
// pure-imaginary directed infinity (DirectedInfinity(±i), Wolfram's own FullForm for i·∞)
// as anything but an ordinary argument, and leaves it unevaluated. |Γ(iy)| → 0 as y → ±∞
// (DLMF 5.11.9's decay off the positive real axis), so Γ(i·∞) = 0.

const isPureImaginaryDirection = (z: BoxedExpression): boolean => z.re === 0 && Number.isFinite(z.im) && z.im !== 0;

export function evaluateGammaAtInfinity(
  ce: ComputeEngine,
  native: NativeEval,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const r = native?.(ops, options);
  if (!declined(r, "Gamma")) return r;

  const z = ops[0];
  if (z === undefined || z.operator !== "DirectedInfinity") return r;
  const direction = operandsOf(z)[0];
  if (direction === undefined || !isPureImaginaryDirection(direction)) return r;

  return ce.number(0);
}

export { barnesG, barnesGReal, logBarnesG, logBarnesGReal } from "../numerics/barnes-g.ts";
export { barnesGBig, barnesGBall, pi as barnesGPi } from "../numerics/barnes-g-big.ts";
export { logGamma, logGammaReal, logGammaBig } from "../numerics/log-gamma.ts";
export { clausen } from "../numerics/clausen.ts";
export { stieltjesGamma, stieltjesGammaReal, STIELTJES_MAX_ORDER } from "../numerics/stieltjes.ts";
export { stieltjesGammaBall, stieltjesGammaBig } from "../numerics/stieltjes-big.ts";
export { lerchPhi, lerchPhiReal } from "../numerics/lerch-phi.ts";
export { lerchContinued } from "../numerics/lerch-phi-continuation.ts";
export { lerchPhiBig, lerchPhiBall } from "../numerics/lerch-phi-big.ts";
export { hurwitzZeta, hurwitzZetaReal, zetaGeneralized, zetaGeneralizedReal } from "../numerics/hurwitz-zeta.ts";
export { digamma, polygamma, polygammaReal } from "../numerics/polygamma.ts";
export { polyLog, polyLogReal } from "../numerics/polylog.ts";

/**
 * Which kernel numeric `HurwitzZeta` and `Zeta` evaluate on. `"bignum"` (the default) is
 * hurwitz-zeta-big.ts: correctly rounded, the same in every JS engine, and as many digits as
 * the engine asks for -- at a cost of milliseconds rather than microseconds. `"double"` is
 * `hurwitzZeta` (numerics/hurwitz-zeta.ts). Compiled code always uses the double kernel. This
 * lives here, not in the pure kernel file, since it is dispatch state for the boxed
 * evaluate handlers below, not part of the numeric kernel itself.
 */
export type ZetaKernel = "bignum" | "double";
let zetaKernel: ZetaKernel = "bignum";
export const setZetaKernel = (kernel: ZetaKernel): void => {
  zetaKernel = kernel;
};
