import type { BoxedExpression } from "@cortex-js/compute-engine";
import { type EvalOptions, type NativeEval, realCompile, wantsNumber, declined, isFiniteNum } from "../shared/box.ts";
import type { Patch } from "../patch.ts";
import { evaluateHurwitz, evaluateZeta } from "./kernel.ts";

// cortex-js/compute-engine#340, offered as PR #350: the complex Riemann zeta ζ(s), the
// two-argument generalized zeta Zeta(s, a), and the two-argument Hurwitz zeta
// HurwitzZeta(s, a) — Wolfram has all three; compute-engine's native `Zeta` is real,
// one-argument only.

export const zetaHurwitz: Patch = {
  id: "zeta-hurwitz",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  pr: "https://github.com/cortex-js/compute-engine/pull/350",
  lands: "HurwitzZeta(s, a), and Zeta widened to a complex s and a two-argument (s, a) form",

  fixed: (ce) => {
    // Zeta(s) at a concretely complex s is what native compute-engine declines today
    // (falls back to NaN/unevaluated); HurwitzZeta doesn't exist at all.
    if (ce.lookupDefinition("HurwitzZeta") === undefined) return false;
    const r = ce.box(["Zeta", ce.complex(0.5, 14.13)]).N();
    return Number.isFinite(r.re) && Number.isFinite(r.im);
  },

  apply: (ce) => {
    ce.declare("HurwitzZeta", {
      signature: "(number, number) -> number",
      evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
        evaluateHurwitz(ce, ops, wantsNumber(ops, options)),
      compile: realCompile(2, { js: "__hz", wgsl: "hurwitz" }),
    });

    // Capture the native single-argument Riemann zeta before redeclaring, then defer
    // to it for the one-argument case; declaring `Zeta` replaces its whole definition.
    // Native evaluates real s only, to the engine's precision; a concretely complex s it
    // declines goes to ζ(s, 1). Real and symbolic s stay native: HurwitzZeta reduces ζ(s, 1)
    // back to Zeta(s) for those, so routing them there would loop.
    const nativeZeta: NativeEval = ce.box(["Zeta", 2]).operatorDefinition?.evaluate;
    const zetaCompile = realCompile(2, { js: "__zg", wgsl: "zetaGen" });
    ce.declare("Zeta", {
      signature: "(number, number?) -> number",
      broadcastable: true, // preserve native threading over a list of s
      evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
        if (ops.length >= 2) return evaluateZeta(ce, ops, wantsNumber(ops, options));
        const r = nativeZeta?.(ops, options);
        const s = ops[0];
        if (!declined(r, "Zeta") || s === undefined || !isFiniteNum(s) || s.im === 0) return r;
        return evaluateHurwitz(ce, [s, ce.One], wantsNumber(ops, options)) ?? r;
      },
      compile: (args, compile, ctx) => zetaCompile(args.length === 1 ? [args[0], ce.One] : args, compile, ctx),
    });
  },
};

export {
  hurwitzZeta,
  hurwitzZetaReal,
  setZetaKernel,
  zetaGeneralized,
  zetaGeneralizedReal,
  type ZetaKernel,
  evaluateHurwitz,
  evaluateZeta,
} from "./kernel.ts";
