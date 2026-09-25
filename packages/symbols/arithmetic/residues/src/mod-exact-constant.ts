import type { ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, symbolNameOf, wrapOperator } from "@enumeratio/boxed";

// Mod(x, m) for a bare symbolic numeric constant (Pi, ExponentialE, …) against a positive
// numeric modulus: compute-engine's native Mod leaves this unevaluated, but the answer is
// exact and easy — floor the double approximation to find which residue class x falls in
// (`Mod(Pi, 2)` is in [0, 2), so k = 1), then build the EXACT symbolic remainder x − k·m,
// where the subtraction stays exact even though k was found numerically. Guarded to a wide
// margin from either boundary so a double-precision floor is never in doubt.
//
// Disjoint from packages/symbols/analysis/analytic/src/closed-forms-113.ts' own Mod(x, m) wrapper for an
// exact IRRATIONAL (a Sqrt-built radical like √28), which is guarded on that expression's
// own `isExact` flag -- a flag a bare `Symbol` node like `Pi` never carries, so the two
// wrappers never compete for the same call regardless of which attaches first.
export function declareModExactConstant(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Mod", 2],
    (ops) => {
      if (ops.length !== 2 || ops[0] === undefined || ops[1] === undefined) return false;
      const [x, m] = ops;
      if (symbolNameOf(x) === undefined) return false; // a bare constant symbol only
      if (bigRationalAt(x) !== undefined) return false; // already exact: native handles it
      const mNum = m.re;
      if (!(Number.isFinite(mNum) && mNum > 0)) return false;
      const xNum = x.N().re;
      if (!Number.isFinite(xNum)) return false; // a free variable, not a numeric constant
      const ratio = xNum / mNum;
      return Math.abs(ratio - Math.round(ratio)) > 1e-6; // margin from a boundary case
    },
    () => (ops, options) => {
      const [x, m] = ops;
      const k = Math.floor(x.N().re / m.re!);
      const expr = ce.function("Subtract", [x, ce.function("Multiply", [ce.number(k), m])]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
  );
}
