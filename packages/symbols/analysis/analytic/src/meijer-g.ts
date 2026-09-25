import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { add, cx, type Cx } from "./complex.ts";
import { meijerGSeriesBig } from "./meijer-g-big.ts";

// MeijerG[{{a1,…,an},{a(n+1),…,ap}}, {{b1,…,bm},{b(m+1),…,bq}}, z]: numeric evaluation
// via the standard reduction to a finite sum of ordinary pFq series (DLMF 16.17.2),
// one term per pole b_h (h = 1..m) of the defining contour integral's Γ(b_j − s)
// factors:
//
//   G(z) = Σ_h [∏_{j≠h}^m Γ(b_j−b_h)] [∏_{j≤n} Γ(1−a_j+b_h)]
//            / [∏_{j>m}^q Γ(1−b_j+b_h)] [∏_{j>n}^p Γ(a_j−b_h)]
//          × z^{b_h} × pFq(1+b_h−a_1,…,1+b_h−a_p ; 1+b_h−b_1,…[omit h]…,1+b_h−b_q ; (−1)^{p−m−n} z)
//
// valid when m ≥ 1, p ≤ q (so every term's pFq has upper-count ≤ lower-count + 1, which
// `pfqSeries` already requires to converge), and the b_h are pairwise non-congruent mod
// 1 (simple poles — a repeated or integer-separated b needs the log-case formula this
// does not implement). Each declines rather than answering when: p > q, m = 0, any two
// b_h coincide mod 1, or a Γ argument in the prefactor lands on a non-positive integer
// (a further, un-implemented degeneracy). Verified against wolframscript's `MeijerG`
// at several parameter sets (see meijer-g.test.ts) including the exponential case
// (m=1,n=0,p=0,q=1) and a case with both a- and b-parameters.
//
// The actual sum runs in BigDecimal (`meijerGSeriesBig`, meijer-g-big.ts): a plain-double
// version of this sum was only accurate to ~1e-13 relative, not ~1e-16, from two stacked
// cancellations — the Γ-prefactor's own shift recurrence, and the outer sum over poles b_h,
// whose terms can be tens of times larger than their total. Only the cheap domain declines
// (below) stay in double.

const isNonPosInt = (z: Cx): boolean => z.im === 0 && z.re <= 0 && Number.isInteger(z.re);

function listPair(expr: BoxedExpression | undefined): [Cx[], Cx[]] | undefined {
  if (expr === undefined || expr.operator !== "List") return undefined;
  const parts = operandsOf(expr);
  if (parts.length !== 2) return undefined;
  const [block1, block2] = parts;
  if (block1.operator !== "List" || block2.operator !== "List") return undefined;
  const b1 = operandsOf(block1);
  const b2 = operandsOf(block2);
  if (b1.some((o) => !isFiniteNum(o)) || b2.some((o) => !isFiniteNum(o))) return undefined;
  return [b1.map((o) => cx(o.re, o.im)), b2.map((o) => cx(o.re, o.im))];
}

/**
 * The DLMF 16.17.2 sum. `a` is the p upper parameters (block1 ++ block2, in that order —
 * the split only matters for the prefactor); `b` is the q lower parameters, with the first
 * `m` (`bBlock1.length`) the ones the sum runs over. Declines the cheap domain checks in
 * double (m ≥ 1, p ≤ q, pairwise-simple poles) before handing the arithmetic itself to
 * `meijerGSeriesBig`.
 */
function meijerGSeries(
  a: readonly Cx[],
  b: readonly Cx[],
  m: number,
  n: number,
  z: Cx,
): Cx | undefined {
  const p = a.length;
  const q = b.length;
  if (m < 1 || p > q) return undefined;
  for (let h = 0; h < m; h++) {
    for (let j = 0; j < m; j++) {
      if (h === j) continue;
      const d = add(b[h], cx(-b[j].re, -b[j].im));
      if (isNonPosInt(d) || (d.im === 0 && Number.isInteger(d.re))) return undefined; // non-simple pole
    }
  }
  return meijerGSeriesBig(a, b, m, n, z);
}

export function declareMeijerG(ce: ComputeEngine): void {
  ce.declare("MeijerG", {
    signature: "(list, list, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [upperExpr, lowerExpr, zExpr] = ops;
      if (upperExpr === undefined || lowerExpr === undefined || zExpr === undefined)
        return undefined;
      if (!wantsNumber(ops, options) || !isFiniteNum(zExpr)) return undefined;
      const upper = listPair(upperExpr);
      const lower = listPair(lowerExpr);
      if (upper === undefined || lower === undefined) return undefined;
      const [aBlock1, aBlock2] = upper;
      const [bBlock1, bBlock2] = lower;
      const a = [...aBlock1, ...aBlock2];
      const b = [...bBlock1, ...bBlock2];
      const z = cx(zExpr.re, zExpr.im);
      const r = meijerGSeries(a, b, bBlock1.length, aBlock1.length, z);
      return r === undefined ? undefined : numberResult(ce, r);
    },
  });
}
