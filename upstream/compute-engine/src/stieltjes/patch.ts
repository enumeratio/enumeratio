import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { isRealInt, numberResult, wantsNumber } from "../shared/box.ts";
import { bigRealOperand, bigResult } from "../shared/precise.ts";
import { cx } from "../shared/complex.ts";
import type { Patch } from "../patch.ts";
import { stieltjesGamma, stieltjesGammaReal } from "./stieltjes.ts";
import { stieltjesGammaBall, stieltjesGammaBig } from "./stieltjes-big.ts";

// cortex-js/compute-engine#340: the generalized Stieltjes constants StieltjesGamma(n, a).
// Wolfram has them; compute-engine does not.

const isNonPosInt = (x: BoxedExpression): boolean => isRealInt(x) && x.re <= 0;

/** Past this order the double-precision Euler–Maclaurin kernel drifts beyond ~1e-7, and the
 * head declines. */
export const STIELTJES_MAX_ORDER = 30;

export function evaluateStieltjes(
  ce: ComputeEngine,
  n: BoxedExpression,
  a: BoxedExpression | undefined,
  numeric: boolean,
): BoxedExpression | undefined {
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());
  if (!isRealInt(n) || n.re < 0) return undefined;
  if (a === undefined) {
    if (n.re === 0) return finish(ce.symbol("EulerGamma"));
  } else {
    if (isNonPosInt(a)) return ce.symbol("ComplexInfinity");
    if (n.re === 0) {
      // γ₀(a) = −ψ(a); the native digamma is real-only, so a complex a that it leaves
      // unevaluated falls through to the kernel below.
      const r = finish(ce.box(["Negate", ["PolyGamma", 0, a.json]] as unknown as never));
      if (!numeric || isNumber(r)) return r;
    }
  }
  if (n.re > STIELTJES_MAX_ORDER) return undefined;
  if (numeric) {
    // A real a past a double's digits: the arbitrary-precision kernel (stieltjes-big.ts).
    const x = bigRealOperand(ce, a ?? ce.One);
    const g = x === undefined ? undefined : stieltjesGammaBig(n.re, x, ce.precision);
    if (g !== undefined) return bigResult(ce, g);
  }
  const av = a === undefined ? cx(1) : cx(a.re, a.im);
  if (numeric && Number.isFinite(av.re) && Number.isFinite(av.im)) {
    return numberResult(ce, stieltjesGamma(n.re, av));
  }
  return undefined;
}

export const stieltjes: Patch = {
  id: "stieltjes",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "StieltjesGamma(n, a), the generalized Stieltjes constants",

  fixed: (ce) => ce.lookupDefinition("StieltjesGamma") !== undefined,

  apply: (ce) => {
    ce.declare("StieltjesGamma", {
      signature: "(integer, number?) -> number",
      evaluate: (ops, options) =>
        ops[0] === undefined ? undefined : evaluateStieltjes(ce, ops[0], ops[1], wantsNumber(ops, options)),
    });
  },
};

export { stieltjesGamma, stieltjesGammaReal, stieltjesGammaBall, stieltjesGammaBig };
