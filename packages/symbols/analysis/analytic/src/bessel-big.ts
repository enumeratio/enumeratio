// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@enumeratio/engine/unstable";
import { wrapOperator } from "@enumeratio/engine";
import {
  atDigits,
  bigRealOperand,
  bigResult,
  exceedsDoublePrecision,
  isFiniteNum,
  isRealInt,
  wantsNumber,
} from "@enumeratio/ce-patches";
import { pfqRegularizedBig } from "./hypergeometric-big.ts";

// BesselI(n, x) and BesselJ(n, x) past a double's digits, for integer order and real x: native
// evaluates only in a double, so `N(…, d)` for d > 15 would print a double's digits as more.
// I_n(x) = (x/2)^n · 0F1(; n+1; x²/4)/Γ(n+1) and J_n(x) the same at -x²/4 (DLMF 10.25.2, 10.2.2);
// the order's sign folds in by I_{-n} = I_n, J_{-n} = (-1)^n J_n. A series that cannot settle declines.

const GUARD = 15;

/** I_n(x) or J_n(x) to `digits` significant digits, or undefined when the series can't vouch for it. */
export function besselBig(kind: "I" | "J", order: number, x: BigDecimal, digits: number): BigDecimal | undefined {
  const n = Math.abs(order);
  if (!x.isFinite() || !Number.isInteger(order)) return undefined;
  if (x.isZero()) return n === 0 ? new BigDecimal(1) : new BigDecimal(0);
  const working = digits + GUARD;
  return atDigits(working, () => {
    const quarter = x.mul(x).div(4);
    const regularized = pfqRegularizedBig([], [new BigDecimal(n + 1)], kind === "I" ? quarter : quarter.neg(), working);
    if (regularized === undefined) return undefined;
    const value = x.div(2).pow(n).mul(regularized);
    return (kind === "J" && order < 0 && n % 2 === 1 ? value.neg() : value).toPrecision(digits);
  });
}

export function declareBesselBig(ce: ComputeEngine): void {
  for (const [head, kind] of [
    ["BesselI", "I"],
    ["BesselJ", "J"],
  ] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => ops.length === 2 && ops.every(isFiniteNum) && isRealInt(ops[0]!) && ops[1]!.im === 0,
      (native) => (ops, options) => {
        if (!wantsNumber(ops, options) || !exceedsDoublePrecision(ce, options.numericApproximation))
          return native?.(ops, options);
        const [order, x] = ops as [BoxedExpression, BoxedExpression];
        const arg = bigRealOperand(ce, x);
        const value = arg === undefined ? undefined : besselBig(kind, order.re, arg, ce.precision);
        return value === undefined ? undefined : bigResult(ce, value);
      },
      2,
    );
  }
}
