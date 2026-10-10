// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import {
  atDigits,
  bernoulliRational,
  bigAdd,
  bigCx,
  bigDiv,
  bigExp,
  bigLog,
  bigMul,
  bigScale,
  hurwitzZetaBig,
  type BigCx,
} from "@enumeratio/ce-patches";
import { reaches, riemannSiegelZAsymptotic } from "./riemann-siegel-asymptotic.ts";

// The BigDecimal twin of `riemannSiegelZ` (riemann-siegel.ts): Z(z) = e^{iϑ(z)} ζ(½ + iz) with
//   ϑ(z) = (ln Γ(¼ + iz/2) − ln Γ(¼ − iz/2)) / 2i − (z/2) ln π,
// from the bignum Hurwitz zeta (Euler–Maclaurin) and log-gamma kernels, and a Newton refinement
// of a double zero of Z. e^{iϑ} wants ϑ to its absolute digits, and ϑ ~ (t/2) ln t carries
// log10 of that many integer digits; those are added to the working precision. Z is small near
// its zeros and a complex argument's imaginary part can be tiny against its real part, so each
// part is only returned with the digits asked for, re-running with more working digits when it
// has fewer.

const GUARD = 12;
/** Past this many working digits a part this far below the other is not worth chasing. */
const MAX_WORKING = 1200;
const MAX_PASSES = 6;
/** The Euler–Maclaurin sum costs a term per unit of |t|/2π or so: ~1 s at 10⁵, and not worth more. */
const MAX_ARGUMENT = 100_000;
/** A complex argument re-runs at several working precisions to resolve its smaller part: ~4 s at 10⁵. */
const MAX_COMPLEX_ARGUMENT = 20_000;
/** Digits kept past those asked for, so a part right at the limit is not trusted. */
const SPARE = 4;

const log10 = (x: BigDecimal): number => x.abs().ln().toNumber() / Math.LN10;

/**
 * ln Γ(z) for Re z > 0 at the caller's working precision, up to multiples of 2πi in its
 * imaginary part (all e^{iϑ} needs): Stirling's series at z + n, where n lifts |z + n| past
 * 0.4·digits, the radius at which the series' smallest term clears the digits, less the logs of
 * z, z+1, …, z+n−1. (`logGammaBig` carries a fixed number of Stirling terms, good to ~30 digits.)
 */
function lnGammaBig(z: BigCx): BigCx {
  const digits = BigDecimal.precision;
  const radius = Math.ceil(0.4 * digits) + 10;
  const n = Math.max(0, Math.ceil(radius - Math.hypot(z.re.toNumber(), z.im.toNumber())));
  let shift: BigCx = bigCx(0);
  for (let k = 0; k < n; k++) shift = bigAdd(shift, bigLog({ re: z.re.add(k), im: z.im }));
  const w: BigCx = { re: z.re.add(n), im: z.im };
  const lnW = bigLog(w);
  let sum = bigAdd(
    bigAdd(bigMul({ re: w.re.sub(0.5), im: w.im }, lnW), { re: w.re.neg(), im: w.im.neg() }),
    bigCx(BigDecimal.PI.mul(2).ln().div(2)),
  );
  const inv = bigDiv(bigCx(1), w);
  const inv2 = bigMul(inv, inv);
  const tol = new BigDecimal(10).pow(-(digits + 2));
  let power = inv;
  for (let k = 1; k < 2 * digits; k++) {
    const [num, den] = bernoulliRational(2 * k);
    const coefficient = new BigDecimal(num.toString()).div(new BigDecimal(den.toString())).div(2 * k * (2 * k - 1));
    const term = bigScale(power, coefficient);
    sum = bigAdd(sum, term);
    if (term.re.abs().lt(tol) && term.im.abs().lt(tol)) break;
    power = bigMul(power, inv2);
  }
  return { re: sum.re.sub(shift.re), im: sum.im.sub(shift.im) };
}

/** ζ(s) at the working precision; undefined where the kernel declines, or finds no truncation. */
function zetaOrUndefined(s: BigCx, working: number): BigCx | undefined {
  try {
    return hurwitzZetaBig(s, bigCx(1), working);
  } catch {
    return undefined;
  }
}

/** Z at real t at the caller's working precision. */
function realZ(t: BigDecimal, working: number): BigDecimal | undefined {
  const zeta = zetaOrUndefined({ re: bigCx(0.5).re, im: t }, working);
  if (zeta === undefined) return undefined;
  const half = t.div(2);
  const theta = lnGammaBig(bigCx(0.25, half)).im.sub(half.mul(BigDecimal.PI.ln()));
  return zeta.re.mul(theta.cos()).sub(zeta.im.mul(theta.sin()));
}

/** Z at complex z = x + iy at the caller's working precision. */
function complexZ(x: BigDecimal, y: BigDecimal, working: number): BigCx | undefined {
  const zeta = zetaOrUndefined({ re: bigCx(0.5).re.sub(y), im: x }, working);
  if (zeta === undefined) return undefined;
  const a = lnGammaBig({ re: bigCx(0.25).re.sub(y.div(2)), im: x.div(2) });
  const b = lnGammaBig({ re: bigCx(0.25).re.add(y.div(2)), im: x.div(-2) });
  const lnPi = BigDecimal.PI.ln();
  const thetaRe = a.im.sub(b.im).div(2).sub(x.div(2).mul(lnPi));
  const thetaIm = a.re.sub(b.re).div(-2).sub(y.div(2).mul(lnPi));
  // e^{iϑ} = e^{−Im ϑ}(cos Re ϑ + i sin Re ϑ)
  const phase = bigExp({ re: thetaIm.neg(), im: thetaRe });
  return bigMul(phase, zeta);
}

/** Integer digits of the largest argument ϑ is formed from, which the phase must resolve. */
const phaseDigits = (x: BigDecimal, y: BigDecimal): number =>
  Math.max(0, Math.ceil(Math.log10(1 + Math.abs(x.toNumber()) * Math.log(2 + Math.abs(x.toNumber()))))) +
  Math.max(0, Math.ceil(Math.log10(1 + Math.abs(y.toNumber()))));

/**
 * `compute` at growing working precision until every part it returns has `digits` correct
 * significant digits. A part's error is about 10^−(working − extra), so it keeps
 * (working − extra) − lost digits when it is 10^−lost small. One down in that noise has no size
 * to go by, so the precision doubles; one above it is re-run for the digits it lost.
 */
function resolved(
  parts: (working: number) => readonly BigDecimal[] | undefined,
  digits: number,
  extra: number,
): BigDecimal[] | undefined {
  let working = digits + GUARD + extra;
  for (let pass = 0; pass < MAX_PASSES && working <= MAX_WORKING; pass++) {
    const values = atDigits(working, () => parts(working));
    if (values === undefined) return undefined;
    let next = working;
    for (const v of values) {
      const lost = v.isZero() ? Infinity : Math.max(0, -log10(v));
      if (lost <= working - extra - digits - SPARE) continue;
      const sized = lost < working - extra - SPARE;
      next = Math.max(next, sized ? digits + SPARE + extra + GUARD + Math.ceil(lost) : 2 * working);
    }
    if (next === working) return values.map((v) => v.toPrecision(digits));
    working = next;
  }
  return undefined;
}

/**
 * Z(x + iy) from the Riemann–Siegel formula, each part to `digits` significant digits (the real
 * part alone when y is 0), or undefined when the series can't reach them: it is asymptotic, so
 * small t, a part near a zero, and a large y all fall outside it. A part's own size sets the
 * truncation it needs, so the terms are re-chosen when a part came out small, unless `strict` is
 * off, which settles for `digits` absolute.
 */
export function asymptoticParts(x: BigDecimal, y: BigDecimal, digits: number, strict = true): BigDecimal[] | undefined {
  const real = y.isZero();
  // The imaginary part is ~y·Z′, and so is its truncation error, in proportion.
  const scale = [1, Math.min(1, Math.abs(y.toNumber()))];
  let accuracy = strict ? digits + SPARE : digits;
  for (let pass = 0; pass < 3; pass++) {
    const values = resolved(
      () => {
        const z = riemannSiegelZAsymptotic(x, y, accuracy);
        if (z === undefined) return undefined;
        return real ? [z.value.re] : [z.value.re, z.value.im];
      },
      digits,
      phaseDigits(x, y),
    );
    if (values === undefined) return undefined;
    if (!strict) return values; // truncation is absolute: a part near a zero keeps fewer digits
    let wanted = accuracy;
    values.forEach((v, i) => {
      wanted = Math.max(wanted, v.isZero() ? Infinity : Math.ceil(digits + SPARE - log10(v) + Math.log10(scale[i]!)));
    });
    if (wanted === accuracy) return values;
    if (!Number.isFinite(wanted)) return undefined;
    accuracy = wanted;
  }
  return undefined;
}

/** Z(t) for real t, to `digits` significant digits, or undefined when the zeta kernel declines. */
export function riemannSiegelZBig(t: BigDecimal, digits: number): BigDecimal | undefined {
  if (!t.isFinite()) return undefined;
  const asymptotic = asymptoticParts(t, BigDecimal.ZERO, digits);
  if (asymptotic !== undefined) return asymptotic[0];
  if (t.abs().gt(MAX_ARGUMENT)) return undefined;
  const values = resolved(
    (working) => {
      const z = realZ(t, working);
      return z === undefined ? undefined : [z];
    },
    digits,
    phaseDigits(t, BigDecimal.ZERO),
  );
  return values?.[0];
}

/** Z(x + iy) to `digits` significant digits in each part; a part that is exactly zero stays so. */
export function riemannSiegelZComplexBig(x: BigDecimal, y: BigDecimal, digits: number): BigCx | undefined {
  if (!x.isFinite() || !y.isFinite()) return undefined;
  const asymptotic = asymptoticParts(x, y, digits);
  if (asymptotic !== undefined) return { re: asymptotic[0]!, im: asymptotic[1]! };
  if (x.abs().gt(MAX_COMPLEX_ARGUMENT) || y.abs().gt(MAX_COMPLEX_ARGUMENT)) return undefined;
  const values = resolved(
    (working) => {
      const z = complexZ(x, y, working);
      return z === undefined ? undefined : [z.re, z.im];
    },
    digits,
    phaseDigits(x, y),
  );
  return values === undefined ? undefined : { re: values[0]!, im: values[1]! };
}

/** A double as the exact decimal it is (BigDecimal's own reading takes the shortest one that round-trips). */
function exactDouble(x: number): BigDecimal {
  if (Number.isInteger(x)) return new BigDecimal(BigInt(x));
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
  const shift = (biased === 0 ? 1 : biased) - 1075; // x = ±mantissa · 2^shift, and shift < 0 here
  const exact = atDigits(Math.ceil(-shift * 0.31) + 20, () =>
    new BigDecimal(mantissa).div(new BigDecimal(1n << BigInt(-shift))),
  );
  return x < 0 ? exact.neg() : exact;
}

/** Digits of Z a double result is held to. */
const DOUBLE_ACCURACY = 17;

/**
 * Real t from here on go through the Riemann–Siegel formula too: the zeta sum's double phases lose
 * ~log₁₀(t ln t) digits (a relative 10⁻¹¹ by t = 10⁴, 10⁻⁸ by 10⁶), but it is ~30× the work of the
 * sum below this, which is good to ~10⁻¹² and what a plot over the first zeros wants.
 */
const REAL_SWITCH = 2000;

/**
 * Z(x + iy) as doubles, from the Riemann–Siegel formula, for the large |x| where it reaches a
 * double's digits. Undefined elsewhere. The doubles are taken as the exact numbers they are.
 */
export function riemannSiegelZLarge(x: number, y: number): readonly [number, number] | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  if ((y === 0 && Math.abs(x) < REAL_SWITCH) || !reaches(Math.abs(x), DOUBLE_ACCURACY)) return undefined;
  const parts = asymptoticParts(exactDouble(x), exactDouble(y), DOUBLE_ACCURACY, false);
  if (parts === undefined) return undefined;
  const [re, im] = [parts[0]!.toNumber(), parts[1]?.toNumber() ?? 0]; // |Z| grows like e^{|y| ln t / 2}
  return Number.isFinite(re) && Number.isFinite(im) ? [re, im] : undefined;
}

const MAX_NEWTON = 8;

/**
 * The zero of Z nearest the double `seed`, to `digits` significant digits, by Newton's method with
 * a central-difference slope whose step makes the slope's own relative error about 10^−(working/2),
 * so each step more than doubles the digits. Undefined when it hasn't settled, or wandered off
 * the seed (a different zero).
 */
export function riemannZetaZeroBig(seed: number, digits: number): BigDecimal | undefined {
  if (!Number.isFinite(seed) || Math.abs(seed) > MAX_ARGUMENT) return undefined;
  const t0 = new BigDecimal(seed);
  const extra = phaseDigits(t0, BigDecimal.ZERO);
  const working = digits + GUARD + extra + 10;
  return atDigits(working, () => {
    const h = new BigDecimal(10).pow(-Math.ceil(working / 4));
    const tol = new BigDecimal(10).pow(-(digits + 4));
    let t = t0;
    for (let i = 0; i < MAX_NEWTON; i++) {
      const [at, above, below] = [realZ(t, working), realZ(t.add(h), working), realZ(t.sub(h), working)];
      if (at === undefined || above === undefined || below === undefined) return undefined;
      const slope = above.sub(below).div(h.mul(2));
      if (slope.isZero()) return undefined;
      const step = at.div(slope);
      t = t.sub(step);
      if (
        t
          .sub(t0)
          .abs()
          .gt(1e-6 * Math.max(1, Math.abs(seed)))
      )
        return undefined;
      if (step.abs().lt(tol)) return t.toPrecision(digits);
    }
    return undefined;
  });
}
