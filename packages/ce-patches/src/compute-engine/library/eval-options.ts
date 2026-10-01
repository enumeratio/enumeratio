import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

// N(x, {Infinity, a}) -- Wolfram's accuracy goal: the answer is good to an absolute error of
// 10^-a, however many significant digits that takes. Native N ignores the list and answers
// at machine precision, which for x = 10^10 (e^100 - e^99.9999999999) is 11 digits where
// 63 are asked.
//
// Working precision doubles until two successive evaluations agree to the goal (plus a
// margin); past MAX_DIGITS the call stays unevaluated rather than answering short. The
// answer is rounded to the significant digits the goal asks for (a + the decimal exponent + 1).

/** The widest working precision tried; past it N declines. */
const MAX_DIGITS = 2000;
/** Guard digits above the goal, and the extra decades two evaluations must agree beyond it. */
const GUARD = 10;

const numeric = (x: BoxedExpression | undefined): boolean => x !== undefined && !Number.isNaN(x.re);

export function evaluateNAccuracyGoal(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("N");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native = operator.evaluate;
  const at = (x: BoxedExpression, digits: number): BoxedExpression =>
    ce.function("N", [x, ce.number(digits)]).evaluate();

  operator.evaluate = (ops, options) => {
    const [x, spec] = ops;
    const goal = spec?.operator === "List" ? (spec as unknown as { ops: readonly BoxedExpression[] }).ops : undefined;
    const accuracy = goal?.length === 2 && goal[0]!.json === "PositiveInfinity" ? goal[1]!.re : Number.NaN;
    if (ops.length !== 2 || x === undefined || !Number.isInteger(accuracy) || accuracy < 1) {
      return native?.(ops, options);
    }

    const tolerance = 10 ** -(accuracy + 2);
    const exponentOf = (value: BoxedExpression): number => {
      const magnitude = ce.function("Abs", [value]).evaluate();
      if (magnitude.is(0)) return Number.NEGATIVE_INFINITY;
      return ce.function("Floor", [ce.function("Log10", [magnitude]).evaluate()]).evaluate().re;
    };

    for (let digits = accuracy + GUARD; digits <= MAX_DIGITS; digits *= 2) {
      const coarse = at(x, digits);
      const fine = at(x, 2 * digits);
      // A symbolic expression has no value to meet a goal with: native N answers it.
      if (!numeric(coarse) || !numeric(fine)) return native?.(ops, options);
      const gap = ce.function("Abs", [ce.function("Subtract", [coarse, fine])]).evaluate();
      if (!(gap.re < tolerance)) continue;
      // Two answers that agree to the goal: the digits it asks for are the ones both carry.
      const exponent = exponentOf(fine);
      const significant = Number.isFinite(exponent) ? Math.max(accuracy + exponent + 1, 1) : 1;
      return significant >= digits ? fine : at(fine, significant);
    }
    return undefined;
  };
}
