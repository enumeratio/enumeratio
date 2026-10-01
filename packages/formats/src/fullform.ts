// FullForm -- an expression printed as the Epsil spelling of its tree: every head written out
// as a call, no operators, no list brackets, no library-name lowering. `Take(List(a, b, c), 2)`,
// not `take([a, b, c], 2)`. Atoms use Epsil's literal syntax, so `parseEpsil` reads the text
// back as the same MathJSON, uncanonicalised.

import { ComputeEngine as Engine } from "@cortex-js/compute-engine";
import {
  type ComputeEngine,
  type MathJsonExpression,
  parseEpsil,
  serializeEpsil,
} from "@cortex-js/compute-engine/epsil";

const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_]*$/u;

const bareCache = new Map<string, boolean>();
/** Whether `name` reads back bare as that symbol: not a keyword, a literal (`NaN`) or an operator. */
function readsBare(name: string): boolean {
  let ok = bareCache.get(name);
  if (ok === undefined) {
    const [json, errors] = parseEpsil(name);
    ok = errors.length === 0 && (json as { sym?: string })?.sym === name;
    bareCache.set(name, ok);
  }
  return ok;
}

function symbol(name: string): string {
  if (IDENTIFIER.test(name) && readsBare(name)) return name;
  return `\`${name.replace(/\\/g, "\\\\").replace(/`/g, "\\`")}\``;
}

/** A MathJSON number's text as an Epsil literal: `Infinity` for `+Infinity`, the rest as written. */
function number(text: string): string {
  const t = text.replace(/^\+/, "");
  return t === "Infinity" || t === "-Infinity" || t === "NaN" ? t : t.replace(/_/g, "");
}

const string = (text: string): string => serializeEpsil({ str: text });

let sharedEngine: ComputeEngine | undefined;

/**
 * `json` as FullForm. It is read as compute-engine reads MathJSON, uncanonicalised (`raw`), so a
 * shorthand atom prints as what it is: `"3"` a number, `"hello world"` a string.
 */
export function toFullForm(json: MathJsonExpression, ce?: ComputeEngine): string {
  ce ??= sharedEngine ??= new Engine() as unknown as ComputeEngine;
  return print(ce.box(json as never, { form: "raw" }).json as MathJsonExpression);
}

/** A non-symbol head prints as `Apply(head, …)`, the spelling Epsil reads it back as. */
function print(json: MathJsonExpression): string {
  if (typeof json === "number") return Number.isFinite(json) ? String(json) : number(String(json));
  if (typeof json === "string") {
    if (json.length >= 2 && json.startsWith("'") && json.endsWith("'")) return string(json.slice(1, -1));
    return symbol(json);
  }
  if (Array.isArray(json)) {
    const [head, ...ops] = json as unknown as [MathJsonExpression, ...MathJsonExpression[]];
    const args = ops.map(print).join(", ");
    if (typeof head === "string") return `${symbol(head)}(${args})`;
    return `Apply(${print(head)}${args === "" ? "" : `, ${args}`})`;
  }
  const node = json as { num?: string; sym?: string; str?: string; fn?: MathJsonExpression[] };
  if (node.num !== undefined) return number(node.num);
  if (node.sym !== undefined) return symbol(node.sym);
  if (node.str !== undefined) return string(node.str);
  if (node.fn !== undefined) return print(node.fn as unknown as MathJsonExpression);
  throw new Error(`FullForm: no spelling for ${JSON.stringify(json)}`);
}
