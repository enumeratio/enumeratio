import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { compile } from "@cortex-js/compute-engine/compile";
import { checkpoint, integerAt, operandsOf, symbolNameOf } from "@enumeratio/engine";
import { integrateSemiInfiniteOscillatory } from "../numerics/oscillatory-quadrature.ts";

type Evaluate = (ops: readonly BoxedExpression[], options: { numericApproximation?: boolean }) => unknown;

/** The integrand of `∫ body d(variable)` as a real function, or `undefined` when it has
 * another free symbol or doesn't compile. */
function realIntegrand(body: BoxedExpression, variable: string): ((x: number) => number) | undefined {
  while (body.operator === "Block" && operandsOf(body).length === 1) body = operandsOf(body)[0]!;
  if (body.unknowns.some((u) => u !== variable)) return undefined;
  // Real arithmetic: the default mode takes `t^1.5` through complex division, which answers
  // `∞ + i∞` for `sin t/t^1.5` at t = 1e-30. A complex integrand is NaN here, and the native
  // handler's, which integrates both parts.
  let compiled: ReturnType<typeof compile>;
  try {
    compiled = compile(body, { mode: "strict", fallback: false });
  } catch {
    return undefined; // a head with no compiled form (`ChebyshevU`)
  }
  if (!compiled.success || compiled.calling !== "expression") return undefined;
  const run = compiled.run as (vars: Record<string, number>) => unknown;
  return (x) => {
    const v = run({ [variable]: x });
    return typeof v === "number" ? v : NaN;
  };
}

/**
 * `∫ₐ^∞ f` (or `∫_{−∞}^b f`) for an oscillatory `f` that isn't finite at the finite end,
 * with the lobe next to that end integrated without evaluating `f` there (see
 * oscillatory-quadrature.ts); `"decline"` where its lobes beat, which the native handler
 * would sum to a confident wrong value too. `undefined` for every other integral, which
 * the native handler answers as before.
 */
function semiInfinite(
  body: BoxedExpression,
  variable: string,
  lo: number,
  hi: number,
): { estimate: number; error: number } | "decline" | undefined {
  if (Number.isNaN(lo) || Number.isNaN(hi) || Number.isFinite(lo) === Number.isFinite(hi)) return undefined;
  const f = realIntegrand(body, variable);
  if (f === undefined) return undefined;
  const [g, a] = Number.isFinite(lo) ? [f, lo] : [(t: number) => f(-t), -hi];
  if (Number.isFinite(g(a))) return undefined;
  const r = integrateSemiInfiniteOscillatory(g, a, checkpoint);
  return r === "irregular" ? "decline" : (r ?? undefined);
}

/** Attach `handler` ahead of `head`'s native evaluation, under `N` only unless `always`.
 * `"decline"` leaves the call as it is. */
function attach(
  ce: ComputeEngine,
  head: string,
  handler: (ops: readonly BoxedExpression[]) => BoxedExpression | "decline" | undefined,
  always = false,
): void {
  const definition = ce.lookupDefinition(head);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native = operator.evaluate as Evaluate | undefined;
  operator.evaluate = ((ops: readonly BoxedExpression[], options: { numericApproximation?: boolean }) => {
    const r = always || options.numericApproximation ? handler(ops) : undefined;
    if (r === "decline") return ce.function(head, [...ops]);
    return r ?? native?.(ops, options);
  }) as never;
}

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

/**
 * `N(Integrate(f, Limits(x, a, ∞)))` and `NIntegrate(f, a, ∞)` for an oscillatory `f`
 * singular (or 0/0) at `a`: compute-engine starts the lobe sum at `a + 1e-8` and drops the
 * sliver, so `∫₀^∞ sin t/t dt` answers `π/2 − 1.0e-8 ± 2.5e-10`.
 */
export function integrateOscillatoryEndpoint(ce: ComputeEngine): void {
  attach(ce, "Integrate", (ops) => {
    const [f, limits] = ops;
    if (ops.length !== 2 || f === undefined || limits?.operator !== "Limits") return undefined;
    const [v, lo, hi] = operandsOf(limits);
    const variable = v && symbolNameOf(v);
    if (variable == null || lo === undefined || hi === undefined) return undefined;
    let body = f;
    if (f.operator === "Function") {
      const [inner, ...params] = operandsOf(f);
      if (inner === undefined || params.length !== 1 || symbolNameOf(params[0]!) !== variable) return undefined;
      body = inner;
    }
    const r = semiInfinite(body, variable, lo.N().re, hi.N().re);
    return typeof r === "object" ? ce.box(["Measurement", r.estimate, r.error]) : r;
  });
  // NIntegrate is numeric on every route.
  attach(
    ce,
    "NIntegrate",
    (ops) => {
      const [fn, lo, hi] = ops;
      if (fn?.operator !== "Function" || lo === undefined || hi === undefined) return undefined;
      const [body, ...params] = operandsOf(fn);
      const variable = params[0] && symbolNameOf(params[0]);
      if (body === undefined || variable == null || params.length !== 1) return undefined;
      const r = semiInfinite(body, variable, lo.N().re, hi.N().re);
      return typeof r === "object" ? ce.number(r.estimate) : r;
    },
    true,
  );
}
