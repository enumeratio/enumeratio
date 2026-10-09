import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import {
  type EvalOptions,
  type Cx,
  atDigits,
  bigAdd,
  bigCx,
  bigLog,
  bigMul,
  bigPow,
  bigResult,
  exceedsDoublePrecision,
  zetaGeneralized,
  zetaGeneralizedBig,
  isFiniteNum,
  logGamma,
  numberResult,
  wantsNumber,
  add,
  clog,
  csin,
  cx,
  mul,
  scale,
  sub,
} from "@enumeratio/ce-patches";

// PrimeZetaP(s) = Σ_p p^(−s), the sum over primes. Rather than sieving primes and summing
// directly — which converges far too slowly to be useful past a couple of digits — this uses
// the Möbius/ζ identity P(s) = Σ_{k≥1} μ(k)/k · ln ζ(ks): each ln ζ(ks) → 0 geometrically as k
// grows (ζ(ks) → 1), so squarefree k alone settle it in a few dozen terms at double precision.
//
// For Re(s) ≤ 1 the identity is a continuation, and each ln ζ(x), x = ks, needs a branch. Wolfram's,
// matched to 30 digits across the strip: the principal Log of ζ(x) when Re(x) ≥ 1/2, and
//   x·ln 2 + (x−1)·ln π + Log sin(πx/2) + LogΓ(1−x) + Log ζ(1−x)
// (ζ's functional equation; every Log principal, LogΓ continuous) when Re(x) < 1/2. For real x
// both are the principal log, +iπ on the negative reals; for complex x the second is the first plus
// 2πi·m, m found below from the doubles. So the value is not continuous across the real axis.
// Declined: Re(s) ≤ 0 (a natural boundary), a zero of ζ(x), ζ(x) on its cut, a very large |Im x|.

const TOL = 1e-17;
/** 2⁻⁶² ≈ 2e-19: past Re(ks) = 62 every remaining term is below a double's last place. */
const TAIL_RE = 62;
/** The sum needs about 62/Re(s) terms; below this that is tens of thousands, more than an evaluation should cost. */
const MIN_RE = 0.005;
/** The engine allows an evaluation about 2 s, and a term costs about a millisecond at 50 digits. */
const MAX_K_BIG = 1500;
/** |ζ| below this is a zero as far as the digits go: ln|ζ| loses them. A double keeps ~16; the bignum path carries 20 more. */
const ZERO_BELOW = 1e-6;
const ZERO_BELOW_BIG = 1e-15;
/** Re(ks) from which a short Euler product is the whole of ln ζ(ks) to a double. */
const EULER_FROM = 12;
/** sin(πx/2) stays inside a double's range, and 2πm stays resolvable, up to this |Im x|. */
const MAX_IM = 350;
const HALF = 0.5;
/** k·s for an exact rational s with Re(ks) = 1/2 can land an ulp short; Wolfram's exact test takes the principal side. */
const HALF_SLACK = 1e-15;
const POLE = Symbol("pole");

type Outcome<T> = T | typeof POLE | undefined;

const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

/** μ(0..n) by a linear sieve; grown, never shrunk. */
let mobius = new Int8Array(0);
function moebiusUpTo(n: number): Int8Array {
  if (mobius.length > n) return mobius;
  const mu = new Int8Array(n + 1);
  const composite = new Uint8Array(n + 1);
  const primes: number[] = [];
  mu[1] = 1;
  for (let i = 2; i <= n; i++) {
    if (!composite[i]) {
      primes.push(i);
      mu[i] = -1;
    }
    for (const p of primes) {
      if (i * p > n) break;
      composite[i * p] = 1;
      if (i % p === 0) break;
      mu[i * p] = -mu[i]!;
    }
  }
  mobius = mu;
  return mu;
}

const zeta = (x: Cx): Cx => zetaGeneralized(x, cx(1));

/** ln ζ(x) = −Σ_p ln(1 − p^−x), for Re(x) ≥ EULER_FROM where |ln ζ| ≪ π and the sum is the principal log. */
function eulerLog(x: Cx): Cx {
  let sum = cx(0);
  for (const p of SMALL_PRIMES) {
    sum = add(sum, negLog1m(expNegLog(x, Math.log(p))));
    if (Math.exp(-x.re * Math.log(p)) < 1e-20) break;
  }
  return sum;
}

/** −ln(1 − w), by series while w is small enough that 1 − w would round away its own digits. */
function negLog1m(w: Cx): Cx {
  if (Math.hypot(w.re, w.im) >= 1e-4) return scale(clog(sub(cx(1), w)), -1);
  let sum = cx(0);
  let power = w;
  for (let n = 1; n <= 5; n++) {
    sum = add(sum, scale(power, 1 / n));
    power = mul(power, w);
  }
  return sum;
}

/** exp(−x·lnp). */
function expNegLog(x: Cx, lnp: number): Cx {
  const m = Math.exp(-x.re * lnp);
  return x.im === 0 ? cx(m) : cx(m * Math.cos(x.im * lnp), -m * Math.sin(x.im * lnp));
}

/**
 * The 2π multiple m with Wolfram's ln ζ(x) = Log ζ(x) + 2πi·m for complex x, 0 < Re(x) < 1/2:
 * its Im is the sum of the functional equation's principal pieces, which the double kernels give
 * to far better than π. Undefined when a piece sits on its cut, where Wolfram's own value flips.
 */
function windings(x: Cx, principalArg: number): number | undefined {
  if (Math.abs(x.im) > MAX_IM) return undefined;
  const w = cx(1 - x.re, -x.im);
  const zw = zeta(w);
  const mag = Math.hypot(zw.re, zw.im);
  if (!(mag > ZERO_BELOW) || (zw.re < 0 && Math.abs(zw.im) < 1e-9 * mag)) return undefined;
  const sin = csin(cx((Math.PI * x.re) / 2, (Math.PI * x.im) / 2));
  const total =
    x.im * (Math.LN2 + Math.log(Math.PI)) + Math.atan2(sin.im, sin.re) + logGamma(w).im + Math.atan2(zw.im, zw.re);
  const m = (total - principalArg) / (2 * Math.PI);
  return Math.abs(m - Math.round(m)) < 0.05 ? Math.round(m) : undefined;
}

/** Wolfram's ln ζ(x) at a double, Re(x) > 0. */
function logZeta(x: Cx): Outcome<Cx> {
  if (x.im === 0 && x.re === 1) return POLE;
  if (x.im === 0 && Math.abs(x.re - 1) < 1e-14) return undefined;
  if (x.re >= EULER_FROM) return eulerLog(x);
  const z = zeta(x);
  const mag = Math.hypot(z.re, z.im);
  if (!(mag > ZERO_BELOW)) return undefined;
  // Real x: ζ is real, negative on (0, 1) — the principal log is ln|ζ| + iπ there.
  if (x.im === 0) return cx(Math.log(mag), z.re < 0 ? Math.PI : 0);
  if (z.re < 0 && Math.abs(z.im) < 1e-12 * mag) return undefined;
  const l = clog(z);
  if (x.re >= HALF - HALF_SLACK) return l;
  const m = windings(x, l.im);
  return m === undefined ? undefined : cx(l.re, l.im + 2 * Math.PI * m);
}

function primeZetaP(s: Cx): Outcome<Cx> {
  const kmax = Math.ceil(TAIL_RE / s.re);
  const mu = moebiusUpTo(kmax);
  let sum = cx(0);
  for (let k = 1; k <= kmax; k++) {
    if (mu[k] === 0) continue;
    const x = scale(s, k);
    const l = logZeta(x);
    if (l === undefined || l === POLE) return l;
    const term = scale(l, mu[k]! / k);
    sum = add(sum, term);
    if (x.re > EULER_FROM && Math.hypot(term.re, term.im) < TOL * (1 + Math.hypot(sum.re, sum.im))) break;
  }
  return sum;
}

/** `eulerLog` to the working precision, while a few primes (≤ 100) cover it; else undefined. */
function eulerLogBig(x: { re: BigDecimal; im: BigDecimal }): { re: BigDecimal; im: BigDecimal } | undefined {
  const bound = 10 ** ((BigDecimal.precision + 2) / x.re.toNumber());
  if (!(bound <= 100)) return undefined;
  const minusX = { re: x.re.neg(), im: x.im.neg() };
  let sum = bigCx(0);
  for (const p of SMALL_PRIMES) {
    if (p > bound) break;
    const w = bigPow(bigCx(p), minusX);
    const l = bigLog({ re: BigDecimal.ONE.sub(w.re), im: w.im.neg() });
    sum = { re: sum.re.sub(l.re), im: sum.im.sub(l.im) };
  }
  return sum;
}

/** Wolfram's ln ζ(x) in BigDecimal at the current working precision; `digits` are the ones asked for. */
function logZetaBig(
  x: { re: BigDecimal; im: BigDecimal },
  digits: number,
): Outcome<{ re: BigDecimal; im: BigDecimal }> {
  const real = x.im.isZero();
  if (real) {
    if (x.re.eq(1)) return POLE;
    if (
      x.re
        .sub(1)
        .abs()
        .lt(new BigDecimal(`1e-${digits - 5}`))
    )
      return undefined;
  }
  // |ln ζ| ≪ π out here, so the Euler sum is the principal log (and real x gives a real sum).
  const euler = eulerLogBig(x);
  if (euler !== undefined) return euler;
  const z = zetaGeneralizedBig(x, bigCx(1), BigDecimal.precision);
  if (z === undefined) return undefined;
  const [zr, zi] = [z.re.toNumber(), z.im.toNumber()];
  const mag = Math.hypot(zr, zi);
  if (!(mag > ZERO_BELOW_BIG)) return undefined;
  if (real) return { re: z.re.abs().ln(), im: z.re.isNegative() ? BigDecimal.PI : BigDecimal.ZERO };
  if (zr < 0 && Math.abs(zi) < 1e-12 * mag) return undefined;
  const l = bigLog(z);
  if (
    !x.re.lt(HALF) ||
    x.re
      .sub(HALF)
      .abs()
      .lt(new BigDecimal(`1e-${digits - 5}`))
  )
    return l;
  const m = windings(cx(x.re.toNumber(), x.im.toNumber()), Math.atan2(zi, zr));
  return m === undefined ? undefined : bigAdd(l, { re: BigDecimal.ZERO, im: BigDecimal.PI.mul(2 * m) });
}

/**
 * The same sum on the bignum ζ kernel: ln ζ(ks) is below 2^(−Re(ks)), so K = ⌈digits·log₂10 / Re(s)⌉
 * terms clear the digits asked for. For Re(s) > 1 working precision also covers the size of P(s)
 * itself, about 2^(−s): a large s has few significant digits left.
 */
function primeZetaPBig(
  s: { re: BigDecimal; im: BigDecimal },
  digits: number,
): Outcome<{ re: BigDecimal; im: BigDecimal }> {
  const sd = s.re.toNumber();
  const working = digits + 20 + (sd > 1 ? Math.ceil(sd * Math.log10(2)) : 0);
  const kmax = Math.ceil((working * Math.log2(10)) / sd) + 2;
  if (kmax > MAX_K_BIG) return undefined;
  const mu = moebiusUpTo(kmax);
  return atDigits(working, () => {
    let sum = bigCx(0);
    for (let k = 1; k <= kmax; k++) {
      if (mu[k] === 0) continue;
      const l = logZetaBig(bigMul(s, bigCx(k)), digits);
      if (l === undefined || l === POLE) return l;
      const f = new BigDecimal(mu[k]!).div(k);
      sum = bigAdd(sum, { re: l.re.mul(f), im: l.im.mul(f) });
    }
    return sum;
  });
}

/** 1/k for a squarefree k: ln ζ(1) is infinite and nothing cancels it. Wolfram answers ComplexInfinity there. */
function isExactPole(s: BoxedExpression): boolean {
  if (!(s as Partial<{ isExact: boolean }>).isExact || s.im !== 0 || !(s.re > 0)) return false;
  const k = Math.round(1 / s.re);
  return k >= 1 && k <= 1e6 && Math.abs(1 / s.re - k) < 1e-9 && moebiusUpTo(k)[k] !== 0;
}

function boxBig(ce: ComputeEngine, value: { re: BigDecimal; im: BigDecimal }, digits: number): BoxedExpression {
  const re = bigResult(ce, value.re.toPrecision(digits));
  return value.im.isZero() ? re : ce.function("Complex", [re, bigResult(ce, value.im.toPrecision(digits))]);
}

export function declarePrimeZetaP(ce: ComputeEngine): void {
  ce.declare("PrimeZetaP", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [s] = ops;
      if (s === undefined || !isFiniteNum(s)) return undefined;
      if (isExactPole(s)) return ce.symbol("ComplexInfinity");
      // Re(s) ≤ 0 is the sum's natural boundary: no continuation to give.
      if (!wantsNumber(ops, options) || !(s.re > 0)) return undefined;
      // Past a double's digits: the bignum sum, else decline rather than pad.
      if (exceedsDoublePrecision(ce, options.numericApproximation)) {
        const arg = { re: s.bignumRe ?? ce.bignum(s.re), im: s.bignumIm ?? ce.bignum(s.im) };
        const value = primeZetaPBig(arg, ce.precision);
        if (value === POLE) return ce.symbol("ComplexInfinity");
        return value === undefined ? undefined : boxBig(ce, value, ce.precision);
      }
      if (s.re < MIN_RE) return undefined;
      const value = primeZetaP(cx(s.re, s.im));
      if (value === POLE) return ce.symbol("ComplexInfinity");
      return value === undefined ? undefined : numberResult(ce, value);
    },
  });
}
