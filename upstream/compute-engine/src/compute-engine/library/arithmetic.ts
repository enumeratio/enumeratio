import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, wrapOperator } from "@enumeratio/engine";
import type { LibraryRecord } from "../../patch.ts";

/**
 * `Round(x, n)` as an exact multiple of 10⁻ⁿ, as Wolfram's `Round[x, 10^-n]` and compute-engine
 * 0.136 give it: `Round(3.14159, 2)` is `157/50`, not `3.14`. Wraps the native handler in place
 * and keeps its value; upstream this is an edit to `Round` in library/arithmetic.ts.
 */
export function roundPlacesLibrary(ce: ComputeEngine): LibraryRecord {
  wrapOperator(
    ce,
    ["Round", 1, 1],
    (ops) => bigIntegerAt(ops[1]) !== undefined,
    (native) => (ops, options) => {
      const r = native?.(ops, options) as BoxedExpression | undefined;
      const n = bigIntegerAt(ops[1])!;
      if (r === undefined || r.operator !== "Real" || r.im !== 0 || !Number.isFinite(r.re)) return r;
      if (n <= 0n) return r.isInteger ? r : ce.number(Math.round(r.re));
      const scale = 10n ** n;
      const count = BigInt(Math.round(r.re * Number(scale)));
      return ce.box(["Rational", ce.number(count), ce.number(scale)]).evaluate();
    },
    2,
  );
  return { Round: true };
}
