import type { BoxedExpression } from "@cortex-js/compute-engine";
import type { EvaluateHandler, EvaluateOptions, NativeEvaluate } from "@enumeratio/boxed";
import type { Patch } from "../patch.ts";

// cortex-js/compute-engine#346, offered as PR #348: the complete elliptic integral of the
// second kind, EllipticE(m), loses precision at a complex modulus (design/upstreaming.md
// §8: at m = 0.57 + 0.23i it gives four correct digits against mpmath and the engine's own
// Hypergeometric2F1 identity, both of which agree to full precision). The two-argument
// incomplete form E(pi/2, m) is exact there, so the fix routes the one-argument reduction
// through it: E(m) = E(pi/2, m) (DLMF 19.2.7). Real modulus is untouched -- already exact.

/** A concrete (finite) numeric operand -- as opposed to a symbolic one (NaN re/im). */
const isFiniteNum = (x: BoxedExpression): boolean => Number.isFinite(x.re) && Number.isFinite(x.im);

/** Should this call produce a number? Either N() asked for one, or the operand is inexact. */
const wantsNumber = (op: BoxedExpression, options: EvaluateOptions): boolean =>
  (options.numericApproximation ?? false) || (op as Partial<{ isExact: boolean }>).isExact === false;

/** mpmath's `ellipe(0.57 + 0.23j)`, to a few more digits than compute-engine gets right today. */
const REPRO_M: readonly [number, number] = [0.57, 0.23];
const REPRO_ANSWER: readonly [number, number] = [1.3248077726970517, -0.1197294454595116];

export const ellipticEComplex: Patch = {
  id: "elliptic-e-complex",
  issue: "https://github.com/cortex-js/compute-engine/issues/346",
  pr: "https://github.com/cortex-js/compute-engine/pull/348",
  lands: "EllipticE's one-argument (complete) reduction, at a complex modulus",

  fixed: (ce) => {
    const r = ce.box(["EllipticE", ce.complex(...REPRO_M)]).N();
    return Math.abs(r.re - REPRO_ANSWER[0]) < 1e-9 && Math.abs(r.im - REPRO_ANSWER[1]) < 1e-9;
  },

  apply: (ce) => {
    const definition = ce.lookupDefinition("EllipticE");
    const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator === undefined) return; // EllipticE not declared at all -- nothing to patch

    const native: NativeEvaluate = operator.evaluate;
    const halfPi = ce.box(["Divide", "Pi", 2]);
    const evaluate: EvaluateHandler = (ops, options) => {
      const [m] = ops;
      if (ops.length === 1 && m !== undefined && wantsNumber(m, options) && isFiniteNum(m) && m.im !== 0) {
        return ce.box(["EllipticE", halfPi, m]).evaluate(options);
      }
      return native?.(ops, options);
    };
    operator.evaluate = evaluate as NonNullable<typeof operator.evaluate>;
  },
};
