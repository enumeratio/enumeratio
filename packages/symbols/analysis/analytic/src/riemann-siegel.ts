import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import {
  atDigits,
  bigRealOperand,
  bigResult,
  DOUBLE_DIGITS,
  bigCx,
  hurwitzZetaBig,
  logGammaBig,
  type EvalOptions,
  type Cx,
  cexp,
  cx,
  exceedsDoublePrecision,
  isRealInt,
  mul,
  numberResult,
  wantsNumber,
  logGamma,
  zetaGeneralized,
  inexactComplex,
} from "@enumeratio/ce-patches";
import { riemannSiegelZBig, riemannSiegelZComplexBig, riemannZetaZeroBig } from "./riemann-siegel-big.ts";

// RiemannSiegelTheta(t), RiemannSiegelZ(t), and RiemannZetaZero(k) — reusing the
// existing log-gamma continuation (loggamma.ts) and generalized zeta kernel
// (hurwitz-zeta.ts) rather than re-deriving either. compute-engine has none of these
// three heads (checked with `ce.lookupDefinition` first).
//
// ϑ(t) = Im ln Γ(¼ + it/2) − (t/2) ln π          (RiemannSiegelTheta)
// Z(t)  = e^{iϑ(t)} ζ(½ + it)                     (RiemannSiegelZ, real for real t)
// Z extends to complex t by the same formula, with ϑ(z) = (ln Γ(¼ + iz/2) − ln Γ(¼ − iz/2)) / 2i
// − (z/2) ln π (Wolfram's); ϑ itself stays real-t only here, nothing needs it complex.
//
// ζ(½ + it) is HurwitzZeta/Zeta's own generalized kernel at a = 1, which reduces to
// the Riemann zeta; every value here is already covered by hurwitz-zeta.ts's own
// Euler–Maclaurin tests, so this file adds no new zeta evaluation of its own.

/** ϑ(t) for real t. */
function theta(t: number): number {
  const lg = logGamma({ re: 0.25, im: t / 2 });
  return lg.im - (t / 2) * Math.log(Math.PI);
}

/** Z(t) for real t: real by construction (the imaginary part cancels to rounding noise). */
function riemannSiegelZ(t: number): number {
  const th = theta(t);
  const z = zetaGeneralized({ re: 0.5, im: t }, { re: 1, im: 0 });
  return Math.cos(th) * z.re - Math.sin(th) * z.im;
}

/** Z(z) for complex z: e^{iϑ(z)} ζ(½ + iz), with ϑ continued as above. */
function riemannSiegelZComplex(z: Cx): Cx {
  const a = logGamma(cx(0.25 - z.im / 2, z.re / 2));
  const b = logGamma(cx(0.25 + z.im / 2, -z.re / 2));
  const lnPi = Math.log(Math.PI);
  const th = cx((a.im - b.im) / 2 - (z.re / 2) * lnPi, -(a.re - b.re) / 2 - (z.im / 2) * lnPi);
  return mul(cexp(cx(-th.im, th.re)), zetaGeneralized(cx(0.5 - z.im, z.re), cx(1, 0)));
}

// --- RiemannZetaZero -----------------------------------------------------------------
//
// t_k is located by a plain sign-change scan of Z along the real line from t ≈ 0,
// counting zero crossings as it goes, and bisecting the bracket once the k-th crossing
// is found. This needs no Gram-point bookkeeping and so isn't exposed to a Gram's-law
// failure (the rare case where consecutive Gram points don't bracket exactly one zero
// each) — it just counts sign changes, wherever they fall.
//
// The step is adaptive: a fraction of the mean local zero spacing 2π/ln(t/2π), which
// shrinks as t grows (zeros crowd closer together), floored so it never vanishes for
// small t. That keeps the scan from skipping a crossing anywhere in range.
//
// Supported range: k such that t_k ≤ MAX_T. MAX_T = 2000 reaches roughly the first
// 1400 zeros (way past the k ≤ 10 the backlog tests) while keeping the scan itself
// well under a second. Above that this file declines rather than guess — a linear
// scan out that far is not worth the wait, and isn't validated against Gram's law
// exceptions (the first is at Gram index 126) or missed close pairs.
const MAX_T = 2000;

function meanSpacing(t: number): number {
  const x = Math.max(t, 10) / (2 * Math.PI);
  return (2 * Math.PI) / Math.log(x + 2);
}

/** t_k, or undefined if it isn't found by t = MAX_T. */
function riemannZetaZeroT(k: number): number | undefined {
  let t = 0.5;
  let prev = riemannSiegelZ(t);
  let count = 0;
  while (t < MAX_T) {
    const step = Math.max(0.02, Math.min(0.5, meanSpacing(t) / 10));
    const next = t + step;
    const cur = riemannSiegelZ(next);
    if ((prev < 0 && cur > 0) || (prev > 0 && cur < 0)) {
      count++;
      if (count === k) {
        let lo = t;
        let hi = next;
        let flo = prev;
        for (let i = 0; i < 80; i++) {
          const mid = (lo + hi) / 2;
          const fm = riemannSiegelZ(mid);
          if ((flo < 0 && fm < 0) || (flo > 0 && fm > 0)) {
            lo = mid;
            flo = fm;
          } else {
            hi = mid;
          }
        }
        return (lo + hi) / 2;
      }
    }
    t = next;
    prev = cur;
  }
  return undefined;
}

/** Working digits for `refineZeroBig`: the double root is good to ~1e-15, one Newton step squares that. */
const REFINE_DIGITS = 40;
/** Half-width of the central difference for Z'(t); its h² error is far below the step it scales. */
const REFINE_H = 1e-6;

/**
 * One Newton step on Z(t) = e^{iϑ(t)} ζ(½ + it) in BigDecimal, from the double root `t`. The
 * double Z carries ~1e-15 of noise, which put the bisected root a couple of ulps off
 * (14.134725141734695 for 14.134725141734693…); a step at 40 digits lands within 1e-25 of the root,
 * so rounding it gives the nearest double. Undefined if the bignum kernel declines.
 */
export function refineZeroBig(t: number): number | undefined {
  return atDigits(REFINE_DIGITS, () => {
    const z = (x: BigDecimal): BigDecimal | undefined => {
      const zeta = hurwitzZetaBig(bigCx(0.5, x), bigCx(1), REFINE_DIGITS);
      if (zeta === undefined) return undefined;
      const half = x.div(2);
      const theta = logGammaBig(bigCx(0.25, half), REFINE_DIGITS).im.sub(half.mul(BigDecimal.PI.ln()));
      return zeta.re.mul(theta.cos()).sub(zeta.im.mul(theta.sin()));
    };
    const t0 = new BigDecimal(t);
    const h = new BigDecimal(REFINE_H);
    const [at, above, below] = [z(t0), z(t0.add(h)), z(t0.sub(h))];
    if (at === undefined || above === undefined || below === undefined) return undefined;
    const slope = above.sub(below).div(h.mul(2));
    if (slope.isZero()) return undefined;
    const root = t0.sub(at.div(slope)).toNumber();
    return Math.abs(root - t) < 1e-9 * t ? root : undefined;
  });
}

/** Z(t) at the engine's precision, for N(…, d) past a double's digits. */
function riemannSiegelZPastDouble(ce: ComputeEngine, t: BoxedExpression): BoxedExpression | undefined {
  if (ce.precision <= DOUBLE_DIGITS) return undefined;
  const im = t.bignumIm ?? ce.bignum(t.im);
  if (im.isZero()) {
    const x = bigRealOperand(ce, t);
    const value = x === undefined ? undefined : riemannSiegelZBig(x, ce.precision);
    return value === undefined ? undefined : bigResult(ce, value);
  }
  const value = riemannSiegelZComplexBig(t.bignumRe ?? ce.bignum(t.re), im, ce.precision);
  if (value === undefined) return undefined;
  return ce.function("Complex", [bigResult(ce, value.re), bigResult(ce, value.im)]);
}

/** ½ + i·t_k at the engine's precision from the double zero `seed`; ZetaZero(−k) is the conjugate. */
function zetaZeroPastDouble(ce: ComputeEngine, k: number, seed: number): BoxedExpression | undefined {
  if (ce.precision <= DOUBLE_DIGITS) return undefined;
  const root = riemannZetaZeroBig(refineZeroBig(seed) ?? seed, ce.precision);
  if (root === undefined) return undefined;
  return ce.function("Complex", [bigResult(ce, bigCx(0.5).re), bigResult(ce, k < 0 ? root.neg() : root)]);
}

export function declareRiemannSiegel(ce: ComputeEngine): void {
  ce.declare("RiemannSiegelTheta", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const t = ops[0];
      if (t === undefined || t.im !== 0 || !Number.isFinite(t.re)) return undefined;
      if (t.re === 0) return ce.Zero; // ϑ(0) = Im ln Γ(¼) = 0 exactly — no N() needed
      if (!wantsNumber(ops, options)) return undefined;
      return ce.number(theta(t.re));
    },
  });

  ce.declare("RiemannSiegelZ", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const t = ops[0];
      if (t === undefined || !Number.isFinite(t.re) || !Number.isFinite(t.im)) return undefined;
      if (!wantsNumber(ops, options)) return undefined;
      // Past what a double carries only the bignum kernel answers; it declines rather than dress
      // ~17 correct digits as the d asked for.
      if (exceedsDoublePrecision(ce, options.numericApproximation)) return riemannSiegelZPastDouble(ce, t);
      if (t.im !== 0) return numberResult(ce, riemannSiegelZComplex(cx(t.re, t.im)));
      return ce.number(riemannSiegelZ(t.re));
    },
  });

  ce.declare("RiemannZetaZero", {
    signature: "(integer) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const k = ops[0];
      if (k === undefined || !isRealInt(k) || k.re === 0) return undefined;
      if (!wantsNumber(ops, options)) return undefined;
      const pastDouble = exceedsDoublePrecision(ce, options.numericApproximation);
      const t = riemannZetaZeroT(Math.abs(k.re));
      if (t === undefined) return undefined; // beyond MAX_T; decline rather than guess
      if (pastDouble) return zetaZeroPastDouble(ce, k.re, t);
      const root = refineZeroBig(t) ?? t;
      return inexactComplex(ce, 0.5, k.re < 0 ? -root : root); // ZetaZero(-k) = Conjugate(ZetaZero(k))
    },
  });
}
