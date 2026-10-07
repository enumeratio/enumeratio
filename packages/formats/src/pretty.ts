// Source to read: an expression printed the way a page writes it, broken over lines to fit.
//
// - `prettyEpsil` is Epsil with each name as MathJSON spells it (`IsPrime`, not the library's
//   `isPrime`, which reads back the same), `f(x)(y)` for an applied function, and a call that
//   doesn't fit on its line broken one argument per line, indented two.
// - `sourceMarkupOf` is notatio markup as a page author writes it: an application is an element,
//   its atoms text; its options are PascalCase attributes holding Epsil; a `StringTemplate`'s text
//   is its text. What `readMarkupText` reads back as the same expression.

/** MathJSON, loosely. */
type Json = unknown;

const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === "string" ? json[0] : undefined;
const argsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);

/** A plain form of the object kinds MathJSON may use: `{fn}`, `{sym}`, `{num}`, `{str}`. */
function plain(json: Json): Json {
  if (Array.isArray(json)) return json.map(plain);
  if (json !== null && typeof json === "object") {
    const o = json as { fn?: Json[]; sym?: string; num?: string; str?: string };
    if (Array.isArray(o.fn)) return o.fn.map(plain);
    if (typeof o.sym === "string") return o.sym;
    if (typeof o.str === "string") return `'${o.str}'`;
    if (typeof o.num === "string") return Number.isFinite(Number(o.num)) ? Number(o.num) : o.num;
  }
  return json;
}

const isString = (json: Json): json is string => typeof json === "string" && /^'.*'$/s.test(json);
const stringText = (json: string): string => json.slice(1, -1);
const quote = (text: string): string => JSON.stringify(text);

/** Binary heads written between their operands, and how tightly they bind. */
const INFIX: Readonly<Record<string, readonly [string, number]>> = {
  KeyValuePair: [" -> ", 1],
  Rule: [" -> ", 1],
  Or: [" || ", 2],
  And: [" && ", 3],
  Equal: [" == ", 4],
  Add: [" + ", 5],
  Subtract: [" - ", 5],
  Multiply: [" * ", 6],
  Divide: [" / ", 6],
  Power: ["^", 8],
};

/** One expression on one line. */
function flat(json: Json, outer = 0): string {
  if (typeof json === "number") return String(json);
  if (isString(json)) return quote(stringText(json));
  if (typeof json === "string") return json;
  const head = headOf(json);
  const args = argsOf(json);
  if (head === "List") return `[${args.map((a) => flat(a)).join(", ")}]`;
  if (head === "Tuple" && args.length !== 2) return `(${args.map((a) => flat(a)).join(", ")})`;
  if (head === "Tuple" && typeof args[0] === "string" && /^[A-Z_]/.test(args[0]))
    return wrap(`${flat(args[0], 1)} -> ${flat(args[1], 1)}`, 1, outer);
  if (head === "Tuple") return `(${args.map((a) => flat(a)).join(", ")})`;
  if (head === "Not" && args.length === 1) return `!${flat(args[0], 9)}`;
  if (head === "Negate" && args.length === 1) return `-${flat(args[0], 9)}`;
  if (head === "Apply" && args.length >= 1)
    return `${flat(args[0], 10)}(${args
      .slice(1)
      .map((a) => flat(a))
      .join(", ")})`;
  const infix = head === undefined ? undefined : INFIX[head];
  if (infix && args.length >= 2) return wrap(args.map((a) => flat(a, infix[1] + 1)).join(infix[0]), infix[1], outer);
  const name = typeof head === "string" ? head : flat(Array.isArray(json) ? json[0] : json, 10);
  return `${name}(${args.map((a) => flat(a)).join(", ")})`;
}

const wrap = (text: string, binds: number, outer: number): string => (binds < outer ? `(${text})` : text);

/** Epsil broken over lines to fit `width` columns, indented by `indent`. */
function pretty(json: Json, width: number, indent: number): string {
  const one = flat(json);
  if (indent + one.length <= width) return one;
  const head = headOf(json);
  const args = argsOf(json);
  const pad = " ".repeat(indent + 2);
  const end = " ".repeat(indent);
  const lines = (items: Json[]): string => items.map((a) => pad + pretty(a, width, indent + 2)).join(",\n");
  if (head === "List") return `[\n${lines(args)}\n${end}]`;
  // A rule whose value is long: the value breaks, the key stays on the rule's line.
  if (
    (head === "KeyValuePair" ||
      head === "Rule" ||
      (head === "Tuple" && typeof args[0] === "string" && /^[A-Z_]/.test(args[0]))) &&
    args.length === 2
  ) {
    const key = flat(args[0], 1);
    return `${key} -> ${pretty(args[1], width, indent).trimStart()}`;
  }
  if (head === "Apply" && args.length >= 1) return `${flat(args[0], 10)}(\n${lines(args.slice(1))}\n${end})`;
  if (head !== undefined && !(head in INFIX) && head !== "Not" && head !== "Negate" && head !== "Tuple")
    return `${head}(\n${lines(args)}\n${end})`;
  return one;
}

/** Epsil to read: names as MathJSON spells them, broken over lines to fit `width` columns. */
export function prettyEpsil(json: Json, { width = 80 }: { width?: number } = {}): string {
  return pretty(plain(json), width, 0);
}

// ── Markup ───────────────────────────────────────────────────────────────────────────────

/** A trailing option of an application: `Name -> value` with a capitalized name. */
const optionOf = (json: Json): [string, Json] | undefined => {
  const head = headOf(json);
  const [key, value] = argsOf(json);
  if ((head !== "KeyValuePair" && head !== "Rule" && head !== "Tuple") || argsOf(json).length !== 2) return undefined;
  return typeof key === "string" && /^[A-Z]\w*$/.test(key) ? [key, value] : undefined;
};

const isAtom = (json: Json): boolean => typeof json === "number" || typeof json === "string";

/** An attribute, its value in whichever quote it doesn't contain: a bare atom, or Epsil laid out from `indent`. */
function attribute(name: string, value: Json, indent: number, width: number): string {
  if (value === "True") return name;
  const text = isAtom(value) && !isString(value) ? flat(value) : pretty(value, width, indent);
  return text.includes('"') ? `${name}='${text}'` : `${name}="${text}"`;
}

function element(json: Json, indent: number, width: number): string[] {
  const pad = " ".repeat(indent);
  if (isAtom(json)) return [pad + flat(json)];
  const head = headOf(json);
  if (head === undefined || head === "List" || head === "Apply" || head in INFIX)
    return [`${pad}<ToExpression value=${JSON.stringify(flat(json))} />`];
  const args = argsOf(json);
  // Options trail the positional arguments, Wolfram's way.
  let split = args.length;
  while (split > 0 && optionOf(args[split - 1]) !== undefined) split--;
  const positional = args.slice(0, split);
  const options = args.slice(split).map((o) => optionOf(o)!);
  // The attributes on the tag's line when they fit there, else one to a line beneath it.
  const inline = options.map(([name, value]) => attribute(name, value, 0, Infinity));
  const oneLine = `<${head}${inline.map((a) => ` ${a}`).join("")}`;
  const open =
    pad.length + oneLine.length + 1 <= width
      ? [pad + oneLine]
      : [`${pad}<${head}`, ...options.map(([name, value]) => `${pad}  ${attribute(name, value, indent + 2, width)}`)];
  const opened = open.length === 1 ? open : [...open, pad];
  const close = (rest: string): string[] => [...opened.slice(0, -1), opened.at(-1)! + rest];
  if (head === "StringTemplate" && positional.length === 1 && isString(positional[0]))
    return close(`>${stringText(positional[0])}</${head}>`);
  if (positional.length === 0) return close(open.length === 1 ? " />" : "/>");
  if (open.length === 1 && positional.every(isAtom) && !positional.some(isString)) {
    const line = `${open[0]}>${positional.map((a) => flat(a)).join(" ")}</${head}>`;
    if (line.length <= width) return [line];
  }
  return [...close(">"), ...positional.flatMap((a) => element(a, indent + 2, width)), `${pad}</${head}>`];
}

/** Notatio markup as a page writes it, broken over lines to fit `width` columns. */
export function sourceMarkupOf(json: Json, { width = 80 }: { width?: number } = {}): string {
  return element(plain(json), 0, width).join("\n");
}
