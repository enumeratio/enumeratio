import { isNumber, isSymbol, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { type Knowledge, knowledgeOf, withAssumed } from "./piecewise-assumptions.ts";
import { compose } from "./piecewise-compose.ts";
import { expandStep, STEP_HEADS } from "./piecewise-rewrites.ts";

// Piecewise({{v1, c1}, {v2, c2}, ...}, default) — Wolfram's conditional-value head. The
// conditions are tried in order; the value returned is the first one that's `True`,
// provided every condition before it is `False` (an undecided earlier condition means we
// can't know whether THIS one is really first, so the call declines rather than guess).
// `default` is 0 when omitted, matching Wolfram.
//
// PiecewiseExpand(expr, assumptions?) — rewrites Abs, Sign and the step heads
// (piecewise-rewrites.ts) into Piecewise, recursively; a sum, product or step head over
// Piecewise values becomes one Piecewise (piecewise-compose.ts). Abs and Sign fire once their
// argument is known real (Wolfram's own PiecewiseExpand[Abs[x]] likewise declines without a
// real assumption on `x` — Abs isn't piecewise-comparable over the complex plane); the step
// heads need no assumption on their arguments, as in Wolfram. `assumptions` is scoped
// exactly like Refine/Assuming: pushed for the rewrite and popped after, so it never leaks.
// Without an explicit `assumptions` argument, whatever the caller already has assumed (via
// `Assuming`) is what's consulted — same as Wolfram reading `$Assumptions`. The rewrites read
// the bounds those conditions state (piecewise-assumptions.ts), not only what `ce.assume` kept.

function pair(ce: ComputeEngine, value: BoxedExpression, cond: BoxedExpression): BoxedExpression {
  return ce.box(["List", value.json, cond.json] as never);
}

function evaluatePiecewise(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [clauses, defaultArg] = ops;
  if (!clauses || clauses.operator !== "List") return undefined;
  const originalClauses = operandsOf(clauses);
  const fallback = defaultArg ?? ce.number(0);
  const kept: BoxedExpression[] = [];
  for (const clause of originalClauses) {
    if (clause.operator !== "List") return undefined;
    const [value, cond] = operandsOf(clause);
    if (!value || !cond) return undefined;
    const truth = ce.verify(cond);
    if (truth === false) continue; // eliminated — never reached
    if (truth === true && kept.length === 0) return value.evaluate(); // definitely first
    kept.push(pair(ce, value, cond)); // undecided, or certain but behind an undecided one
    if (truth === true) break; // nothing after a definite hit is ever reached
  }
  if (kept.length === originalClauses.length) return undefined; // nothing decided — stay symbolic
  if (kept.length === 0) return fallback.evaluate();
  return ce.box(["Piecewise", ["List", ...kept.map((k) => k.json)], fallback.json] as never);
}

export function declarePiecewise(ce: ComputeEngine): void {
  ce.declare("Piecewise", {
    signature: "(list, expression?) -> expression",
    evaluate: (ops: readonly BoxedExpression[]) => evaluatePiecewise(ce, ops),
  });
}

/** Is `v` known to be real-valued under whatever the caller (or PiecewiseExpand's own
 * `assumptions` argument) has already assumed? Concrete real number literals count too. */
function isKnownReal(ce: ComputeEngine, v: BoxedExpression): boolean {
  if (isNumber(v) && v.im === 0 && Number.isFinite(v.re)) return true;
  return ce.ask(["Element", v.json, "RealNumbers"] as never).length > 0;
}

function expandOne(
  ce: ComputeEngine,
  e: BoxedExpression,
  allReal: boolean,
  kn: Knowledge,
): BoxedExpression | undefined {
  const op = e.operator;
  const ops = operandsOf(e);
  if (op === "Abs" && ops.length === 1 && (allReal || isKnownReal(ce, ops[0]))) {
    const v = ops[0];
    return ce.box(["Piecewise", ["List", ["List", ["Negate", v.json], ["Less", v.json, 0]]], v.json] as never);
  }
  if (op === "Sign" && ops.length === 1 && (allReal || isKnownReal(ce, ops[0]))) {
    const v = ops[0];
    return ce.box([
      "Piecewise",
      ["List", ["List", -1, ["Less", v.json, 0]], ["List", 1, ["Greater", v.json, 0]]],
      0,
    ] as never);
  }
  if (op === "Argument" && ops.length === 1 && (allReal || isKnownReal(ce, ops[0]))) {
    return ce.box(["Piecewise", ["List", ["List", "Pi", ["Less", ops[0].json, 0]]], 0] as never);
  }
  return STEP_HEADS.has(op) ? expandStep(ce, e, kn) : undefined;
}

// A relation holds a Piecewise only as a boolean combination; that rewrite is not made here.
const RELATIONS = new Set(["Less", "LessEqual", "Greater", "GreaterEqual", "Equal", "NotEqual", "Inequality"]);

const holdsPiecewise = (e: BoxedExpression): boolean =>
  e.operator === "Piecewise" || operandsOf(e).some(holdsPiecewise);

/** Recursively rewrite every eligible subexpression, innermost first. */
function expand(ce: ComputeEngine, e: BoxedExpression, allReal: boolean, kn: Knowledge): BoxedExpression {
  const ops = operandsOf(e);
  if (ops.length === 0 || RELATIONS.has(e.operator)) return e;
  const inner = ops.map((o) => expand(ce, o, allReal, kn));
  if (inner.some(holdsPiecewise)) {
    // A sum, product or step head over Piecewise values is one Piecewise; any other call stays as written.
    const composed = compose(ce, kn, e.operator, inner);
    if (composed) return composed;
    if (STEP_HEADS.has(e.operator)) return e;
  }
  const rebuilt = ce.box([e.operator, ...inner.map((o) => o.json)] as never);
  return expandOne(ce, rebuilt, allReal, kn) ?? rebuilt;
}

export function declarePiecewiseExpand(ce: ComputeEngine): void {
  ce.declare("PiecewiseExpand", {
    signature: "(expression, expression?) -> expression",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr, assumptions] = ops;
      if (!expr) return undefined;
      if (!assumptions) return expand(ce, expr.evaluate(), false, knowledgeOf(ce));
      // `RealNumbers` as the assumption is Wolfram's `Reals`: every variable is real.
      if (isSymbol(assumptions) && assumptions.symbol === "RealNumbers")
        return expand(ce, expr.evaluate(), true, knowledgeOf(ce));
      const conds =
        assumptions.operator === "And" || assumptions.operator === "List" ? operandsOf(assumptions) : [assumptions];
      ce.pushScope();
      try {
        for (const c of conds) ce.assume(c);
        return withAssumed(ce, conds, () => expand(ce, expr.evaluate(), false, knowledgeOf(ce)));
      } finally {
        ce.popScope();
      }
    },
  });
}
