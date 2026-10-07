// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import { atDigits } from "@enumeratio/ce-patches";
import { carlsonRDBig, carlsonRFBig, carlsonRJBig } from "./carlson-big.ts";

// The BigDecimal twin of `ellipticPiComplete` / `incompleteEllipticPi` (elliptic.ts) for real
// characteristic n, parameter m and amplitude φ: Π(n; φ, m) = sin φ·R_F(cos²φ, 1−m sin²φ, 1)
// + (n/3)·sin³φ·R_J(cos²φ, 1−m sin²φ, 1, 1−n sin²φ) on [−π/2, π/2] (DLMF 19.25.14), shifted
// into that range by Π(n; φ+kπ, m) = 2k·Π(n, m) + Π(n; φ, m). R_J is declined outside the
// positive reals, so an argument that needs its principal value stays unevaluated.

const GUARD = 20;
const big = (x: number): BigDecimal => new BigDecimal(x);

/** Π(n, m), or Π(n; φ, m) when `phi` is given, to `digits` digits; undefined where R_F/R_J decline. */
export function ellipticPiBig(
  n: BigDecimal,
  phi: BigDecimal | undefined,
  m: BigDecimal,
  digits: number,
): BigDecimal | undefined {
  if (!n.isFinite() || !m.isFinite() || (phi !== undefined && !phi.isFinite())) return undefined;
  const working = digits + GUARD;
  const value = atDigits(working, () => {
    const one = big(1);
    const third = n.div(3);
    const complete = (): BigDecimal | undefined => {
      const rf = carlsonRFBig(big(0), one.sub(m), one, working);
      const rj = carlsonRJBig(big(0), one.sub(m), one, one.sub(n), working);
      return rf === undefined || rj === undefined ? undefined : rf.add(third.mul(rj));
    };
    if (phi === undefined) return complete();

    const k = phi.div(BigDecimal.PI).round();
    const reduced = phi.sub(k.mul(BigDecimal.PI));
    const s = reduced.sin();
    const s2 = s.mul(s);
    const c2 = one.sub(s2);
    const x = c2.isNegative() ? big(0) : c2;
    const rf = carlsonRFBig(x, one.sub(m.mul(s2)), one, working);
    const rj = carlsonRJBig(x, one.sub(m.mul(s2)), one, one.sub(n.mul(s2)), working);
    if (rf === undefined || rj === undefined) return undefined;
    const base = s.mul(rf).add(third.mul(s2).mul(s).mul(rj));
    if (k.isZero()) return base;
    const whole = complete();
    return whole === undefined ? undefined : whole.mul(k).mul(2).add(base);
  });
  return value?.toPrecision(digits);
}

/**
 * E(φ, m) = s·R_F(c², 1−m s², 1) − (m/3)·s³·R_D(c², 1−m s², 1) on [−π/2, π/2] (DLMF 19.25.9),
 * shifted into that range by E(φ+kπ, m) = 2k·E(m) + E(φ, m); to `digits` digits, or undefined
 * where R_F/R_D decline.
 */
export function incompleteEllipticEBig(phi: BigDecimal, m: BigDecimal, digits: number): BigDecimal | undefined {
  if (!phi.isFinite() || !m.isFinite()) return undefined;
  const working = digits + GUARD;
  const value = atDigits(working, () => {
    const one = big(1);
    const form = (x: BigDecimal, y: BigDecimal, s: BigDecimal): BigDecimal | undefined => {
      const rf = carlsonRFBig(x, y, one, working);
      const rd = carlsonRDBig(x, y, one, working);
      return rf === undefined || rd === undefined ? undefined : s.mul(rf).sub(m.div(3).mul(s).mul(s).mul(s).mul(rd));
    };
    const k = phi.div(BigDecimal.PI).round();
    const s = phi.sub(k.mul(BigDecimal.PI)).sin();
    const s2 = s.mul(s);
    const c2 = one.sub(s2);
    const base = form(c2.isNegative() ? big(0) : c2, one.sub(m.mul(s2)), s);
    if (base === undefined || k.isZero()) return base;
    const rf = carlsonRFBig(big(0), one.sub(m), one, working);
    const rd = carlsonRDBig(big(0), one.sub(m), one, working);
    if (rf === undefined || rd === undefined) return undefined;
    return rf.sub(m.div(3).mul(rd)).mul(k).mul(2).add(base);
  });
  return value?.toPrecision(digits);
}

/** A complex value as its parts. */
export interface BigComplex {
  readonly re: BigDecimal;
  readonly im: BigDecimal;
}

/**
 * R_F(x, y, z) for x, z ≥ 0 and any real y, at the caller's working precision. For y < 0 the
 * integral runs through the branch point t = −y: with p = −y, A = x + p and C = z + p,
 *   Re R_F = R_F(0, A, C),   Im R_F = −R_F(1/p, x/(pA), z/(pC)) / √(AC)
 * (the part on (0, p) turned into an R_F by t = p − 1/w; the sign is that of the principal root
 * of the negative factor, the side Wolfram's F(φ | m) takes for m sin²φ > 1).
 */
function rfAcrossBranch(x: BigDecimal, y: BigDecimal, z: BigDecimal, working: number): BigComplex | undefined {
  if (!y.isNegative()) {
    const re = carlsonRFBig(x, y, z, working);
    return re === undefined ? undefined : { re, im: big(0) };
  }
  const p = y.neg();
  const [a, c] = [x.add(p), z.add(p)];
  const re = carlsonRFBig(big(0), a, c, working);
  const im = carlsonRFBig(big(1).div(p), x.div(p.mul(a)), z.div(p.mul(c)), working);
  return re === undefined || im === undefined ? undefined : { re, im: im.div(a.mul(c).sqrt()).neg() };
}

/**
 * F(φ, m) = s·R_F(c², 1−m s², 1) on [−π/2, π/2] (DLMF 19.25.5), shifted into that range by
 * F(φ+kπ, m) = F(φ, m) + 2k·K(m) with K(m) = R_F(0, 1−m, 1); to `digits` digits. m > 1 makes
 * it complex once m sin²φ > 1 (and K(m) always), which `rfAcrossBranch` carries. Undefined where
 * R_F declines (m = 1 at φ = π/2 + kπ, a pole).
 */
export function incompleteEllipticFBig(phi: BigDecimal, m: BigDecimal, digits: number): BigComplex | undefined {
  if (!phi.isFinite() || !m.isFinite()) return undefined;
  const working = digits + GUARD;
  const value = atDigits(working, (): BigComplex | undefined => {
    const one = big(1);
    const k = phi.div(BigDecimal.PI).round();
    const s = phi.sub(k.mul(BigDecimal.PI)).sin();
    const s2 = s.mul(s);
    const c2 = one.sub(s2);
    const base = rfAcrossBranch(c2.isNegative() ? big(0) : c2, one.sub(m.mul(s2)), one, working);
    if (base === undefined) return undefined;
    const scaled = { re: s.mul(base.re), im: s.mul(base.im) };
    if (k.isZero()) return scaled;
    const whole = rfAcrossBranch(big(0), one.sub(m), one, working);
    if (whole === undefined) return undefined;
    return { re: whole.re.mul(k).mul(2).add(scaled.re), im: whole.im.mul(k).mul(2).add(scaled.im) };
  });
  return value === undefined ? undefined : { re: value.re.toPrecision(digits), im: value.im.toPrecision(digits) };
}
