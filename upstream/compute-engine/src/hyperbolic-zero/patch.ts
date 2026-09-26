import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, wrapOperator } from "@enumeratio/boxed";
import type { Patch } from "../patch.ts";

// cortex-js/compute-engine#341, offered as PR #342: exact values at 0 for the hyperbolic
// functions, though compute-engine already has them for the circular ones. Wolfram gives
// Sinh(0) = 0, Cosh(0) = 1, and so on; compute-engine leaves each symbolic.
//
// NOT included here: Arcosh(1) = 0 (a different point, 1 rather than 0) and the `ln q`
// rules — sinh(ln q) = (q - 1/q)/2 and friends, for a positive rational q — which are not
// part of this issue and stay in @enumeratio/analytic (src/hyperbolic-exact.ts).

/** f(0) for the exact 0 at which each head has a plain value. */
const SPECIAL: Readonly<Record<string, (ce: ComputeEngine) => BoxedExpression>> = {
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
const answersAtZero = (ce: ComputeEngine, head: string, value: BoxedExpression): boolean =>
  ce.box([head, 0]).evaluate().isSame(value);

export const hyperbolicZero: Patch = {
  id: "hyperbolic-zero",
  issue: "https://github.com/cortex-js/compute-engine/issues/341",
  pr: "https://github.com/cortex-js/compute-engine/pull/342",
  lands: "the SPECIAL-value tables for Sinh/Cosh/Tanh/Sech/Csch/Coth/Arsinh/Artanh",

  fixed: (ce) => Object.entries(SPECIAL).every(([head, value]) => answersAtZero(ce, head, value(ce))),

  apply: (ce) => {
    for (const [head, value] of Object.entries(SPECIAL)) {
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
  },
};
