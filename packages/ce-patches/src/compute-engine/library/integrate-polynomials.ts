import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/engine";

type Evaluate = (ops: readonly BoxedExpression[], options: { numericApproximation?: boolean }) => unknown;

// cortex-js/compute-engine: `Integrate` expands a product of polynomials and integrates a power of
// a linear form, but leaves `∫(x² + 1)² dx` and `∫(1 + x + x²)² dx` unevaluated -- a power of a
// polynomial past linear is not expanded. Where the integrand is a polynomial in the variable,
// the call is retried on its expansion.
//
// `Integrate`'s canonical form wraps the integrand as `Function(Block(body), x)`.
/** `ops` with the polynomial integrand expanded, or `undefined` when it isn't a polynomial in the
 * variable or expanding changes nothing. */
function expandedPolynomialOps(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression[] | undefined {
  const [integrand, ...rest] = ops;
  if (integrand?.operator !== "Function") return undefined;
  const [inner, variable, ...extra] = operandsOf(integrand);
  const name = variable && symbolNameOf(variable);
  if (inner === undefined || name == null || extra.length > 0) return undefined;
  let body = inner;
  while (body.operator === "Block" && operandsOf(body).length === 1) body = operandsOf(body)[0]!;
  const degree = integerAt(ce.function("PolynomialDegree", [body, variable!]).evaluate());
  if (degree === undefined || degree < 2) return undefined;
  const expanded = ce.function("Expand", [body]).evaluate();
  if (expanded.isSame(body)) return undefined;
  return [ce.function("Function", [ce.function("Block", [expanded]), variable!]), ...rest];
}

/** Retry an `Integrate` the native handler leaves unevaluated on its polynomial expansion. */
export function integrateExpandsPolynomials(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Integrate");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate as Evaluate | undefined;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = ((ops: readonly BoxedExpression[], options: { numericApproximation?: boolean }) => {
    const result = native(ops, options) as BoxedExpression | undefined;
    if (result !== undefined && result.operator !== "Integrate") return result;
    const retryOps = expandedPolynomialOps(ce, ops);
    if (retryOps === undefined) return result;
    const retried = native(retryOps, options) as BoxedExpression | undefined;
    return retried !== undefined && retried.operator !== "Integrate" ? retried : result;
  }) as never;
}
