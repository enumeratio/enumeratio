import { cpow, cx, type Cx, mul, sub } from "./complex.ts";
import { hurwitzZeta } from "./hurwitz-zeta.ts";
import { lerchPhi } from "./lerch.ts";

// Dirichlet eta and beta — the two alternating cousins of ζ, both entire.
//   η(s) = Σ (−1)^{n−1} n^{−s} = (1 − 2^{1−s}) ζ(s);  η(1) = ln 2 (the pole cancels).
//   β(s) = Σ (−1)^n (2n+1)^{−s} = 4^{−s} (ζ(s, ¼) − ζ(s, ¾));  β(1) = π/4.
// Both ride on the Hurwitz Euler–Maclaurin kernel, which takes complex s directly —
// except near s = 1, where the ζ formulas cancel a pole and lose 1/|s−1| digits. There
// the alternating series itself is summed by the Euler transform in lerch.ts
// (η(s) = Φ(−1, s, 1), β(s) = 2^{−s} Φ(−1, s, ½)), which has no pole to cancel.

/** Inside this radius of s = 1 the pole-free Lerch route is used. */
const NEAR_POLE = 0.25;
const nearPole = (s: Cx): boolean => Math.hypot(s.re - 1, s.im) < NEAR_POLE;

export function dirichletEta(s: Cx): Cx {
  if (nearPole(s)) return lerchPhi(cx(-1), s, cx(1));
  const factor = sub(cx(1), cpow(cx(2), cx(1 - s.re, -s.im))); // 1 − 2^{1−s}
  return mul(factor, hurwitzZeta(s, cx(1)));
}

export function dirichletBeta(s: Cx): Cx {
  if (nearPole(s)) return mul(cpow(cx(2), cx(-s.re, -s.im)), lerchPhi(cx(-1), s, cx(0.5)));
  const scale4 = cpow(cx(4), cx(-s.re, -s.im)); // 4^{−s}
  return mul(scale4, sub(hurwitzZeta(s, cx(0.25)), hurwitzZeta(s, cx(0.75))));
}

export const dirichletEtaReal = (s: number): number => dirichletEta(cx(s)).re;
export const dirichletBetaReal = (s: number): number => dirichletBeta(cx(s)).re;
