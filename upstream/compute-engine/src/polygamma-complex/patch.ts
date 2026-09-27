import { type NativeEval, realCompile } from "../shared/box.ts";
import type { Patch } from "../patch.ts";
import { digamma, evaluatePolygamma, polygamma, polygammaReal } from "./polygamma.ts";

// cortex-js/compute-engine#340: PolyGamma(m, z) at a complex z. Native compute-engine
// already declares PolyGamma, but only evaluates it at a real z.

export const polygammaComplex: Patch = {
  id: "polygamma-complex",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "PolyGamma widened to a complex z",

  fixed: (ce) => {
    const r = ce.box(["PolyGamma", 1, ce.complex(2, 1)]).N();
    return Number.isFinite(r.re) && Number.isFinite(r.im);
  },

  apply: (ce) => {
    // PolyGamma(m, z): native for real z at every integer order (m = 0 is the digamma);
    // ours adds complex z. compute-engine already lowers it to `_SYS.polygamma` on the
    // JS target, so only the WGSL kernel is named here and JS falls through to native.
    const nativePolyGamma: NativeEval = ce.box(["PolyGamma", 1, 1]).operatorDefinition?.evaluate;
    ce.declare("PolyGamma", {
      signature: "(number, number) -> number",
      broadcastable: true, // preserve native threading over a list of z
      evaluate: (ops, options) => evaluatePolygamma(ce, nativePolyGamma, ops, options),
      compile: realCompile(2, { wgsl: "polygamma" }),
    });
  },
};

export { digamma, polygamma, polygammaReal, evaluatePolygamma };
