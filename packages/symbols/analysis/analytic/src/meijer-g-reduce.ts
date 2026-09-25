import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// MeijerGReduce(expr, x): rewrites a handful of elementary/special functions into
// MeijerG form, using identities that hold for the operand as a whole (not just a
// linear argument), so each is unconditional — no parameter range to get wrong:
//
//   e^g       = G^{1,0}_{0,1}(-g | ; 0)
//   sin(g)    = √π · G^{1,0}_{0,2}(g²/4 | ; 1/2, 0)
//   cos(g)    = √π · G^{1,0}_{0,2}(g²/4 | ; 0, 1/2)
//   log(1+g)  = G^{1,2}_{2,2}(g | 1, 1; 1, 0)
//   J_n(g)    = G^{1,0}_{0,2}(g²/4 | ; n/2, -n/2)
//
// (DLMF 8.4.14/16.18, Gradshteyn–Ryzhik 8.4). Each was checked numerically against
// wolframscript's own `MeijerG` (see meijer-g-reduce.test.ts) — the exact 4-argument
// form here, not Wolfram's generalized 5-argument one (its MeijerGReduce often
// prefers a `MeijerG[…, z, r]` with r ≠ 1 to keep the argument free of an explicit
// square root; both are correct, and round-tripping through our own `MeijerG`
// evaluator is what's verified). Anything else — a bare `log(x)`, a shifted or scaled
// trig argument beyond plain substitution, any other head — is declined.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isE = (x: BoxedExpression): boolean => symbolNameOf(x) === "ExponentialE";

function meijerGCall(
  ce: ComputeEngine,
  aBlocks: [BoxedExpression[], BoxedExpression[]],
  bBlocks: [BoxedExpression[], BoxedExpression[]],
  z: BoxedExpression,
): BoxedExpression {
  const list2 = (blocks: [BoxedExpression[], BoxedExpression[]]) =>
    ce.function("List", [ce.function("List", blocks[0]), ce.function("List", blocks[1])]);
  return ce.function("MeijerG", [list2(aBlocks), list2(bBlocks), z]);
}

function reduce(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression | undefined {
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    const g = opAt(expr, 1);
    const negG = ce.function("Negate", [g]).evaluate();
    return meijerGCall(ce, [[], []], [[ce.Zero], []], negG);
  }
  if (expr.operator === "Sin" || expr.operator === "Cos") {
    const g = opAt(expr, 0);
    const gSq4 = ce.function("Divide", [ce.function("Power", [g, 2]), 4]).evaluate();
    const bBlocks: [BoxedExpression[], BoxedExpression[]] =
      expr.operator === "Sin" ? [[ce.Half], [ce.Zero]] : [[ce.Zero], [ce.Half]];
    const g_ = meijerGCall(ce, [[], []], bBlocks, gSq4);
    return ce.function("Multiply", [ce.function("Sqrt", [ce.Pi]), g_]).evaluate();
  }
  if (expr.operator === "Ln" && opAt(expr, 0).operator === "Add") {
    const addOps = operandsOf(opAt(expr, 0));
    const one = addOps.find((o) => o.re === 1 && o.im === 0);
    const rest = addOps.filter((o) => o !== one);
    if (one === undefined || rest.length === 0) return undefined;
    const g = rest.length === 1 ? rest[0] : ce.function("Add", rest);
    return meijerGCall(ce, [[ce.One, ce.One], []], [[ce.One], [ce.Zero]], g);
  }
  if (expr.operator === "BesselJ") {
    const n = opAt(expr, 0);
    const g = opAt(expr, 1);
    const gSq4 = ce.function("Divide", [ce.function("Power", [g, 2]), 4]).evaluate();
    const half = ce.function("Divide", [n, 2]).evaluate();
    const negHalf = ce.function("Negate", [half]).evaluate();
    return meijerGCall(ce, [[], []], [[half], [negHalf]], gSq4);
  }
  return undefined;
}

export function declareMeijerGReduce(ce: ComputeEngine): void {
  ce.declare("MeijerGReduce", {
    signature: "(value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr, x] = ops;
      const xName = x === undefined ? undefined : symbolNameOf(x);
      if (expr === undefined || xName === undefined || !expr.has(xName)) return undefined;
      return reduce(ce, expr);
    },
  });
}
