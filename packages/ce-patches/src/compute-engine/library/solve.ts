import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/engine";

// cortex-js/compute-engine: `Solve`'s single-unknown path (`library/solve.ts`) calls
// `equation.solve(unknown)` and returns `List()` whenever that comes back empty, and
// `equation.solve` returns `[]` both when it PROVES there is no solution and when it merely
// can't find one (a quintic with symbolic coefficients, `x*2^(x^2) == 5`, a variable exponent,
// two-argument `Arctan`, a transcendental equation under a side condition). Two wrong answers
// follow from that, both fixed here:
//
// - An empty list is an identity when the equation is true for every value of the unknown
//   (`x == x`, `0 == 0`): Wolfram reports ONE solution with no constraint (`Solve[x == x, x]`
//   -> `{{}}`, not `{}`). Told apart by evaluating the equation on its own: an identity
//   evaluates all the way to `True`.
// - An empty list is kept only when something proves it, else `Solve` stays unevaluated
//   (see `provesNoSolution`).
//
// A trig equation answers its principal solutions only (`sin x == 1/3` drops the 2*Pi*k
// families; `tan x == 1` and `sin x == 0` too), a wrong answer by omission with no `C[1]`
// parameter to say otherwise, so those decline as well (see `dropsPeriodicFamilies`).
export function evaluateSolveIdentity(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Solve");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate;
  if (operator === undefined || native === undefined) return;

  operator.evaluate = (ops, options) => {
    const result = native(ops, options);
    const condition = ops[0];
    if (condition === undefined || result === undefined) return result;
    if (!isEmptySolutionList(result)) return dropsPeriodicFamilies(ops) ? undefined : result;
    if (symbolNameOf(condition.evaluate()) === "True") return ce.function("List", [ce.function("List", [])]);
    return provesNoSolution(ce, ops) ? result : undefined;
  };
}

/** Is `expr` `Solve`'s native "no solutions" answer -- `List()`, zero operands? */
function isEmptySolutionList(expr: BoxedExpression | undefined): boolean {
  return expr !== undefined && expr.operator === "List" && operandsOf(expr).length === 0;
}

// Past this degree compute-engine does not enumerate every root symbolically (no radicals).
const MAX_CLOSED_FORM_DEGREE = 4;

/** The equations a (canonical) `Solve` first operand states: the operand, or an `And`/`List` member. */
function equationsOf(expr: BoxedExpression): readonly BoxedExpression[] {
  const items = ["And", "List", "Set"].includes(expr.operator) ? operandsOf(expr) : [expr];
  return items.filter((item) => item.operator === "Equal" && operandsOf(item).length === 2);
}

/**
 * Did compute-engine PROVE the empty answer, rather than fail to find a solution? Proved when:
 * - the statement evaluates to `False` (`1 == 0`);
 * - an equation reduces to a nonzero constant (`x == x + 1` -> `-1 == 0`), so no value of any
 *   unknown satisfies it, and a conjunction or system containing it has none either;
 * - a single named unknown, and an equation polynomial in it of closed-form degree: every root was
 *   enumerated, so the list is empty only because a domain or side condition excluded them all.
 */
function provesNoSolution(ce: ComputeEngine, ops: readonly BoxedExpression[]): boolean {
  const statement = ops[0]?.canonical;
  if (statement === undefined) return false;
  if (symbolNameOf(statement.evaluate()) === "False") return true;

  const residuals = equationsOf(statement).map((equation) => {
    const [left, right] = operandsOf(equation);
    return ce.function("Subtract", [left!, right!]).simplify();
  });
  if (residuals.some(neverZero)) return true;

  const unknown = soleUnknown(ops);
  if (unknown === undefined) return false;
  return residuals.some((r) => {
    const degree = integerAt(ce.function("PolynomialDegree", [r, ce.symbol(unknown)]).evaluate());
    return degree !== undefined && degree >= 1 && degree <= MAX_CLOSED_FORM_DEGREE;
  });
}

/**
 * Is `expr` nonzero for every value of its unknowns? A nonzero constant; `e^g`, or any
 * nonzero constant to a power; `b^-n` (zero only at infinity); `b^n` for nonzero `b`; and
 * products, quotients and negations of those.
 */
function neverZero(expr: BoxedExpression): boolean {
  const ops = operandsOf(expr);
  switch (expr.operator) {
    case "Exp":
      return true;
    case "Negate":
      return neverZero(ops[0]!);
    case "Multiply":
      return ops.every(neverZero);
    case "Divide":
      return neverZero(ops[0]!);
    case "Power": {
      const [base, exponent] = ops as [BoxedExpression, BoxedExpression];
      if (base.unknowns.length === 0 && base.is(0) === false) return true;
      const n = exponent.unknowns.length === 0 ? exponent.N().re : Number.NaN;
      return n < 0 || (n > 0 && neverZero(base));
    }
    default:
      return expr.unknowns.length === 0 && expr.is(0) === false && Number.isFinite(expr.N().re);
  }
}

/** The one unknown a `Solve` names, bare or as `Element(x, domain)`; none for a system. */
function soleUnknown(ops: readonly BoxedExpression[]): string | undefined {
  const specs = ops.slice(1);
  if (specs.length !== 1) return undefined;
  const spec = specs[0]!;
  return symbolNameOf(spec.operator === "Element" ? operandsOf(spec)[0]! : spec);
}

const PERIODIC = new Set(["Sin", "Cos", "Tan", "Cot", "Sec", "Csc"]);

/** Does `expr` apply a periodic trig function to something containing an unknown? */
function hasPeriodicOfUnknown(expr: BoxedExpression): boolean {
  if (PERIODIC.has(expr.operator) && operandsOf(expr).some((arg) => arg.unknowns.length > 0)) return true;
  return operandsOf(expr).some(hasPeriodicOfUnknown);
}

/**
 * Is a non-empty answer to a bare trig equation only its principal solutions? A domain or side
 * condition (`Element`, `And`) bounds the unknown, so the principal values may be all there are;
 * only an unbounded `Solve(equation, x)` is left out.
 */
function dropsPeriodicFamilies(ops: readonly BoxedExpression[]): boolean {
  const statement = ops[0]?.canonical;
  if (statement === undefined || statement.operator !== "Equal") return false;
  if (ops.slice(1).some((spec) => spec.operator === "Element")) return false;
  return hasPeriodicOfUnknown(statement);
}
