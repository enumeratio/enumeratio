import { bernoulliNumber } from "./bernoulli.ts";
import { add, clog, cpow, cx, type Cx, div, mul, scale, sub } from "./complex.ts";

// Generalized Stieltjes constants γ_n(a): the Laurent coefficients of the Hurwitz zeta
// at its pole, ζ(s, a) = 1/(s−1) + Σ_n (−1)^n γ_n(a) (s−1)^n / n!, with γ_n = γ_n(1) the
// classical constants (γ_0 = Euler's γ) and γ_0(a) = −ψ(a). Wolfram's
// StieltjesGamma[n, a] uses this normalisation, as does mpmath's stieltjes(n, a).
//
// Numerically, Euler–Maclaurin on f(x) = lnⁿ(x)/x:
//   γ_n(a) = Σ_{k<N} f(k+a) + ½ f(N+a) − ln^{n+1}(N+a)/(n+1) − Σ_j B₂ⱼ/(2j)! f^{(2j−1)}(N+a),
// the subtracted power of the log being the integral ∫ f that the defining limit removes.
// The derivatives come from f(x) = n! [tⁿ] x^{t−1}: f^{(m)}(x) = x^{−1−m} Σ_i p_i n!/(n−i)! lnⁿ⁻ⁱ x
// where Π_{j=1}^m (t − j) = Σ p_i tⁱ. Double precision caps this around n ≈ 30: the
// partial sum and the subtracted log power are each ~ln^{n+1}(N)/(n+1) and cancel.

const EM_PAIRS = 16;
const EM_COEFF: number[] = (() => {
  const c: number[] = [0];
  let fact = 1;
  for (let j = 1; j <= EM_PAIRS; j++) {
    fact *= (2 * j - 1) * (2 * j);
    c[j] = bernoulliNumber(2 * j) / fact;
  }
  return c;
})();

/** Coefficients of Π_{j=1}^m (t − j), lowest degree first. */
function fallingPoly(m: number): number[] {
  let p = [1];
  for (let j = 1; j <= m; j++) {
    const q = Array.from({ length: p.length + 1 }, () => 0);
    for (let i = 0; i < p.length; i++) {
      q[i] += -j * p[i];
      q[i + 1] += p[i];
    }
    p = q;
  }
  return p;
}

/** zⁿ for an integer n ≥ 0 by repeated multiplication (exact at z = 0, unlike exp(n ln z)). */
function ipow(z: Cx, n: number): Cx {
  let r = cx(1);
  for (let i = 0; i < n; i++) r = mul(r, z);
  return r;
}

/** f^{(m)}(x) for f(x) = lnⁿ(x)/x, complex x, with L = ln x supplied. */
function derivative(n: number, m: number, x: Cx, L: Cx): Cx {
  const p = fallingPoly(m);
  let acc = cx(0);
  let ff = 1; // n!/(n−i)! = n (n−1) … (n−i+1)
  for (let i = 0; i <= Math.min(m, n); i++) {
    if (i > 0) ff *= n - i + 1;
    acc = add(acc, scale(ipow(L, n - i), p[i] * ff));
  }
  return mul(acc, cpow(x, cx(-1 - m)));
}

/** γ_n(a) for an integer n ≥ 0 and complex a (a not a nonpositive integer). */
export function stieltjesGamma(n: number, a: Cx): Cx {
  // Tail point at Re ≈ 6: far enough out for the Bernoulli tail to converge, near
  // enough to keep the lnⁿ⁺¹ cancellation down (~1e-12 through n = 15, ~1e-10 at
  // n = 20, ~1e-8 at n = 30 — a larger tail point is worse, not better, for large n).
  const N = Math.max(1, Math.ceil(6 - a.re));
  let sum = cx(0);
  for (let k = 0; k < N; k++) {
    const x = cx(a.re + k, a.im);
    if (x.re === 0 && x.im === 0) continue;
    const L = clog(x);
    sum = add(sum, div(ipow(L, n), x)); // lnⁿ(x)/x
  }
  const x = cx(a.re + N, a.im);
  const L = clog(x);
  sum = add(sum, scale(div(ipow(L, n), x), 0.5));
  sum = sub(sum, scale(ipow(L, n + 1), 1 / (n + 1)));
  for (let j = 1; j <= EM_PAIRS; j++) {
    sum = sub(sum, scale(derivative(n, 2 * j - 1, x, L), EM_COEFF[j]));
  }
  return sum;
}

export const stieltjesGammaReal = (n: number, a: number): number => stieltjesGamma(n, cx(a)).re;
