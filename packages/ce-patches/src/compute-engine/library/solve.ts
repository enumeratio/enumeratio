import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/engine";

// cortex-js/compute-engine: `Solve`'s single-unknown path calls `equation.solve(unknown)`, which
// answers a list that can be wrong by omission:
//
// - an empty list is kept only when something proves it (see `provesNoSolution`); `sin x == 2`
//   and `e^x == -1` have complex solutions, but come back `List()`. Where `Solve` declines
//   an equation that is provably never satisfied (`(x^2 + 1)^-2 == 0`), the empty list is
//   what answers;
// - a trig equation answers its principal solutions only (`sin x == 1/3` drops the 2*Pi*k
//   families; `tan x == 1` and `sin x == 0` too), with no `C[1]` parameter to say otherwise, so
//   those decline (see `dropsPeriodicFamilies`);
// - over the complexes a polynomial equation has as many roots as its degree, counting
//   multiplicity; an answer with fewer is a wrong answer by omission (`x^5 + x + 1` answers one
//   real root, `x^4 == 1` answers only `+-1`), so it declines too (see `missesRoots`).
export function evaluateSolveDeclines(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Solve");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate;
  if (operator === undefined || native === undefined) return;

  operator.evaluate = (ops, options) => {
    const result = native(ops, options);
    const condition = ops[0];
    if (condition === undefined) return result;
    if (result === undefined) return provesNoSolution(ce, ops, false) ? ce.function("List", []) : result;
    if (!isEmptySolutionList(result)) {
      return dropsPeriodicFamilies(ops) || missesRoots(ce, ops, result) ? undefined : result;
    }
    return provesNoSolution(ce, ops, true) ? result : undefined;
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
 * - (only when `Solve` itself answered empty) a single named unknown, and an equation polynomial in
 *   it of closed-form degree: every root was enumerated, so the list is empty only because a
 *   domain or side condition excluded them all.
 */
function provesNoSolution(ce: ComputeEngine, ops: readonly BoxedExpression[], answeredEmpty: boolean): boolean {
  const statement = ops[0]?.canonical;
  if (statement === undefined) return false;
  if (symbolNameOf(statement.evaluate()) === "False") return true;

  const residuals = equationsOf(statement).map((equation) => {
    const [left, right] = operandsOf(equation);
    return ce.function("Subtract", [left!, right!]).simplify();
  });
  if (residuals.some(neverZero)) return true;
  const sides = equationsOf(statement).map((equation) => operandsOf(equation) as [BoxedExpression, BoxedExpression]);
  if (sides.some(([left, right]) => isImpossible(left, right))) return true;

  // Past this point a proof rests on the native answer having enumerated every root.
  if (!answeredEmpty) return false;
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

/**
 * Can `a == b` never hold? A principal square root has a non-negative real part and an absolute
 * value is a non-negative real, so neither equals a constant that is negative (`sqrt(x) == -1`,
 * `|x| == -1`). Either side may carry the function.
 */
function isImpossible(a: BoxedExpression, b: BoxedExpression): boolean {
  const impossibleAgainst = (side: BoxedExpression, constant: BoxedExpression) => {
    if (constant.unknowns.length > 0) return false;
    const value = constant.N();
    if (!(value.re < 0)) return false;
    return side.operator === "Sqrt" || (side.operator === "Abs" && value.im === 0);
  };
  return impossibleAgainst(a, b) || impossibleAgainst(b, a);
}

// Relative size below which a derivative at a root counts as zero when measuring multiplicity.
const MULTIPLICITY_TOLERANCE = 1e-9;

/** The magnitude of `expr` with the unknown set to `value`; NaN when that is not a number. */
function magnitudeAt(expr: BoxedExpression, unknown: string, value: BoxedExpression): number {
  const n = expr.subs({ [unknown]: value }).N();
  return Math.hypot(n.re, n.im);
}

/**
 * The multiplicity of `root` in `polynomial`: how many successive derivatives vanish there,
 * measured against the same derivative one unit away. 1 when the numbers do not evaluate.
 */
function multiplicityOf(
  ce: ComputeEngine,
  polynomial: BoxedExpression,
  unknown: string,
  root: BoxedExpression,
  degree: number,
): number {
  const x = ce.symbol(unknown);
  const near = [root.add(ce.One), root.sub(ce.One)];
  let derivative = polynomial;
  for (let multiplicity = 0; multiplicity < degree; multiplicity++) {
    const here = magnitudeAt(derivative, unknown, root);
    const scale = Math.max(...near.map((point) => magnitudeAt(derivative, unknown, point)));
    if (!Number.isFinite(here) || !Number.isFinite(scale)) return Math.max(multiplicity, 1);
    if (here > MULTIPLICITY_TOLERANCE * Math.max(scale, 1)) return Math.max(multiplicity, 1);
    derivative = ce.function("D", [derivative, x]).evaluate();
  }
  return degree;
}

/**
 * Did an answer to a polynomial equation over the complexes (no domain, or `Element(x, ComplexNumbers)`)
 * leave out roots? Fewer roots than the degree, each counted with its multiplicity, means some
 * are missing: `x^4 == 1` without `+-i`, a quintic with one numeric root. A system, a real or
 * integer domain, or a non-polynomial equation is not judged here.
 */
function missesRoots(ce: ComputeEngine, ops: readonly BoxedExpression[], result: BoxedExpression): boolean {
  const statement = ops[0]?.canonical;
  const unknown = soleUnknown(ops);
  if (statement === undefined || statement.operator !== "Equal" || unknown === undefined) return false;
  const domain = ops[1]?.operator === "Element" ? symbolNameOf(operandsOf(ops[1])[1]!) : undefined;
  if (domain !== undefined && domain !== "ComplexNumbers") return false;

  const [left, right] = operandsOf(statement);
  const polynomial = ce.function("Subtract", [left!, right!]).evaluate();
  const degree = integerAt(ce.function("PolynomialDegree", [polynomial, ce.symbol(unknown)]).evaluate());
  if (degree === undefined || degree < 1) return false;

  const found = operandsOf(result).reduce(
    (sum, root) => sum + multiplicityOf(ce, polynomial, unknown, root, degree),
    0,
  );
  return found < degree;
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
