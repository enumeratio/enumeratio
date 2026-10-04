import type { Engine, Expr } from "./facade.ts";

type Definition = NonNullable<ReturnType<Engine["lookupDefinition"]>>;
type Operator = Extract<Definition, { operator: unknown }>["operator"];

/**
 * Does the engine already define `name`, as it stands now? The "never redeclare" probe: a
 * head compute-engine ships, or one a package declared earlier, answers true. Any kind of
 * definition counts, operator or value, so a probe can't miss a symbol and clobber it.
 */
export const isNativeHead = (ce: Engine, name: string): boolean => ce.lookupDefinition(name) !== undefined;

/**
 * The `evaluate` handler the engine currently holds for the operator `name`, to call as a
 * fallback from a replacement; `undefined` when `name` has no operator definition or no handler.
 * Capture before attaching one of your own, so layered packages chain in declaration order.
 */
export const nativeEvaluate = (ce: Engine, name: string): Operator["evaluate"] => {
  const definition = ce.lookupDefinition(name);
  return definition !== undefined && "operator" in definition ? definition.operator.evaluate : undefined;
};

/**
 * Run `fn` with `assumptions` assumed, in a scope of its own that is dropped afterwards,
 * whether `fn` returns or throws. Safe inside another evaluation, unlike `ce.checkpoint()`.
 */
export function withAssumptions<T>(ce: Engine, assumptions: readonly Expr[], fn: () => T): T {
  ce.pushScope();
  try {
    for (const assumption of assumptions) ce.assume(assumption);
    return fn();
  } finally {
    ce.popScope();
  }
}
