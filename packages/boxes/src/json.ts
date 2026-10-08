// Boxes as MathJSON, and back. In MathJSON an array is an application and a bare string a
// symbol, so the box shape does not carry over as-is: a leaf becomes a string literal
// (`{str}`), a Wolfram list becomes `List`, and options become trailing `->` rules. The
// result is what `SuperscriptBox("x", "2")` parses to in Epsil.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  ARITY,
  type Box,
  type BoxNode,
  isBox,
  isBoxHead,
  type Options,
  type OptionValue,
  optionsOfBox,
} from "./box.ts";

type Json = MathJsonExpression;

const list = (items: readonly Json[]): Json => ["List", ...items] as Json;

function optionToJson(value: OptionValue): Json {
  if (value === null) return "Null";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return value;
  if (typeof value === "string") return { str: value };
  return list(value.map(optionToJson));
}

/** Boxes as a MathJSON expression. */
export function toMathJson(box: Box): Json {
  if (typeof box === "string") return { str: box };
  const head = box[0];
  const args = box.slice(1, ARITY[head] + 1) as unknown[];
  const encoded: Json[] = args.map((arg, i) => {
    if (head === "RowBox" || head === "TextData") return list((arg as Box[]).map(toMathJson));
    if (head === "GridBox") return list((arg as Box[][]).map((r) => list(r.map(toMathJson))));
    if (head === "TextBox" || head === "TemplateSlot" || head === "TemplateExpression") return { str: arg as string };
    // A tag that is no symbol's name (an address, "1,0") is a string.
    if ((head === "TagBox" || head === "FormBox") && i === 1)
      return /^[A-Za-z][A-Za-z0-9]*$/.test(arg as string) ? (arg as string) : { str: arg as string };
    if (head === "TextCell" && i === 1) return { str: arg as string };
    if (head === "InterpretationBox" && i === 1) return arg as Json;
    if (head === "TableViewBox") return arg as Json;
    return toMathJson(arg as Box);
  });
  const rules = Object.entries(optionsOfBox(box as BoxNode)).map(
    ([name, value]) => ["KeyValuePair", name, optionToJson(value)] as Json,
  );
  return [head, ...encoded, ...rules] as Json;
}

export class BoxFormError extends Error {
  override name = "BoxFormError";
}

const fail = (why: string, node: unknown): never => {
  throw new BoxFormError(`${why}: ${JSON.stringify(node)}`);
};

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

const stringOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return /^'.*'$/s.test(node) ? node.slice(1, -1) : undefined;
  const s = (node as { str?: unknown })?.str;
  return typeof s === "string" ? s : undefined;
};

const symbolOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return stringOf(node) === undefined ? node : undefined;
  const s = (node as { sym?: unknown })?.sym;
  return typeof s === "string" ? s : undefined;
};

const listItems = (node: unknown): Json[] => (headOf(node) === "List" ? opsOf(node) : fail("expected a List", node));

function optionFromJson(node: Json): OptionValue {
  if (typeof node === "number") return node;
  const n = (node as { num?: unknown })?.num;
  if (n !== undefined) return Number(n);
  const s = stringOf(node);
  if (s !== undefined) return s;
  const sym = symbolOf(node);
  if (sym === "True" || sym === "False") return sym === "True";
  if (sym === "Null") return null;
  if (sym !== undefined) return sym;
  if (headOf(node) === "List") return opsOf(node).map(optionFromJson);
  return fail("unsupported option value", node);
}

/**
 * `Name -> value` as a rule: a `KeyValuePair`, or the `Tuple` compute-engine canonicalises
 * a symbol-keyed pair to (an option name is capitalised, which keeps `(x, 1)` a tuple).
 */
function ruleOf(node: Json): [string, Json] | undefined {
  const head = headOf(node);
  const ops = opsOf(node);
  if ((head !== "KeyValuePair" && head !== "Tuple") || ops.length !== 2) return undefined;
  const name = symbolOf(ops[0]) ?? stringOf(ops[0]);
  return name !== undefined && /^[A-Z]/.test(name) ? [name, ops[1]] : undefined;
}

/** A MathJSON expression read as boxes. Throws `BoxFormError` when it is not one. */
export function fromMathJson(json: Json): Box {
  const leaf = stringOf(json);
  if (leaf !== undefined) return leaf;
  const head = headOf(json);
  if (!isBoxHead(head)) return fail("not a box", json);
  // The trailing rules are the options; a box head's positional arguments never are.
  const all = opsOf(json);
  let split = all.length;
  while (split > 0 && ruleOf(all[split - 1]) !== undefined) split--;
  const ops = all.slice(0, split);
  const raw = Object.fromEntries(all.slice(split).map((op) => ruleOf(op)!));
  const arity = ARITY[head];
  if (ops.length !== arity) fail(`${head} takes ${arity} argument(s)`, json);
  const args: unknown[] = ops.map((op, i) => {
    if (head === "RowBox" || head === "TextData") return listItems(op).map(fromMathJson);
    if (head === "GridBox") return listItems(op).map((r) => listItems(r).map(fromMathJson));
    if (head === "TextBox" || head === "TemplateSlot" || head === "TemplateExpression")
      return stringOf(op) ?? fail(`${head} takes a string`, op);
    if ((head === "TagBox" || head === "FormBox") && i === 1)
      return symbolOf(op) ?? stringOf(op) ?? fail(`${head} takes a name`, op);
    if (head === "TextCell" && i === 1) return stringOf(op) ?? fail("TextCell takes a style name", op);
    if (head === "InterpretationBox" && i === 1) return op;
    if (head === "TableViewBox") return op;
    return fromMathJson(op);
  });
  const options: Record<string, OptionValue> = {};
  for (const [name, value] of Object.entries(raw)) options[name] = optionFromJson(value);
  const box = (head === "StyleBox" || Object.keys(options).length > 0
    ? [head, ...args, options as Options]
    : [head, ...args]) as unknown as Box;
  return isBox(box) ? box : fail("malformed box", json);
}
