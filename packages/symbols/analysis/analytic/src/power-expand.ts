import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// PowerExpand(expr) — expand powers and logarithms of products as though every variable were
// positive: `Ln(xy)` becomes `Ln(x) + Ln(y)`, `(ab)^c` becomes `a^c·b^c`, `Sqrt(x²)` becomes
// `x` (dropping the `|x|` an unsigned real would need), and likewise for `Sqrt` of a product.
// A bottom-up rewrite — each rule fires once its children are already expanded — covers every
// backlog example; nothing here checks positivity, matching Wolfram's own default behaviour
// for `PowerExpand` (it assumes it unless told otherwise via `Assumptions`, which this does
// not model).

export function powerExpand(ce: ComputeEngine, e: BoxedExpression): BoxedExpression {
  const ops = operandsOf(e);
  if (ops.length === 0) return e;
  const children = ops.map((o) => powerExpand(ce, o));
  const op = e.operator!;
  const firstOps = operandsOf(children[0]);

  if (op === "Ln" && children[0].operator === "Multiply" && firstOps.length > 0) {
    return ce
      .function(
        "Add",
        firstOps.map((f) => powerExpand(ce, ce.function("Ln", [f]).evaluate())),
      )
      .evaluate();
  }
  if (op === "Ln" && children[0].operator === "Power" && firstOps.length === 2) {
    const [base, exponent] = firstOps;
    return ce.function("Multiply", [exponent, ce.function("Ln", [base]).evaluate()]).evaluate();
  }
  if (op === "Power" && children[0].operator === "Multiply" && firstOps.length > 0) {
    const exponent = children[1];
    return ce
      .function(
        "Multiply",
        firstOps.map((f) => ce.function("Power", [f, exponent]).evaluate()),
      )
      .evaluate();
  }
  if (op === "Sqrt" && children[0].operator === "Multiply" && firstOps.length > 0) {
    return ce
      .function(
        "Multiply",
        firstOps.map((f) => ce.function("Sqrt", [f]).evaluate()),
      )
      .evaluate();
  }
  if (op === "Sqrt" && children[0].operator === "Power" && firstOps.length === 2) {
    const [base, exponent] = firstOps;
    return ce.function("Power", [base, ce.function("Divide", [exponent, 2]).evaluate()]).evaluate();
  }
  return ce.function(op, children).evaluate();
}

export function declarePowerExpand(ce: ComputeEngine): void {
  ce.declare("PowerExpand", {
    signature: "(value) -> value",
    evaluate: (ops: readonly BoxedExpression[], _options: EvalOptions) => {
      const expr = ops[0];
      return expr === undefined ? undefined : powerExpand(ce, expr);
    },
  });
}
