import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/boxed";

// BellY(n, k, {x1, …, x_{n−k+1}}) — the partial (incomplete) Bell polynomial B_{n,k},
// by its textbook recurrence (Comtet):
//   B_{n,k}(x₁,…) = Σ_{i=1}^{n−k+1} C(n−1, i−1)·xᵢ·B_{n−i,k−1}(x₁,…),  B_{0,0} = 1.
// Built entirely symbolically (bigint binomial coefficients, compute-engine Add/Multiply for
// everything else) so it works the same whether the xᵢ are numbers or symbols — the recursion
// doesn't care which, and letting compute-engine's own `evaluate()` combine and cancel terms
// gets the canonical form its Add/Multiply already produce elsewhere for free.

const binom = (n: number, k: number): bigint => {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let num = 1n;
  let den = 1n;
  for (let i = 0; i < k; i++) {
    num *= BigInt(n - i);
    den *= BigInt(i + 1);
  }
  return num / den;
};

const bigNumber = (ce: ComputeEngine, v: bigint): BoxedExpression =>
  ce.number([v, 1n] as unknown as [number, number]);

function bellYExpr(
  ce: ComputeEngine,
  xs: readonly BoxedExpression[],
  memo: Map<string, BoxedExpression>,
  n: number,
  k: number,
): BoxedExpression {
  if (n === 0 && k === 0) return ce.One;
  if (n === 0 || k === 0 || k > n) return ce.Zero;
  const key = `${n},${k}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const terms: BoxedExpression[] = [];
  for (let i = 1; i <= n - k + 1; i++) {
    const coeff = binom(n - 1, i - 1);
    if (coeff === 0n) continue;
    const inner = bellYExpr(ce, xs, memo, n - i, k - 1);
    if (inner.re === 0 && inner.im === 0) continue; // a literal zero subterm — drop it
    const factors: BoxedExpression[] =
      coeff === 1n ? [xs[i - 1], inner] : [bigNumber(ce, coeff), xs[i - 1], inner];
    terms.push(ce.function("Multiply", factors));
  }
  const result = (terms.length === 0 ? ce.Zero : ce.function("Add", terms)).evaluate();
  memo.set(key, result);
  return result;
}

export function declareBellY(ce: ComputeEngine): void {
  ce.declare("BellY", {
    signature: "(integer, integer, list) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [nExpr, kExpr, xsExpr] = ops;
      if (nExpr === undefined || kExpr === undefined || xsExpr === undefined) return undefined;
      const n = bigIntegerAt(nExpr);
      const k = bigIntegerAt(kExpr);
      if (n === undefined || k === undefined || n < 0n || k < 0n || n > 200n) return undefined;
      if (xsExpr.operator !== "List") return undefined;
      const xs = operandsOf(xsExpr);
      if (xs.length !== Number(n) - Number(k) + 1 && !(n === 0n && k === 0n)) return undefined;
      return bellYExpr(ce, xs, new Map(), Number(n), Number(k));
    },
  });
}
