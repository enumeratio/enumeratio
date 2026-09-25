import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  declined,
  type EvalOptions,
  isFiniteNum,
  isRealInt,
  type NativeEval,
  numberResult,
  wantsNumber,
} from "./box.ts";
import { add, type Cx, div, mul, sub } from "./complex.ts";
import { bernoulliNumber } from "./bernoulli.ts";
import { hurwitzZeta } from "./hurwitz-zeta.ts";

// Polygamma ψ⁽ᵐ⁾(z) = dᵐ⁺¹/dzᵐ⁺¹ ln Γ(z), straight off the Hurwitz zeta:
// ψ⁽ᵐ⁾(z) = (−1)^(m+1) · m! · ζ(m+1, z) for integer m ≥ 1. compute-engine has a
// native PolyGamma(m, z) covering real z (and m = 0, the digamma); this fills in
// complex z, which the Euler–Maclaurin kernel handles directly. The digamma itself
// (m = 0) has no Hurwitz-zeta form — ζ(1, z) is the pole — so it gets its own
// asymptotic series below rather than routing through `hurwitzZeta`.

/** m! as a double; non-finite past m = 170, which the caller treats as out of range. */
const factorial = (m: number): number => {
  let f = 1;
  for (let k = 2; k <= m; k++) f *= k;
  return f;
};

/** Asymptotic coefficients B₂ₖ/(2k), the digamma tail Σ −cₖ z^{−2k}. */
const DIGAMMA_TAIL: number[] = (() => {
  const c: number[] = [0];
  for (let k = 1; k <= 14; k++) c[k] = bernoulliNumber(2 * k) / (2 * k);
  return c;
})();

const SHIFT_TO_DIGAMMA = 18;

/**
 * ψ(z), analytically continued, for complex z — the derivative of `logGamma`'s
 * Stirling series: ψ(w) ~ ln w − 1/(2w) − Σ_{k≥1} B₂ₖ/(2k) w^{−2k} for Re(w) large,
 * reached by the recurrence ψ(z) = ψ(z+n) − Σ_{k<n} 1/(z+k). Non-finite at the poles
 * 0, −1, −2, ….
 */
export function digamma(z: Cx): Cx {
  if (z.im === 0 && z.re <= 0 && Number.isInteger(z.re)) return { re: Number.NaN, im: Number.NaN };
  const n = Math.max(0, Math.ceil(SHIFT_TO_DIGAMMA - z.re));
  let shift = { re: 0, im: 0 };
  for (let k = 0; k < n; k++) shift = add(shift, div({ re: 1, im: 0 }, add(z, { re: k, im: 0 })));
  const w = add(z, { re: n, im: 0 });
  const lw = Math.log(Math.hypot(w.re, w.im));
  const th = Math.atan2(w.im, w.re);
  let r = sub({ re: lw, im: th }, div({ re: 0.5, im: 0 }, w)); // ln w − 1/(2w)
  const w2 = mul(w, w);
  let p = w2; // w^{2k}
  for (let k = 1; k < DIGAMMA_TAIL.length; k++) {
    r = sub(r, div({ re: DIGAMMA_TAIL[k], im: 0 }, p));
    p = mul(p, w2);
  }
  return sub(r, shift);
}

/** ψ⁽ᵐ⁾(z) = (−1)^(m+1) m! ζ(m+1, z), integer m ≥ 1, complex z. */
export function polygamma(m: number, z: Cx): Cx {
  const k = (m % 2 === 0 ? -1 : 1) * factorial(m); // (−1)^(m+1) m!
  const h = hurwitzZeta({ re: m + 1, im: 0 }, z);
  return { re: k * h.re, im: k * h.im };
}

/** Real-valued ψ⁽ᵐ⁾(x) — the real-scalar shape the compiled (JS/GPU) pipeline uses. */
export const polygammaReal = (m: number, x: number): number => polygamma(m, { re: x, im: 0 }).re;

/**
 * Evaluate PolyGamma(m, z), deferring to compute-engine's native handler first and
 * stepping in only where it declines — a complex z at an integer order m ≥ 0 (m = 0
 * the digamma, via its own series above; m ≥ 1 via the Hurwitz zeta). Orders past
 * 170 overflow m! in double and are left to the native handler.
 */
export function evaluatePolygamma(
  ce: ComputeEngine,
  native: NativeEval,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const r = native?.(ops, options);
  if (!declined(r, "PolyGamma")) return r;

  const m = ops[0];
  const z = ops[1];
  if (m === undefined || z === undefined) return r;
  if (!wantsNumber(ops, options)) return r;
  if (!isRealInt(m) || m.re < 0 || m.re > 170) return r;
  if (!isFiniteNum(z)) return r;

  const v = m.re === 0 ? digamma({ re: z.re, im: z.im }) : polygamma(m.re, { re: z.re, im: z.im });
  return numberResult(ce, v);
}
