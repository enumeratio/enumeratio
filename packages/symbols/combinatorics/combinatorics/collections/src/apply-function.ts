import { type Engine, type Expr, operandsOf, symbolNameOf } from "@enumeratio/engine";

const SLOT = /^_(\d+)$/;

/** The slot parameters a body uses, as in `Function(Sow(_2))` (which uses `_2`). */
function slotsIn(expr: Expr, found: Set<string> = new Set()): Set<string> {
  const name = symbolNameOf(expr);
  if (name !== undefined && SLOT.test(name)) found.add(name);
  for (const operand of operandsOf(expr)) slotsIn(operand, found);
  return found;
}

/** The argument each parameter of a `Function` literal binds, or `undefined` when the
 *  parameters can't be matched to `args`. Slot parameters (`_1`, `_2`, …) bind by number,
 *  whether listed or only used in the body; named ones bind by position. */
function bindings(body: Expr, params: readonly Expr[], args: readonly Expr[]): Record<string, Expr> | undefined {
  const names = params.length > 0 ? params.map(symbolNameOf) : [...slotsIn(body)];
  if (names.some((name) => name === undefined)) return undefined;
  if (names.every((name) => SLOT.test(name!))) {
    const slots = names.map((name) => Number(SLOT.exec(name!)![1]));
    return slots.every((slot) => slot >= 1 && slot <= args.length)
      ? Object.fromEntries(names.map((name, i) => [name!, args[slots[i]! - 1]!]))
      : undefined;
  }
  return names.length === args.length ? Object.fromEntries(names.map((name, i) => [name!, args[i]!])) : undefined;
}

/**
 * Call `f` (a `Function` literal, a head, or any callable expression) on `args`.
 *
 * A `Function` literal binds its parameters directly. compute-engine's own call maps a lambda
 * over a list argument its body doesn't visibly consume whole, which Wolfram's `Function`
 * never does, and shows an operator in the body (`D(_1, x)`, say) only the bare parameter.
 */
export function applyFunction(ce: Engine, f: Expr, args: readonly Expr[]): Expr {
  const [body, ...params] = f.operator === "Function" ? operandsOf(f) : [];
  const bound = body === undefined ? undefined : bindings(body, params, args);
  if (body !== undefined && bound !== undefined) return body.subs(bound).evaluate();
  return ce.box([f, ...args] as never).evaluate();
}
