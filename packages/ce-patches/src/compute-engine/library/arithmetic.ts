import { type BoxedExpression, type ComputeEngine, isFunction, isNumber } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/engine";

/**
 * `Power(8, 1/3)` evaluates to `Root(8, 3)`, not 2. `pow()` starts from `canonicalPower`, and for a
 * unit-fraction exponent that is a `Root`, which only folds when evaluated (an integer radicand's
 * `Root` stays symbolic at canonicalization on purpose). The handler returns it as it is, so a
 * `Power` built without that canonical step (the elements an exponent list threads over) stops at
 * the `Root`, where the boxed scalar (canonicalized to `Root`, then evaluated) reaches -2.
 *
 * Over numbers, whatever `canonicalPower` rewrote the call into is evaluated once more, so
 * `evaluate` is idempotent: `Power(-8, [1/3, 5])` is `[-2, -32768]`.
 */
export function evaluateRootsOfNumbers(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Power"],
    (ops) => ops.length === 2 && ops.every((op) => isNumber(op)),
    (native) => (ops, options) => {
      const value = native?.(ops, options);
      // A numeric request already folded; `Power` itself is a result that did not change form.
      if (options.numericApproximation || value === undefined || !isFunction(value) || value.operator === "Power")
        return value;
      return value.evaluate();
    },
    { arity: 2, compile: "builtin" },
  );
}

const isNegativeInfinity = (op: BoxedExpression | undefined): boolean =>
  op !== undefined && isNumber(op) && op.re === -Infinity && op.im === 0;

/**
 * `Ln(-oo)` stays unevaluated (and `N` answers `oo + pi i`). Wolfram, Sage and SymPy take the
 * real part: ln(-x) = ln(x) + i pi, and the magnitude alone diverges, so the value is `+oo`.
 * `Log(-oo)` and `Log(-oo, b)` at a real base b > 1 are the same quotient by ln b > 0.
 */
export function evaluateLnOfNegativeInfinity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Ln"],
    (ops) => isNegativeInfinity(ops[0]),
    () => () => ce.PositiveInfinity,
    {
      arity: 1,
      compile: "builtin",
    },
  );
  wrapOperator(
    ce,
    ["Log"],
    ([x, base]) =>
      isNegativeInfinity(x) &&
      (base === undefined || (isNumber(base) && base.im === 0 && Number.isFinite(base.re) && base.re > 1)),
    () => () => ce.PositiveInfinity,
    { arity: { min: 1, max: 2 }, compile: "builtin" },
  );
}
