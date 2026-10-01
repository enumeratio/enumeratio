import { type BoxedExpression, ComputeEngine, isDictionary, isSymbol } from "@cortex-js/compute-engine";

// cortex-js/compute-engine: a definition accepts `examples` and `keywords`, and `About`
// (`library/core.ts`) reports neither: `_BoxedOperatorDefinition` drops `examples` when it
// boxes the definition, and keeps `keywords` without reading them back. `About` also gives a
// function's algebraic flags as one space-joined string (`"commutative associative"`), not a
// list, and says nothing of `lazy`: `About(Hold)` reads like any other function, though its
// argument reaches it unevaluated. Fixed here by adding `examples`, `keywords` and an
// `attributes` list (the flags, then `lazy`) to `About`'s dictionary for a declared name. `lazy`
// is the flag's own name, not Wolfram's HoldAll: `Add` is lazy too, and evaluates its arguments
// itself.
//
// Upstream this is the boxed definitions keeping `examples` and `About` reading them; here the
// examples come from the standard library's definitions, and from each `declare` made after
// the patch is applied.

const FLAGS = ["commutative", "associative", "idempotent", "involution"] as const;

interface Documented {
  readonly examples?: string | readonly string[];
  readonly keywords?: readonly string[];
}

let standard: ReadonlyMap<string, readonly string[]> | undefined;

/** Each standard-library head's examples, by name. */
function standardExamples(): ReadonlyMap<string, readonly string[]> {
  if (standard !== undefined) return standard;
  const found = new Map<string, readonly string[]>();
  for (const library of ComputeEngine.getStandardLibrary("all")) {
    const tables = (Array.isArray(library.definitions) ? library.definitions : [library.definitions]) as readonly (
      | Readonly<Record<string, Documented>>
      | undefined
    )[];
    for (const table of tables)
      for (const [name, definition] of Object.entries(table ?? {}))
        if (definition.examples !== undefined) found.set(name, listOf(definition.examples));
  }
  return (standard = found);
}

const listOf = (examples: string | readonly string[]): readonly string[] =>
  typeof examples === "string" ? [examples] : examples;

const declaredExamples = new WeakMap<ComputeEngine, Map<string, readonly string[]>>();

/** Record the examples of each definition `ce.declare` is given from now on. */
function captureDeclaredExamples(ce: ComputeEngine): Map<string, readonly string[]> {
  const existing = declaredExamples.get(ce);
  if (existing !== undefined) return existing;
  const captured = new Map<string, readonly string[]>();
  declaredExamples.set(ce, captured);
  const declare = ce.declare.bind(ce) as (...args: unknown[]) => unknown;
  const note = (name: string, definition: unknown): void => {
    if (definition === null || typeof definition !== "object") return;
    const { examples } = definition as Documented;
    if (examples === undefined) captured.delete(name);
    else captured.set(name, listOf(examples));
  };
  (ce as unknown as { declare: (...args: unknown[]) => unknown }).declare = (...args: unknown[]) => {
    const [first, second] = args;
    if (typeof first === "string") note(first, second);
    else if (first !== null && typeof first === "object")
      for (const [name, definition] of Object.entries(first)) note(name, definition);
    return declare(...args);
  };
  return captured;
}

/** What `About` adds for `name`: its examples, keywords, and attributes as a list. */
function documentedFields(
  ce: ComputeEngine,
  name: string,
  captured: ReadonlyMap<string, readonly string[]>,
): [string, BoxedExpression][] {
  const definition = ce.lookupDefinition(name) as
    | {
        operator?: { keywords?: readonly string[]; lazy?: boolean } & Partial<Record<(typeof FLAGS)[number], boolean>>;
        value?: { keywords?: readonly string[] };
      }
    | undefined;
  if (definition === undefined) return [];
  const strings = (list: readonly string[]): BoxedExpression =>
    ce.function(
      "List",
      list.map((s) => ce.string(s)),
    );
  const fields: [string, BoxedExpression][] = [];
  const examples = captured.get(name) ?? standardExamples().get(name);
  if (examples?.length) fields.push(["examples", strings(examples)]);
  const keywords = definition.operator?.keywords ?? definition.value?.keywords;
  if (keywords?.length) fields.push(["keywords", strings(keywords)]);
  const op = definition.operator;
  if (op !== undefined) {
    const attributes: string[] = FLAGS.filter((flag) => op[flag] === true);
    if (op.lazy === true) attributes.push("lazy");
    if (attributes.length > 0) fields.push(["attributes", strings(attributes)]);
  }
  return fields;
}

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

/** `About` with `examples`, `keywords` and an `attributes` list for a declared name. */
export function evaluateAboutFields(ce: ComputeEngine): void {
  const captured = captureDeclaredExamples(ce);
  const definition = ce.lookupDefinition("About") as
    | { operator?: { evaluate?: (ops: readonly BoxedExpression[], options: unknown) => BoxedExpression | undefined } }
    | undefined;
  const operator = definition?.operator;
  const native = operator?.evaluate;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = (ops, options) => {
    const result = native(ops, options);
    const [x] = ops;
    if (result === undefined || ops.length !== 1 || x === undefined || !isSymbol(x)) return result;
    const name = x.symbol;
    const added = documentedFields(ce, name, captured);
    if (added.length === 0) return result;
    const replaced = new Set(added.map(([key]) => key));
    return dictionaryOf(ce, [...entriesOf(result).filter(([key]) => !replaced.has(key)), ...added]);
  };
}
