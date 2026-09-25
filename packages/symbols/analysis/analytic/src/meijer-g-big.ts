import { BigDecimal } from "@cortex-js/compute-engine";
import type { Cx } from "./complex.ts";
import {
  add as badd,
  atDigits,
  bigCx,
  type BigCx,
  div as bdiv,
  exp as bexp,
  mul as bmul,
  pow as bpow,
} from "./bigzeta.ts";
import { logGammaBig } from "./loggamma.ts";

// The BigDecimal twin of meijer-g.ts's `meijerGSeries` — same DLMF 16.17.2 sum, same term
// structure, run at extended precision so a second cancellation this package's double kernels
// don't otherwise reach for gets covered too: the *outer* sum over poles b_h. Even with an
// exact Γ-prefactor (`logGammaBig`), each h-term is only as accurate as a double lets it be
// multiplied out to, and the terms can be much larger than their sum — MeijerG({{},{}},
// {{0,1/2},{}}, 1.3) sums 8.758… and −8.577… to 0.181…, a ~48× cancellation that alone costs
// double about 1.7 digits, still short of a few ulps. Running the whole sum — Γ-prefactors,
// z^{b_h}, the pFq series, and the h-sum itself — in BigDecimal with guard digits fixes both
// cancellations (this one and the recurrence's, since `logGammaBig` is reused) in one pass;
// only the final total rounds back to a double.

/** Digits carried past a double's ~16-17, covering the outer sum's cancellation (and pFq's,
 * for the rare term that overshoots the final answer). Generous: this runs once per MeijerG
 * evaluation, not in a hot per-term loop. */
const DIGITS = 50;

// p = q makes the inner pFq exactly one upper parameter short of a lower one (DLMF 16.17.2:
// upper has p entries, lower has q−1), so its terms decay like |z|ᵏ for any parameters — near
// the unit circle that needs many terms to clear 40 digits (`z = 0.9` wants ~900). Generous
// since this only runs once per MeijerG evaluation, not per term of an outer loop.
const MAX_TERMS = 20_000;

const bneg = (x: BigCx): BigCx => ({ re: x.re.neg(), im: x.im.neg() });
const bmag = (x: BigCx): number => Math.hypot(x.re.toNumber(), x.im.toNumber());

const isNonPosIntBig = (z: BigCx): boolean =>
  z.im.isZero() && !z.re.isPositive() && z.re.isInteger();

/** Γ(z) in BigDecimal, `undefined` at the poles (matching `gammaC` in meijer-g.ts). */
function gammaBig(z: BigCx, digits: number): BigCx | undefined {
  if (isNonPosIntBig(z)) return undefined;
  return bexp(logGammaBig(z, digits));
}

/**
 * pFq(upper; lower; z) in BigDecimal — the same series as `pfqSeries` (hypergeometric.ts),
 * stopped once a term is provably below the working precision rather than a fixed `1e-16`.
 */
function pfqSeriesBig(
  upper: readonly BigCx[],
  lower: readonly BigCx[],
  z: BigCx,
): BigCx | undefined {
  const tol = 10 ** -(BigDecimal.precision - 2);
  let term: BigCx = bigCx(1);
  let sum: BigCx = bigCx(1);
  for (let k = 0; k < MAX_TERMS; k++) {
    if (term.re.isZero() && term.im.isZero()) return sum; // terminated (a polynomial case)
    let num = z;
    for (const a of upper) num = bmul(num, badd(a, bigCx(k)));
    let den: BigCx = bigCx(k + 1);
    let denPole = false;
    for (const b of lower) {
      const bk = badd(b, bigCx(k));
      if (bk.re.isZero() && bk.im.isZero()) {
        denPole = true;
        break;
      }
      den = bmul(den, bk);
    }
    if (denPole) {
      if (num.re.isZero() && num.im.isZero()) return sum; // 0/0 is 0
      return undefined; // a genuine pole
    }
    term = bdiv(bmul(term, num), den);
    sum = badd(sum, term);
    if (bmag(term) < tol * (1 + bmag(sum))) return sum;
  }
  return undefined; // did not converge inside the term budget
}

/**
 * `meijerGSeries` (meijer-g.ts), in BigDecimal at `DIGITS` significant digits — every Γ,
 * z^{b_h}, pFq term and the final h-sum computed with guard digits, rounded to a double only
 * at the very end. Same declines as the double version (non-simple poles, non-convergence);
 * the caller (`meijer-g.ts`) has already run the cheap domain checks (m ≥ 1, p ≤ q, pairwise
 * non-congruent bₕ) before calling this, so this only needs to decline on a Γ pole or a pFq
 * that doesn't converge.
 */
export function meijerGSeriesBig(
  a: readonly Cx[],
  b: readonly Cx[],
  m: number,
  n: number,
  z: Cx,
): Cx | undefined {
  const p = a.length;
  const q = b.length;
  const sign = (p - m - n) % 2 === 0 ? 1 : -1;
  return atDigits(DIGITS, () => {
    const ba = a.map((c) => bigCx(c.re, c.im));
    const bb = b.map((c) => bigCx(c.re, c.im));
    const bz = bigCx(z.re, z.im);
    let total: BigCx = bigCx(0);
    for (let h = 0; h < m; h++) {
      const bh = bb[h];
      let pref: BigCx = bigCx(1);
      for (let j = 0; j < m; j++) {
        if (j === h) continue;
        const g = gammaBig(badd(bb[j], bneg(bh)), DIGITS);
        if (g === undefined) return undefined;
        pref = bmul(pref, g);
      }
      for (let j = 0; j < n; j++) {
        const arg = badd(bigCx(1), badd(bh, bneg(ba[j])));
        const g = gammaBig(arg, DIGITS);
        if (g === undefined) return undefined;
        pref = bmul(pref, g);
      }
      for (let j = m; j < q; j++) {
        const arg = badd(bigCx(1), badd(bh, bneg(bb[j])));
        const g = gammaBig(arg, DIGITS);
        if (g === undefined) return undefined;
        pref = bdiv(pref, g);
      }
      for (let j = n; j < p; j++) {
        const arg = badd(ba[j], bneg(bh));
        const g = gammaBig(arg, DIGITS);
        if (g === undefined) return undefined;
        pref = bdiv(pref, g);
      }
      const upper = ba.map((aj) => badd(bigCx(1), badd(bh, bneg(aj))));
      const lower = bb.filter((_, j) => j !== h).map((bj) => badd(bigCx(1), badd(bh, bneg(bj))));
      const argZ = sign > 0 ? bz : bneg(bz);
      const series = pfqSeriesBig(upper, lower, argZ);
      if (series === undefined) return undefined;
      const zPow =
        z.re === 0 && z.im === 0 && bh.re.isZero() && bh.im.isZero() ? bigCx(1) : bpow(bz, bh);
      const term = bmul(bmul(pref, zPow), series);
      total = badd(total, term);
    }
    return { re: total.re.toNumber(), im: total.im.toNumber() };
  });
}
