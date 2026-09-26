import { type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { isRealInt, numberResult, wantsNumber } from "../shared/box.ts";
import { bigRealOperand, bigResult } from "../shared/precise.ts";
import { cx } from "../shared/complex.ts";
import type { Patch } from "../patch.ts";
import { barnesG, barnesGReal, logBarnesG, logBarnesGReal } from "./barnes-g.ts";
import { barnesGBall, barnesGBig, pi } from "./barnes-g-big.ts";

// cortex-js/compute-engine#340: the Barnes G-function BarnesG(z) and its logarithm
// LogBarnesG(z). Wolfram has both; compute-engine has neither.

const isNonPosInt = (x: BoxedExpression): boolean => isRealInt(x) && x.re <= 0;
const finish = (expr: BoxedExpression, numeric: boolean): BoxedExpression => (numeric ? expr.N() : expr.evaluate());

/** Superfactorial Π_{k=0}^{n−2} k! = G(n) for a positive integer n, exact. */
function superfactorial(n: number): bigint {
  let g = 1n;
  let f = 1n;
  for (let k = 1; k <= n - 2; k++) {
    f *= BigInt(k);
    g *= f;
  }
  return g;
}

const bigint = (v: bigint): unknown => ({ num: v.toString() });

export function evaluateBarnesG(
  ce: ComputeEngine,
  z: BoxedExpression,
  numeric: boolean,
  log: boolean,
): BoxedExpression | undefined {
  if (isNonPosInt(z)) return log ? ce.symbol("NegativeInfinity") : ce.number(0);
  if (isRealInt(z)) {
    const g = bigint(superfactorial(z.re));
    return finish(ce.box((log ? ["Ln", g] : g) as never), numeric);
  }
  if (numeric) {
    // A real z past a double's digits: the arbitrary-precision kernel (barnes-g-big.ts). Its
    // logarithm only for z > 0: on the negative axis Wolfram's LogBarnesG continuation carries
    // an imaginary part of 2πk that ln G alone does not.
    const x = bigRealOperand(ce, z);
    const g = x === undefined || (log && !x.isPositive()) ? undefined : barnesGBig(x, ce.precision);
    if (g !== undefined) return bigResult(ce, log ? g.ln() : g);
  }
  if (numeric && Number.isFinite(z.re) && Number.isFinite(z.im)) {
    const v = cx(z.re, z.im);
    return numberResult(ce, log ? logBarnesG(v) : barnesG(v));
  }
  return undefined;
}

export const barnesGPatch: Patch = {
  id: "barnes-g",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "BarnesG(z) and LogBarnesG(z), the Barnes G-function and its logarithm",

  fixed: (ce) => ce.lookupDefinition("BarnesG") !== undefined,

  apply: (ce) => {
    ce.declare("BarnesG", {
      signature: "(number) -> number",
      broadcastable: true,
      evaluate: (ops, options) =>
        ops[0] === undefined ? undefined : evaluateBarnesG(ce, ops[0], wantsNumber(ops, options), false),
    });

    ce.declare("LogBarnesG", {
      signature: "(number) -> number",
      broadcastable: true,
      evaluate: (ops, options) =>
        ops[0] === undefined ? undefined : evaluateBarnesG(ce, ops[0], wantsNumber(ops, options), true),
    });
  },
};

export { barnesG, barnesGReal, logBarnesG, logBarnesGReal, barnesGBig, barnesGBall, pi };
