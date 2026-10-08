// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import { atDigits } from "@enumeratio/ce-patches";
import { rd, rf } from "./carlson-big.ts";

// The BigDecimal twin of jacobi-elliptic.ts's real kernel: the descending Landen/AGM amplitude
// (Abramowitz & Stegun 16.4) for real u and m strictly inside (0, 1), which is what a `N(…, d)`
// past a double's digits needs. JacobiZN's elliptic E comes from the Carlson kernels, DLMF
// 19.25.9-10. Complex u, m outside (0, 1) and arguments too large to reduce are declined.

const GUARD = 15;
const MAX_AGM_STEPS = 80;
/** Past this |u| the amplitude's sin/cos would need more reduction digits than are worth carrying. */
const MAX_ARGUMENT = 1e12;

const big = (x: number): BigDecimal => new BigDecimal(x);
const round = (x: BigDecimal): BigDecimal => x.toPrecision(BigDecimal.precision);
const log10 = (x: BigDecimal): number => x.abs().ln().toNumber() / Math.LN10;

/** am(u, m) at the current working precision. */
function amplitude(u: BigDecimal, m: BigDecimal): BigDecimal | undefined {
  // Rounding to the working precision leaves c with noise of a unit or two in the last place, so
  // asking for c ≤ 10^-precision·a can stall (m = 0.999 at 50 digits); the guard digits cover the slack.
  const tol = big(10).pow(-(BigDecimal.precision - 3));
  let a = big(1);
  let b = round(big(1).sub(m).sqrt());
  let c = round(m.sqrt());
  const seqA = [a];
  const seqC = [c];
  for (let n = 0; n < MAX_AGM_STEPS; n++) {
    [a, b, c] = [round(a.add(b).div(2)), round(a.mul(b).sqrt()), round(a.sub(b).div(2))];
    seqA.push(a);
    seqC.push(c);
    if (c.abs().lte(tol.mul(a.abs()))) {
      let phi = round(u.mul(big(2).pow(n + 1)).mul(a));
      for (let k = n + 1; k >= 1; k--) {
        const ratio = seqC[k]!.div(seqA[k]!);
        phi = round(phi.add(round(ratio.mul(phi.sin())).asin()).div(2));
      }
      return phi;
    }
  }
  return undefined; // the AGM did not settle
}

/** sn, cn, dn at real u and 0 < m < 1, to `digits` significant digits. */
export function sncndnBig(
  u: BigDecimal,
  m: BigDecimal,
  digits: number,
): { S: BigDecimal; C: BigDecimal; D: BigDecimal } | undefined {
  if (!u.isFinite() || u.abs().gt(MAX_ARGUMENT) || !m.isFinite() || !m.isPositive() || m.gte(1)) return undefined;
  // sin and cos of an amplitude of size ~u give up log10(u) digits.
  const extra = Math.max(0, Math.ceil(log10(u.abs().add(1))));
  return atDigits(digits + GUARD + extra, () => {
    const phi = amplitude(u, m);
    if (phi === undefined) return undefined;
    const S = phi.sin();
    const C = phi.cos();
    const D = round(big(1).sub(m.mul(S).mul(S)).sqrt());
    return { S: S.toPrecision(digits), C: C.toPrecision(digits), D: D.toPrecision(digits) };
  });
}

/** Jacobi zeta Z(u, m) = E(am(u, m), m) − E(m)·u/K(m), at real u and 0 < m < 1. */
export function jacobiZetaBig(u: BigDecimal, m: BigDecimal, digits: number): BigDecimal | undefined {
  if (!u.isFinite() || u.abs().gt(MAX_ARGUMENT) || !m.isFinite() || !m.isPositive() || m.gte(1)) return undefined;
  let extra = Math.max(0, Math.ceil(log10(u.abs().add(1))));
  for (let pass = 0; pass < 2; pass++) {
    const working = digits + GUARD + extra;
    const attempt = atDigits(working, () => {
      const phi = amplitude(u, m);
      if (phi === undefined) return undefined;
      // E(φ) over |φ| ≤ π/2 by Carlson; E(φ + nπ) = E(φ) + 2nE(m).
      const n = phi.div(BigDecimal.PI).round();
      const reduced = round(phi.sub(n.mul(BigDecimal.PI)));
      const s = reduced.sin();
      const c2 = round(big(1).sub(s.mul(s)));
      const y = round(big(1).sub(m.mul(s).mul(s)));
      const one = big(1);
      const fInc = rf(c2, y, one);
      const dInc = rd(c2, y, one);
      const fComplete = rf(big(0), big(1).sub(m), one);
      const dComplete = rd(big(0), big(1).sub(m), one);
      if (fInc === undefined || dInc === undefined || fComplete === undefined || dComplete === undefined)
        return undefined;
      const eComplete = round(fComplete.sub(m.mul(dComplete).div(3)));
      const eInc = round(s.mul(fInc).sub(m.mul(s).mul(s).mul(s).mul(dInc).div(3)).add(n.mul(2).mul(eComplete)));
      const linear = round(eComplete.mul(u).div(fComplete));
      const z = round(eInc.sub(linear));
      return { z, peak: eInc.abs().gt(linear.abs()) ? eInc.abs() : linear.abs() };
    });
    if (attempt === undefined || attempt.z.isZero()) return undefined;
    const lost = Math.max(0, log10(attempt.peak) - log10(attempt.z));
    if (!Number.isFinite(lost) || lost > 200) return undefined;
    if (pass === 1 || lost <= GUARD / 2) return attempt.z.toPrecision(digits);
    extra += Math.ceil(lost);
  }
  return undefined;
}

/** The Glaisher quotient p/q of sn, cn, dn and 1 (`N`), to `digits` digits; undefined at a pole. */
export function jacobiQuotientBig(
  u: BigDecimal,
  m: BigDecimal,
  p: "S" | "C" | "D" | "N",
  q: "S" | "C" | "D" | "N",
  digits: number,
): BigDecimal | undefined {
  const r = sncndnBig(u, m, digits + GUARD);
  if (r === undefined) return undefined;
  const parts = { ...r, N: big(1) };
  if (parts[q].isZero()) return undefined;
  return atDigits(digits + GUARD, () => {
    const value = parts[p].div(parts[q]);
    return value.isFinite() ? value.toPrecision(digits) : undefined;
  });
}
