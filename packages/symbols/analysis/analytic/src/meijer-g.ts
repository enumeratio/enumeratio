import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { add, cexp, cpow, cx, type Cx, div, mul, scale } from "./complex.ts";
import { logGamma } from "./loggamma.ts";
import { pfqSeries } from "./hypergeometric.ts";

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

const isNonPosInt = (z: Cx): boolean => z.im === 0 && z.re <= 0 && Number.isInteger(z.re);
const gammaC = (z: Cx): Cx => (isNonPosInt(z) ? cx(NaN, NaN) : cexp(logGamma(z)));

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
 * The DLMF 16.17.2 sum, in plain Cx arithmetic. `a` is the p upper parameters (block1
 * ++ block2, in that order — the split only matters for the prefactor); `b` is the q
 * lower parameters, with the first `m` (`bBlock1.length`) the ones the sum runs over.
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
  const sign = (p - m - n) % 2 === 0 ? 1 : -1;
  let total = cx(0, 0);
  for (let h = 0; h < m; h++) {
    const bh = b[h];
    let pref = cx(1, 0);
    for (let j = 0; j < m; j++) {
      if (j === h) continue;
      const g = gammaC(add(b[j], scale(bh, -1)));
      if (!Number.isFinite(g.re)) return undefined;
      pref = mul(pref, g);
    }
    for (let j = 0; j < n; j++) {
      const arg = add(cx(1, 0), add(bh, scale(a[j], -1)));
      const g = gammaC(arg);
      if (!Number.isFinite(g.re)) return undefined;
      pref = mul(pref, g);
    }
    for (let j = m; j < q; j++) {
      const arg = add(cx(1, 0), add(bh, scale(b[j], -1)));
      const g = gammaC(arg);
      if (!Number.isFinite(g.re)) return undefined;
      pref = div(pref, g);
    }
    for (let j = n; j < p; j++) {
      const arg = add(a[j], scale(bh, -1));
      const g = gammaC(arg);
      if (!Number.isFinite(g.re)) return undefined;
      pref = div(pref, g);
    }
    const upper = a.map((aj) => add(cx(1, 0), add(bh, scale(aj, -1))));
    const lower = b.filter((_, j) => j !== h).map((bj) => add(cx(1, 0), add(bh, scale(bj, -1))));
    const argZ = sign > 0 ? z : scale(z, -1);
    const series = pfqSeries(upper, lower, argZ);
    if (series === undefined) return undefined;
    const zPow = z.re === 0 && z.im === 0 && bh.re === 0 && bh.im === 0 ? cx(1, 0) : cpow(z, bh);
    total = add(total, mul(mul(pref, zPow), series));
  }
  return total;
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
