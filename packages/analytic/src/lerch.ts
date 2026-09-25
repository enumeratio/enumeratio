import { cosPi, type Cx, sinPi } from "./complex.ts";
import { hurwitzZeta } from "./hurwitz-zeta.ts";

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

export function lerchPhi(z: Cx, s: Cx, a: Cx): Cx {
  if (z.im === 0 && z.re === 1) return hurwitzZeta(s, a); // Φ(1, s, a) = ζ(s, a)
  const absZ = Math.hypot(z.re, z.im);
  if (absZ > 1) return { re: Number.NaN, im: Number.NaN }; // continuation, not the series
  if (z.im === 0 && z.re < 0) return lerchEuler(z.re, s, a); // −1 ≤ z < 0: alternating
  const negSr = -s.re;
  const negSi = -s.im;
  // |z|<1: term ~ |z|ⁿ, so log|z| sets how many terms reach machine precision.
  const maxN =
    absZ < 1 ? Math.min(2_000_000, Math.ceil(Math.log(1e-17) / Math.log(absZ)) + 64) : 200_000;
  let sumR = 0;
  let sumI = 0;
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
      if (n > 8 && Math.hypot(tR, tI) < 1e-16 * (Math.hypot(sumR, sumI) + 1e-16)) break;
    }
    const nzR = zpR * z.re - zpI * z.im; // zⁿ⁺¹
    const nzI = zpR * z.im + zpI * z.re;
    zpR = nzR;
    zpI = nzI;
  }
  return { re: sumR, im: sumI };
}

/** Real-valued Φ(z, s, a) for real z, s, a — for compiled (JS/GPU) plotting. */
export const lerchPhiReal = (z: number, s: number, a: number): number =>
  lerchPhi({ re: z, im: 0 }, { re: s, im: 0 }, { re: a, im: 0 }).re;
