import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isRealInt, wantsNumber } from "./box.ts";

// MultiZetaValue(s₁, s₂) — Fungrim's depth-2 multiple zeta value
// ζ(s₁, s₂) = Σ_{n₁ > n₂ ≥ 1} n₁^{−s₁} n₂^{−s₂}.
//
// Every MultiZetaValue identity in the crosswalk (fungrim-verified-data.ts) is
// two-argument with both weights integers ≥ 2 — the depth and the ≥2 floor are what
// make the double sum converge unconditionally — so that is the scope declared here;
// a general depth-n MZV over compositions is a different, open-ended project.
//
// Numerically: write ζ(s₁, s₂) = Σ_{n≥1} n^{−s₁} H_{n−1}^{(s₂)}, where H_{n−1}^{(s₂)}
// is the partial sum Σ_{k<n} k^{−s₂}. Summing the first N terms tracks H incrementally
// (O(N), not O(N²)); the tail is
//   Σ_{n>N} n^{−s₁} H_{n−1}^{(s₂)} = ζ(s₂)·Σ_{n>N} n^{−s₁} − Σ_{n>N} n^{−s₁}·ζtail(s₂,n),
// where ζtail(s₂,n) = Σ_{k≥n} k^{−s₂}. The first piece is exact (native `Zeta` both
// sides); the second is approximated by ζtail(s₂,n) ≈ n^{1−s₂}/(s₂−1) — its leading
// Euler–Maclaurin term — which turns it into (1/(s₂−1))·ζtail(s₁+s₂−1, N+1), again
// from native `Zeta`. What's left uncorrected is one order smaller still, O(N^{2−s₁−s₂}):
// at N = 10⁵ and the least favourable weights (2, 2) that is ~1e-10, comfortably under
// the 1e-12 the reference examples are pinned to.
const TERMS = 100_000;

/** ζ(s₁, s₂) for integers s₁, s₂ ≥ 2 (see file header for the summation and its tail). */
export function multiZetaValue(ce: ComputeEngine, s1: number, s2: number): number {
  let partialS2 = 0; // H_{n-1}^{(s2)}
  let partialS1 = 0; // Σ_{k=1}^{n} k^{-s1}, tracked to get the s1 tail at N
  let partialCross = 0; // Σ_{k=1}^{n} k^{-(s1+s2-1)}, for the tail's correction term
  const sCross = s1 + s2 - 1;
  let sum = 0;
  for (let n = 1; n <= TERMS; n++) {
    const invS1 = Math.pow(n, -s1);
    sum += invS1 * partialS2;
    partialS1 += invS1;
    partialS2 += Math.pow(n, -s2);
    partialCross += Math.pow(n, -sCross);
  }
  const zetaS1 = ce.box(["Zeta", s1]).N().re;
  const zetaS2 = ce.box(["Zeta", s2]).N().re;
  const zetaCross = ce.box(["Zeta", sCross]).N().re;
  const tailS1 = zetaS1 - partialS1; // Σ_{n=N+1}^∞ n^{-s1}
  const tailCross = zetaCross - partialCross; // Σ_{n=N+1}^∞ n^{-(s1+s2-1)}
  return sum + zetaS2 * tailS1 - tailCross / (s2 - 1);
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
