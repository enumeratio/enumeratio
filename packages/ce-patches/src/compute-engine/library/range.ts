import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/engine";

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;

// cortex-js/compute-engine: `Range`'s `count` is exact since 0.149, but its `iterator` and `at` still
// step through doubles, so a bound past 2^53 rounds: `Range(2^225, 2^225 + 5)` materialises as
// six copies of the float 5.39e67. Wolfram's `Range` is exact on integers of any size. Fixed
// here by stepping in bigints when every operand is an exact integer and one is past the
// safe-integer range; any other range keeps the native handlers. `at` takes a double index.

type Bounds = readonly [lower: bigint, upper: bigint, step: bigint];

/** An operand's exact integer value, evaluating a closed compound bound (`2^225`) first. */
function exactInteger(op: BoxedExpression): bigint | undefined {
  const value = isNumber(op) ? op : op.symbols.length === 0 ? op.evaluate() : undefined;
  return bigIntegerAt(value);
}

/** `[lower, upper, step]` of a `Range` whose operands are all exact integers, at least one past
 * the safe-integer range; `undefined` for any range the native handlers already get right. */
function bigBounds(expr: BoxedExpression): Bounds | undefined {
  const ops = operandsOf(expr);
  if (ops.length === 0 || ops.length > 3) return undefined;
  const values = ops.map(exactInteger);
  if (values.some((v) => v === undefined)) return undefined;
  const [first, second, third] = values as bigint[];
  const bounds: Bounds =
    ops.length === 1
      ? [1n, first!, 1n]
      : ops.length === 2
        ? [first!, second!, second! >= first! ? 1n : -1n]
        : [first!, second!, third!];
  const past = (v: bigint): boolean => v > BigInt(Number.MAX_SAFE_INTEGER) || v < -BigInt(Number.MAX_SAFE_INTEGER);
  return bounds.some(past) ? bounds : undefined;
}

/** Elements of `lower, lower + step, ...` that stop at or before `upper` (after, for a negative
 * step); a zero step has none, as natively. */
function bigCount([lower, upper, step]: Bounds): bigint {
  if (step === 0n) return 0n;
  const span = upper - lower;
  return span === 0n || span < 0n === step < 0n ? span / step + 1n : 0n;
}

/** Patch `Range`'s `iterator` and `at` to be exact on integer bounds past 2^53. */
export function evaluateRangeBigBounds(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Range");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const collection = operator?.collection as OperatorDefinition["collection"];
  if (collection === undefined) return;
  const { iterator: nativeIterator, at: nativeAt } = collection;

  collection.iterator = (expr) => {
    const bounds = bigBounds(expr);
    if (bounds === undefined) return nativeIterator?.(expr);
    const [lower, , step] = bounds;
    const count = bigCount(bounds);
    let index = 0n;
    return {
      next: () => {
        if (index >= count) return { value: undefined, done: true };
        const value = ce.number(lower + step * index);
        index += 1n;
        return { value, done: false };
      },
    };
  };

  collection.at = (expr, index) => {
    const bounds = bigBounds(expr);
    if (bounds === undefined || typeof index !== "number" || !Number.isSafeInteger(index)) {
      return nativeAt?.(expr, index as never);
    }
    const [lower, , step] = bounds;
    return index < 1 || BigInt(index) > bigCount(bounds) ? undefined : ce.number(lower + step * BigInt(index - 1));
  };
}
