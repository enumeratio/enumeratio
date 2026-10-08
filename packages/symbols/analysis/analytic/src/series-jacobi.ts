import { bigRationalAt, type Engine, type Expr, extendHead, operandsOf, symbolNameOf } from "@enumeratio/engine";
import type { EvalOptions, Json } from "@enumeratio/ce-patches";
import { JACOBI_POLE_HEADS, MAX_LAURENT_ORDER, jacobiLaurent } from "./jacobi-laurent.ts";
import { JACOBI_M_SERIES_HEADS, MAX_ORDER, jacobiMCoefficients } from "./jacobi-m-series.ts";

// Series of a Jacobi function in its parameter, `Series(JacobiCN(u, m), m, 0, n)`, with u free of
// m. compute-engine's Taylor fallback differentiates at m = 0, where the closed forms for ∂ₘ are
// 0/0, so it leaves Derivative terms; the coefficients come from jacobi-m-series.ts instead.
// The Laurent series in u of ns, cs and ds at u = 0 (a pole, where the Taylor fallback holds the
// call) come from jacobi-laurent.ts.

const DEFAULT_ORDER = 5;
const HEADS = new Set([...JACOBI_M_SERIES_HEADS, ...JACOBI_POLE_HEADS]);

/** `Series(ns/cs/ds(u, m), u, 0, n)` for m free of u, or undefined when the call is not that. */
function poleSeries(
  ce: Engine,
  head: string,
  variable: string,
  x: Expr,
  u: Expr,
  m: Expr,
  extra: number,
  x0: Expr,
  order: Expr | undefined,
): Expr | undefined {
  if (extra > 0 || symbolNameOf(u) !== variable || m.symbols.includes(variable) || x0.N().re !== 0) return undefined;
  const n = order === undefined ? DEFAULT_ORDER : Math.floor(order.N().re);
  const terms = jacobiLaurent(head, n, m.json as Json);
  if (terms === undefined || !(n <= MAX_LAURENT_ORDER)) return undefined;
  const summands = terms.map(([exponent, coefficient]) => {
    const c = ce.box(coefficient as never);
    if (exponent === 0) return c;
    return ce.function("Multiply", [c, ce.function("Power", [x, ce.number(exponent)])]);
  });
  return ce.function("Add", [...summands, ce.function("BigO", [ce.function("Power", [x, ce.number(n + 1)])])]);
}

export function declareSeriesJacobi(ce: Engine): void {
  const native = ce.lookupDefinition("Series");
  if (native === undefined || !("operator" in native)) return;
  const before = native.operator.evaluate;
  extendHead(ce, "Series", {
    evaluate: (ops: readonly Expr[], options: EvalOptions) => {
      const [f, x, x0, order] = ops;
      const head = f?.operator;
      if (head === undefined || !HEADS.has(head) || x === undefined || x0 === undefined) {
        return before?.(ops, options);
      }
      if (options.numericApproximation) return before?.(ops, options);
      const variable = symbolNameOf(x);
      const [u, m, ...extra] = operandsOf(f);
      if (JACOBI_POLE_HEADS.includes(head) && variable !== undefined && u !== undefined && m !== undefined) {
        const laurent = poleSeries(ce, head, variable, x, u, m, extra.length, x0, order);
        if (laurent !== undefined) return laurent;
      }
      const claimed =
        variable !== undefined &&
        extra.length === 0 &&
        u !== undefined &&
        m !== undefined &&
        symbolNameOf(m) === variable &&
        !u.symbols.includes(variable) &&
        x0.N().re === 0;
      if (!claimed) return before?.(ops, options);
      const n = order === undefined ? DEFAULT_ORDER : Math.floor(order.N().re);
      if (!(n >= 0) || n > MAX_ORDER) return before?.(ops, options);

      // A numeric u that zeroes cos or sin makes the quotient heads poles at m = 0: not a power series.
      const vanishes = (denominator: Json): boolean => {
        const value = ce.box(denominator as never).N();
        return u.unknowns.length === 0 && Math.abs(value.re) < 1e-12 && Math.abs(value.im) < 1e-12;
      };
      const coefficients = jacobiMCoefficients(head, n, u.json as Json, vanishes, bigRationalAt(u));
      if (coefficients === undefined) return before?.(ops, options);
      const terms = coefficients.flatMap((coefficient, k): Expr[] => {
        if (coefficient === 0) return [];
        const c = ce.box(coefficient as never);
        return [k === 0 ? c : ce.function("Multiply", [c, k === 1 ? x : ce.function("Power", [x, ce.number(k)])])];
      });
      return ce.function("Add", [...terms, ce.function("BigO", [ce.function("Power", [x, ce.number(n + 1)])])]);
    },
  });
}
