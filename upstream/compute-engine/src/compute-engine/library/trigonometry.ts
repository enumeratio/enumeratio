// cortex-js/compute-engine#341, offered as PR #342: exact values at 0 for the hyperbolic
// functions, though compute-engine already has them for the circular ones. Wolfram gives
// Sinh(0) = 0, Cosh(0) = 1, and so on; compute-engine leaves each symbolic. Upstream this is
// an edit to the SPECIAL-value tables in library/trigonometry.ts.
//
// NOT included here: Arcosh(1) = 0 (a different point, 1 rather than 0) and the `ln q`
// rules — sinh(ln q) = (q - 1/q)/2 and friends, for a positive rational q — which are not
// part of this issue and stay in @enumeratio/analytic (src/hyperbolic-exact.ts).
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, wrapOperator } from "@enumeratio/boxed";
import type { LibraryRecord } from "../../patch.ts";

/** f(0) for the exact 0 at which each head has a plain value. */
export const HYPERBOLIC_ZERO: Readonly<Record<string, (ce: ComputeEngine) => BoxedExpression>> = {
  Sinh: (ce) => ce.Zero,
  Cosh: (ce) => ce.One,
  Tanh: (ce) => ce.Zero,
  Sech: (ce) => ce.One,
  Csch: (ce) => ce.ComplexInfinity,
  Coth: (ce) => ce.ComplexInfinity,
  Arsinh: (ce) => ce.Zero,
  Artanh: (ce) => ce.Zero,
};

/** Does `head(0)` already come back exact (not symbolic) on a fresh engine? */
export const answersAtZero = (ce: ComputeEngine, head: string, value: BoxedExpression): boolean =>
  ce.box([head, 0]).evaluate().isSame(value);

/** Wraps each hyperbolic head's native evaluate in place; `wrapOperator` has no record
 * form, so the mutation happens here. The returned record is bookkeeping only, for
 * `patchSymbols` -- nothing declares from it. */
export function hyperbolicZeroLibrary(ce: ComputeEngine): LibraryRecord {
  for (const [head, value] of Object.entries(HYPERBOLIC_ZERO)) {
    wrapOperator(
      ce,
      [head, 1],
      ([x]) => {
        const q = bigRationalAt(x);
        const exact = (x as { isExact?: boolean } | undefined)?.isExact !== false;
        return exact && q !== undefined && q[1] === 1n && q[0] === 0n;
      },
      () => () => value(ce),
      1,
    );
  }
  return Object.fromEntries(Object.keys(HYPERBOLIC_ZERO).map((head) => [head, true]));
}
