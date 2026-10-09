import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { declareCompile, operandsOf } from "@enumeratio/engine";

// cortex-js/compute-engine: `Shape` reads `xs.shape`, which is the `dimensions` of the operand's
// TYPE, and a list's type only carries dimensions when its elements' type is known. A nested
// list of applications of an unknown function (`{{a(1), a(2)}}`, what `Array(a, {2, 3})` makes)
// has type `list<list<unknown>>` with none, so its shape reads empty, while `{{x, y}}` and
// `{{Sin(1), Sin(2)}}` have (1, 2). Wolfram's `Dimensions` is structural. Fixed here by falling
// back to the nested list's own structure when the type has no dimensions; a ragged list keeps
// the leading dimensions its rows agree on, as `Dimensions` does.

/** The leading dimensions every row agrees on. */
function commonPrefix(rows: readonly (readonly number[])[]): number[] {
  const [first, ...rest] = rows;
  if (first === undefined) return [];
  const out: number[] = [];
  for (const [i, n] of first.entries()) {
    if (rest.some((row) => row[i] !== n)) break;
    out.push(n);
  }
  return out;
}

/** `Dimensions` of a nested `List` by structure (`[]` for anything that is not one). */
export function structuralShape(expr: BoxedExpression): number[] {
  if (expr.operator !== "List") return [];
  const ops = operandsOf(expr);
  return [ops.length, ...commonPrefix(ops.map(structuralShape))];
}

/** Patch `Shape` to fall back to the structure of a list whose type carries no dimensions. */
export function evaluateShapeOfUnknownElements(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Shape");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate;
  if (operator === undefined || native === undefined) return;
  (operator as { evaluate: unknown }).evaluate = (ops: readonly BoxedExpression[], options: never) => {
    const [xs] = ops;
    if (xs === undefined || xs.shape.length > 0) return native(ops, options);
    const shape = structuralShape(xs);
    return shape.length === 0 ? native(ops, options) : ce.tuple(...shape);
  };
  // compile builtin: the structure of a list whose type carries no dimensions: the same shape
  declareCompile(ce, "Shape", "builtin");
}
