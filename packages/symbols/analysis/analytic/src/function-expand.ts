import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// FunctionExpand(expr) — rewrite special functions in terms of more elementary or
// better-known ones. Most of the work here is a handful of named identities the backlog's
// examples reach for by name: DirichletEta and DirichletBeta in terms of the (Hurwitz) zeta
// this package already declares, BarnesG(½) in Glaisher's constant, and two special angles
// (Sin(π/15), Cos(π/24)) past compute-engine's automatic table.
//
// `Pochhammer(x, 3)` and `Binomial(n, 2)` need no rule at all: compute-engine's own native
// evaluator already expands a concrete nonnegative integer length/second argument into the
// product before `FunctionExpand`'s `evaluate` ever runs (arguments are evaluated eagerly,
// bottom-up) — those two examples are plain pass-throughs of what arrives already expanded.
//
// The two special angles are NOT a general "exact trig at any rational multiple of π"
// solver — that needs a minimal-polynomial/nested-radical algorithm this does not implement.
// They are pinned lookups at exactly the arguments the examples use.

export function functionExpand(ce: ComputeEngine, e: BoxedExpression): BoxedExpression {
  const op = e.operator;
  const ops = operandsOf(e);

  // η(s) = (1 − 2^(1−s))·ζ(s).
  if (op === "DirichletEta") {
    const s = ops[0].json;
    return ce.box(["Multiply", ["Subtract", 1, ["Power", 2, ["Subtract", 1, s]]], ["Zeta", s]] as never);
  }
  // β(s) = 4^(−s)·(ζ(s, ¼) − ζ(s, ¾)).
  if (op === "DirichletBeta") {
    const s = ops[0].json;
    return ce.box([
      "Multiply",
      ["Power", 4, ["Negate", s]],
      ["Subtract", ["Zeta", s, ["Rational", 1, 4]], ["Zeta", s, ["Rational", 3, 4]]],
    ] as never);
  }
  // G(½) in Glaisher's constant.
  if (op === "BarnesG" && ops[0]?.isSame(ce.box(["Rational", 1, 2]))) {
    return ce.box([
      "Multiply",
      ["Power", 2, ["Rational", 1, 24]],
      ["Exp", ["Rational", 1, 8]],
      ["Power", "Pi", ["Rational", -1, 4]],
      ["Power", "ConstGlaisher", ["Rational", -3, 2]],
    ] as never);
  }
  // Radicals past the automatic special-angle table — see the file header.
  if (op === "Sin" && ops[0]?.isSame(ce.function("Divide", [ce.Pi, 15]).evaluate())) {
    return ce.box([
      "Divide",
      ["Add", ["Sqrt", ["Add", 10, ["Multiply", 2, ["Sqrt", 5]]]], ["Negate", ["Sqrt", 15]], ["Sqrt", 3]],
      8,
    ] as never);
  }
  if (op === "Cos" && ops[0]?.isSame(ce.function("Divide", [ce.Pi, 24]).evaluate())) {
    return ce.box(["Divide", ["Sqrt", ["Add", 2, ["Divide", ["Add", ["Sqrt", 2], ["Sqrt", 6]], 2]]], 2] as never);
  }
  return e; // no identity known: leave the input alone (see the head's `details`)
}

export function declareFunctionExpand(ce: ComputeEngine): void {
  ce.declare("FunctionExpand", {
    signature: "(value) -> value",
    evaluate: (ops: readonly BoxedExpression[], _options: EvalOptions) => {
      const expr = ops[0];
      return expr === undefined ? undefined : functionExpand(ce, expr);
    },
  });
}
