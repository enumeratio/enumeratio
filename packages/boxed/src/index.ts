import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

// Reading values back out of compute-engine expressions.
//
// `.ops`, `.symbol` and `.string` live on compute-engine's NARROWED expression
// interfaces (FunctionInterface / SymbolInterface / StringInterface). `BoxedExpression`
// is an alias for the `Expression` union, and 0.128 documents `isFunction()` /
// `isSymbol()` / `isString()` predicates it does not actually ship, so there is no
// typed route from the union to any of them. Read each through one checked accessor
// instead of casting at every use.

/** An expression's operands, or `[]` if it has none. */
export const operandsOf = (expr: BoxedExpression | undefined): readonly BoxedExpression[] => {
  const ops = (expr as { ops?: unknown } | undefined)?.ops;
  return Array.isArray(ops) ? (ops as readonly BoxedExpression[]) : [];
};

/** The symbol an expression names, or `undefined` if it is not a symbol. */
export const symbolNameOf = (expr: BoxedExpression): string | undefined => {
  const name = (expr as { symbol?: unknown }).symbol;
  return typeof name === "string" ? name : undefined;
};

/**
 * The integer an expression denotes, or `undefined` if it is not one.
 *
 * Deliberately strict: a real integer in the safe range, nothing else. Rejecting
 * non-integers rather than truncating them matters on the membership path, where a
 * truncated `1.5` would read as the perfectly valid element `1`.
 */
export const integerAt = (expr: BoxedExpression | undefined): number | undefined =>
  expr !== undefined && expr.im === 0 && Number.isSafeInteger(expr.re) ? expr.re : undefined;

/**
 * The integer an expression denotes, exactly, as a `bigint` — unlike `integerAt`, not
 * capped at the safe-integer range. A machine-range integer's `.numericValue` is a plain
 * `number`; anything past that range is an `ExactNumericValue` whose `.rational` is
 * `[bigint, 1n]` (denominator 1, since it's an integer). Both lanes land here so a caller
 * never has to reach for `.re`, which silently loses precision past 2^53.
 */
export const bigIntegerAt = (expr: BoxedExpression | undefined): bigint | undefined => {
  if (expr === undefined || expr.im !== 0 || expr.isInteger !== true) return undefined;
  const value = (expr as { numericValue?: unknown }).numericValue;
  if (typeof value === "number") return Number.isInteger(value) ? BigInt(value) : undefined;
  const rational = (value as { rational?: unknown } | undefined)?.rational;
  if (!Array.isArray(rational) || rational.length !== 2) return undefined;
  const [num, den] = rational as unknown[];
  if (typeof num !== "number" && typeof num !== "bigint") return undefined;
  return den === 1 || den === 1n ? BigInt(num) : undefined;
};

const unquote = (text: string): string =>
  text.replace(/^'(.*)'$/s, "$1").replace(/^"(.*)"$/s, "$1");

/** The string an expression denotes — bare, `["String", …]`-wrapped, or quoted JSON. */
export const stringAt = (expr: BoxedExpression | undefined): string | undefined => {
  if (expr === undefined) return undefined;
  const direct = (expr as { string?: unknown }).string;
  if (typeof direct === "string") return unquote(direct);
  if (expr.operator === "String") {
    const inner = operandsOf(expr)[0];
    const innerString = (inner as { string?: unknown } | undefined)?.string;
    if (typeof innerString === "string") return unquote(innerString);
    if (typeof inner?.json === "string") return unquote(inner.json);
  }
  return typeof expr.json === "string" ? unquote(expr.json) : undefined;
};

/**
 * The exact rational an expression denotes, as `[numerator, denominator]` bigints with
 * `denominator > 0`, or `undefined` if it is not one. Integers come back over 1. Same two
 * lanes as `bigIntegerAt`: a machine-range integer is a plain `number`, everything else
 * is an `ExactNumericValue` carrying `.rational`.
 */
export const bigRationalAt = (
  expr: BoxedExpression | undefined,
): readonly [bigint, bigint] | undefined => {
  if (expr === undefined || expr.im !== 0 || expr.isRational !== true) return undefined;
  const value = (expr as { numericValue?: unknown }).numericValue;
  if (typeof value === "number") return Number.isInteger(value) ? [BigInt(value), 1n] : undefined;
  const rational = (value as { rational?: unknown } | undefined)?.rational;
  if (!Array.isArray(rational) || rational.length !== 2) return undefined;
  const [num, den] = rational as unknown[];
  const ok = (x: unknown): x is number | bigint => typeof x === "number" || typeof x === "bigint";
  if (!ok(num) || !ok(den)) return undefined;
  const d = BigInt(den);
  return d === 0n ? undefined : d < 0n ? [-BigInt(num), -d] : [BigInt(num), d];
};

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;
export type NativeEvaluate = OperatorDefinition["evaluate"];
export type EvaluateOptions = Parameters<NonNullable<NativeEvaluate>>[1];
export type EvaluateHandler = (
  ops: readonly BoxedExpression[],
  options: EvaluateOptions,
) => BoxedExpression | undefined;

/**
 * Attach to an operator the engine already defines so that `handler` answers whenever
 * `applies(ops)` holds, and the handler that was there before answers otherwise.
 *
 * Attached IN PLACE rather than re-declared: `ce.declare` on a built-in head throws once
 * a second library tries it ("already declared in this scope"), and replacing the whole
 * definition means re-supplying every flag and handler it carried — `type`, which keeps
 * `Add` returning `number`; `lazy`, which `Subtract` needs to canonicalise at all. The
 * definition object is per engine, so attaching does not leak across instances.
 *
 * A lazy head (`Add`, `Multiply`) hands its handler the operands as written; `applies`
 * and `handler` get them evaluated so they see values, while the native fallback gets
 * what it expected. Layering is by capture: each attach takes whatever `evaluate` is
 * current as its fallback, so libraries chain in declaration order.
 */
export function wrapOperator(
  ce: ComputeEngine,
  probe: readonly [string, ...unknown[]],
  applies: (ops: readonly BoxedExpression[]) => boolean,
  build: (native: NativeEvaluate) => EvaluateHandler,
): void {
  const definition = ce.lookupDefinition(probe[0]);
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native = operator.evaluate;
  const handler = build(native);
  const lazy = operator.lazy === true;
  operator.evaluate = (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
    const values = lazy ? ops.map((op) => op.evaluate()) : ops;
    return applies(values) ? handler(values, options) : native?.(ops, options);
  };
}

export { isOptionList, optionName, optionsOf, ruleOf, type Split, withOptions } from "./options.ts";

/**
 * Widen the signature of an operator the engine already defines, in place, so arguments its
 * native declaration would reject at boxing reach `evaluate` — where a `wrapOperator` handler
 * can answer them and hand everything else to the native one. Re-declaring the head instead
 * would drop the rest of its definition.
 *
 * The native handler trusted boxing to have checked its operands; `nativeAccepts` restores
 * that gate for it (a call it rejects stays unevaluated). Wrap after widening, so the
 * wrappers fall through to the gated handler.
 */
export function widenSignature(
  ce: ComputeEngine,
  name: string,
  signature: string,
  nativeAccepts?: (op: BoxedExpression) => boolean,
): void {
  const definition = ce.lookupDefinition(name);
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  (operator as { signature: unknown }).signature = ce.type(signature);
  const native = operator.evaluate;
  if (nativeAccepts === undefined || native === undefined) return;
  operator.evaluate = (ops: readonly BoxedExpression[], options: EvaluateOptions) =>
    ops.every(nativeAccepts) ? native(ops, options) : undefined;
}

/** A `widenSignature` gate for heads natively typed `integer`: anything not provably non-integer. */
export const mayBeInteger = (op: BoxedExpression): boolean => op.isInteger !== false;
