// `About(name)`: compute-engine's dictionary, widened with what the manifest knows (`describe`,
// @enumeratio/manifest), so a head the engine hasn't declared yet, or a library's `ns.Name`,
// is described as well as a declared one.
//
// A name is given as a symbol (`About(Zeta)`) or a field chain (`About(ada.Sq)`). A string is a
// value, as compute-engine has it: `About("Sin")` describes the string.

import { type BoxedExpression, type ComputeEngine, isFunction, isString, isSymbol } from "@cortex-js/compute-engine";
import { dictionaryOf, entriesOf } from "@enumeratio/ce-patches";
import { describe, describeNow } from "@enumeratio/manifest";

/** `describe`'s keys `About` doesn't carry: the example count (compute-engine's `examples` are
 *  the definition's own, a list) and the kind, which compute-engine settles for a declared name. */
const NOT_CARRIED = new Set(["examples", "kind", "name"]);

/** The name `x` gives: a symbol, or `a.b` for `Field(a, "b")`. */
export function nameGiven(x: BoxedExpression | undefined): string | undefined {
  if (x === undefined) return undefined;
  if (isSymbol(x)) return x.symbol;
  if (!isFunction(x) || x.operator !== "Field" || x.nops !== 2) return undefined;
  const [base, member] = x.ops;
  const prefix = nameGiven(base);
  return prefix === undefined || member === undefined || !isString(member) ? undefined : `${prefix}.${member.string}`;
}

const listOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(" ").filter(Boolean) : [];

/**
 * What `About` says of `name`: compute-engine's entries (`native`, as JSON), then ours. For a
 * name the engine has declared, its keys stand and ours are added; for one it hasn't, the
 * description is the manifest's (or the registry's), so its kind and signature are the ones it
 * will have once declared.
 */
export function aboutOf(
  ce: ComputeEngine,
  name: string,
  native: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const described = describeNow(name, ce);
  // Boxing `About(Fooble)` declares `Fooble` as a symbol of unknown type: that isn't declared.
  const declared = !name.includes(".") && !(native.kind === "symbol" && native.type === "unknown");
  if (described.kind === "unknown") return { ...native, name };
  const base: Record<string, unknown> = declared ? { ...native } : { name, kind: described.kind };
  for (const [key, value] of Object.entries(described))
    if (!NOT_CARRIED.has(key) && value !== undefined && !(key in base)) base[key] = value;
  const attributes = [...new Set([...listOf(native.attributes), ...(described.attributes ?? [])])];
  if (attributes.length > 0) base.attributes = attributes;
  return base;
}

/** A JSON value as an expression: strings as strings, lists as lists, records as dictionaries. */
function boxed(ce: ComputeEngine, value: unknown): BoxedExpression {
  if (typeof value === "string") return ce.string(value);
  if (typeof value === "number") return ce.number(value);
  if (typeof value === "boolean") return ce.symbol(value ? "True" : "False");
  if (Array.isArray(value))
    return ce.function(
      "List",
      value.map((v) => boxed(ce, v)),
    );
  if (value !== null && typeof value === "object")
    return dictionaryOf(
      ce,
      Object.entries(value).map(([k, v]) => [k, boxed(ce, v)]),
    );
  return ce.symbol("Nothing");
}

/** An entry's value as plain JSON: a string as itself (not MathJSON's `'quoted'`), a list as an array. */
const plainOf = (value: BoxedExpression): unknown =>
  isString(value) ? value.string : isFunction(value) && value.operator === "List" ? value.ops.map(plainOf) : value.json;

const recordOf = (dictionary: BoxedExpression): Record<string, unknown> =>
  Object.fromEntries(entriesOf(dictionary).map(([key, value]) => [key, plainOf(value)]));

/** `a.b.c` as the field chain `Field(Field(a, "b"), "c")`. */
const nameJson = (name: string): unknown =>
  name.split(".").reduce<unknown>((base, member, i) => (i === 0 ? member : ["Field", base, `'${member}'`]), undefined);

/** `About(name)` as plain JSON, in an engine whose `About` may or may not be widened yet. */
export function aboutRecord(ce: ComputeEngine, name: string): Record<string, unknown> {
  const native = ce.box(["About", nameJson(name)] as never).evaluate();
  return aboutOf(ce, name, recordOf(native));
}

/** `About`'s dictionary for `name`, from compute-engine's own (`native`). */
function aboutDictionary(ce: ComputeEngine, name: string, native: BoxedExpression): BoxedExpression {
  const own = new Map(entriesOf(native));
  const record = aboutOf(ce, name, recordOf(native));
  return dictionaryOf(
    ce,
    Object.entries(record).map(([key, value]) => {
      // An entry of compute-engine's keeps its boxed value (a symbolic `value`, say).
      const kept = own.get(key);
      const same = kept !== undefined && JSON.stringify(plainOf(kept)) === JSON.stringify(value);
      return [key, same ? kept : boxed(ce, value)];
    }),
  );
}

const widened = new WeakSet<ComputeEngine>();

type Evaluate = (ops: readonly BoxedExpression[], options: unknown) => BoxedExpression | undefined;

/** `About` widened with the manifest's description; compute-engine's `examples`, `keywords`
 *  and attribute list come with it. */
export function declareAbout(ce: ComputeEngine): void {
  if (widened.has(ce)) return;
  widened.add(ce);
  const definition = ce.lookupDefinition("About") as
    | {
        operator?: {
          evaluate?: Evaluate;
          evaluateAsync?: (ops: readonly BoxedExpression[], options: unknown) => Promise<BoxedExpression | undefined>;
        };
      }
    | undefined;
  const operator = definition?.operator;
  const native = operator?.evaluate;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = (ops, options) => {
    const result = native(ops, options);
    const name = ops.length === 1 ? nameGiven(ops[0]) : undefined;
    return result === undefined || name === undefined ? result : aboutDictionary(ce, name, result);
  };
  // Asynchronously, a summary not yet imported is imported first.
  operator.evaluateAsync = async (ops, options) => {
    const result = native(ops, options);
    const name = ops.length === 1 ? nameGiven(ops[0]) : undefined;
    if (result === undefined || name === undefined) return result;
    await describe(name);
    return aboutDictionary(ce, name, result);
  };
}
