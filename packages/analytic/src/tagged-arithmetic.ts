import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";

// A shared, low-overhead registration for the arithmetic heads Interval, CenteredInterval
// and Around all extend (Add, Negate, Multiply, Divide, Power, Abs, Sin, plus Sqrt/Erf for
// Around alone) — see interval.ts, centered-interval.ts and around.ts for the actual math.
//
// Deliberately NOT `wrapOperator` (@enumeratio/boxed): that helper re-evaluates every lazy
// operand just to run its predicate, and a separate `wrapOperator` call per tagged type per
// head (three, for Add) means three redundant evaluate passes over every operand stacked on
// top of the real one — a measured ~4x slowdown on Add/Multiply-heavy code (large sums,
// the statistics/domains exhaustive suites) even when nothing tagged is anywhere near the
// expression. Registering once per head here means the untagged path (the overwhelming
// majority of calls) costs one `.operator` read per operand and calls the native handler
// exactly once, on the original operands — no evaluate, no re-boxing, no `.json`.

const TAGS: ReadonlySet<string> = new Set(["Interval", "CenteredInterval", "Around"]);

/**
 * Does `op` structurally carry one of our tagged types, without evaluating anything? Checks
 * `op`'s own operator, and — since `Subtract(a, b)` canonicalizes to `Add(a, Negate(b))`
 * before any hook sees a `Subtract` head (see interval.ts) — one level through a bare
 * `Negate`, which is the only wrapper any of our examples put around a tagged value.
 */
function isTaggedOperand(op: BoxedExpression): boolean {
  const name = op.operator;
  if (name === undefined) return false;
  if (TAGS.has(name)) return true;
  if (name === "Negate") {
    const inner = operandsOf(op)[0];
    return inner !== undefined && TAGS.has(inner.operator ?? "");
  }
  return false;
}

/** O(n), allocation-free: bails out on the first tagged operand. */
function hasTaggedOperand(ops: readonly BoxedExpression[]): boolean {
  for (const op of ops) if (isTaggedOperand(op)) return true;
  return false;
}

/** One head's handling of already-evaluated operands; `undefined` means "not mine". */
export type Resolver = (ops: readonly BoxedExpression[]) => BoxedExpression | undefined;

/**
 * Register a single evaluate hook for `head` that tries each resolver in turn once an
 * operand is structurally tagged, and otherwise defers to the native handler untouched.
 */
export function registerTaggedHead(
  ce: ComputeEngine,
  head: string,
  resolvers: readonly Resolver[],
): void {
  if (resolvers.length === 0) return;
  const definition = ce.lookupDefinition(head);
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return;
  const native = operator.evaluate;
  operator.evaluate = (ops, options) => {
    if (!hasTaggedOperand(ops)) return native?.(ops, options);
    const values = ops.map((op) => op.evaluate());
    for (const resolve of resolvers) {
      const result = resolve(values);
      if (result !== undefined) return result;
    }
    return native?.(ops, options);
  };
}

/** Merge several `{head: Resolver}` maps and register each head once, in the order given —
 * the order resolvers are tried when more than one map handles the same head. */
export function registerTaggedHeads(
  ce: ComputeEngine,
  heads: readonly string[],
  ...resolverMaps: readonly Readonly<Record<string, Resolver | undefined>>[]
): void {
  for (const head of heads) {
    const resolvers = resolverMaps
      .map((map) => map[head])
      .filter((r): r is Resolver => r !== undefined);
    registerTaggedHead(ce, head, resolvers);
  }
}
