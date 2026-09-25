import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt } from "@enumeratio/boxed";
import { logBarnesG } from "./barnes-g.ts";
import { cx } from "./complex.ts";
import { logGamma } from "./loggamma.ts";

// Hyperfactorial H(n) = ∏_{k=1}^n k^k, continued off the integers by
// H(z) = Γ(z+1)^z / G(z+1) (G = Barnes G) — checked at n = 1..4 against the exact
// products before trusting it past them, and at z = ½ against Wolfram to ~1e-13 relative.
// Exact at a nonnegative integer (a plain BigInt product); numeric via the log form
// otherwise, real domain only (no reference example calls for a complex or negative
// argument — BarnesG's zeros at the nonpositive integers give it poles there anyway).

function hyperfactorialExact(n: bigint): bigint {
  let h = 1n;
  for (let k = 1n; k <= n; k++) h *= k ** k;
  return h;
}

/** ln H(z) = z·lnΓ(z+1) − ln G(z+1), real z ≥ 0. */
function hyperfactorialReal(z: number): number {
  const lg = logGamma(cx(z + 1)).re;
  const lbg = logBarnesG(cx(z + 1)).re;
  return Math.exp(z * lg - lbg);
}

function evaluateHyperfactorial(ce: ComputeEngine, x: BoxedExpression | undefined): BoxedExpression | undefined {
  if (x === undefined) return undefined;
  const n = bigIntegerAt(x);
  if (n !== undefined && n >= 0n) return ce.number(hyperfactorialExact(n));
  if (x.im === 0 && Number.isFinite(x.re) && x.re >= 0) return ce.number(hyperfactorialReal(x.re));
  return undefined; // stay symbolic — negative/complex continuation is unverified
}

export function declareHyperfactorial(ce: ComputeEngine): void {
  ce.declare("Hyperfactorial", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => evaluateHyperfactorial(ce, ops[0]),
  });
}
