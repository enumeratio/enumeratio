import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { symbolNameOf, wrapOperator } from "@enumeratio/boxed";
import { add, cexp, clog, cx, type Cx, div, mul, sub } from "./complex.ts";
import { isFiniteNum, isRealInt, wantsNumber } from "./box.ts";

// LambertW(z) — compute-engine's native ProductLog — already evaluates the principal (k = 0)
// and lower-real (k = -1) branches numerically. Missing: exact values at algebraically nice
// points, and every other integer branch LambertW(z, k). Both are added here by wrapping the
// existing operator in place (never redeclaring it — see widened.ts's own note on why).
//
// Wolfram's ProductLog[k, z] puts the branch index first; compute-engine's native LambertW(z, k)
// puts it second (checked: LambertW(-0.14, -1) is the k = -1 branch, LambertW(-1, -0.14) declines).
// The k = 0/-1 cases already worked in that order, so extending keeps it — the Wolfram mapping
// carries the reversal (see to-wolfram.ts's SPECIAL entry for LambertW).

const MAX_ITER = 100;
const TOL = 1e-15;

/**
 * W_k(z) by Halley's iteration (Corless et al. 1996, eq. 5.9), from the standard
 * asymptotic seed. Converges quickly away from the branch point z = -1/e (k = 0, -1) and
 * from z = 0 (k = 0); those two are left to compute-engine's own native handler, which
 * already gets them right, so this is only reached for other branches or non-real z.
 */
function lambertWBranch(k: number, z: Cx): Cx | undefined {
  if (z.re === 0 && z.im === 0) return k === 0 ? cx(0) : undefined; // W_k(0) is -∞ for k ≠ 0
  // Seed: the log-log asymptotic, valid away from the branch singularities; a small twist
  // for k = 0 pulls the seed toward z itself (Corless's near-0 recommendation).
  const twoPiK = cx(0, 2 * Math.PI * k);
  const lz = add(clog(z), twoPiK);
  let w = k === 0 && Math.hypot(z.re, z.im) < 1 ? z : sub(lz, clog(lz));
  for (let i = 0; i < MAX_ITER; i++) {
    const ew = cexp(w);
    const wew = mul(w, ew);
    const f = sub(wew, z);
    const denom1 = mul(ew, add(w, cx(1)));
    // Halley correction: Δ = f / (denom1 - (w+2)f / (2w+2))
    const denom2 = div(mul(add(w, cx(2)), f), add(mul(w, cx(2)), cx(2)));
    const delta = div(f, sub(denom1, denom2));
    w = sub(w, delta);
    if (Math.hypot(delta.re, delta.im) < TOL * (1 + Math.hypot(w.re, w.im))) return w;
  }
  return undefined; // did not settle — decline rather than guess
}

/** z as w·e^w for a literal w compute-engine's Ln/rational layer already produced — i.e. the
 * argument was written (or reduces) to exactly that shape. Handles the closed forms Wolfram's
 * page and this package's examples give: 0, ±1 at 0/-1/e, integer w·e^w, and -ln(k)/k (whose
 * w = -ln k, since e^{-ln k} = 1/k). Returns the exact w expression, or undefined. */
function exactLambertW(ce: ComputeEngine, zExpr: BoxedExpression): BoxedExpression | undefined {
  if (zExpr.re === 0 && zExpr.im === 0) return ce.Zero;
  if (symbolNameOf(zExpr) === "ExponentialE") return ce.One; // e = 1·e¹
  // -1/e: Negate(Divide(1, ExponentialE)) or the equivalent rational-power forms compute-engine
  // normalizes to — recognize by value: z·e = -1 exactly needs symbolic care, so match structurally.
  const asNegRecipE = ce.box(["Multiply", zExpr, "ExponentialE"]).evaluate();
  if (asNegRecipE.re === -1 && asNegRecipE.im === 0) return ce.NegativeOne;
  // n·e^n for a small integer n (either sign): divide z by e^n and check it collapses to n.
  for (let n = -10; n <= 10; n++) {
    if (n === 0 || n === 1 || n === -1) continue; // already covered / trivial
    const candidate = ce.box(["Multiply", n, ["Power", "ExponentialE", n]]).evaluate();
    if (candidate.isSame(zExpr)) return ce.number(n);
  }
  // -ln(k)/k for a small integer k ≥ 2: w = -ln(k), since w·e^w = -ln(k)·(1/k).
  for (let k = 2; k <= 12; k++) {
    const candidate = ce.box(["Negate", ["Divide", ["Ln", k], k]]).evaluate();
    if (candidate.isSame(zExpr)) return ce.function("Negate", [ce.function("Ln", [ce.number(k)])]);
  }
  return undefined;
}

export function declareLambertW(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["LambertW", 1],
    () => true, // gate below decides; native's own decline still falls through per-call
    (native) => (ops, options) => {
      const [zExpr, kExpr] = ops;
      if (zExpr === undefined) return native?.(ops, options);

      // Two-argument, branch k other than the native 0/-1: our own iteration.
      if (kExpr !== undefined) {
        if (!isRealInt(kExpr)) return native?.(ops, options);
        const k = kExpr.re;
        if (k === 0 || k === -1) return native?.(ops, options); // already correct natively
        if (!wantsNumber(ops, options) || !isFiniteNum(zExpr)) return undefined; // decline: no exact form attempted for other branches
        const w = lambertWBranch(k, cx(zExpr.re, zExpr.im));
        if (w === undefined) return undefined;
        if (Math.abs(w.im) < 1e-14 * (1 + Math.abs(w.re))) return ce.number(w.re);
        return ce.number(ce.complex(w.re, w.im));
      }

      // One-argument: try the native handler first (it already owns 0, real z ≥ -1/e's
      // principal branch numerically); only step in when it declines.
      const r = native?.(ops, options);
      if (r !== undefined && r.operator !== "LambertW") return r;
      const exact = exactLambertW(ce, zExpr);
      if (exact !== undefined) return options.numericApproximation ? exact.N() : exact;
      return r;
    },
  );
}
