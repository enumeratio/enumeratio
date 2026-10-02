import {
  type BoxedExpression,
  type ComputeEngine,
  isDictionary,
  isFunction,
  isSymbol,
} from "@cortex-js/compute-engine";

/** `About`'s entries, in order, from the dictionary it evaluated to. */
export function entriesOf(dictionary: BoxedExpression): [string, BoxedExpression][] {
  if (!isDictionary(dictionary)) return [];
  return [...dictionary.keys].flatMap((key) => {
    const value = dictionary.get(key);
    return value === undefined ? [] : [[key, value] as [string, BoxedExpression]];
  });
}

/** A dictionary of `entries`, evaluated as `About` assembles its own. */
export const dictionaryOf = (ce: ComputeEngine, entries: readonly [string, BoxedExpression][]): BoxedExpression =>
  ce
    .function(
      "Dictionary",
      entries.map(([key, value]) => ce.function("KeyValuePair", [ce.string(key), value])),
    )
    .evaluate();

// cortex-js/compute-engine: Epsil reads `f(x) := x^2 + a` as `Assign(f(x), x^2 + a)`, with the
// application itself on the left, where the LaTeX reader turns `f(x)\coloneq x^2+a` into
// `Assign(f, Function(Block(x^2 + a), x))`. `Assign` only binds a symbol, so the Epsil form
// stays as written and `f` is never defined. Fixed here by canonicalizing an application of
// distinct symbols on the left of `Assign` to the function definition the LaTeX route builds,
// so both readers give the same expression.
//
// Upstream this is the `Assign` definition's `canonical` in `library/core.ts` (or the Epsil
// parser building the `Function` form directly).

type Canonical = (ops: readonly BoxedExpression[], options: { engine: ComputeEngine }) => BoxedExpression | null;

/** `Assign(f(x, y), body)` as `Assign(f, Function(Block(body), x, y))`: a function definition. */
export function canonicalAssignFunctionDefinition(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Assign") as { operator?: { canonical?: Canonical } } | undefined;
  const operator = definition?.operator;
  const native = operator?.canonical;
  if (operator === undefined || native === undefined) return;
  operator.canonical = (ops, options) => {
    const [target, body] = ops;
    if (ops.length !== 2 || body === undefined || target === undefined || !isFunction(target))
      return native(ops, options);
    const params = target.ops;
    const distinct = new Set(params.map((p) => (isSymbol(p) ? p.symbol : undefined)));
    if (params.length === 0 || distinct.has(undefined) || distinct.size !== params.length) return native(ops, options);
    const lambda = ce.function("Function", [ce.function("Block", [body], { form: "raw" }), ...params], { form: "raw" });
    return native([ce.symbol(target.operator), lambda], options);
  };
}
