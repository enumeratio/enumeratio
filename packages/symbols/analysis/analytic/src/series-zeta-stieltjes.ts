import { type Engine, type Expr, extendHead, operandsOf, symbolNameOf } from "@enumeratio/engine";
import type { EvalOptions } from "@enumeratio/ce-patches";

// ζ(s) = 1/(s−1) + Σ_{k≥0} (−1)^k γ_k (s−1)^k / k!. compute-engine's `Series` knows the residue
// and γ_0 = EulerGamma and stops there (the higher γ_k are not in its pole table), so the
// expansion at 1 ends in O(s−1) (https://github.com/cortex-js/compute-engine/issues/421).
// This continues it with the StieltjesGamma terms, reusing the native result's own (s−1) and
// remainder so the variable binding is the one it already carries.
// Self-disabling: once the native result reaches past the constant, the remainder is no longer
// O(s−1) and the result passes through.

const DEFAULT_ORDER = 5;

/** The base u of a remainder `BigO(u)` (that is, `BigO(u^1)`); undefined for any higher power. */
const linearRemainder = (bigO: Expr): Expr | undefined => {
  const [inner] = operandsOf(bigO);
  return inner !== undefined && inner.operator !== "Power" ? inner : undefined;
};

export function declareSeriesZetaStieltjes(ce: Engine): void {
  const native = ce.lookupDefinition("Series");
  if (native === undefined || !("operator" in native)) return;
  const before = native.operator.evaluate;
  extendHead(ce, "Series", {
    evaluate: (ops: readonly Expr[], options: EvalOptions) => {
      const result = before?.(ops, options);
      const [f, x, x0, order] = ops;
      if (result === undefined || options.numericApproximation || result.operator !== "Add") return result;
      if (f?.operator !== "Zeta" || x === undefined || x0?.N().re !== 1) return result;
      const [arg, ...extra] = operandsOf(f);
      const variable = symbolNameOf(x);
      if (variable === undefined || extra.length > 0 || arg === undefined || symbolNameOf(arg) !== variable)
        return result;
      const n = order === undefined ? DEFAULT_ORDER : Math.floor(order.N().re);
      if (!(n >= 1)) return result;

      const terms = operandsOf(result);
      const bigO = terms.find((t) => t.operator === "BigO");
      const u = bigO === undefined ? undefined : linearRemainder(bigO);
      if (u === undefined) return result;

      let factorial = 1n;
      const stieltjes: Expr[] = [];
      for (let k = 1; k <= n; k++) {
        factorial *= BigInt(k);
        stieltjes.push(
          ce.function("Multiply", [
            ce.function("Divide", [ce.number(k % 2 === 0 ? 1 : -1), ce.number(factorial)]).evaluate(),
            ce.function("StieltjesGamma", [ce.number(k)]),
            ce.function("Power", [u, ce.number(k)]),
          ]),
        );
      }
      const remainder = ce.function("BigO", [ce.function("Power", [u, ce.number(n + 1)])]);
      return ce.function("Add", [...terms.filter((t) => t !== bigO), ...stieltjes, remainder]);
    },
  });
}
