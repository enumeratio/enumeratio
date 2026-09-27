import { type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { isFiniteNum, isRealInt, numberResult, wantsNumber } from "../shared/box.ts";
import { atEnginePrecision } from "../shared/precise.ts";
import { cx } from "../shared/complex.ts";
import type { Patch } from "../patch.ts";
import { logGamma, logGammaBig, logGammaReal } from "./loggamma.ts";

// cortex-js/compute-engine#340: LogGamma(z), the analytic continuation of ln Γ(z) (branch
// cut on (−∞, 0]). compute-engine has Gamma (complex) but no LogGamma head.

const isNonPosInt = (x: BoxedExpression): boolean => isRealInt(x) && x.re <= 0;
const finish = (expr: BoxedExpression, numeric: boolean): BoxedExpression => (numeric ? expr.N() : expr.evaluate());

export function evaluateLogGamma(ce: ComputeEngine, z: BoxedExpression, numeric: boolean): BoxedExpression | undefined {
  if (isNonPosInt(z)) return ce.symbol("PositiveInfinity"); // Wolfram: Infinity at the poles
  if (isRealInt(z)) return finish(ce.box(["Ln", ["Factorial", z.re - 1]] as never), numeric);
  if (!numeric && z.im === 0 && z.re === 0.5) return ce.box(["Divide", ["Ln", "Pi"], 2] as never).evaluate();
  // z > 0: compute-engine's own GammaLn agrees with the continuation there, and carries
  // arbitrary precision where the double kernel below is stuck at ~1e-15. Left of the origin
  // the continuation is complex (GammaLn keeps the real part but drops the winding, which is
  // −iπ⌈−z⌉ there) — and a compute-engine complex number is a pair of doubles, so routing
  // gains nothing. The kernel keeps that side.
  if (numeric && isFiniteNum(z) && z.im === 0 && z.re > 0) {
    const native = atEnginePrecision(ce, ce.box(["GammaLn", z.json] as never).N());
    if (native !== undefined) return native;
  }
  if (numeric && isFiniteNum(z)) return numberResult(ce, logGamma(cx(z.re, z.im)));
  return undefined;
}

export const logGammaPatch: Patch = {
  id: "log-gamma",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "LogGamma(z), the analytic continuation of ln Γ(z)",

  fixed: (ce) => ce.lookupDefinition("LogGamma") !== undefined,

  apply: (ce) => {
    ce.declare("LogGamma", {
      signature: "(number) -> number",
      broadcastable: true,
      evaluate: (ops, options) =>
        ops[0] === undefined ? undefined : evaluateLogGamma(ce, ops[0], wantsNumber(ops, options)),
    });
  },
};

export { logGamma, logGammaReal, logGammaBig };
