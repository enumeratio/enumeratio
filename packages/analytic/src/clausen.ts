import { bernoulliNumber } from "./bernoulli.ts";
import { hurwitzZeta } from "./hurwitz-zeta.ts";

// Clausen functions Cl_n(θ): the standard family Cl_{2m}(θ) = Σ sin(kθ)/k^{2m},
// Cl_{2m+1}(θ) = Σ cos(kθ)/k^{2m+1} — i.e. Im Li_n(e^{iθ}) for even n and Re Li_n(e^{iθ})
// for odd n (DLMF §25.12(ii); mpmath's clsin / clcos). Cl_2 is the classical one:
// Cl_2(θ) = −∫₀^θ ln|2 sin(t/2)| dt, with Cl_2(π/2) = Catalan's constant.
//
// Wolfram has no Clausen head; it spells these as Im/Re PolyLog[n, E^(I θ)], which is
// what the oracle checks use. Numerically, the polylog's expansion at the unit circle
// (DLMF 25.12.12), with μ = iθ and θ reduced into (−π, π]:
//   Li_n(e^μ) = μ^{n−1}/(n−1)! · (H_{n−1} − ln(−μ)) + Σ_{k≠n−1} ζ(n−k) μ^k / k!,
// geometric in |θ|/2π ≤ ½, so some sixty terms reach double precision. The ζ(n−k) at
// nonpositive arguments are Bernoulli numbers; the positive ones come off the Hurwitz
// kernel. Real θ only.

/** ζ(m) at an integer m ≠ 1. */
function zetaInt(m: number): number {
  if (m >= 2) return hurwitzZeta({ re: m, im: 0 }, { re: 1, im: 0 }).re;
  if (m === 0) return -0.5;
  return -bernoulliNumber(1 - m) / (1 - m); // ζ(−j) = −B_{j+1}/(j+1)
}

const TWO_PI = 2 * Math.PI;

/** θ reduced into (−π, π]. */
const reduce = (theta: number): number => {
  let t = theta - TWO_PI * Math.round(theta / TWO_PI);
  if (t <= -Math.PI) t += TWO_PI;
  return t;
};

/** Cl_n(θ) for an integer n ≥ 1 and real θ. Cl_1(θ) = −ln|2 sin(θ/2)|, infinite at θ ≡ 0. */
export function clausen(n: number, theta: number): number {
  const even = n % 2 === 0;
  const t = reduce(theta);
  if (n === 1) return t === 0 ? Number.POSITIVE_INFINITY : -Math.log(Math.abs(2 * Math.sin(t / 2)));
  if (t === 0) return even ? 0 : zetaInt(n);
  // Li_n(e^{iθ}) as re + i·im, accumulated in real arithmetic: μ^k = (iθ)^k cycles
  // through the quadrants, so each term lands in exactly one of re / im.
  let re = 0;
  let im = 0;
  // Singular term: μ^{n−1}/(n−1)! · (H_{n−1} − ln(−μ)), with −μ = −iθ, ln(−iθ) = ln|θ| − i·sgn(θ)π/2.
  let h = 0;
  let fact = 1;
  for (let k = 1; k <= n - 1; k++) {
    h += 1 / k;
    fact *= k;
  }
  const lnRe = Math.log(Math.abs(t));
  const lnIm = -Math.sign(t) * (Math.PI / 2);
  const cRe = h - lnRe; // (H − ln(−μ))
  const cIm = -lnIm;
  // μ^{n−1} = (iθ)^{n−1}
  const pw = Math.pow(t, n - 1) / fact;
  const [pRe, pIm] = quadrant(n - 1, pw);
  re += pRe * cRe - pIm * cIm;
  im += pRe * cIm + pIm * cRe;
  // Regular terms Σ_{k≠n−1} ζ(n−k) θ^k/k! · i^k. Every other term past k = n is a
  // trivial zero ζ(−2j) = 0, so convergence is judged on the nonzero ones only.
  let term = 1; // θ^k / k!
  for (let k = 0; k < 400; k++) {
    if (k > 0) term *= t / k;
    if (k === n - 1) continue;
    const c = zetaInt(n - k) * term;
    if (c === 0) continue;
    const [qRe, qIm] = quadrant(k, c);
    re += qRe;
    im += qIm;
    if (k > n + 8 && Math.abs(c) < 1e-17 * (Math.abs(re) + Math.abs(im) + 1e-300)) break;
  }
  return even ? im : re;
}

/** x · i^k split into (re, im). */
function quadrant(k: number, x: number): [number, number] {
  switch (k & 3) {
    case 0:
      return [x, 0];
    case 1:
      return [0, x];
    case 2:
      return [-x, 0];
    default:
      return [0, -x];
  }
}
