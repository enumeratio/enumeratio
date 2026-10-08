// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import type { Engine, Expr } from "@enumeratio/engine";
import { atDigits } from "@enumeratio/ce-patches";
import { BigDecimal } from "@enumeratio/engine/unstable";

// Subfactorial(n) = Γ(n+1, −1)/e at a real, non-integer n, to any number of digits. With a = n+1,
//   Γ(a, −1) = Γ(a) − γ(a, −1),   γ(a, −1) = e^{iπa} Σ_{k≥0} 1/(k! (a+k))
// (DLMF 8.7.1 at z = −1, the principal branch z^a = e^{iπa}), so
//   D_n = (Γ(a) − cos(πa)·S)/e − i·sin(πa)·S/e,   S = Σ 1/(k! (a+k)).
// The series converges like 1/k!. Γ(a) is compute-engine's own, which carries the working
// precision for a real argument. Complex n and arguments too large to reduce are declined.

const GUARD = 15;
const MAX_TERMS = 2_000;
/** Past this |a| the π·a reduction and Γ(a) are not worth carrying. */
const MAX_ARGUMENT = 10_000;
/** Past this many digits lost to cancellation the answer is not worth carrying. */
const MAX_LOST_DIGITS = 400;

const log10 = (x: BigDecimal): number => x.abs().ln().toNumber() / Math.LN10;

/** Γ(a) at `digits` working digits, by compute-engine's own real Gamma. */
function gammaAt(ce: Engine, a: BigDecimal, digits: number): BigDecimal | undefined {
  const saved = ce.precision;
  ce.precision = digits;
  try {
    const g = ce.function("Gamma", [ce.number(a)]).N();
    return g.im === 0 ? g.bignumRe : undefined;
  } finally {
    ce.precision = saved;
  }
}

interface Parts {
  readonly re: BigDecimal;
  readonly im: BigDecimal;
  /** The largest magnitude summed into `re` and into `S`, which set the digits cancellation cost. */
  readonly peakRe: BigDecimal;
  readonly peakS: BigDecimal;
  readonly s: BigDecimal;
}

function parts(ce: Engine, a: BigDecimal, working: number): Parts | undefined {
  return atDigits(working, () => {
    const round = (x: BigDecimal): BigDecimal => x.toPrecision(working);
    const gamma = gammaAt(ce, a, working);
    if (gamma === undefined) return undefined;
    // Past k > −a every denominator a+k is positive and at least frac(a), so the tail is bounded by
    // two terms' worth of 1/(k! frac(a)).
    const fractional = a.sub(a.floor());
    const tol = new BigDecimal(10).pow(-(working - 2));
    let invFactorial = new BigDecimal(1);
    let s = new BigDecimal(0);
    let peakS = new BigDecimal(0);
    for (let k = 0; k < MAX_TERMS; k++) {
      const term = round(invFactorial.div(a.add(k)));
      s = round(s.add(term));
      if (term.abs().gt(peakS)) peakS = term.abs();
      if (a.add(k).gt(1) && invFactorial.div(fractional).lt(tol.mul(s.abs()))) {
        const angle = round(BigDecimal.PI.mul(a));
        const cos = angle.cos();
        const sin = angle.sin();
        const e = new BigDecimal(1).exp();
        const cosS = round(cos.mul(s));
        const re = round(gamma.sub(cosS).div(e));
        const im = round(sin.mul(s).neg().div(e));
        return { re, im, peakRe: gamma.abs().gt(cosS.abs()) ? gamma.abs() : cosS.abs(), peakS, s };
      }
      invFactorial = round(invFactorial.div(k + 1));
    }
    return undefined; // did not settle inside the term budget
  });
}

/** D_n for real, non-integer `n`, to `digits` significant digits; undefined when it can't be vouched for. */
export function subfactorialBig(
  ce: Engine,
  n: BigDecimal,
  digits: number,
): { re: BigDecimal; im: BigDecimal } | undefined {
  if (!n.isFinite() || n.isInteger() || n.abs().gt(MAX_ARGUMENT)) return undefined;
  const a = n.add(1);
  // Reducing π·a costs log10|a| digits.
  let extra = Math.max(0, Math.ceil(log10(a.abs().add(1))));
  for (let pass = 0; pass < 2; pass++) {
    const working = digits + GUARD + extra;
    const r = parts(ce, a, working);
    if (r === undefined || r.re.isZero() || r.s.isZero()) return undefined;
    const lost = Math.max(0, log10(r.peakRe) - log10(r.re), log10(r.peakS) - log10(r.s));
    if (!Number.isFinite(lost) || lost > MAX_LOST_DIGITS) return undefined;
    if (pass === 1 || lost <= GUARD / 2) {
      return atDigits(working, () => ({ re: r.re.toPrecision(digits), im: r.im.toPrecision(digits) }));
    }
    extra += Math.ceil(lost);
  }
  return undefined;
}

/** `re + im·i` boxed with both parts at the digits given (`im` is never zero off the integers). */
export function boxComplex(ce: Engine, re: BigDecimal, im: BigDecimal): Expr {
  return ce.box(["Complex", { num: re.toString() }, { num: im.toString() }] as never);
}
