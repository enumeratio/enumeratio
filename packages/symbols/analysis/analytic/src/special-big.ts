// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@enumeratio/engine/unstable";
import { wrapOperator } from "@enumeratio/engine";
import { atDigits, bigRealOperand, bigResult, wantsBigDigits, isFiniteNum, isRealInt } from "@enumeratio/ce-patches";
import { pfqRegularizedBig } from "./hypergeometric-big.ts";

// AiryAi, AiryBi, ExpIntegralEi, LogIntegral and integer-order BesselK and BesselY past a double's
// digits, for real arguments: native evaluates only in a double, so `N(…, d)` for d > 15 would
// print a double's digits as more. Each is a convergent power series (DLMF 9.2.2, 6.6.1, 6.2.8,
// 10.8.1, 10.31.1) summed in BigDecimal; where it cancels, the digits it costs are added and the sum
// run once more. A series that cannot settle declines.

const GUARD = 15;
const MAX_TERMS = 50_000;
/** Past this many digits lost to cancellation the answer is not worth carrying. */
const MAX_LOST_DIGITS = 400;
/** Largest integer order the finite sums of K and Y carry. */
const MAX_ORDER = 200;

const big = (x: number): BigDecimal => new BigDecimal(x);
const log10 = (x: BigDecimal): number => x.abs().ln().toNumber() / Math.LN10;
const biggest = (...xs: BigDecimal[]): BigDecimal => xs.reduce((a, b) => (b.abs().gt(a) ? b.abs() : a), big(0));

interface Sum {
  readonly value: BigDecimal;
  /** The largest magnitude summed, which sets how many digits the value lost to cancellation. */
  readonly peak: BigDecimal;
}

/**
 * `run(working)`'s value to `digits` digits. A value far below its largest part lost digits to
 * cancellation, and a sum that lost more than it carried is noise whose size says nothing about how
 * much it lost. So a value stands only when the same run with ten more digits agrees with it; until
 * then the extra digits double, up to `MAX_LOST_DIGITS`.
 */
function settled(digits: number, run: (working: number) => Sum | undefined): BigDecimal | undefined {
  const tolerance = big(10).pow(-(digits + 2));
  let extra = GUARD;
  while (extra <= MAX_LOST_DIGITS) {
    const [a, b] = [digits + extra, digits + extra + 10].map((working) => atDigits(working, () => run(working))) as [
      Sum | undefined,
      Sum | undefined,
    ];
    if (a === undefined || b === undefined || b.value.isZero()) return undefined;
    if (a.value.sub(b.value).abs().lte(b.value.abs().mul(tolerance))) return b.value.toPrecision(digits);
    const lost = Math.max(0, log10(b.peak) - log10(b.value));
    extra = Math.max(2 * extra, Math.ceil(lost) + GUARD);
  }
  return undefined;
}

/** 3^(-p/q), for the constants of the Airy series. */
const thirdPower = (p: number, q: number): BigDecimal => big(3).ln().mul(p).div(q).neg().exp();

/**
 * Ai(x) or Bi(x), from the two solutions of Airy's equation about 0 (DLMF 9.2.2), through the
 * regularized 0F1 so no Γ(1/3) is needed: with z = x³/9, Ai = 3^(−2/3) R(2/3) − 3^(−4/3) x R(4/3) and
 * Bi = 3^(−1/6) R(2/3) + 3^(−5/6) x R(4/3), where R(b) = 0F1(; b; z)/Γ(b).
 */
export function airyBig(kind: "Ai" | "Bi", x: BigDecimal, digits: number): BigDecimal | undefined {
  if (!x.isFinite()) return undefined;
  return settled(digits, (working) => {
    const z = x.mul(x).mul(x).div(9);
    const r1 = pfqRegularizedBig([], [big(2).div(3)], z, working);
    const r2 = pfqRegularizedBig([], [big(4).div(3)], z, working);
    if (r1 === undefined || r2 === undefined) return undefined;
    const [c1, c2] = kind === "Ai" ? [thirdPower(2, 3), thirdPower(4, 3).neg()] : [thirdPower(1, 6), thirdPower(5, 6)];
    const [a, b] = [c1.mul(r1), c2.mul(x).mul(r2)];
    return { value: a.add(b), peak: biggest(a, b) };
  });
}

/**
 * Ai'(x) or Bi'(x), the same series differentiated: R_b'(z) = R_(b+1)(z) and z' = x²/3, so with
 * Ai = c₁R(2/3) + c₂ x R(4/3), Ai' = c₁ (x²/3) R(5/3) + c₂ (R(4/3) + (x³/3) R(7/3)).
 */
export function airyPrimeBig(kind: "Ai" | "Bi", x: BigDecimal, digits: number): BigDecimal | undefined {
  if (!x.isFinite()) return undefined;
  return settled(digits, (working) => {
    const z = x.mul(x).mul(x).div(9);
    const [r5, r4, r7] = [5, 4, 7].map((p) => pfqRegularizedBig([], [big(p).div(3)], z, working));
    if (r5 === undefined || r4 === undefined || r7 === undefined) return undefined;
    const [c1, c2] = kind === "Ai" ? [thirdPower(2, 3), thirdPower(4, 3).neg()] : [thirdPower(1, 6), thirdPower(5, 6)];
    const x2 = x.mul(x);
    const [a, b, c] = [c1.mul(x2).div(3).mul(r5), c2.mul(r4), c2.mul(x2).mul(x).div(3).mul(r7)];
    return { value: a.add(b).add(c), peak: biggest(a, b, c) };
  });
}

/** Ei(x) = γ + ln|x| + Σ_{k≥1} xᵏ/(k·k!) for real x ≠ 0 (DLMF 6.6.1 and 6.2.8, the principal value). */
export function expIntegralEiBig(x: BigDecimal, digits: number): BigDecimal | undefined {
  if (!x.isFinite() || x.isZero()) return undefined;
  return settled(digits, (working) => eiSum(x, working));
}

/** The series for Ei(x) at `working` digits, with its largest part. */
function eiSum(x: BigDecimal, working: number): Sum | undefined {
  if (x.isZero()) return undefined;
  const tol = big(10).pow(-working);
  const lead = BigDecimal.EULER_GAMMA.add(x.abs().ln());
  let sum = big(0);
  let peak = biggest(lead, BigDecimal.EULER_GAMMA);
  let term = big(1); // xᵏ/k!
  const settleAfter = Math.ceil(x.abs().toNumber()) + 2;
  for (let k = 1; k < MAX_TERMS; k++) {
    term = term.mul(x).div(k).toPrecision(working);
    const part = term.div(k);
    sum = sum.add(part);
    if (part.abs().gt(peak)) peak = part.abs();
    if (k > settleAfter && part.abs().lt(tol.mul(peak))) return { value: lead.add(sum), peak };
  }
  return undefined;
}

/** li(x) = Ei(ln x) for real x > 0, x ≠ 1; ln x is taken at each pass's digits, so the agreement test sees its error. */
export function logIntegralBig(x: BigDecimal, digits: number): BigDecimal | undefined {
  if (!x.isFinite() || !x.isPositive() || x.eq(1)) return undefined;
  return settled(digits, (working) => eiSum(x.ln(), working));
}

const factorial = (n: number): BigDecimal => {
  let f = 1n;
  for (let k = 2n; k <= BigInt(n); k++) f *= k;
  return new BigDecimal(f);
};

/**
 * K_n(x) or Y_n(x) for an integer order n ≥ 0 and real x > 0 (DLMF 10.31.1, 10.8.1):
 *
 *   K_n = ½(x/2)^−n Σ_{k<n} (n−k−1)!/k! (−x²/4)ᵏ + (−1)^(n+1) ln(x/2) I_n + (−1)ⁿ ½ (x/2)ⁿ S(x²/4)
 *   Y_n = −(x/2)^−n/π Σ_{k<n} (n−k−1)!/k! (x²/4)ᵏ + (2/π) ln(x/2) J_n − (x/2)ⁿ/π S(−x²/4)
 *
 * with S(q) = Σ_k (ψ(k+1) + ψ(n+k+1)) qᵏ/(k!(n+k)!) and ψ(m+1) = −γ + H_m.
 */
export function besselKYBig(kind: "K" | "Y", order: number, x: BigDecimal, digits: number): BigDecimal | undefined {
  const n = Math.abs(order);
  if (!Number.isInteger(order) || n > MAX_ORDER || !x.isFinite() || !x.isPositive()) return undefined;
  const value = settled(digits, (working) => {
    const tol = big(10).pow(-working);
    const half = x.div(2);
    const q = half.mul(half);
    const sign = kind === "K" ? -1 : 1; // the sign q takes in the finite sum, the opposite in S and the I/J series
    // Σ_{k<n} (n−k−1)!/k! (sign·q)ᵏ
    let finite = big(0);
    let power = big(1);
    for (let k = 0; k < n; k++) {
      finite = finite.add(
        factorial(n - k - 1)
          .div(factorial(k))
          .mul(power),
      );
      power = power.mul(q).mul(sign);
    }
    // The shared series: t_k = (−sign·q)ᵏ/(k!(n+k)!), with the Bessel I_n or J_n sum and S.
    let term = big(1).div(factorial(n));
    let hk = big(0);
    let hnk = big(0);
    for (let j = 1; j <= n; j++) hnk = hnk.add(big(1).div(j));
    let bessel = big(0);
    let s = big(0);
    let peak = big(0);
    const settleAfter = Math.ceil(x.toNumber()) + 2;
    const twoGamma = BigDecimal.EULER_GAMMA.mul(2);
    for (let k = 0; k < MAX_TERMS; k++) {
      bessel = bessel.add(term);
      const psi = hk.add(hnk).sub(twoGamma);
      const part = term.mul(psi);
      s = s.add(part);
      peak = biggest(peak, term, part);
      if (k > settleAfter && part.abs().lt(tol.mul(peak)) && term.abs().lt(tol.mul(peak))) break;
      if (k === MAX_TERMS - 1) return undefined;
      term = term
        .mul(q)
        .mul(-sign)
        .div((k + 1) * (n + k + 1))
        .toPrecision(working);
      hk = hk.add(big(1).div(k + 1));
      hnk = hnk.add(big(1).div(n + k + 1));
    }
    const lx = half.ln();
    const scale = half.pow(n);
    const inverse = big(1).div(scale);
    const parity = n % 2 === 0 ? 1 : -1;
    const parts: BigDecimal[] =
      kind === "K"
        ? [inverse.mul(finite).div(2), lx.mul(scale).mul(bessel).mul(-parity), scale.mul(s).mul(parity).div(2)]
        : (() => {
            const pi = BigDecimal.PI;
            return [
              inverse.mul(finite).div(pi).neg(),
              lx.mul(scale).mul(bessel).mul(2).div(pi),
              scale.mul(s).div(pi).neg(),
            ];
          })();
    return { value: parts.reduce((a, b) => a.add(b)), peak: biggest(...parts, peak.mul(scale)) };
  });
  if (value === undefined) return undefined;
  // Y_{−n} = (−1)ⁿ Y_n and K_{−n} = K_n
  return kind === "Y" && order < 0 && n % 2 === 1 ? value.neg() : value;
}

type Handler = (x: BigDecimal, digits: number) => BigDecimal | undefined;

export function declareSpecialBig(ce: ComputeEngine): void {
  const real = (ops: readonly BoxedExpression[], arity: number): boolean =>
    ops.length === arity && ops.every(isFiniteNum) && ops.every((op) => op.im === 0);
  // What each kernel can answer, so a call it always refuses never reaches it.
  const unary: readonly [string, Handler, (x: number) => boolean][] = [
    ["AiryAi", (x, d) => airyBig("Ai", x, d), () => true],
    ["AiryBi", (x, d) => airyBig("Bi", x, d), () => true],
    ["ExpIntegralEi", expIntegralEiBig, (x) => x !== 0],
    ["LogIntegral", logIntegralBig, (x) => x > 0 && x !== 1],
  ];
  for (const [head, handler, accepts] of unary) {
    // compile builtin: digits past a double's, where compiled code has none
    wrapOperator(
      ce,
      [head, 1],
      (ops) => real(ops, 1) && accepts(ops[0]!.re),
      (native) => (ops, options) => {
        if (!wantsBigDigits(ce, options, ops)) return native?.(ops, options);
        const arg = bigRealOperand(ce, ops[0]!);
        const value = arg === undefined ? undefined : handler(arg, ce.precision);
        // a kernel that cannot vouch for the digits leaves the call to native, as it was
        return value === undefined ? native?.(ops, options) : bigResult(ce, value);
      },
      { arity: 1, compile: "builtin" },
    );
  }
  for (const [head, kind] of [
    ["BesselK", "K"],
    ["BesselY", "Y"],
  ] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => real(ops, 2) && isRealInt(ops[0]!) && Math.abs(ops[0]!.re) <= MAX_ORDER && ops[1]!.re > 0,
      (native) => (ops, options) => {
        if (!wantsBigDigits(ce, options, ops)) return native?.(ops, options);
        const arg = bigRealOperand(ce, ops[1]!);
        const value = arg === undefined ? undefined : besselKYBig(kind, ops[0]!.re, arg, ce.precision);
        return value === undefined ? native?.(ops, options) : bigResult(ce, value);
      },
      { arity: 2, compile: "builtin" },
    );
  }
}
