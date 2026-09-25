// Wolfram Language full-form source → MathJSON. Inverse of `toWolfram`: a small
// recursive-descent parser over `Head[args]` syntax (plus `{...}` list sugar),
// reversing the same `HEADS`/`SYMBOLS` maps `toWolfram` uses so the two stay in
// sync. Reads what a kernel prints as `FullForm` — including precision marks and
// `*^` exponents — so a kernel's answer can be boxed and compared structurally.
// Pure (string in, MathJSON out): no compute-engine dependency.

import { CONTEXT, HEADS, type MathJson, SYMBOLS } from "./to-wolfram.ts";

/** Strip the context off a name `toWolfram` qualified to keep it out of `System``. */
const unqualify = (name: string): string =>
  name.startsWith(CONTEXT) ? name.slice(CONTEXT.length) : name;

/** Wolfram spelling → compute-engine symbol constant. Reverse of `SYMBOLS`. */
const REVERSE_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOLS).map(([ce, wl]) => [wl, ce]),
);

/** Wolfram head → compute-engine head. Reverse of `HEADS`. Where two compute-engine
 * heads share a Wolfram spelling (`Log2`/`Lb` both → `Log2`, `List`/`Tuple`), the
 * first entry in `HEADS` wins, since object insertion order is preserved. */
const REVERSE_HEADS: Record<string, string> = {};
for (const [ce, wl] of Object.entries(HEADS)) {
  if (!(wl in REVERSE_HEADS)) REVERSE_HEADS[wl] = ce;
}

// Parser state. `fromWolfram` is not reentrant/concurrent, matching the scope
// of this small a grammar.
let src = "";
let pos = 0;

/** Parse a Wolfram Language full-form expression into a MathJSON value. */
export function fromWolfram(input: string): MathJson {
  src = input;
  pos = 0;
  const result = parseExpr();
  skipWs();
  if (pos < src.length) {
    throw new Error(
      `fromWolfram: unexpected trailing input at ${pos}: ${JSON.stringify(src.slice(pos))}`,
    );
  }
  return result;
}

function parseExpr(): MathJson {
  skipWs();
  const ch = peek();

  if (ch === '"') return parseString();
  if (ch === "{") return parseList();
  if (ch === "-" && /[0-9]/.test(src[pos + 1] ?? "")) return parseNumber();
  if (/[0-9]/.test(ch)) return parseNumber();
  // `toWolfram` emits `NegativeInfinity` as the raw text "-Infinity" rather than
  // a proper expression; recognise it as a single token so it round-trips.
  if (
    src.startsWith("-Infinity", pos) &&
    !/[A-Za-z0-9$]/.test(src[pos + "-Infinity".length] ?? "")
  ) {
    pos += "-Infinity".length;
    return "NegativeInfinity";
  }
  if (/[A-Za-z$]/.test(ch)) return parseSymbolOrCall();

  throw new Error(`fromWolfram: unexpected character ${JSON.stringify(ch)} at ${pos}`);
}

/** Integer, real (`2.`, `2.5`), with an optional precision mark (`` 2.5`20. ``) and
 * `*^n` exponent — every number shape `FullForm` prints. The mark is dropped. */
function parseNumber(): number {
  const re = /-?\d+(\.\d*)?(`[\d.]*)?(\*\^[+-]?\d+)?/y;
  re.lastIndex = pos;
  const m = re.exec(src);
  if (!m) throw new Error(`fromWolfram: expected a number at ${pos}`);
  pos = re.lastIndex;
  const text = m[0].replace(/`[\d.]*/, "").replace("*^", "e");
  return Number(text);
}

/** A Wolfram string literal, as the `'quoted'` MathJSON shorthand compute-engine's
 * own serialisation uses (and `toWolfram` reads). */
function parseString(): MathJson {
  expect('"');
  let out = "";
  while (peek() !== '"') {
    if (pos >= src.length) throw new Error("fromWolfram: unterminated string literal");
    out += peek() === "\\" ? src[pos++] + src[pos++] : src[pos++];
  }
  expect('"');
  // `toWolfram` writes strings via JSON.stringify, so JSON.parse is the exact inverse.
  return `'${JSON.parse(`"${out}"`)}'`;
}

function parseList(): MathJson {
  expect("{");
  const items = parseArgs("}");
  expect("}");
  return ["List", ...items];
}

function parseSymbolOrCall(): MathJson {
  // A backtick separates a context from a name (`` enumeratio`Area ``), which is how our
  // own heads stay out of `System``. Wolfram allows a nested path, so match any number.
  const re = /[A-Za-z$][A-Za-z0-9$]*(?:`[A-Za-z$][A-Za-z0-9$]*)*/y;
  re.lastIndex = pos;
  const m = re.exec(src);
  if (!m) throw new Error(`fromWolfram: expected an identifier at ${pos}`);
  pos = re.lastIndex;
  const name = m[0];

  skipWs();
  if (peek() === "[") {
    pos++;
    const args = parseArgs("]");
    expect("]");
    return applyHead(name, args);
  }
  if (name === "True") return true;
  if (name === "False") return false;
  return REVERSE_SYMBOLS[name] ?? REVERSE_HEADS[name] ?? unqualify(name);
}

function parseArgs(closer: string): MathJson[] {
  const args: MathJson[] = [];
  skipWs();
  if (peek() === closer) return args;
  args.push(parseExpr());
  skipWs();
  while (peek() === ",") {
    pos++;
    args.push(parseExpr());
    skipWs();
  }
  return args;
}

const isList = (node: MathJson): node is MathJson[] => Array.isArray(node) && node[0] === "List";
/** A bare identifier or a non-negative integer — what can sit either side of a `_`. */
const isPlain = (node: MathJson): node is string | number =>
  (typeof node === "string" && /^[A-Za-z][A-Za-z0-9]*$/.test(node)) ||
  (typeof node === "number" && Number.isInteger(node) && node >= 0);

/** The structural forms `toWolfram` emits, reversed where the shape is unambiguous.
 *
 * `Log[b, z]` reverses compute-engine's arg-swap back to `["Log", z, b]`; the 1-arg
 * form `Log[x]` is natural log, compute-engine `["Ln", x]`. Not invertible: the 1-arg
 * base-10 `Log(x)` serialises to `Log[10, x]`, which parses back as an explicit base.
 * Likewise `Round[x, step]` reads as a step, not digits; `Union[{…}]` as a Union, not
 * a `Set`; and `Root`, `Square`, `Mode`, `IndexOf`, `DigitSum`, `Degrees` come back as
 * the Wolfram expression they were lowered to. Those directions are lossy by
 * construction and aren't reconstructed. */
function applyHead(name: string, args: MathJson[]): MathJson {
  if (name === "Log" && args.length === 1) return ["Ln", args[0]];
  if (name === "Log" && args.length === 2) return ["Log", args[1], args[0]];
  // Divisible(n, m) is "n is divisible by m"; our Divides(a, b) is "a divides b" —
  // same relation, arguments swapped.
  if (name === "Divisible" && args.length === 2) return ["Divides", args[1], args[0]];
  // Digamma is the 1-arg PolyGamma; the 2-arg form is compute-engine's PolyGamma too.
  if (name === "PolyGamma") return [args.length === 1 ? "Digamma" : "PolyGamma", ...args];
  // Always `_n`, so compute-engine's bare `_` comes back as `_1`.
  if (name === "Slot" && args.length === 1 && typeof args[0] === "number") return `_${args[0]}`;
  if (name === "Subscript" && args.length === 2 && isPlain(args[0]) && isPlain(args[1])) {
    return `${args[0]}_${args[1]}`;
  }
  if (name === "Clip") {
    const range = args[1];
    return args.length === 2 && isList(range) && range.length === 3
      ? ["Clamp", args[0], range[1], range[2]]
      : ["Clamp", ...args];
  }
  if (name === "Total" && args.length === 1) return ["Sum", args[0]];
  // Array[f, n] is our Tabulate(f, n); Array[f, {n1, n2, ...}] spreads the dims into
  // separate Tabulate args (see the Tabulate case in SPECIAL).
  if (name === "Array" && args.length === 2) {
    const dims = args[1];
    return isList(dims) ? ["Tabulate", args[0], ...dims.slice(1)] : ["Tabulate", ...args];
  }
  // FoldList[f, list] (no seed) is our Scan(list, f) reordered; the seeded
  // FoldList[f, x, list] is length+1 and has no Scan equivalent, so it's left unmapped.
  if (name === "FoldList" && args.length === 2) return ["Scan", args[1], args[0]];
  // Accumulate[list] = FoldList[Plus, list] — our Scan(list, Add).
  if (name === "Accumulate" && args.length === 1) return ["Scan", args[0], "Add"];
  // An iterator `{k, a, b}` is a Tuple on the compute-engine side, not a List.
  if ((name === "Sum" || name === "Product") && args.length >= 2) {
    return [
      name,
      args[0],
      ...args.slice(1).map((it) => (isList(it) ? ["Tuple", ...it.slice(1)] : it)),
    ];
  }
  if (name === "Apply" && args.length === 2 && args[0] === "Multiply") return ["Product", args[1]];
  // `FullForm` spells the infinities as `DirectedInfinity[±1]` and `DirectedInfinity[]`.
  if (name === "DirectedInfinity") {
    if (args.length === 0) return "ComplexInfinity";
    if (args[0] === 1) return "PositiveInfinity";
    if (args[0] === -1) return "NegativeInfinity";
  }
  return [REVERSE_HEADS[name] ?? unqualify(name), ...args];
}

function peek(): string {
  return src[pos] ?? "";
}

function skipWs(): void {
  while (/\s/.test(src[pos] ?? "")) pos++;
}

function expect(ch: string): void {
  if (src[pos] !== ch) {
    throw new Error(
      `fromWolfram: expected "${ch}" at ${pos}, got ${JSON.stringify(src.slice(pos, pos + 10))}`,
    );
  }
  pos++;
}
