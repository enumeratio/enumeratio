import type { BoxedExpression } from "@cortex-js/compute-engine";
import { type EvalOptions, type NativeEval, realCompile } from "../shared/box.ts";
import type { Patch } from "../patch.ts";
import { evaluatePolyLog, polyLog, polyLogReal } from "./polylog.ts";

// cortex-js/compute-engine#340: PolyLog(s, z) at non-integer and complex order s. Native
// compute-engine already declares PolyLog, but only evaluates it at an integer order.

export const polylogOrder: Patch = {
  id: "polylog-order",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "PolyLog widened to a non-integer or complex order s",

  fixed: (ce) => {
    const r = ce.box(["PolyLog", 0.5, 0.3]).N();
    return Number.isFinite(r.re) && Number.isFinite(r.im);
  },

  apply: (ce) => {
    // PolyLog(s, z): native for integer s; the Lerch series adds non-integer and
    // complex orders inside |z| ≤ 1. No native lowering on either target, so both the
    // JS wrapper and the WGSL kernel come from here.
    const nativePolyLog: NativeEval = ce.box(["PolyLog", 2, 0.5]).operatorDefinition?.evaluate;
    ce.declare("PolyLog", {
      signature: "(number, number) -> number",
      broadcastable: true, // thread over a list of z (or of s), like the other heads
      evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
        evaluatePolyLog(ce, nativePolyLog, ops, options),
      compile: realCompile(2, { js: "__pl", wgsl: "polyLog" }),
    });
  },
};

export { polyLog, polyLogReal, evaluatePolyLog };
