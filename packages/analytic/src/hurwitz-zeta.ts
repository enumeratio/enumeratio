import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { threadOverLists } from "@enumeratio/boxed";
import { bernoulliNumber, bernoulliPolyExpr, type Json } from "./bernoulli.ts";
import {
  type BoxInput,
  declined,
  type EvalOptions,
  isFiniteNum,
  isRealInt,
  type NativeEval,
  numberResult,
  realCompile,
  wantsNumber,
} from "./box.ts";
import { add, cexp, clog, cosPi, cpow, cx, type Cx, mul, scale, sinPi } from "./complex.ts";
import { type BigCx, bigCx, hurwitzZetaBig, zetaGeneralizedBig } from "./bigzeta.ts";
import { logGamma } from "./loggamma.ts";
import { lerchPhi } from "./lerch.ts";
import { lerchContinued } from "./lerch-continuation.ts";
import { evaluateIncompleteGamma } from "./incomplete-gamma.ts";
import { declareWidened } from "./widened.ts";
import { evaluatePolygamma } from "./polygamma.ts";
import { evaluatePolyLog } from "./polylog.ts";
import { atEnginePrecision, DOUBLE_DIGITS } from "./precise.ts";
import { declareCarlson } from "./carlson.ts";
import { declareDerivatives } from "./derivatives.ts";
import { declareElliptic } from "./elliptic.ts";
import { declareModular } from "./modular.ts";
import { declareMatrixExp } from "./matrix-exp.ts";
import { declareSpecialFunctions } from "./special-functions.ts";
import { declareBesselJZero } from "./bessel-zeros.ts";
import { declareDigammaFunctionZero } from "./digamma-zero.ts";
import { declareHypergeometricUStar } from "./hypergeometric-ustar.ts";
import { declareMultiZetaValue } from "./multizeta.ts";
import { declareSloaneA } from "./sloane-a.ts";
import { declareQSeries } from "./q-series.ts";
import { declareRiemannSiegel } from "./riemann-siegel.ts";

// Hurwitz zeta ζ(s, a) = Σ_{n≥0} (n+a)^{-s}, analytically continued, as a
// compute-engine head. Numeric evaluation is Euler–Maclaurin: sum the first N
// terms directly (which also shifts a into the right half-plane), then add the
// tail's integral, endpoint, and Bernoulli-number correction terms — or, left of
// Re(s) = 0, a Taylor series in a over Riemann zetas (see `hurwitzZeta`). Exact
// closed forms are returned symbolically where Wolfram has them: the s=1 pole,
// the ζ(−n, a) Bernoulli-polynomial values, and the ζ(s, m) reduction to the
// Riemann ζ that makes ζ(s, 1) = ζ(s).

/** Bernoulli correction pairs B₂..B₂ₖ used in the tail (optimal-truncation regime). */
const EM_PAIRS = 12;

/** cₖ = B₂ₖ / (2k)!, the Euler–Maclaurin tail coefficients. */
const EM_COEFF: number[] = (() => {
  const c: number[] = [0];
  let factorial = 1; // (2k)!
  for (let k = 1; k <= EM_PAIRS; k++) {
    factorial *= (2 * k - 1) * (2 * k);
    c[k] = bernoulliNumber(2 * k) / factorial;
  }
  return c;
})();

// Scratch registers for the allocation-free complex power below. The kernel is
// synchronous and single-threaded, so a shared pair is safe and keeps the hot loop
// from allocating a {re,im} per term (each eval does ~N+15 powers).
let _pr = 0;
let _pi = 0;

/** z^w for z = zr+zi·i, w = wr+wi·i, principal branch; result in _pr/_pi. */
function cpowInto(zr: number, zi: number, wr: number, wi: number): void {
  if (zi === 0 && zr > 0 && wi === 0) {
    _pr = Math.pow(zr, wr);
    _pi = 0;
    return;
  }
  // A negative real base to a real power: |z|^w · e^{iπw}, with the phase exact at
  // half-integers. cos(−1.5π) in floating point is −1.8e−16, not 0, and next to a huge
  // |z|^w (a tiny |z| to a negative power) that leaked hundreds into the real part.
  if (zi === 0 && zr < 0 && wi === 0) {
    const m = Math.pow(-zr, wr);
    _pr = m * cosPi(wr);
    _pi = m * sinPi(wr);
    return;
  }
  const logr = 0.5 * Math.log(zr * zr + zi * zi);
  const th = Math.atan2(zi, zr);
  const er = wr * logr - wi * th;
  const ei = wr * th + wi * logr;
  const m = Math.exp(er);
  _pr = m * Math.cos(ei);
  _pi = m * Math.sin(ei);
}

/**
 * Euler–Maclaurin for ζ(s, a); see `hurwitzZeta`, which calls it.
 *
 * Hot path: all complex arithmetic is inlined on primitive locals (no per-term
 * object allocation). The math is identical to the `Cx`-helper form; see
 * `zetaGeneralized` for the readable version of the same operations.
 */
function hurwitzEM(s: Cx, a: Cx): Cx {
  const sRe = s.re;
  const sIm = s.im;
  const aRe = a.re;
  const aIm = a.im;
  // Direct terms push a into Re(a)+N large relative to |s|, where the asymptotic
  // tail is accurate; a few more than |s| keeps the truncated series converging.
  const n = Math.max(8, Math.ceil(emEdge(s) - aRe));
  const negSr = -sRe;
  const negSi = -sIm;

  let sumR = 0;
  let sumI = 0;
  for (let k = 0; k < n; k++) {
    const br = aRe + k;
    if (br === 0 && aIm === 0) continue; // Wolfram HurwitzZeta drops (n+a)=0
    cpowInto(br, aIm, negSr, negSi);
    sumR += _pr;
    sumI += _pi;
  }

  const zr = aRe + n; // Re(z) large
  const zi = aIm;
  cpowInto(zr, zi, negSr, negSi); // z^{-s}
  const zNegSr = _pr;
  const zNegSi = _pi;

  cpowInto(zr, zi, 1 - sRe, -sIm); // z^{1-s}
  const dr = sRe - 1;
  const dd = dr * dr + sIm * sIm; // divide by (s-1)
  sumR += (_pr * dr + _pi * sIm) / dd;
  sumI += (_pi * dr - _pr * sIm) / dd;

  sumR += 0.5 * zNegSr; // ½ z^{-s}
  sumI += 0.5 * zNegSi;

  // Σ_{k≥1} cₖ · (s)_{2k-1} · z^{-(s+2k-1)}, rolling the Pochhammer and z-power forward.
  cpowInto(zr, zi, -2, 0); // z^{-2}
  const zi2r = _pr;
  const zi2i = _pi;
  const zd = zr * zr + zi * zi; // zPow = z^{-s}/z = z^{-(s+1)}
  let zpr = (zNegSr * zr + zNegSi * zi) / zd;
  let zpi = (zNegSi * zr - zNegSr * zi) / zd;
  let pochR = sRe; // (s)_1
  let pochI = sIm;
  for (let k = 1; k <= EM_PAIRS; k++) {
    sumR += EM_COEFF[k] * (pochR * zpr - pochI * zpi);
    sumI += EM_COEFF[k] * (pochR * zpi + pochI * zpr);
    // poch *= (s+2k-1)(s+2k)
    const gr = (sRe + 2 * k - 1) * (sRe + 2 * k) - sIm * sIm;
    const gi = (sRe + 2 * k - 1) * sIm + sIm * (sRe + 2 * k);
    const npR = pochR * gr - pochI * gi;
    pochI = pochR * gi + pochI * gr;
    pochR = npR;
    // zPow *= z^{-2}
    const nzr = zpr * zi2r - zpi * zi2i;
    zpi = zpr * zi2i + zpi * zi2r;
    zpr = nzr;
  }
  return { re: sumR, im: sumI };
}

/** How far from 1 (once shifted by an integer) a may sit for the Taylor series in a. */
const TAYLOR_RADIUS = 0.75;

/**
 * Past this many times `emEdge`, Euler–Maclaurin takes over from the Taylor series left of
 * the strip. Its direct terms stop cancelling at 1×, but its big tail still costs it a digit
 * or two out to ~4×, where walking a down to 1 + h stops being cheap.
 */
const EM_BEYOND = 4;

/**
 * Numeric ζ(s, a) for complex s, a. Terms where (n+a)=0 (a a nonpositive integer) are
 * dropped, matching Wolfram's `HurwitzZeta`, which omits the singular term rather than
 * diverging there. Returns a non-finite part at the s=1 pole.
 *
 * Euler–Maclaurin (`hurwitzEM`), except left of Re(s) = 0 with a near the real axis and not
 * far past where its direct terms end: there those terms grow like N^(−Re s) and cancel down
 * to an O(1) result. Instead a is shifted by an integer to b = 1 + h, |Re h| ≤ ½, and
 * ζ(s, 1 + h) = Σₖ C(−s, k) hᵏ ζ(s + k) sums Riemann zetas, each from the functional
 * equation, with no cancellation to speak of: the terms fall off like (2πh)ᵏ/k! against
 * ζ(s)'s own scale, so at most e^π of it is lost. An integer a is h = 0, ζ(s) alone.
 */
export function hurwitzZeta(s: Cx, a: Cx): Cx {
  if (s.re >= 0 || a.re >= EM_BEYOND * emEdge(s)) return hurwitzEM(s, a);
  const m = Math.floor(a.re - 0.5); // a − m has real part in [½, 3/2)
  const h = cx(a.re - m - 1, a.im);
  if (!(Math.hypot(h.re, h.im) <= TAYLOR_RADIUS)) return hurwitzEM(s, a); // NaN included
  // ζ(s, a) = ζ(s, a+1) + a^(−s): walk a to 1 + h, carrying the terms passed over.
  let z = zetaNearOne(s, h);
  for (let j = 0; j < Math.abs(m); j++) {
    const br = m > 0 ? h.re + 1 + j : a.re + j;
    if (br === 0 && a.im === 0) continue; // the dropped (n+a)=0 term
    cpowInto(br, a.im, -s.re, -s.im);
    z = m > 0 ? cx(z.re - _pr, z.im - _pi) : cx(z.re + _pr, z.im + _pi);
  }
  return z;
}

/** Where `hurwitzEM` starts its asymptotic tail; a at or past it sums no cancelling terms. */
function emEdge(s: Cx): number {
  return Math.max(12, Math.ceil(Math.abs(s.re) + Math.abs(s.im)) + 6);
}

/** ζ(s, 1 + h) = Σₖ C(−s, k) hᵏ ζ(s + k) for |h| < 1 — see `hurwitzZeta`. */
function zetaNearOne(s: Cx, h: Cx): Cx {
  let sum = riemannZeta(s);
  let c = cx(1, 0); // C(−s, k)
  let hk = cx(1, 0); // hᵏ
  let largest = Math.hypot(sum.re, sum.im);
  let small = 0;
  const cap = Math.ceil(Math.abs(s.re)) + 200;
  for (let k = 1; k < cap; k++) {
    hk = mul(hk, h);
    if (hk.re === 0 && hk.im === 0) break;
    const f = cx(-s.re - k + 1, -s.im);
    if (f.re === 0 && f.im === 0) {
      // s = 1 − k, an integer: C(−s, k) → 0 as ζ(s + k) → ∞, and their product → −C(−s, k−1)/k.
      // Every later C(−s, k) is 0, so the series ends here (a Bernoulli polynomial).
      const t = scale(mul(c, hk), -1 / k);
      return add(sum, t);
    }
    c = scale(mul(c, f), 1 / k);
    const t = mul(mul(c, hk), riemannZeta(cx(s.re + k, s.im)));
    sum = add(sum, t);
    const size = Math.hypot(t.re, t.im);
    largest = Math.max(largest, size);
    // Two in a row, since ζ at a negative even integer makes every other term vanish.
    if (size <= 1e-17 * largest) {
      if (++small === 2) break;
    } else small = 0;
  }
  return sum;
}

/**
 * ζ(s): the functional equation left of Re(s) = 0, Euler–Maclaurin across the strip, and far
 * right the bare series, whose nᵗʰ term is already below a double's reach by n = 10^(17/Re s).
 */
function riemannZeta(s: Cx): Cx {
  if (s.re < 0) return reflectedZeta(s);
  if (s.re < 16) return hurwitzEM(s, cx(1, 0));
  const n = Math.ceil(10 ** (17 / s.re));
  let z = cx(1, 0);
  for (let k = 2; k <= n; k++) {
    cpowInto(k, 0, -s.re, -s.im);
    z = cx(z.re + _pr, z.im + _pi);
  }
  return z;
}

/**
 * ζ(s) = 2ˢ πˢ⁻¹ sin(πs/2) Γ(1−s) ζ(1−s), for Re(s) < 0. Every factor but ζ(1−s) is taken
 * as a log and summed, so the huge Γ and sin at large |s| never meet outside exp.
 */
function reflectedZeta(s: Cx): Cx {
  const r = cx(1 - s.re, -s.im);
  const log = add(
    add(scale(s, Math.LN2), scale(cx(s.re - 1, s.im), Math.log(Math.PI))),
    add(logGamma(r), logSin(scale(s, Math.PI / 2))),
  );
  return mul(cexp(log), hurwitzEM(r, cx(1, 0)));
}

/**
 * ln sin w, up to 2πi. For Im w ≥ 0, sin w = (i/2)·e^(−iw)·(1 − e^(2iw)) with |e^(2iw)| ≤ 1,
 * so nothing overflows however large Im w is; below the axis, sin w̄ = conj(sin w).
 */
function logSin(w: Cx): Cx {
  if (w.im < 0) {
    const c = logSin(cx(w.re, -w.im));
    return cx(c.re, -c.im);
  }
  const u = cexp(cx(-2 * w.im, 2 * w.re)); // e^(2iw)
  const l = clog(cx(1 - u.re, -u.im));
  return cx(w.im + l.re - Math.LN2, -w.re + l.im + Math.PI / 2);
}

/**
 * Numeric Zeta(s, a) in Wolfram's generalized-zeta convention. Identical to
 * HurwitzZeta for Re(a) > 0; for a with Re(a) ≤ 0 it differs in the finitely many
 * terms off the positive axis: those use ((k+a)²)^(−s/2) (which is the real
 * |k+a|^(−s) when k+a is real and negative), and the (k+a)=0 slot is dropped. So,
 * unlike HurwitzZeta, Zeta(s, a) is finite at a = 0, −1, −2, … (Zeta(s, 0) = ζ(s)).
 */
export function zetaGeneralized(s: Cx, a: Cx): Cx {
  const negHalfS = scale(s, -0.5);
  let acc = cx(0, 0);
  let cur = cx(a.re, a.im);
  while (cur.re < 0) {
    acc = add(acc, cpow(mul(cur, cur), negHalfS)); // ((k+a)²)^(−s/2)
    cur = cx(cur.re + 1, cur.im);
  }
  if (cur.re === 0 && cur.im === 0) cur = cx(1, 0); // drop the (k+a)=0 term — no pole
  return add(acc, hurwitzZeta(s, cur));
}

/** Real-valued ζ(s, a) for real s, a — the shape compute-engine's compiled
 * (JS/GPU) plotting pipeline consumes, which is real-scalar. */
export const hurwitzZetaReal = (s: number, a: number): number =>
  hurwitzZeta({ re: s, im: 0 }, { re: a, im: 0 }).re;
export const zetaGeneralizedReal = (s: number, a: number): number =>
  zetaGeneralized({ re: s, im: 0 }, { re: a, im: 0 }).re;

/**
 * Which kernel numeric `HurwitzZeta` and `Zeta` evaluate on. `"bignum"` (the default) is
 * bigzeta.ts: correctly rounded, the same in every JS engine, and as many digits as the
 * engine asks for — at a cost of milliseconds rather than microseconds. `"double"` is
 * `hurwitzZeta` above. Compiled code always uses the double kernel.
 */
export type ZetaKernel = "bignum" | "double";
let zetaKernel: ZetaKernel = "bignum";
export const setZetaKernel = (kernel: ZetaKernel): void => {
  zetaKernel = kernel;
};

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

function evaluateHurwitz(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const s = ops[0];
  const a = ops[1];
  if (s === undefined || a === undefined) return undefined;

  const box = (expr: Json) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  // ζ(1, a): a simple pole for every a.
  if (isRealInt(s) && s.re === 1) return ce.symbol("ComplexInfinity");

  // ζ(−n, a) = −B_{n+1}(a)/(n+1). Exact and polynomial in a — works for symbolic a.
  if (isRealInt(s) && s.re <= 0) {
    const nn = -s.re;
    const poly = bernoulliPolyExpr(nn + 1, a.json as unknown as Json);
    return finish(box(["Divide", ["Negate", poly], nn + 1]));
  }

  // ζ(s, m) for a positive integer m: ζ(s) − Σ_{k=1}^{m-1} k^{-s}. Gives the
  // ζ(s, 1) = ζ(s) reduction and closed forms like ζ(2, 2) = π²/6 − 1. Skipped for
  // a concretely complex s, whose ζ(s) compute-engine can't evaluate numerically —
  // those fall through to Euler–Maclaurin, which handles complex s directly.
  const complexS = Number.isFinite(s.re) && Number.isFinite(s.im) && s.im !== 0;
  if (!complexS && a.im === 0 && Number.isInteger(a.re) && a.re >= 1) {
    const m = a.re;
    const sJson = s.json as unknown as Json;
    if (m === 1) return finish(box(["Zeta", sJson]));
    const subtracted: Json[] = [];
    for (let k = 1; k < m; k++) subtracted.push(["Power", k, ["Negate", sJson]]);
    const tail: Json = subtracted.length === 1 ? subtracted[0] : ["Add", ...subtracted];
    return finish(box(["Subtract", ["Zeta", sJson], tail]));
  }

  // ζ(n, a) = (−1)ⁿ ψ⁽ⁿ⁻¹⁾(a)/(n−1)! for an integer n ≥ 2 and real a > 0. Exact, and
  // compute-engine's PolyGamma carries it to whatever precision was asked for, which the
  // double-precision kernel below cannot. Numeric path only: under plain evaluate the head
  // keeps its own form rather than trading it for a polygamma.
  if (numeric && isRealInt(s) && s.re >= 2 && a.im === 0 && a.re > 0) {
    const n = s.re;
    const sign: Json = n % 2 === 0 ? 1 : -1;
    const viaPolygamma = atEnginePrecision(
      ce,
      box([
        "Divide",
        ["Multiply", sign, ["PolyGamma", n - 1, a.json as unknown as Json]],
        ["Factorial", n - 1],
      ]).N(),
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

/**
 * Evaluate the two-argument Zeta(s, a) — Wolfram's generalized zeta. For Re(a) > 0
 * (and symbolic a) it is identical to HurwitzZeta, so it reuses those exact
 * reductions; for a concrete a with Re(a) ≤ 0 it uses the generalized-zeta
 * convention numerically (see zetaGeneralized). The one-argument case is handled by
 * the caller, which defers to compute-engine's native Riemann zeta.
 */
function evaluateZeta(
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
    const expr = ce.box(["Zeta", s.json as unknown as BoxInput] as unknown as BoxInput);
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
 * Evaluate the Lerch transcendent LerchPhi(z, s, a) = Σ zⁿ (n+a)^(−s). Exact
 * reductions: z=1 → HurwitzZeta(s, a); s=0 → 1/(1−z). Otherwise numeric via the
 * direct series (see lerch.ts), which covers |z| ≤ 1.
 */
function evaluateLerch(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const z = ops[0];
  const s = ops[1];
  const a = ops[2];
  if (z === undefined || s === undefined || a === undefined) return undefined;
  const box = (expr: Json) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  // Φ(1, s, a) = ζ(s, a) — flows into the HurwitzZeta closed forms.
  if (z.im === 0 && z.re === 1) {
    return finish(box(["HurwitzZeta", s.json as unknown as Json, a.json as unknown as Json]));
  }
  // Φ(0, s, a) = a^(−s): only the n = 0 term survives (0⁰ = 1).
  if (z.is(0)) {
    return finish(box(["Power", a.json as unknown as Json, ["Negate", s.json as unknown as Json]]));
  }
  // Φ(z, 0, a) = 1/(1 − z), independent of a (the geometric series and its continuation).
  if (isRealInt(s) && s.re === 0) {
    return finish(box(["Divide", 1, ["Subtract", 1, z.json as unknown as Json]]));
  }
  // Past |z| = 1 the series stops converging: continue by the integral representation
  // (lerch-continuation.ts), with compute-engine's own upper incomplete Γ. Where that can't
  // be trusted to double precision, stay unevaluated rather than guess.
  if (numeric && isFiniteNum(z) && isFiniteNum(s) && isFiniteNum(a) && Math.hypot(z.re, z.im) > 1) {
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
  if (numeric && isFiniteNum(z) && isFiniteNum(s) && isFiniteNum(a)) {
    return numberResult(
      ce,
      lerchPhi({ re: z.re, im: z.im }, { re: s.re, im: s.im }, { re: a.re, im: a.im }),
    );
  }
  return undefined; // stay symbolic
}

/**
 * Declare the analytic special-function heads on `ce`, numerically aligned with
 * Wolfram:
 * - `HurwitzZeta(s, a)` — the two-argument Hurwitz zeta (`HurwitzZeta[s, a]`).
 * - `Zeta(s, a)` — the two-argument generalized zeta (`Zeta[s, a]`), which differs
 *   from HurwitzZeta only for a with Re(a) ≤ 0. compute-engine's `Zeta` is
 *   single-argument (Riemann); this extends the head to accept a second argument
 *   while preserving the native one-argument behaviour (closed forms, poles,
 *   list-threading).
 * - `LerchPhi(z, s, a)` — the Lerch transcendent (`LerchPhi[z, s, a]`).
 *
 * `Gamma` and `GammaRegularized` gain a third argument (Wolfram's generalized incomplete
 * gamma, and with it the lower incomplete gamma) while keeping the native one- and
 * two-argument behaviour.
 *
 * `PolyLog(s, z)` and `PolyGamma(m, z)` are native compute-engine heads already;
 * they are extended rather than introduced — the native evaluator runs first and
 * ours only fills the cases it declines (see polylog.ts / polygamma.ts) and adds the
 * GPU lowering it has no kernel for.
 *
 * Also declares the heads in special-functions.ts: `BarnesG`, `LogBarnesG`, `LogGamma`,
 * `ClausenCl`, `DirichletEta`, `DirichletBeta`, `StieltjesGamma`, `DirichletCharacter`,
 * `DirichletL`, `HarmonicNumber`, `ChebyshevT`, `ChebyshevU`, `LegendrePolynomial`,
 * `RisingFactorial`, and the `Catalan` constant — the Carlson symmetric elliptic
 * integrals in carlson.ts: `CarlsonRF`, `CarlsonRC`, `CarlsonRD`, `CarlsonRJ`, `CarlsonRG`
 * — and, in elliptic.ts, `IncompleteEllipticF`/`IncompleteEllipticE` plus an in-place
 * precision fix for native `EllipticE` at complex modulus; the modular heads in
 * modular.ts: `ModularJ`, `ModularLambda`, `EisensteinG`; the Fungrim-frontier
 * heads `BesselJZero`, `DigammaFunctionZero`, `MultiZetaValue`, `SloaneA` and
 * `HypergeometricUStar` (bessel-zeros.ts, digamma-zero.ts, multizeta.ts,
 * sloane-a.ts, hypergeometric-ustar.ts); and, in matrix-exp.ts, `MatrixExp`.
 *
 * Also, in q-series.ts, the q-analogues `QPochhammer`, `QFactorial`, `QBinomial`;
 * and, in riemann-siegel.ts, `RiemannSiegelTheta`, `RiemannSiegelZ`, `RiemannZetaZero`.
 */
export function declareAnalytic(ce: ComputeEngine): void {
  ce.declare("HurwitzZeta", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluateHurwitz(ce, ops, options.numericApproximation ?? false),
    compile: realCompile(2, { js: "__hz", wgsl: "hurwitz" }),
  });

  // Capture the native single-argument Riemann zeta before redeclaring, then defer
  // to it for the one-argument case; declaring `Zeta` replaces its whole definition.
  // Native evaluates real s only, to the engine's precision; a concretely complex s it
  // declines goes to ζ(s, 1). Real and symbolic s stay native: HurwitzZeta reduces ζ(s, 1)
  // back to Zeta(s) for those, so routing them there would loop.
  const nativeZeta: NativeEval = ce.box(["Zeta", 2]).operatorDefinition?.evaluate;
  const zetaCompile = realCompile(2, { js: "__zg", wgsl: "zetaGen" });
  ce.declare("Zeta", {
    signature: "(number, number?) -> number",
    broadcastable: true, // preserve native threading over a list of s
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      if (ops.length >= 2) return evaluateZeta(ce, ops, options.numericApproximation ?? false);
      const r = nativeZeta?.(ops, options);
      const s = ops[0];
      if (!declined(r, "Zeta") || s === undefined || !isFiniteNum(s) || s.im === 0) return r;
      return evaluateHurwitz(ce, [s, ce.One], wantsNumber(ops, options)) ?? r;
    },
    compile: (args, compile, ctx) =>
      zetaCompile(args.length === 1 ? [args[0], ce.One] : args, compile, ctx),
  });

  // LerchPhi(z, s, a): the Lerch transcendent (HurwitzZeta and PolyLog are special cases).
  ce.declare("LerchPhi", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluateLerch(ce, ops, options.numericApproximation ?? false),
    compile: realCompile(3, { js: "__lp", wgsl: "lerchPhi" }),
  });

  // PolyLog(s, z): native for integer s; the Lerch series adds non-integer and
  // complex orders inside |z| ≤ 1. No native lowering on either target, so both the
  // JS wrapper and the WGSL kernel come from here.
  const nativePolyLog: NativeEval = ce.box(["PolyLog", 2, 0.5]).operatorDefinition?.evaluate;
  ce.declare("PolyLog", {
    signature: "(number, number) -> number",
    broadcastable: true, // thread over a list of z (or of s), like the other heads
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluatePolyLog(ce, nativePolyLog, ops, options),
    compile: realCompile(2, { js: "__pl", wgsl: "polyLog" }),
  });

  // PolyGamma(m, z): native for real z at every integer order (m = 0 is the digamma);
  // ours adds complex z. compute-engine already lowers it to `_SYS.polygamma` on the
  // JS target, so only the WGSL kernel is named here and JS falls through to native.
  const nativePolyGamma: NativeEval = ce.box(["PolyGamma", 1, 1]).operatorDefinition?.evaluate;
  ce.declare("PolyGamma", {
    signature: "(number, number) -> number",
    broadcastable: true, // preserve native threading over a list of z
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluatePolygamma(ce, nativePolyGamma, ops, options),
    compile: realCompile(2, { wgsl: "polygamma" }),
  });

  // Gamma(s, z₀, z₁) and GammaRegularized(s, z₀, z₁): the generalized incomplete gamma,
  // whose z₀ = 0 case is the lower incomplete gamma. Native for one and two arguments.
  // The operand type follows each native definition — Gamma's second argument is optional,
  // GammaRegularized's is required — so that redeclaring changes the arity and nothing else,
  // type errors included. Both thread over a list, as Wolfram's Listable heads do (natively
  // only Gamma does).
  for (const [head, secondRequired] of [
    ["Gamma", false],
    ["GammaRegularized", true],
  ] as const) {
    const native: NativeEval = ce.box([head, 2, 1]).operatorDefinition?.evaluate;
    const z = "complex | infinity";
    ce.declare(head, {
      signature: `(${z}, (${z})${secondRequired ? "" : "?"}, (${z})?) -> number`,
      broadcastable: true,
      evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
        evaluateIncompleteGamma(ce, head, native, ops, options),
    });
  }

  // Native heads that reject a list argument with a type error, where Wolfram's thread
  // over it: Erf([0, 1]) is [0, Erf(1)].
  threadOverLists(ce, [
    "Binomial",
    "Pochhammer",
    "BernoulliB",
    "Erf",
    "Erfc",
    "ErfInv",
    "BetaRegularized",
  ]);
  declareWidened(ce);

  declareSpecialFunctions(ce);
  declareCarlson(ce);
  declareElliptic(ce);
  declareModular(ce);
  declareDerivatives(ce);
  declareBesselJZero(ce);
  declareDigammaFunctionZero(ce);
  declareMultiZetaValue(ce);
  declareSloaneA(ce);
  declareHypergeometricUStar(ce);
  declareMatrixExp(ce);
  declareQSeries(ce);
  declareRiemannSiegel(ce);
}
