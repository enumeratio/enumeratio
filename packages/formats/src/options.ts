// Options, the way Wolfram does them: rules -- `PlotRange -> (-1, 1)` -- as the trailing
// arguments of an application, given singly or inside (nested) lists, after the
// positional arguments. Nothing about the expression is rewritten to hold them: they
// are read off with `OptionsPattern` semantics -- the trailing rules are flattened and
// the LEFTMOST setting of a name wins -- and written back the same way.
//
// In notatio a rule is `a -> b`, which Epsil parses to `KeyValuePair`; compute-engine's
// canonical form turns a symbol-keyed pair into a `Tuple`, so both spellings read as a
// rule here, as does a string key.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";

type Json = MathJsonExpression;

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

/** A symbol or a string, as the name it spells; anything else is not an option name. */
export function optionName(node: unknown): string | undefined {
  if (typeof node === "string") {
    if (node.length >= 2 && node.startsWith("'") && node.endsWith("'")) return node.slice(1, -1);
    return /^[A-Za-z_][\w]*$/.test(node) ? node : undefined;
  }
  const sym = (node as { sym?: unknown })?.sym;
  if (typeof sym === "string") return sym;
  const str = (node as { str?: unknown })?.str;
  if (typeof str === "string") return str;
  return undefined;
}

/** `name -> value`, as a `KeyValuePair` or the `Tuple` it canonicalises to. */
export function ruleOf(node: Json): { name: string; value: Json } | undefined {
  const head = headOf(node);
  if (head !== "KeyValuePair" && head !== "Tuple") return undefined;
  const [key, value] = opsOf(node);
  if (key === undefined || value === undefined || opsOf(node).length !== 2) return undefined;
  // A tuple is a rule only if its first entry names something: `(x, 0, 10)` is an
  // iterator and `(1, 2)` is a point, but `(PlotRange, All)` is what a rule becomes.
  const name = optionName(key);
  if (name === undefined || (head === "Tuple" && /^[a-z]/.test(name))) return undefined;
  return { name, value };
}

/** A list every entry of which is a rule (or such a list): an options list. */
export function isOptionList(node: Json): boolean {
  if (headOf(node) !== "List") return false;
  const ops = opsOf(node);
  return ops.length > 0 && ops.every((op) => ruleOf(op) !== undefined || isOptionList(op));
}

/** Every rule in a list, nested lists flattened, in order. */
function flatten(node: Json, into: { name: string; value: Json }[]): void {
  const rule = ruleOf(node);
  if (rule !== undefined) {
    into.push(rule);
    return;
  }
  if (isOptionList(node)) for (const op of opsOf(node)) flatten(op, into);
}

export interface Split {
  /** The positional arguments: everything before the trailing rules. */
  readonly ops: readonly Json[];
  /** The options, leftmost setting of a name winning, in first-seen order. */
  readonly options: Readonly<Record<string, Json>>;
}

/**
 * Split an application's arguments into the positional ones and the options among
 * the trailing ones -- `OptionsPattern[]`: rules and lists of rules, flattened, the
 * first setting of each name kept. A rule that appears before a positional argument
 * is not an option; it is data, and stays where it is.
 */
export function optionsOf(expr: Json): Split {
  const ops = opsOf(expr);
  let end = ops.length;
  while (end > 0 && (ruleOf(ops[end - 1]) !== undefined || isOptionList(ops[end - 1]))) end--;
  const rules: { name: string; value: Json }[] = [];
  for (const op of ops.slice(end)) flatten(op, rules);
  const options: Record<string, Json> = {};
  for (const { name, value } of rules) if (!(name in options)) options[name] = value;
  return { ops: ops.slice(0, end), options };
}

/** `head(ops…, name -> value, …)`: the application with its options as trailing rules. */
export function withOptions(
  head: string,
  ops: readonly Json[],
  options: Readonly<Record<string, Json>>,
): Json {
  const rules = Object.entries(options).map(([name, value]) => ["KeyValuePair", name, value]);
  return [head, ...ops, ...rules] as unknown as Json;
}
