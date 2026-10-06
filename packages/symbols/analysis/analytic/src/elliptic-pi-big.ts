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
