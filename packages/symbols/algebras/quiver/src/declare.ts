import { registerAlgebra } from "@enumeratio/algebra";
import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";
import {
  allPaths,
  concatenate,
  hasCycle,
  isPath,
  jordanQuiver,
  kroneckerQuiver,
  linearQuiver,
  type Path,
  pathAlgebraDimension,
  pathEnd,
  quiver,
  type Quiver,
} from "./quiver.ts";

// Wiring path algebras to compute-engine.
//
// The novel case is the infinite-dimensional one. A quiver with a cycle has infinitely
// many paths, so `Basis` and `AlgebraDimension` have no answer — and the right behaviour
// is to leave the call standing rather than enumerate forever or invent a number.
// `QuiverIsAcyclic` is the head that says which side of that line a quiver is on.

const integerList = (expr: BoxedExpression | undefined): number[] | undefined => {
  if (expr === undefined || expr.operator !== "List") return undefined;
  const values = operandsOf(expr).map(integerAt);
  return values.every((v): v is number => v !== undefined) ? values : undefined;
};

/** Read `Quiver(n, [[from,to],…])`, or one of the named quivers. */
function quiverOf(expr: BoxedExpression): Quiver | undefined {
  const name = symbolNameOf(expr);
  if (name === "JordanQuiver") return jordanQuiver();
  if (name === "KroneckerQuiver") return kroneckerQuiver();
  const ops = operandsOf(expr);
  if (expr.operator === "JordanQuiver") return jordanQuiver();
  if (expr.operator === "KroneckerQuiver") return kroneckerQuiver();
  if (expr.operator === "LinearQuiver") {
    const n = integerAt(ops[0]);
    return n === undefined ? undefined : linearQuiver(n);
  }
  if (expr.operator === "Quiver") {
    const vertices = integerAt(ops[0]);
    const listed = ops[1];
    if (vertices === undefined || listed === undefined || listed.operator !== "List") {
      return undefined;
    }
    const arrows: { from: number; to: number }[] = [];
    for (const pair of operandsOf(listed)) {
      const ends = integerList(pair);
      if (ends === undefined || ends.length !== 2) return undefined;
      arrows.push({ from: ends[0]!, to: ends[1]! });
    }
    return quiver(`Quiver(${vertices})`, vertices, arrows);
  }
  return undefined;
}

/** `PathAlgebra(quiver)` → its quiver. */
const algebraOf = (expr: BoxedExpression): Quiver | undefined =>
  expr.operator === "PathAlgebra"
    ? (() => {
        const inner = operandsOf(expr)[0];
        return inner === undefined ? undefined : quiverOf(inner);
      })()
    : undefined;

export function declareQuiver(ce: ComputeEngine): void {
  ce.declare("Quiver", { signature: "(integer, list) -> value" });
  ce.declare("LinearQuiver", { signature: "(integer) -> value" });
  // JordanQuiver and KroneckerQuiver are NAMES, recognised but not declared: declaring
  // them nullary gives them the type `() -> value`, which then fails PathAlgebra's
  // `value` parameter. An undeclared symbol types as unknown and passes.
  ce.declare("PathAlgebra", { signature: "(value) -> value" });
  ce.declare("QuiverPath", { signature: "(integer, list<integer>) -> number" });

  const pathExpression = (p: Path): BoxedExpression =>
    ce.function("QuiverPath", [
      ce.number(p.start),
      ce.function(
        "List",
        p.arrows.map((a) => ce.number(a)),
      ),
    ]);

  /** Read `QuiverPath(start, [arrows…])`. */
  const pathOf = (expr: BoxedExpression): Path | undefined => {
    if (expr.operator !== "QuiverPath") return undefined;
    const ops = operandsOf(expr);
    const start = integerAt(ops[0]);
    const arrows = integerList(ops[1]);
    return start === undefined || arrows === undefined ? undefined : { start, arrows };
  };

  ce.declare("QuiverIsAcyclic", {
    signature: "(value) -> boolean",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const q = ops[0] === undefined ? undefined : quiverOf(ops[0]);
      return q === undefined ? undefined : ce.symbol(hasCycle(q) ? "False" : "True");
    },
  });

  ce.declare("QuiverPathEnd", {
    signature: "(value, number) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const q = ops[0] === undefined ? undefined : quiverOf(ops[0]);
      const p = ops[1] === undefined ? undefined : pathOf(ops[1]);
      if (q === undefined || p === undefined || !isPath(q, p)) return undefined;
      return ce.number(pathEnd(q, p));
    },
  });

  /**
   * The product needs its quiver — a path on its own does not know which quiver it
   * belongs to — so concatenation is its own head rather than riding the seam's
   * ordered product.
   */
  ce.declare("QuiverCompose", {
    signature: "(value, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const q = ops[0] === undefined ? undefined : quiverOf(ops[0]);
      const a = ops[1] === undefined ? undefined : pathOf(ops[1]);
      const b = ops[2] === undefined ? undefined : pathOf(ops[2]);
      if (q === undefined || a === undefined || b === undefined) return undefined;
      if (!isPath(q, a) || !isPath(q, b)) return undefined;
      const joined = concatenate(q, a, b);
      // Non-composable paths multiply to ZERO — that is the algebra, not a failure.
      return joined === undefined ? ce.number(0) : pathExpression(joined);
    },
  });

  registerAlgebra(ce, {
    name: "quiver",
    basis: (expr) => {
      const q = algebraOf(expr);
      if (q === undefined) return undefined;
      const paths = allPaths(q);
      // A cyclic quiver has no finite basis; say nothing rather than enumerate forever.
      if (paths === undefined || paths.length > 512) return undefined;
      return ce.function("List", paths.map(pathExpression));
    },
    dimension: (expr) => {
      const q = algebraOf(expr);
      if (q === undefined) return undefined;
      const dimension = pathAlgebraDimension(q);
      return dimension === undefined ? undefined : ce.number(dimension);
    },
    contains: (element, expr) => {
      const q = algebraOf(expr);
      const p = pathOf(element);
      if (q === undefined || p === undefined) return undefined;
      return ce.symbol(isPath(q, p) ? "True" : "False");
    },
  });
}
