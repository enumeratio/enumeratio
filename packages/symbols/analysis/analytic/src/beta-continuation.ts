import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/boxed";
import { isFiniteNum, isRealInt, wantsNumber } from "./box.ts";
import { logGammaReal } from "./loggamma.ts";

// I_x(a, b) past x = 1 at a positive integer b: (1 − t)^(b−1) is a polynomial, so the
// defining integral is a finite sum, B_x(a, b) = Σⱼ C(b−1, j)(−1)ʲ x^(a+j)/(a+j), real for
// any x > 0. Native BetaRegularized takes x in [0, 1] only.

/** Largest b expanded term by term; the alternating sum loses digits as b grows. */
const B_MAX = 30;

export function declareBetaContinuation(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["BetaRegularized", 0.5, 2, 3],
    ([x, a, b]) =>
      x !== undefined &&
      a !== undefined &&
      b !== undefined &&
      isFiniteNum(x) &&
      isFiniteNum(a) &&
      x.im === 0 &&
      a.im === 0 &&
      x.re > 1 &&
      a.re > 0 &&
      isRealInt(b) &&
      b.re >= 1 &&
      b.re <= B_MAX,
    (native) => (ops, options) => {
      if (!wantsNumber(ops, options)) return native?.(ops, options);
      const [x, a, b] = ops.map((op: BoxedExpression) => op.re) as [number, number, number];
      let sum = 0;
      let binomial = 1;
      for (let j = 0; j < b; j++) {
        sum += ((j % 2 === 0 ? 1 : -1) * binomial * x ** (a + j)) / (a + j);
        binomial = (binomial * (b - 1 - j)) / (j + 1);
      }
      const beta = Math.exp(logGammaReal(a) + logGammaReal(b) - logGammaReal(a + b));
      return ce.number(sum / beta);
    },
    3,
  );
}
