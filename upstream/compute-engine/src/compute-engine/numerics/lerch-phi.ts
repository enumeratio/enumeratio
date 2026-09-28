import { abs, add, cexp, clog, cosPi, cx, type Cx, mul, scale, sinPi, sub } from "./complex-arithmetic.ts";
import { hurwitzZeta } from "./hurwitz-zeta.ts";
import { logGamma } from "./log-gamma.ts";

// Lerch transcendent Φ(z, s, a) = Σ_{n≥0} zⁿ (n+a)^(−s), by direct summation.
// Generalizes the Hurwitz zeta (Φ(1, s, a) = ζ(s, a)) and the polylogarithm
// (Liₛ(z) = z·Φ(z, s, 1)). For |z| < 1 the zⁿ factor gives geometric convergence,
// so the series is summed to full double precision. z = 1 is delegated to the
// Hurwitz kernel; |z| > 1 needs analytic continuation the series can't provide and
// returns NaN, for the plots. The LerchPhi head continues there instead, through
// lerch-continuation.ts.
//
// Real z < 0 is summed by the van Wijngaarden Euler transform instead: there the
// series alternates and, on the |z| = 1 rim (z = −1: the Dirichlet eta/beta family,
// Φ(−1,1,1) = ln2, Φ(−1,2,1) = π²/12, Φ(−1,2,½) = 4G), direct summation converges
// far too slowly to reach machine precision. The transform accelerates it to full
// double precision in a few dozen terms.
//
// Left of Re(s) = 0 the terms grow like n^(−Re s) before |z|ⁿ pulls them down, and near the
// rim they peak orders of magnitude above Φ and cancel (|z| = 0.99, s = −3.8: ten digits
// gone). There the series about z = 1 takes over (`lerchAboutOne`).

let _pr = 0;
let _pi = 0;

/** (zr+zi·i)^(wr+wi·i), principal branch; result in _pr/_pi. */
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
 * Σ_{n≥0} zⁿ (n+a)^(−s) for real z < 0 by the van Wijngaarden Euler transform
 * (Numerical Recipes `eulsum`, carried through the complex terms). The signed,
 * alternating terms are fed in; on the |z| = 1 rim direct summation stalls but the
 * repeated-averaging table reaches double precision in a few dozen terms.
 */
function lerchEuler(zRe: number, s: Cx, a: Cx): Cx {
  const negSr = -s.re;
  const negSi = -s.im;
  const wR: number[] = [];
  const wI: number[] = [];
  let nterm = 0;
  let sumR = 0;
  let sumI = 0;
  let zpow = 1; // zⁿ (signed: z < 0 makes the terms alternate)
  for (let n = 0; n < 512; n++, zpow *= zRe) {
    const br = a.re + n;
    // termₙ = zⁿ (n+a)^(−s), the signed term the Euler transform averages.
    let aR = 0;
    let aI = 0;
    if (!(br === 0 && a.im === 0)) {
      cpowInto(br, a.im, negSr, negSi);
      aR = zpow * _pr;
      aI = zpow * _pi;
    }
    let incR: number;
    let incI: number;
    if (n === 0) {
      nterm = 1;
      wR[1] = aR;
      wI[1] = aI;
      incR = 0.5 * aR;
      incI = 0.5 * aI;
    } else {
      let tmpR = wR[1];
      let tmpI = wI[1];
      wR[1] = aR;
      wI[1] = aI;
      for (let j = 1; j <= nterm - 1; j++) {
        const dumR = wR[j + 1];
        const dumI = wI[j + 1];
        wR[j + 1] = 0.5 * (wR[j] + tmpR);
        wI[j + 1] = 0.5 * (wI[j] + tmpI);
        tmpR = dumR;
        tmpI = dumI;
      }
      wR[nterm + 1] = 0.5 * (wR[nterm] + tmpR);
      wI[nterm + 1] = 0.5 * (wI[nterm] + tmpI);
      if (Math.hypot(wR[nterm + 1], wI[nterm + 1]) <= Math.hypot(wR[nterm], wI[nterm])) {
        nterm++;
        incR = 0.5 * wR[nterm];
        incI = 0.5 * wI[nterm];
      } else {
        incR = wR[nterm + 1];
        incI = wI[nterm + 1];
      }
    }
    sumR += incR;
    sumI += incI;
    if (n > 4 && Math.hypot(incR, incI) < 1e-17 * (Math.hypot(sumR, sumI) + 1e-17)) break;
  }
  return { re: sumR, im: sumI };
}

/**
 * Φ(z, s, a) = z^(−a) [Γ(1−s) (−L)^(s−1) + Σₖ ζ(s−k, a) Lᵏ/k!], L = log z, for |L| < 2π and s
 * not a positive integer, with how far its terms overshoot the result. Its terms fall like
 * (|L|/2π)ᵏ however negative s is. A large a is first brought to (0, 1] by
 * Φ(z, s, a) = z^(−m) [Φ(z, s, a−m) − Σ_{j<m} zʲ (a−m+j)^(−s)]: ζ(s−k, a) grows like aᵏ,
 * and at arg z near ±π the series would cancel like e^(a·|L|) otherwise.
 */
function lerchAboutOne(z: Cx, s: Cx, a: Cx): { value: Cx; lost: number } {
  const L = clog(z);
  const m = Math.max(0, Math.ceil(a.re) - 1);
  const b = cx(a.re - m, a.im);
  const closed = cexp(add(logGamma(sub(cx(1), s)), mul(sub(s, cx(1)), clog(scale(L, -1)))));
  let inner = closed;
  let largest = abs(closed);
  let lk = cx(1); // Lᵏ/k!
  let small = 0;
  for (let k = 0; k < 400; k++) {
    const t = mul(hurwitzZeta(cx(s.re - k, s.im), b), lk);
    inner = add(inner, t);
    const size = abs(t);
    largest = Math.max(largest, size);
    // Two in a row: ζ(s−k, b) can pass near a zero.
    if (size <= 1e-17 * largest) {
      if (++small === 2) break;
    } else small = 0;
    lk = scale(mul(lk, L), 1 / (k + 1));
  }
  const phiB = mul(cexp(scale(mul(L, b), -1)), inner);
  let lost = largest / abs(inner);
  let head = cx(0);
  let headLargest = abs(phiB);
  let zj = cx(1);
  for (let j = 0; j < m; j++) {
    if (!(b.re + j === 0 && b.im === 0)) {
      cpowInto(b.re + j, b.im, -s.re, -s.im);
      const t = mul(zj, cx(_pr, _pi));
      head = add(head, t);
      headLargest = Math.max(headLargest, abs(t));
    }
    zj = mul(zj, z);
  }
  const diff = sub(phiB, head);
  lost = Math.max(lost, headLargest / abs(diff));
  return { value: mul(cexp(scale(L, -m)), diff), lost };
}

/**
 * Terms until |z|ⁿ (n+|a|)^(−Re s) is below 1e−17. Left of Re(s) = 0 the polynomial factor
 * pushes that well past where |z|ⁿ alone gets there (z = 0.99, s = −5.5: 5700 terms, not 4000).
 */
function seriesLength(absZ: number, s: Cx, a: Cx): number {
  if (absZ >= 1) return 200_000;
  const decay = -Math.log(absZ);
  const growth = Math.max(0, -s.re);
  const size = Math.hypot(a.re, a.im) + 1;
  let n = 39.2 / decay; // −ln 1e−17
  for (let i = 0; i < 4; i++) n = (39.2 + growth * Math.log(n + size)) / decay;
  return Math.min(2_000_000, Math.ceil(n) + 64);
}

/** Σ zⁿ (n+a)^(−s) summed directly, with Σ |zⁿ (n+a)^(−s)|. */
function lerchDirect(z: Cx, s: Cx, a: Cx, maxN: number): { value: Cx; absSum: number } {
  const negSr = -s.re;
  const negSi = -s.im;
  let sumR = 0;
  let sumI = 0;
  let absSum = 0;
  let zpR = 1; // zⁿ
  let zpI = 0;
  for (let n = 0; n <= maxN; n++) {
    const br = a.re + n;
    if (!(br === 0 && a.im === 0)) {
      cpowInto(br, a.im, negSr, negSi); // (n+a)^(−s)
      const tR = zpR * _pr - zpI * _pi;
      const tI = zpR * _pi + zpI * _pr;
      sumR += tR;
      sumI += tI;
      const size = Math.hypot(tR, tI);
      absSum += size;
      if (n > 8 && size < 1e-16 * (Math.hypot(sumR, sumI) + 1e-16)) break;
    }
    const nzR = zpR * z.re - zpI * z.im; // zⁿ⁺¹
    const nzI = zpR * z.im + zpI * z.re;
    zpR = nzR;
    zpI = nzI;
  }
  return { value: { re: sumR, im: sumI }, absSum };
}

/** Σ |zⁿ (n+a)^(−s)|, for the Euler transform, which doesn't see every term. */
function termSum(absZ: number, s: Cx, a: Cx, maxN: number): number {
  if (absZ >= 1) return Infinity; // left of Re(s) = 0 the rim's terms never fall
  let total = 0;
  let zn = 1; // |z|ⁿ
  for (let n = 0; n <= maxN; n++, zn *= absZ) {
    if (a.re + n === 0 && a.im === 0) continue;
    cpowInto(a.re + n, a.im, -s.re, -s.im);
    const size = zn * Math.hypot(_pr, _pi);
    total += size;
    if (n > 8 && size < 1e-17 * total) break;
  }
  return total;
}

export function lerchPhi(z: Cx, s: Cx, a: Cx): Cx {
  if (z.im === 0 && z.re === 1) return hurwitzZeta(s, a); // Φ(1, s, a) = ζ(s, a)
  const absZ = Math.hypot(z.re, z.im);
  if (absZ > 1) return { re: Number.NaN, im: Number.NaN }; // continuation, not the series
  const maxN = seriesLength(absZ, s, a);
  let value: Cx;
  let absSum: number;
  if (z.im === 0 && z.re < 0) {
    // −1 ≤ z < 0: alternating. The transform's terms only cancel badly when they grow.
    value = lerchEuler(z.re, s, a);
    absSum = s.re < 0 ? termSum(absZ, s, a, maxN) : 0;
  } else ({ value, absSum } = lerchDirect(z, s, a, maxN));
  const lost = absSum / Math.hypot(value.re, value.im);
  // Past three digits lost (or no sum at all), see if the series about z = 1 does better. Its
  // own measure keeps it out where it can't: near a positive integer s, Γ(1−s) and a ζ(s−k, a)
  // pole cancel. Near arg z = ±π with a off the axis both routes can still lose digits, the
  // series about z = 1 by about e^(π|Im a|).
  if (!(lost <= 1e3)) {
    const about = lerchAboutOne(z, s, a);
    if (!(about.lost >= lost) && Number.isFinite(about.value.re) && Number.isFinite(about.value.im)) return about.value;
  }
  return value;
}

/** Real-valued Φ(z, s, a) for real z, s, a — for compiled (JS/GPU) plotting. */
export const lerchPhiReal = (z: number, s: number, a: number): number =>
  lerchPhi({ re: z, im: 0 }, { re: s, im: 0 }, { re: a, im: 0 }).re;
