import { type BoxedExpression, type ComputeEngine, isSymbol } from "@cortex-js/compute-engine";
import { isRealInt, numberResult, wantsNumber } from "../shared/box.ts";
import { cx } from "../shared/complex.ts";
import type { Patch } from "../patch.ts";
import { clausen } from "./clausen.ts";

// cortex-js/compute-engine#340: the Clausen functions ClausenCl(n, theta). Wolfram has no
// Clausen head either — it spells these as Im/Re PolyLog[n, E^(I theta)] — but mpmath does
// (clsin/clcos), and the family is common enough to be worth its own head.

type Json = number | string | { num: string } | Json[];
const box = (ce: ComputeEngine, expr: Json): BoxedExpression => ce.box(expr as never);
const finish = (expr: BoxedExpression, numeric: boolean): BoxedExpression => (numeric ? expr.N() : expr.evaluate());

/** Is this expression literally π/2 (as CE canonicalises it: Half·Pi or Pi/2)? */
const isHalfPi = (x: BoxedExpression): boolean => {
  const j = JSON.stringify(x.json);
  return (
    j === JSON.stringify(["Multiply", ["Rational", 1, 2], "Pi"]) ||
    j === JSON.stringify(["Divide", "Pi", 2]) ||
    j === JSON.stringify(["Multiply", "Half", "Pi"])
  );
};

export function evaluateClausen(
  ce: ComputeEngine,
  n: BoxedExpression,
  theta: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  if (!isRealInt(n) || n.re < 1) return undefined;
  const even = n.re % 2 === 0;
  // Cl_n(0): 0 for the sine series, ζ(n) for the cosine one (and Cl₁(0) = ∞).
  if (theta.im === 0 && theta.re === 0) {
    if (n.re === 1) return ce.symbol("PositiveInfinity");
    return finish(box(ce, even ? 0 : ["Zeta", n.re]), numeric);
  }
  // Cl_n(π) = 0 (even) or −η(n) (odd); Cl_n(π/2) = β(n) (even) or −2^{−n} η(n) (odd).
  if (isSymbol(theta) && theta.symbol === "Pi") {
    return finish(box(ce, even ? 0 : ["Negate", ["DirichletEta", n.re]]), numeric);
  }
  if (isHalfPi(theta)) {
    const r: Json = even
      ? ["DirichletBeta", n.re]
      : ["Negate", ["Multiply", ["Power", 2, -n.re], ["DirichletEta", n.re]]];
    return finish(box(ce, r), numeric);
  }
  if (numeric && Number.isFinite(theta.re) && Number.isFinite(theta.im) && theta.im === 0) {
    return numberResult(ce, cx(clausen(n.re, theta.re)));
  }
  return undefined;
}

export const clausenPatch: Patch = {
  id: "clausen",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "ClausenCl(n, theta), the Clausen functions",

  fixed: (ce) => ce.lookupDefinition("ClausenCl") !== undefined,

  apply: (ce) => {
    ce.declare("ClausenCl", {
      signature: "(integer, number) -> number",
      evaluate: (ops, options) =>
        ops[0] === undefined || ops[1] === undefined
          ? undefined
          : evaluateClausen(ce, ops[0], ops[1], wantsNumber(ops, options)),
    });
  },
};

export { clausen };
