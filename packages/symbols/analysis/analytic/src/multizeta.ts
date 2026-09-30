import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isRealInt, wantsNumber } from "@enumeratio/for-compute-engine";

// MultiZetaValue(s₁, s₂) — Fungrim's depth-2 multiple zeta value
// ζ(s₁, s₂) = Σ_{n₁ > n₂ ≥ 1} n₁^{−s₁} n₂^{−s₂}.
//
// Every MultiZetaValue identity in the crosswalk (fungrim-verified-data.ts) is
// two-argument with both weights integers ≥ 2 — the depth and the ≥2 floor are what
// make the double sum converge unconditionally — so that is the scope declared here;
// a general depth-n MZV over compositions is a different, open-ended project.
//
// Numerically: write ζ(s₁, s₂) = Σ_{n≥1} n^{−s₁} H_{n−1}^{(s₂)}, where H_{n−1}^{(s₂)}
// is the partial sum Σ_{k<n} k^{−s₂}. Direct-sum the first N terms (tracking H
// incrementally), then close the tail analytically. H_{n−1}^{(s₂)} = ζ(s₂) − ζtail(s₂,n),
// where ζtail(s₂,n) = Σ_{k≥n} k^{−s₂} is a Hurwitz-zeta tail with its own
// Euler–Maclaurin expansion:
//   ζtail(s₂,n) = n^{1−s₂}/(s₂−1) + n^{−s₂}/2 + Σ_{j=1}^{m} [B₂ⱼ/(2j)!]·(s₂)_{2j−1}·n^{−(s₂+2j−1)}
// ((s₂)_{2j−1} the rising factorial s₂(s₂+1)···(s₂+2j−2)). Multiplying by n^{−s₁} and
// summing n > N turns every term of that expansion into a plain Riemann-zeta tail
// Σ_{n>N} n^{−k} = ζ(k) − Σ_{n≤N} n^{−k}, computed exactly via native `Zeta`. m = 4
// Bernoulli terms at N = 32 pushes the remaining error below 1e-17 at the least
// favourable weight (2,2) -- confirmed against mpmath's `nsum` and wolframscript's
// `Sum` form at 30+ digits.
const N_DIRECT = 32;

/** B₂, B₄, B₆, B₈ — the even Bernoulli numbers this needs (m = 4 correction terms). */
const BERNOULLI_EVEN = [1 / 6, -1 / 30, 1 / 42, -1 / 30];

/**
 * The Euler–Maclaurin tail expansion of ζtail(s,n) = Σ_{k≥n} k^{−s}, as
 * `{ power, coeff }` pairs meaning `coeff * n^{-power}`: the leading `n^{1-s}/(s-1)`
 * and `n^{-s}/2` terms, then the `BERNOULLI_EVEN.length` Bernoulli corrections.
 */
function emZetaTailTerms(s: number): { power: number; coeff: number }[] {
  const terms: { power: number; coeff: number }[] = [
    { power: s - 1, coeff: 1 / (s - 1) },
    { power: s, coeff: 0.5 },
  ];
  let rising = 1; // (s)_{2j-1}, built incrementally as j grows
  let nextFactor = s;
  let factorsSoFar = 0;
  let factorial = 1; // (2j)!
  for (let j = 1; j <= BERNOULLI_EVEN.length; j++) {
    const target = 2 * j - 1;
    while (factorsSoFar < target) {
      rising *= nextFactor;
      nextFactor += 1;
      factorsSoFar += 1;
    }
    factorial *= (2 * j - 1) * (2 * j);
    const coeff = (BERNOULLI_EVEN[j - 1] / factorial) * rising;
    terms.push({ power: s + 2 * j - 1, coeff });
  }
  return terms;
}

/** ζ(s₁, s₂) for integers s₁, s₂ ≥ 2 (see file header for the summation and its tail). */
export function multiZetaValue(ce: ComputeEngine, s1: number, s2: number): number {
  // Each ζtail(s2,n) term n^{-power}, once multiplied by the outer n^{-s1}, becomes a
  // Riemann-zeta tail at exponent s1 + power.
  const tailTerms = emZetaTailTerms(s2).map(({ power, coeff }) => ({ power: s1 + power, coeff }));
  let partialS2 = 0; // H_{n-1}^{(s2)}
  let partialS1 = 0; // Σ_{k=1}^{n} k^{-s1}, tracked to get the s1 tail at N
  const partialCross = tailTerms.map(() => 0); // Σ_{k=1}^{n} k^{-power}, per tail term
  let sum = 0;
  for (let n = 1; n <= N_DIRECT; n++) {
    const invS1 = Math.pow(n, -s1);
    sum += invS1 * partialS2;
    partialS1 += invS1;
    partialS2 += Math.pow(n, -s2);
    for (let i = 0; i < tailTerms.length; i++) partialCross[i] += Math.pow(n, -tailTerms[i].power);
  }
  const zetaS1 = ce.box(["Zeta", s1]).N().re;
  const zetaS2 = ce.box(["Zeta", s2]).N().re;
  const tailS1 = zetaS1 - partialS1; // Σ_{n=N+1}^∞ n^{-s1}
  let tailCorrection = 0;
  for (let i = 0; i < tailTerms.length; i++) {
    const zetaK = ce.box(["Zeta", tailTerms[i].power]).N().re;
    tailCorrection += tailTerms[i].coeff * (zetaK - partialCross[i]);
  }
  return sum + zetaS2 * tailS1 - tailCorrection;
}

export function declareMultiZetaValue(ce: ComputeEngine): void {
  ce.declare("MultiZetaValue", {
    signature: "(integer, integer) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [a, b] = ops;
      if (a === undefined || b === undefined) return undefined;
      if (!isRealInt(a) || !isRealInt(b) || a.re < 2 || b.re < 2) return undefined;
      if (!wantsNumber(ops, options)) return undefined;
      return ce.number(multiZetaValue(ce, a.re, b.re));
    },
  });
}
