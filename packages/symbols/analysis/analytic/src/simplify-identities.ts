import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { hyperbolicPythagoras } from "./full-simplify.ts";

// Simplify's missing identities, where Wolfram's Simplify has them: a quotient of the
// sine and cosine of the same argument is its tangent (cotangent, and the hyperbolic
// pair likewise), and cosh² − sinh² = 1. Applied after compute-engine's own pass.

const QUOTIENTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Sin: { Cos: "Tan" },
  Cos: { Sin: "Cot" },
  Sinh: { Cosh: "Tanh" },
  Cosh: { Sinh: "Coth" },
};

/** `json` with every f(u)/g(u) in QUOTIENTS replaced by its single function, bottom-up. */
function quotients(json: unknown): unknown {
  if (!Array.isArray(json)) return json;
  const [head, ...rest] = json as [string, ...unknown[]];
  const children = rest.map(quotients);
  if (head === "Divide" && children.length === 2) {
    const [num, den] = children;
    if (Array.isArray(num) && Array.isArray(den) && num.length === 2 && den.length === 2) {
      const to = QUOTIENTS[num[0] as string]?.[den[0] as string];
      if (to !== undefined && JSON.stringify(num[1]) === JSON.stringify(den[1]))
        return [to, num[1]];
    }
  }
  return [head, ...children];
}

type Evaluate = (
  ops: ReadonlyArray<BoxedExpression>,
  options: never,
) => BoxedExpression | undefined;

// Attached directly rather than through `wrapOperator`: Simplify is lazy, and the wrapper
// would evaluate its argument in full before every call.
export function declareSimplifyIdentities(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Simplify");
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate as Evaluate | undefined;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = ((ops: ReadonlyArray<BoxedExpression>, options: never) => {
    const simplified = native(ops, options);
    if (simplified === undefined || ops.length !== 1) return simplified;
    const json = simplified.json;
    const folded = quotients(json);
    const rewritten =
      JSON.stringify(folded) === JSON.stringify(json)
        ? simplified
        : ce.box(folded as never).evaluate();
    return hyperbolicPythagoras(rewritten, ce);
  }) as typeof operator.evaluate;
}
