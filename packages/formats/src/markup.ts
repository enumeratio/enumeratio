// The vdom as markup (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup):
// FullForm written as JSX, read into MathJSON without knowing any symbol. Every rule is
// about the shape of the markup, never about which head it is:
//
//   <Plot PlotRange="All"><Sin>x</Sin><Tuple>x 0 10</Tuple></Plot>
//     = ["Plot", ["Sin", "x"], ["Tuple", "x", 0, 10], ["KeyValuePair", "PlotRange", "All"]]
//
// - an element is an application, its tag the head (`Stats.Mean` a member call);
// - element children and text tokens are the positional arguments, in order; a text run is
//   whitespace-separated atoms: numbers, symbols (`x`, or `` `a b` `` verbatim) and
//   `"strings"` (JSON escapes);
// - a childless element is a symbol (`<NaN/>`); a call with no arguments is `<Apply>f</Apply>`;
// - a PascalCase attribute is a named slot, a trailing `KeyValuePair` (options, or a named
//   parameter once the symbol says so); alone, it is `True`;
// - `value`, the one lowercase attribute, holds the arguments as Epsil in place of children,
//   and `<ToExpression value="…" />` a whole expression.
//
// Engine-free: Epsil is only ever read through the `parseText` a caller passes in, so a page
// can load this eagerly and the engine on first use.

import htm from "htm/mini";

/** MathJSON, loosely: this module builds and reads it without the engine's types; `undefined` where reading failed. */
type Json = unknown;

/** A parsed element: htm's `h(tag, props, ...children)`, and MDX/estree JSX after a rename. */
export interface MarkupNode {
  readonly tag: string;
  readonly props: Readonly<Record<string, string | true>> | null;
  readonly children: readonly (MarkupNode | string)[];
}

/** An Epsil parser, `parseExpression`'s shape: injected so this module stays engine-free. */
export type ParseText = (epsil: string) => { json: unknown; errors: readonly unknown[] };

export interface ReadResult {
  readonly json: Json;
  readonly errors: readonly string[];
}

const h = (tag: string, props: Record<string, string | true> | null, ...children: (MarkupNode | string)[]) => ({
  tag,
  props,
  children,
});
// htm's types are CommonJS under nodenext (a default import types as the module); the value
// is the default export either way.
type Parse = (strings: TemplateStringsArray) => MarkupNode | string | (MarkupNode | string)[];
const html = (htm as unknown as { bind(f: typeof h): Parse }).bind(h);

/** Markup text as its one root element. */
export function parseMarkup(text: string): { node: MarkupNode | undefined; errors: string[] } {
  const strings = Object.assign([text], { raw: [text] }) as unknown as TemplateStringsArray;
  let parsed: ReturnType<typeof html>;
  try {
    parsed = html(strings);
  } catch (error) {
    return { node: undefined, errors: [`markup: ${(error as Error).message}`] };
  }
  const roots = (Array.isArray(parsed) ? parsed : [parsed]).filter((n) => typeof n !== "string" || n.trim() !== "");
  if (roots.length !== 1 || typeof roots[0] === "string") {
    return { node: undefined, errors: ["markup: expected one root element"] };
  }
  return { node: roots[0], errors: [] };
}

/** Markup text read into MathJSON: `parseMarkup` then `readMarkup`. */
export function readMarkupText(text: string, options: { parseText?: ParseText } = {}): ReadResult {
  const { node, errors } = parseMarkup(text);
  return node === undefined ? { json: undefined, errors } : readMarkup(node, options);
}

// --- tokens -----------------------------------------------------------------------------

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\(\d+\))?(?:[eE][+-]?\d+)?$|^[+-]Infinity$/;
/** A symbol written as a plain token; anything else is written `` `verbatim` ``. */
const PLAIN_SYMBOL = /^[\p{L}\p{M}_$][\p{L}\p{M}\p{N}_$]*$/u;

/** A number token: a JSON number where it reads back exactly, else MathJSON's `{ num }`. */
function numberOf(token: string): Json {
  const n = Number(token);
  if (Number.isFinite(n) && (String(n) === token || (token === "-0" && Object.is(n, -0)))) return n;
  return { num: token };
}

const ESCAPES: Readonly<Record<string, string>> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };

/** A verbatim symbol's JSON escapes (and `` \` ``), without JSON's ban on a bare `"`. */
const unescape = (body: string): string =>
  body.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (_, hex: string | undefined, ch: string | undefined) =>
    hex !== undefined ? String.fromCharCode(Number.parseInt(hex, 16)) : (ESCAPES[ch!] ?? ch!),
  );

/** A run of text as its atoms. */
export function tokenize(text: string, errors: string[] = []): Json[] {
  const atoms: Json[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      if (j >= text.length) {
        errors.push(`markup: unterminated ${c === '"' ? "string" : "symbol"} ${text.slice(i)}`);
        return atoms;
      }
      const body = text.slice(i + 1, j);
      if (c === '"') {
        try {
          atoms.push(`'${JSON.parse(`"${body}"`) as string}'`);
        } catch {
          errors.push(`markup: bad string "${body}"`);
        }
      } else atoms.push(unescape(body));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < text.length && !/\s/.test(text[j]!)) j++;
    const token = text.slice(i, j);
    if (NUMBER.test(token)) atoms.push(numberOf(token));
    else if (PLAIN_SYMBOL.test(token)) atoms.push(token);
    else errors.push(`markup: "${token}" isn't an atom (Epsil goes in a value attribute)`);
    i = j;
  }
  return atoms;
}

// --- reading ----------------------------------------------------------------------------

const isSymbol = (json: Json): json is string => typeof json === "string" && !/^'.*'$/s.test(json);

/** `Stats.Mean` as its parts, or undefined if a part isn't a name. */
function dottedParts(tag: string): string[] | undefined {
  const parts = tag.split(".");
  return parts.every((p) => PLAIN_SYMBOL.test(p)) ? parts : undefined;
}

/** `a.b.c` as the receiver Epsil parses it to: `Field(Field(a, "b"), "c")`, less the last. */
const receiverOf = (parts: readonly string[]): Json =>
  parts.slice(1).reduce<Json>((base, member) => ["Field", base, `'${member}'`], parts[0]);

/** A slot's or a `value`'s text: one token needs no parser; anything else is Epsil. */
function textValue(text: string, parseText: ParseText | undefined, errors: string[]): Json {
  const tokenErrors: string[] = [];
  const tokens = tokenize(text, tokenErrors);
  if (tokenErrors.length === 0 && tokens.length === 1) return tokens[0];
  // One token that isn't an atom (`x+1`) is Epsil too.
  if (parseText === undefined) {
    errors.push(`markup: "${text}" is Epsil, and no Epsil parser was given`);
    return undefined;
  }
  const parsed = parseText(text);
  if (parsed.errors.length > 0) {
    errors.push(`markup: "${text}" doesn't parse as Epsil`);
    return undefined;
  }
  return stripMetadata(parsed.json);
}

/**
 * An element as MathJSON, non-canonical (so names resolve before canonicalisation), with
 * whatever errors reading it found.
 */
export function readMarkup(node: MarkupNode, options: { parseText?: ParseText } = {}): ReadResult {
  const errors: string[] = [];
  const json = read(node, options.parseText, errors);
  return { json, errors };
}

function read(node: MarkupNode, parseText: ParseText | undefined, errors: string[]): Json {
  const { tag } = node;
  const parts = dottedParts(tag);
  if (parts === undefined) {
    errors.push(`markup: <${tag}> isn't a head`);
    return undefined;
  }

  const slots: Json[] = [];
  let value: string | undefined;
  for (const [name, raw] of Object.entries(node.props ?? {})) {
    if (name === "value") {
      if (raw === true) errors.push(`markup: <${tag} value> needs text`);
      else value = raw;
    } else if (/^[A-Z]/.test(name)) {
      const v = raw === true ? "True" : textValue(raw, parseText, errors);
      if (v !== undefined) slots.push(["KeyValuePair", name, v]);
    } else errors.push(`markup: <${tag}> has "${name}", which is neither a slot (PascalCase) nor value`);
  }

  const args: Json[] = [];
  for (const child of node.children) {
    if (typeof child === "string") args.push(...tokenize(child, errors));
    else {
      const arg = read(child, parseText, errors);
      if (arg !== undefined) args.push(arg);
    }
  }

  if (value !== undefined) {
    if (args.length > 0) errors.push(`markup: <${tag}> has both value and children`);
    if (tag === "ToExpression") return textValue(value, parseText, errors);
    const list = textValue(`[${value}]`, parseText, errors);
    if (Array.isArray(list) && list[0] === "List") args.push(...list.slice(1));
  }

  if (tag === "ToExpression") {
    if (args.length !== 1 || slots.length > 0) errors.push("markup: <ToExpression> holds one expression");
    return args[0];
  }
  if (parts.length > 1) {
    const receiver = receiverOf(parts.slice(0, -1));
    const member = `'${parts.at(-1)!}'`;
    if (args.length === 0 && slots.length === 0) return ["Field", receiver, member];
    return ["MemberCall", receiver, member, ...args, ...slots];
  }
  if (tag === "Apply" && isSymbol(args[0])) return [args[0], ...args.slice(1), ...slots];
  if (args.length === 0 && slots.length === 0) return tag;
  return [tag, ...args, ...slots];
}

// --- printing ---------------------------------------------------------------------------

/**
 * MathJSON as a markup round trip keeps it: array form, no metadata, a string head where it
 * is a symbol, `Apply(f, …)` as `f(…)`, and a compound head under `Apply`. What
 * `readMarkup(markupOf(e))` equals.
 */
export function stripMetadata(expr: Json): Json {
  if (Array.isArray(expr)) {
    const [head, ...ops] = expr.map(stripMetadata);
    if (head === "Apply" && isSymbol(ops[0])) return [ops[0], ...ops.slice(1)];
    return isSymbol(head) ? [head, ...ops] : ["Apply", head, ...ops];
  }
  if (expr !== null && typeof expr === "object") {
    const o = expr as { fn?: unknown; sym?: unknown; str?: unknown; num?: unknown; dict?: unknown };
    if (Array.isArray(o.fn)) return stripMetadata(o.fn);
    if (typeof o.sym === "string") return o.sym;
    if (typeof o.str === "string") return `'${o.str}'`;
    if (typeof o.num === "string") return NUMBER.test(o.num) ? numberOf(o.num) : { num: o.num };
    if (typeof o.num === "number") return o.num;
    if (o.dict !== undefined) throw new Error("markup: a dictionary literal has no markup yet");
  }
  return expr;
}

/** Characters JSX and HTML read specially, and backticks, as `\u` escapes. */
const escapeSpecials = (text: string): string =>
  text.replace(/[<>{}&`']/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

/** An atom as its token. */
function tokenOf(atom: Json): string | undefined {
  if (typeof atom === "number") return Object.is(atom, -0) ? "-0" : String(atom);
  if (typeof atom === "string") {
    if (/^'.*'$/s.test(atom)) return escapeSpecials(JSON.stringify(atom.slice(1, -1)));
    if (PLAIN_SYMBOL.test(atom) || atom === "True" || atom === "False") return atom;
    return `\`${escapeSpecials(JSON.stringify(atom).slice(1, -1).replace(/\\"/g, '"')).replace(/"/g, "\\u0022")}\``;
  }
  const num = (atom as { num?: unknown } | null)?.num;
  if (typeof num === "string" && NUMBER.test(num)) return num;
  return undefined;
}

const isAtom = (json: Json): boolean => !Array.isArray(json);

/** `Field(Field(a, "b"), "c")` back to `a.b.c`, if every part is a plain name. */
function dottedName(receiver: Json, member: Json): string | undefined {
  if (typeof member !== "string" || !/^'.*'$/s.test(member)) return undefined;
  const name = member.slice(1, -1);
  if (!PLAIN_SYMBOL.test(name)) return undefined;
  if (typeof receiver === "string") return PLAIN_SYMBOL.test(receiver) ? `${receiver}.${name}` : undefined;
  if (Array.isArray(receiver) && receiver[0] === "Field" && receiver.length === 3) {
    const base = dottedName(receiver[1], receiver[2]);
    return base === undefined ? undefined : `${base}.${name}`;
  }
  return undefined;
}

/** A trailing `KeyValuePair(Name, atom)` as a slot attribute, or undefined. */
function slotOf(arg: Json): [string, string] | undefined {
  if (!Array.isArray(arg) || arg[0] !== "KeyValuePair" || arg.length !== 3) return undefined;
  const [, key, value] = arg;
  if (typeof key !== "string" || !/^[A-Z]/.test(key) || !PLAIN_SYMBOL.test(key) || key === "ToExpression")
    return undefined;
  if (!isAtom(value)) return undefined;
  const token = tokenOf(value);
  return token === undefined ? undefined : [key, token];
}

const attribute = ([name, token]: [string, string]): string =>
  token === "True" ? ` ${name}` : token.includes('"') ? ` ${name}='${token}'` : ` ${name}="${token}"`;

interface Printed {
  readonly atom: boolean;
  readonly text: string;
}

function print(expr: Json, depth: number, width: number): Printed {
  if (isAtom(expr)) {
    const token = tokenOf(expr);
    if (token === undefined) throw new Error(`markup: no markup for the atom ${JSON.stringify(expr)}`);
    return { atom: true, text: token };
  }
  const [head, ...ops] = expr as Json[];
  let tag: string;
  let args: Json[];
  // With no arguments, a dotted tag would read as a `Field`.
  if (head === "MemberCall" && ops.length > 2 && dottedName(ops[0], ops[1]) !== undefined) {
    tag = dottedName(ops[0], ops[1])!;
    args = ops.slice(2);
  } else if (head === "Field" && ops.length === 2 && dottedName(ops[0], ops[1]) !== undefined) {
    return { atom: false, text: `<${dottedName(ops[0], ops[1])} />` };
  } else if (typeof head === "string" && PLAIN_SYMBOL.test(head) && head !== "ToExpression" && ops.length > 0) {
    tag = head;
    args = ops;
  } else {
    // A nullary call, a compound head, or a head no tag can spell.
    tag = "Apply";
    args = head === "Apply" ? ops : [head, ...ops];
  }

  const slots: [string, string][] = [];
  const seen = new Set<string>();
  while (args.length > 0) {
    const slot = slotOf(args.at(-1));
    if (slot === undefined || seen.has(slot[0])) break;
    seen.add(slot[0]);
    slots.unshift(slot);
    args = args.slice(0, -1);
  }
  const open = `<${tag}${slots.map(attribute).join("")}`;
  if (args.length === 0) return { atom: false, text: `${open} />` };

  const children = args.map((a) => print(a, depth + 1, width));
  const inline = children.map((c) => c.text).join(" ");
  if (!inline.includes("\n") && open.length + inline.length + tag.length + 3 + 2 * depth <= width) {
    return { atom: false, text: `${open}>${inline}</${tag}>` };
  }
  // One line per element, a run of atoms together.
  const pad = "  ".repeat(depth + 1);
  const lines: string[] = [];
  let run: string[] = [];
  const flush = (): void => {
    if (run.length > 0) lines.push(pad + run.join(" "));
    run = [];
  };
  for (const child of children) {
    if (child.atom) run.push(child.text);
    else {
      flush();
      lines.push(pad + child.text);
    }
  }
  flush();
  return { atom: false, text: `${open}>\n${lines.join("\n")}\n${"  ".repeat(depth)}</${tag}>` };
}

/**
 * An expression as canonical markup: the inverse of `readMarkup`, up to `stripMetadata`. An
 * element longer than `width` puts its children on lines of their own; `Infinity` keeps it
 * to one line.
 */
export function markupOf(expr: Json, { width = 80 }: { width?: number } = {}): string {
  const json = stripMetadata(expr);
  if (isAtom(json)) {
    if (typeof json === "string" && PLAIN_SYMBOL.test(json)) return `<${json} />`;
    return `<ToExpression>${print(json, 0, width).text}</ToExpression>`;
  }
  return print(json, 0, width).text;
}
