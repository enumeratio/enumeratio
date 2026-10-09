// The special-function heads offered upstream: LerchPhi. A pull request for a plain
// record below adds it to compute-engine's own library/special-functions.ts.
//
// BarnesG, LogBarnesG, LogGamma, ClausenCl, StieltjesGamma, DirichletEta/Beta/L/Character and
// PolyGamma at order -1 landed in compute-engine 0.146 and were retired; their kernels
// (numerics/) stay, called directly by @enumeratio/analytic and the frontend.
//
// EllipticE's complex-modulus fix (#346) landed in compute-engine 0.139 and was retired
// from here; HurwitzZeta/Zeta (#340, arbitrary-precision N(x, d)), PolyGamma (complex z)
// and PolyLog (non-integer/complex order) landed in compute-engine 0.141 and were retired
// too. `evaluateHurwitz`/`evaluateZeta`/`evaluatePolygamma` and the arbitrary-precision
// kernels below stay: @enumeratio/analytic still calls them directly for certified-
// precision evaluation, and DirichletBeta/DirichletL still need HurwitzZeta/Zeta correct
// beyond a double's digits.
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/engine";
import type { LibraryRecord } from "../../patch.ts";
import { atEnginePrecision, bigRealOperand, bigResult, DOUBLE_DIGITS } from "../../support/precise.ts";
import {
  declined,
  isFiniteNum,
  isRealInt,
  inexactComplex,
  numberResult,
  realCompile,
  wantsNumber,
  type EvalOptions,
  type NativeEval,
} from "../../support/box.ts";
import type { Cx } from "../numerics/complex-arithmetic.ts";
import { logGamma } from "../numerics/log-gamma.ts";
import { lerchPhi } from "../numerics/lerch-phi.ts";
import { lerchContinued } from "../numerics/lerch-phi-continuation.ts";
import { lerchPhiBig } from "../numerics/lerch-phi-big.ts";
import { hurwitzZeta, zetaGeneralized } from "../numerics/hurwitz-zeta.ts";
import { hurwitzZetaBig, zetaGeneralizedBig, type BigCx, bigCx } from "../numerics/hurwitz-zeta-big.ts";
import { digamma, polygamma, polygammaCoefficient } from "../numerics/polygamma.ts";
import { bernoulliPolyExpr } from "../numerics/bernoulli-rational.ts";

type Json = number | string | { num: string } | Json[];

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
  // unit circle) — neither the pole above nor the clean 0 that Re(s) < 0 gets. Declined,
  // not NaN: Wolfram calls it Indeterminate, which no numeric answer stands for.
  if (a.im === 0 && Number.isInteger(a.re) && a.re <= 0 && isFiniteNum(s) && s.re === 0 && s.im !== 0) {
    return undefined;
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

/** The most terms `Zeta(s, −n)` sums exactly: each adds a rational with a growing denominator. */
const MAX_EXACT_SHIFT = 64;

/**
 * Zeta(s, −n) = ζ(s) + Σ_{j=1}^n j^(−s): the (k+a)=0 slot is dropped and the terms before it are
 * |k+a|^(−s) (Wolfram's Zeta[s, a], the ((k+a)²)^(−s/2) form; DLMF 25.11.1 excludes a ≤ 0). Wolfram
 * agrees for every s ≠ 0 (s = 0 is the jump `evaluateZetaAtZero` keeps), checked against its kernel.
 * Exact where it can say more than a ζ(s) call: an integer s ≥ 2 (Zeta(2, −1) = 1 + π²/6), up to a
 * cap, and any other concrete exact s at n = 1 (1 + ζ(s)), which is where Wolfram stops too; a
 * longer sum with a non-closed ζ(s) stays symbolic. Elsewhere undefined, so it stays symbolic.
 */
export function zetaAtNonpositiveShift(
  ce: ComputeEngine,
  s: BoxedExpression,
  a: BoxedExpression,
): BoxedExpression | undefined {
  if (a.im !== 0 || !Number.isInteger(a.re) || a.re >= 0 || -a.re > MAX_EXACT_SHIFT || !isFiniteNum(s))
    return undefined;
  const sJson = s.json as unknown as Json;
  if (!isRealInt(s)) {
    // 1 + ζ(s) for an exact non-integer s; a float s is a numeric request and goes native.
    if (a.re !== -1 || (s as Partial<{ isExact: boolean }>).isExact === false) return undefined;
    return ce.box(["Add", 1, ["Zeta", sJson]] as never).evaluate();
  }
  if (s.re < 2) return undefined;
  const terms: Json[] = [["Zeta", sJson]];
  for (let j = 1; j <= -a.re; j++) terms.push(["Power", j, ["Negate", sJson]]);
  return ce.box(["Add", ...terms] as never).evaluate();
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
  // ζ(0, a) = 1/2 − a for every a (DLMF 25.11.13); no term is dropped at s = 0.
  if (!isFiniteNum(a) || a.re > 0 || (isRealInt(s) && s.re === 0)) return evaluateHurwitz(ce, ops, numeric);

  // Zeta(s, 0) = ζ(s): the (k+a)=0 term is dropped, leaving the Riemann sum. Exact.
  if (a.re === 0 && a.im === 0) {
    const expr = ce.box(["Zeta", s.json as unknown as never]);
    return numeric ? expr.N() : expr.evaluate();
  }

  // Exact only: the numeric kernels below answer a number.
  if (!numeric) {
    const shifted = zetaAtNonpositiveShift(ce, s, a);
    if (shifted !== undefined) return shifted;
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
  if (!r.im.isZero()) return inexactComplex(ce, r.re.toNumber(), r.im.toNumber());
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

/** Zeta(0, a) = 1/2 − a for every a (DLMF 25.11.13): at s = 0 the (n+a)=0 term is 0⁰ = 1, kept.
 * Native Zeta drops it, so Zeta(0, 0) = −1/2 and Zeta(0, −1) = 1/2 where the formula gives
 * 1/2 and 3/2. Every other s still drops the 0^(−s) term. */
export function evaluateZetaAtZero(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Zeta"],
    (ops) => ops.length === 2 && ops[0]?.re === 0 && ops[0]?.im === 0,
    () => (ops, options) => {
      const value = ce.box(["Subtract", ["Rational", 1, 2], ops[1]!.json as never]);
      return options.numericApproximation ? value.N() : value.evaluate();
    },
    2,
  );
}

/** Exact Zeta(s, −n) (`zetaAtNonpositiveShift`), which native leaves unevaluated; a numeric request still reaches the native kernel. */
export function evaluateZetaAtNonpositiveShift(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Zeta"],
    (ops) => ops.length === 2,
    (native) => (ops, options) =>
      (!options.numericApproximation ? zetaAtNonpositiveShift(ce, ops[0]!, ops[1]!) : undefined) ??
      native?.(ops, options),
    2,
  );
}
