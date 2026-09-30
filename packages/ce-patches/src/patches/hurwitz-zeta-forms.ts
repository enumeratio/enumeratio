import { wrapOperator } from "@enumeratio/engine";
import type { Patch } from "../patch.ts";
import { evaluateHurwitz } from "../compute-engine/library/special-functions.ts";
import { wantsNumber } from "../support/box.ts";

// compute-engine evaluates HurwitzZeta natively since 0.141, but not the closed forms at a
// non-positive integer s with a symbolic a (ζ(−n, a) = −B₍ₙ₊₁₎(a)/(n+1)), and only to about
// 1e-8 at a complex a with s < 0. This answers those first and leaves the rest native.
export const hurwitzZetaForms: Patch = {
  id: "hurwitz-zeta-forms",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "HurwitzZeta(−n, a) as a Bernoulli polynomial in a, and accurate at a complex a",
  files: ["src/compute-engine/numerics/hurwitz-zeta-big.ts", "src/compute-engine/library/special-functions.ts"],
  heads: ["HurwitzZeta"],

  fixed: (ce) => {
    // In a scope of its own: boxing the free `a` would otherwise declare it on the live
    // engine this check runs on.
    ce.pushScope();
    try {
      if (ce.box(["HurwitzZeta", -1, "a"]).evaluate().operator === "HurwitzZeta") return false;
    } finally {
      ce.popScope();
    }
    // ζ(−3, 1 + i) = −B₄(1 + i)/4 = 1/120 + i/2 exactly.
    const r = ce.box(["HurwitzZeta", -3, ["Complex", 1, 1]]).N();
    return Math.abs(r.re - 1 / 120) < 1e-15 && Math.abs(r.im - 0.5) < 1e-15;
  },

  apply: (ce) =>
    wrapOperator(
      ce,
      ["HurwitzZeta"],
      () => true,
      (native) => (ops, options) => evaluateHurwitz(ce, ops, wantsNumber(ops, options)) ?? native?.(ops, options),
    ),
};
