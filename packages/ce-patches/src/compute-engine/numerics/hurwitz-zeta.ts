// Riemann/Hurwitz zeta -- pure numeric kernels, no compute-engine imports. The head
// declaration (HurwitzZeta, and Zeta widened to a complex s / two-argument form) lives in
// library/special-functions.ts, which calls hurwitzZeta/zetaGeneralized below.
import { bernoulliNumber } from "./bernoulli-rational.ts";
import { add, cexp, clog, cosPi, cpow, cx, type Cx, mul, scale, sinPi } from "./complex-arithmetic.ts";
import { GAUSS_LEGENDRE_20 } from "./gauss-legendre.ts";
import { logGamma } from "./log-gamma.ts";

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
 * Largest single term magnitude from the most recent `hurwitzEM` call — read via
 * `hurwitzEMWithLargest` immediately after, before any other call into this module
 * reuses it (synchronous, single-threaded, same allocation-free pattern as `_pr`/`_pi`).
 */
let _emLargest = 0;

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
  let largest = 0;
  for (let k = 0; k < n; k++) {
    const br = aRe + k;
    if (br === 0 && aIm === 0) continue; // Wolfram HurwitzZeta drops (n+a)=0
    cpowInto(br, aIm, negSr, negSi);
    sumR += _pr;
    sumI += _pi;
    const m = Math.hypot(_pr, _pi);
    if (m > largest) largest = m;
  }

  const zr = aRe + n; // Re(z) large
  const zi = aIm;
  cpowInto(zr, zi, negSr, negSi); // z^{-s}
  const zNegSr = _pr;
  const zNegSi = _pi;

  cpowInto(zr, zi, 1 - sRe, -sIm); // z^{1-s}
  const dr = sRe - 1;
  const dd = dr * dr + sIm * sIm; // divide by (s-1)
  const t1r = (_pr * dr + _pi * sIm) / dd;
  const t1i = (_pi * dr - _pr * sIm) / dd;
  sumR += t1r;
  sumI += t1i;
  {
    const m = Math.hypot(t1r, t1i);
    if (m > largest) largest = m;
  }

  const t2r = 0.5 * zNegSr; // ½ z^{-s}
  const t2i = 0.5 * zNegSi;
  sumR += t2r;
  sumI += t2i;
  {
    const m = Math.hypot(t2r, t2i);
    if (m > largest) largest = m;
  }

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
    const cr = EM_COEFF[k] * (pochR * zpr - pochI * zpi);
    const ci = EM_COEFF[k] * (pochR * zpi + pochI * zpr);
    sumR += cr;
    sumI += ci;
    const m = Math.hypot(cr, ci);
    if (m > largest) largest = m;
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
  _emLargest = largest;
  return { re: sumR, im: sumI };
}

/**
 * `hurwitzEM`, plus the largest single term magnitude summed along the way. Left of the
 * strip the direct terms grow like N^(−Re s) before cancelling down to an O(1) result —
 * a `largest` many times `|value|` means most of a double's ~16 digits cancelled away, and
 * `polygamma` is the caller that checks the ratio to decide whether to trust what's left.
 */
export function hurwitzEMWithLargest(s: Cx, a: Cx): { value: Cx; largest: number } {
  const value = hurwitzEM(s, a);
  return { value, largest: _emLargest };
}

/** How far from 1 (once shifted by an integer) a may sit for the Taylor series in a. */
const TAYLOR_RADIUS = 0.75;

/**
 * Past this many times `emEdge`, Euler–Maclaurin takes over from the Taylor series left of
 * the strip. Its direct terms stop cancelling at 1×, but its big tail still costs it a digit
 * or two out to ~4×, where walking a down to 1 + h stops being cheap.
 */
const EM_BEYOND = 4;

/** Below this many times ζ, the Taylor series' largest term is as good as Hermite's integral gets. */
const TAYLOR_TRUSTED = 30;

/**
 * Numeric ζ(s, a) for complex s, a. Terms where (n+a)=0 (a a nonpositive integer) are
 * dropped, matching Wolfram's `HurwitzZeta`, which omits the singular term rather than
 * diverging there. Returns a non-finite part at the s=1 pole.
 *
 * Euler–Maclaurin (`hurwitzEM`), except left of Re(s) = 0 not far past where its direct terms
 * end: there those terms grow like N^(−Re s) and cancel down to an O(1) result. Instead, near
 * the real axis, the Taylor series in a about 1 (`hurwitzTaylor`); off it, or wherever that
 * series cancels, Hermite's integral (`hurwitzHermite`), whichever measures the smaller loss.
 */
export function hurwitzZeta(s: Cx, a: Cx): Cx {
  if (s.re >= 0 || a.re >= EM_BEYOND * emEdge(s) || !Number.isFinite(a.re) || !Number.isFinite(a.im)) {
    return hurwitzEM(s, a);
  }
  const taylor = hurwitzTaylor(s, a);
  if (taylor && taylor.lost <= TAYLOR_TRUSTED) return taylor.value;
  const hermite = hurwitzHermite(s, a);
  return taylor && !(hermite.lost < taylor.lost) ? taylor.value : hermite.value;
}

/**
 * a shifted by an integer to b = 1 + h, |Re h| ≤ ½, and ζ(s, 1 + h) = Σₖ C(−s, k) hᵏ ζ(s + k)
 * summed over Riemann zetas, each from the functional equation. For real s its terms fall off
 * like (2πh)ᵏ/k! against ζ(s)'s own scale, so at most e^π is lost inside `TAYLOR_RADIUS`, but
 * that e^(2π|h|) grows fast off the axis, and faster still for complex s. An integer a is
 * h = 0, ζ(s) alone. Undefined past the radius; `lost` is the largest term over the result.
 */
function hurwitzTaylor(s: Cx, a: Cx): { value: Cx; lost: number } | undefined {
  const m = Math.floor(a.re - 0.5); // a − m has real part in [½, 3/2)
  const h = cx(a.re - m - 1, a.im);
  if (!(Math.hypot(h.re, h.im) <= TAYLOR_RADIUS)) return undefined;
  // ζ(s, a) = ζ(s, a+1) + a^(−s): walk a to 1 + h, carrying the terms passed over.
  let { value: z, largest } = zetaNearOne(s, h);
  for (let j = 0; j < Math.abs(m); j++) {
    const br = m > 0 ? h.re + 1 + j : a.re + j;
    if (br === 0 && a.im === 0) continue; // the dropped (n+a)=0 term
    cpowInto(br, a.im, -s.re, -s.im);
    largest = Math.max(largest, Math.hypot(_pr, _pi));
    z = m > 0 ? cx(z.re - _pr, z.im - _pi) : cx(z.re + _pr, z.im + _pi);
  }
  return { value: z, lost: largest / Math.hypot(z.re, z.im) };
}

/** Hermite's integral shifts a no nearer the axis than this; past it the shift's a^(−s) cancels. */
const HERMITE_MIN_RE = 0.125;

/** Past this t, e^(−2πt) is below any term a double could hold beside ζ. */
const HERMITE_T_MAX = 60;

/**
 * Hermite's integral, for any s ≠ 1 once Re(a) > 0:
 *
 *   ζ(s, a) = ½a^(−s) + a^(1−s)/(s−1) + i ∫₀^∞ ((a+it)^(−s) − (a−it)^(−s)) / (e^(2πt) − 1) dt.
 *
 * The integrand's branch points ±ia sit Re(a) off the path, so it is summed in Gauss–Legendre
 * panels no wider than that. An a nearer the axis than `HERMITE_MIN_RE` is first shifted by
 * ζ(s, a) = a^(−s) + ζ(s, a+1). Left of Re(s) = 0 with a off the axis nothing here is much
 * bigger than ζ itself (a digit or so), where the direct terms of Euler–Maclaurin or the Taylor
 * series in a lose up to seven or more. `lost` is the largest part over the result.
 */
function hurwitzHermite(s: Cx, a: Cx): { value: Cx; lost: number } {
  let headR = 0;
  let headI = 0;
  let largest = 0; // the biggest thing summed, for `lost`
  let bRe = a.re;
  const bIm = a.im;
  for (; bRe < HERMITE_MIN_RE; bRe++) {
    if (bRe === 0 && bIm === 0) continue; // the dropped (n+a)=0 term
    cpowInto(bRe, bIm, -s.re, -s.im);
    headR += _pr;
    headI += _pi;
    largest = Math.max(largest, Math.hypot(_pr, _pi));
  }

  cpowInto(bRe, bIm, -s.re, -s.im); // b^(−s)
  let sumR = headR + 0.5 * _pr;
  let sumI = headI + 0.5 * _pi;
  // b^(1−s)/(s−1) = b·b^(−s)/(s−1)
  const pr = bRe * _pr - bIm * _pi;
  const pi = bRe * _pi + bIm * _pr;
  const dr = s.re - 1;
  const dd = dr * dr + s.im * s.im;
  const qr = (pr * dr + pi * s.im) / dd;
  const qi = (pi * dr - pr * s.im) / dd;
  sumR += qr;
  sumI += qi;
  largest = Math.max(largest, 0.5 * Math.hypot(_pr, _pi), Math.hypot(qr, qi));

  // The integrand peaks near t = −Re(s)/2π and then falls like e^(−2πt); stop once two
  // panels past the peak add nothing a double can see.
  const { x, w } = GAUSS_LEGENDRE_20;
  const peak = Math.max(0, -s.re) / (2 * Math.PI);
  const width = Math.min(1, bRe);
  let intR = 0;
  let intI = 0;
  let intAbs = 0; // ∫ |integrand|
  let panelLargest = 0;
  let small = 0;
  for (let p = 0; p * width < HERMITE_T_MAX; p++) {
    let panR = 0;
    let panI = 0;
    let panAbs = 0;
    for (let i = 0; i < x.length; i++) {
      const t = width * (p + 0.5 + 0.5 * x[i]);
      cpowInto(bRe, bIm + t, -s.re, -s.im);
      const uR = _pr;
      const uI = _pi;
      cpowInto(bRe, bIm - t, -s.re, -s.im);
      const k = (0.5 * width * w[i]) / Math.expm1(2 * Math.PI * t);
      // i·(u − v)
      const vR = k * (uR - _pr);
      const vI = k * (uI - _pi);
      panR -= vI;
      panI += vR;
      panAbs += Math.hypot(vR, vI);
    }
    intR += panR;
    intI += panI;
    intAbs += panAbs;
    const size = panAbs;
    panelLargest = Math.max(panelLargest, size);
    if ((p + 1) * width > peak && size <= 1e-17 * panelLargest) {
      if (++small === 2) break;
    } else small = 0;
  }
  const value = cx(sumR + intR, sumI + intI);
  return { value, lost: Math.max(largest, intAbs) / Math.hypot(value.re, value.im) };
}

/** Where `hurwitzEM` starts its asymptotic tail; a at or past it sums no cancelling terms. */
function emEdge(s: Cx): number {
  return Math.max(12, Math.ceil(Math.abs(s.re) + Math.abs(s.im)) + 6);
}

/** ζ(s, 1 + h) = Σₖ C(−s, k) hᵏ ζ(s + k) for |h| < 1, with its largest term — see `hurwitzTaylor`. */
function zetaNearOne(s: Cx, h: Cx): { value: Cx; largest: number } {
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
      return { value: add(sum, t), largest: Math.max(largest, Math.hypot(t.re, t.im)) };
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
  return { value: sum, largest };
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
export const hurwitzZetaReal = (s: number, a: number): number => hurwitzZeta({ re: s, im: 0 }, { re: a, im: 0 }).re;
export const zetaGeneralizedReal = (s: number, a: number): number =>
  zetaGeneralized({ re: s, im: 0 }, { re: a, im: 0 }).re;
